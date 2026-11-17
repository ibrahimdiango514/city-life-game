/**
 * Game.ts — Orchestration du prototype Étape 1 :
 * renderer, lumières, monde, joueur, PNJ, interactions, HUD, boucle.
 */
import * as THREE from 'three'
import { GameClock } from './core/gameClock'
import { resolveCircleVsCircle } from './core/collision'
import { buildCity } from './world/cityBuilder'
import { INTERACTABLES, NPC_SPAWNS, PARK_RECT, PLAYER_SPAWN } from './world/cityData'
import { createHumanoid } from './entities/humanoid'
import { Player } from './entities/Player'
import { NPC } from './entities/NPC'
import { Input } from './systems/Input'
import { CameraRig } from './systems/CameraRig'
import { findPromptTarget, greetingFor } from './systems/InteractionSystem'
import { HUD } from './ui/hud'
import { checkSupabaseConnection } from './net/supabase'

const ROAD_NAMES: ReadonlyArray<{ axis: 'x' | 'z'; center: number; name: string }> = [
  { axis: 'x', center: -76, name: 'Avenue de l’Indépendance' },
  { axis: 'x', center: 0, name: 'Avenue Principale' },
  { axis: 'x', center: 76, name: 'Boulevard du Mali' },
  { axis: 'z', center: -76, name: 'Boulevard de la Savane' },
  { axis: 'z', center: 0, name: 'Boulevard de la République' },
  { axis: 'z', center: 76, name: 'Boulevard du Fleuve' },
]

function describeLocation(x: number, z: number): string {
  if (x >= PARK_RECT.minX && x <= PARK_RECT.maxX && z >= PARK_RECT.minZ && z <= PARK_RECT.maxZ) {
    return 'Parc de la Liberté'
  }
  for (const road of ROAD_NAMES) {
    const v = road.axis === 'x' ? x : z
    if (Math.abs(v - road.center) <= 6.6) return road.name
  }
  return 'Centre-Ville · Quartier des Commerces'
}

export class Game {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly sun: THREE.DirectionalLight
  private readonly player: Player
  private readonly npcs: NPC[]
  private readonly colliders: ReturnType<typeof buildCity>['colliders']
  private readonly input: Input
  private readonly cameraRig: CameraRig
  private readonly hud: HUD
  private readonly gameClock = new GameClock(1, 8 * 60, 2)
  private readonly frameClock = new THREE.Clock()
  private elapsed = 0
  private hasPlayedOnce = false
  private lastLocation = ''

  constructor(container: HTMLElement) {
    this.container = container

    // ---------- Rendu ----------
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.07
    const canvas = this.renderer.domElement
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.display = 'block'
    canvas.style.outline = 'none'
    canvas.id = 'clg-canvas'
    container.appendChild(canvas)

    // ---------- Scène, brouillard, ciel ----------
    this.scene = new THREE.Scene()
    const skyColor = new THREE.Color('#b7cdd9')
    this.scene.background = skyColor
    this.scene.fog = new THREE.Fog(skyColor, 80, 265)

    this.camera = new THREE.PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.1, 420)
    this.camera.position.set(PLAYER_SPAWN.x + 5, 4.2, PLAYER_SPAWN.z + 6)

    // ---------- Lumières (soleil de fin de matinée, Bamako, saison sèche) ----------
    const hemi = new THREE.HemisphereLight('#cfe2f2', '#5d5544', 1.25)
    this.scene.add(hemi)

    this.sun = new THREE.DirectionalLight('#fff0d4', 2.6)
    this.sun.position.set(38, 56, 27)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.left = -48
    this.sun.shadow.camera.right = 48
    this.sun.shadow.camera.top = 48
    this.sun.shadow.camera.bottom = -48
    this.sun.shadow.camera.near = 2
    this.sun.shadow.camera.far = 150
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.025
    this.sun.shadow.camera.updateProjectionMatrix()
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    // ---------- Monde ----------
    const city = buildCity()
    this.scene.add(city.group)
    this.colliders = city.colliders

    // ---------- Joueur ----------
    const playerRig = createHumanoid({
      height: 1.78,
      skin: '#6f452c',
      shirt: '#d8d3c8',
      pants: '#33404f',
      hair: '#14100d',
      hairStyle: 'short',
      shoes: '#2a251f',
      build: 1.02,
    })
    this.player = new Player(playerRig, { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, yaw: PLAYER_SPAWN.yaw })
    this.scene.add(this.player.group)

    // ---------- PNJ ----------
    this.npcs = NPC_SPAWNS.map((spec) => new NPC(spec))
    for (const npc of this.npcs) this.scene.add(npc.group)

    // ---------- HUD ----------
    this.hud = new HUD(container)
    this.hud.setOverlay('start')
    this.hud.onPlayRequested = () => {
      canvas.requestPointerLock()
    }

    // ---------- Entrées ----------
    this.input = new Input(canvas)
    // Caméra derrière le joueur : le yaw caméra est opposé au yaw du personnage (+ légère inclinaison).
    this.cameraRig = new CameraRig(this.camera, PLAYER_SPAWN.yaw - Math.PI + 0.35)

    // ---------- Pointer lock → menu/pause ----------
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas
      if (locked) {
        this.hasPlayedOnce = true
        this.hud.setOverlay('hidden')
      } else {
        this.hud.setOverlay(this.hasPlayedOnce ? 'paused' : 'start')
      }
    })

    // ---------- Redimensionnement ----------
    window.addEventListener('resize', () => this.onResize())

    // ---------- Supabase (sonde honnête, jamais bloquante) ----------
    void checkSupabaseConnection().then(({ status, detail }) => {
      this.hud.setSupabase(status, detail)
    })

    this.hud.setClock(this.gameClock.label())
    this.hud.setLocation(describeLocation(PLAYER_SPAWN.x, PLAYER_SPAWN.z))
  }

  start(): void {
    this.renderer.setAnimationLoop(this.loop)
  }

  private onResize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  private separateNpcs(): void {
    const minDist = 0.82
    for (let i = 0; i < this.npcs.length; i++) {
      for (let j = i + 1; j < this.npcs.length; j++) {
        const a = this.npcs[i].getPosition2D()
        const b = this.npcs[j].getPosition2D()
        const dx = b.x - a.x
        const dz = b.z - a.z
        const dist = Math.hypot(dx, dz)
        if (dist > 0.0001 && dist < minDist) {
          const push = (minDist - dist) / 2
          const nx = dx / dist
          const nz = dz / dist
          this.npcs[i].setPosition2D(a.x - nx * push, a.z - nz * push)
          this.npcs[j].setPosition2D(b.x + nx * push, b.z + nz * push)
        }
      }
      this.npcs[i].snapToLane()
    }
  }

  private readonly loop = (): void => {
    const dt = Math.min(this.frameClock.getDelta(), 0.05)
    this.elapsed += dt
    const canvas = this.renderer.domElement
    const locked = document.pointerLockElement === canvas

    // L'horloge de jeu n'avance que lorsque le joueur joue (pause au menu).
    if (locked) this.gameClock.update(dt)

    // Joueur (uniquement sous pointer lock).
    const look = this.input.consumeLookDelta()
    const wheel = this.input.consumeWheel()
    if (locked) {
      this.player.update(dt, this.elapsed, this.input, this.cameraRig.forwardFlat(), this.colliders)
    }

    // Caméra (toujours active ; la souris ne compte que si le jeu est au premier plan).
    this.cameraRig.update(dt, this.player.position, locked ? look : { dx: 0, dy: 0 }, locked ? wheel : 0)

    // PNJ : vivants même dans le menu (ville vivante en toile de fond).
    for (const npc of this.npcs) npc.update(dt, this.elapsed)
    this.separateNpcs()

    // Joueur vs PNJ : le joueur contourne (poussée simple).
    const pp = this.player.getPosition2D()
    for (const npc of this.npcs) {
      const np = npc.getPosition2D()
      const resolved = resolveCircleVsCircle(pp, 0.4, np, 0.37)
      if (resolved.x !== pp.x || resolved.z !== pp.z) {
        this.player.setPosition2D(resolved.x, resolved.z)
        pp.x = resolved.x
        pp.z = resolved.z
      }
    }

    // Prompt contextuel (bâtiment / PNJ).
    const npcPrompts = this.npcs.map((npc) => ({
      x: npc.group.position.x,
      z: npc.group.position.z,
      fullName: npc.fullName,
      age: npc.spec.age,
    }))
    const target = findPromptTarget(pp.x, pp.z, INTERACTABLES, npcPrompts)
    this.hud.setPrompt(target ? target.label : null)

    if (locked && this.input.consumeInteract() && target) {
      if (target.kind === 'npc') {
        this.hud.showToast(greetingFor(target.message.replace(/^npc:/, '')))
      } else {
        this.hud.showToast(target.message)
      }
    }

    // HUD : horloge + lieu courants.
    this.hud.setClock(this.gameClock.label())
    const location = describeLocation(pp.x, pp.z)
    if (location !== this.lastLocation) {
      this.lastLocation = location
      this.hud.setLocation(location)
    }

    // Le soleil accompagne le joueur (ombres nettes à proximité).
    this.sun.position.set(pp.x + 38, 56, pp.z + 27)
    this.sun.target.position.set(pp.x, 0, pp.z)
    this.sun.target.updateMatrixWorld()

    this.renderer.render(this.scene, this.camera)
  }
}
