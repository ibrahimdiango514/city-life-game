/**
 * Game.ts — Orchestration de la vertical slice CITY LIFE GAME :
 * monde 3D (ville + intérieur jouable du Fleuve), personnages humains glTF,
 * simulation de vie (faim/énergie/calories/poids), économie FCFA, dialogues
 * (IA en option, moteur local sinon), sauvegarde locale versionnée.
 */
import * as THREE from 'three'
import { GameClock } from './core/gameClock'
import { resolveCircleVsCircle } from './core/collision'
import { buildCity } from './world/cityBuilder'
import { buildRestaurant, RESTAURANT_ORIGIN, type BuiltRestaurant, type RestaurantTable } from './world/restaurant'
import { INTERACTABLES, NPC_SPAWNS, PARK_RECT, PLAYER_SPAWN } from './world/cityData'
import { loadRiggedAssets } from './entities/RiggedCharacter'
import { Player } from './entities/Player'
import { NPC, npcRigKind } from './entities/NPC'
import { Input } from './systems/Input'
import { CameraRig } from './systems/CameraRig'
import { findPromptTarget } from './systems/InteractionSystem'
import { HUD } from './ui/hud'
import { DialoguePanel } from './ui/DialoguePanel'
import { RestaurantMenuPanel } from './ui/RestaurantMenuPanel'
import { checkSupabaseConnection } from './net/supabase'
import { getNpcReply } from './net/dialogueClient'
import { BASE_STATS, applyMeal, tickTime, formatMoney, type SimStats } from './core/simulation'
import { parseSave, serializeSave, SAVE_KEY, SAVE_VERSION, type SaveData, type ContactEntry } from './core/saveGame'
import { generateMalianPhone, type DialogueNpc, type DialogueTurn } from './core/dialogueEngine'
import { ADAMA, ROLE_LABELS, dialogueNpcFor } from './data/npcProfiles'
import { findMenuItem, orderTotal } from './data/menu'

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

/** Silhouette déterministe pour varier les PNJ (teinte légère des matériaux). */
function shadeFromId(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000 * 0.12 - 0.06
}

const CITY_DOOR_EXIT = { x: -20, z: -9.1, yaw: 0 } as const

type PanelKind = 'dialogue' | 'menu' | null
type GameMode = 'city' | 'restaurant'
interface PendingBill {
  itemIds: string[]
  total: number
  eaten: boolean
}

export class Game {
  private readonly container: HTMLElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly sun: THREE.DirectionalLight
  private readonly input: Input
  private readonly cameraRig: CameraRig
  private readonly hud: HUD
  private readonly dialoguePanel: DialoguePanel
  private readonly menuPanel: RestaurantMenuPanel
  private readonly gameClock = new GameClock(1, 8 * 60, 2)
  private readonly frameClock = new THREE.Clock()

  private ready = false
  private mode: GameMode = 'city'
  private player!: Player
  private npcs: NPC[] = []
  private restaurant: BuiltRestaurant | null = null
  private adamaTurn: import('./entities/RiggedCharacter').RiggedCharacter | null = null
  private cityColliders: ReturnType<typeof buildCity>['colliders'] = []

  private stats: SimStats = { ...BASE_STATS }
  private readonly affinity = new Map<string, number>()
  private contacts: ContactEntry[] = []
  private readonly conversations = new Map<string, DialogueTurn[]>()

  private ui: PanelKind = null
  private seatedTable: RestaurantTable | null = null
  private currentBill: PendingBill | null = null
  private dialogueTargetId: string | null = null

  private elapsed = 0
  private hasPlayedOnce = false
  private lastLocation = ''
  private lastClockMinutesTotal = 0
  private hudTimer = 0
  private saveTimer = 0
  private lastCityPos: { x: number; z: number } = { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z }

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

    // ---------- Monde extérieur ----------
    const city = buildCity()
    this.scene.add(city.group)
    this.cityColliders = city.colliders

    // ---------- HUD ----------
    this.hud = new HUD(container)
    this.hud.setOverlay('start')
    this.hud.setLoading(true)
    this.hud.onPlayRequested = () => {
      if (!this.ready) return
      canvas.requestPointerLock()
    }

    // ---------- Panneaux ----------
    this.dialoguePanel = new DialoguePanel(container)
    this.dialoguePanel.onSend = (text) => {
      void this.handleDialogueSend(text)
    }
    this.dialoguePanel.onClose = () => {
      this.closePanel()
    }

    this.menuPanel = new RestaurantMenuPanel(container)
    this.menuPanel.onOrder = (itemIds) => this.handleOrder(itemIds)
    this.menuPanel.onEat = () => this.handleEat()
    this.menuPanel.onPay = () => this.handlePay()
    this.menuPanel.onClose = () => {
      this.closePanel()
    }

    // ---------- Entrées ----------
    this.input = new Input(canvas)
    this.cameraRig = new CameraRig(this.camera, PLAYER_SPAWN.yaw - Math.PI + 0.35)

    // ---------- Pointer lock → menu/pause ----------
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas
      if (locked) {
        this.hasPlayedOnce = true
        this.hud.setOverlay('hidden')
      } else if (!this.ui) {
        this.hud.setOverlay(this.ready ? (this.hasPlayedOnce ? 'paused' : 'start') : 'start')
      }
    })
    // Échap (ou toute perte de focus) ferme aussi notre panneau propriétaire.
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && this.ui) {
        if (this.ui === 'dialogue') this.dialoguePanel.close()
        else this.menuPanel.close()
      }
    })
    window.addEventListener('beforeunload', () => this.saveNow())

    // ---------- Redimensionnement ----------
    window.addEventListener('resize', () => this.onResize())

    // ---------- Supabase (sonde honnête, jamais bloquante) ----------
    void checkSupabaseConnection().then(({ status, detail }) => {
      this.hud.setSupabase(status, detail)
    })

    this.hud.setClock(this.gameClock.label())
    this.hud.setLocation(describeLocation(PLAYER_SPAWN.x, PLAYER_SPAWN.z))

    // ---------- Chargement des personnages glTF ----------
    void this.initWorld()
  }

  private async initWorld(): Promise<void> {
    try {
      const assets = await loadRiggedAssets(import.meta.env.BASE_URL)

      // --- PNJ de la ville ---
      this.npcs = NPC_SPAWNS.map((spec) => {
        const rig = assets.spawn(npcRigKind(spec.gender), {
          height: spec.height,
          shade: shadeFromId(spec.id),
        })
        return new NPC(spec, rig)
      })
      for (const npc of this.npcs) this.scene.add(npc.group)

      // --- Intérieur du restaurant (construit mais hors de vue — x,z=1000) ---
      this.restaurant = buildRestaurant()
      this.scene.add(this.restaurant.group)

      // --- Adama, le serveur (PNJ client) ---
      const adamaRig = assets.spawn('male', { height: 1.78, shade: -0.04 })
      adamaRig.group.position.set(this.restaurant.waiter.x, 0, this.restaurant.waiter.z)
      adamaRig.group.rotation.y = this.restaurant.waiter.yaw
      this.scene.add(adamaRig.group)
      this.adamaTurn = adamaRig

      // --- Joueur (avatar Ready Player Me réaliste) ---
      const saved = this.loadSave()
      const spawn: { x: number; z: number; yaw: number } = saved?.position ?? { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, yaw: PLAYER_SPAWN.yaw }
      const playerRig = assets.spawn('player', { height: 1.78 })
      this.player = new Player(playerRig, { x: spawn.x, z: spawn.z, yaw: saved?.position.yaw ?? PLAYER_SPAWN.yaw })
      this.player.interiorBounds = null
      this.scene.add(this.player.group)
      this.lastCityPos = { x: spawn.x, z: spawn.z }

      // --- État de la partie ---
      if (saved) {
        this.stats = { ...saved.stats }
        this.gameClock.day = saved.clock.day
        this.gameClock.minutes = saved.clock.minutes
        this.affinity.clear()
        for (const [k, v] of Object.entries(saved.affinity)) this.affinity.set(k, v)
        this.contacts = [...saved.contacts]
        this.hud.setSaveState('loaded')
      } else {
        this.stats = { ...BASE_STATS }
        this.hud.setSaveState('saved')
      }
      this.player.character.applyBodyMorph(this.stats.weightKg, this.stats.muscleKg)
      this.refreshLifeHud()
      this.lastClockMinutesTotal = this.gameClock.day * 24 * 60 + this.gameClock.minutes

      this.ready = true
      this.hud.setLoading(false)
      this.hud.setClock(this.gameClock.label())
      if (!saved) {
        this.hud.showToast('Bienvenue à Bamako ! Le Fleuve t’attend près du Boulevard.', 6500)
      }
    } catch (error) {
      console.error('[CITY LIFE GAME] Échec du chargement des personnages 3D :', error)
      this.hud.showToast('Impossible de charger les personnages 3D (voir console).', 9000)
    }
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

  // ================= Sauvegarde =================

  private loadSave(): SaveData | null {
    try {
      return parseSave(window.localStorage.getItem(SAVE_KEY))
    } catch {
      return null
    }
  }

  private saveNow(): void {
    if (!this.ready) return
    try {
      const pos = this.mode === 'city' ? this.player.getPosition2D() : this.lastCityPos
      const data: SaveData = {
        version: SAVE_VERSION,
        stats: { ...this.stats },
        position: { x: pos.x, z: pos.z, yaw: this.player.getYaw() },
        clock: { day: this.gameClock.day, minutes: Math.floor(this.gameClock.minutes) },
        affinity: Object.fromEntries(this.affinity),
        contacts: [...this.contacts],
        savedAt: Date.now(),
      }
      window.localStorage.setItem(SAVE_KEY, serializeSave(data))
      this.hud.setSaveState('saving')
      window.setTimeout(() => this.hud.setSaveState('saved'), 650)
    } catch {
      this.hud.setSaveState('unavailable')
    }
  }

  private refreshLifeHud(): void {
    this.hud.setMoney(formatMoney(this.stats.cash))
    this.hud.setHunger(this.stats.hunger)
    this.hud.setEnergy(this.stats.energy)
  }

  // ================= Mode ville / restaurant =================

  private enterRestaurant(): void {
    if (!this.restaurant || !this.ready) return
    this.mode = 'restaurant'
    this.lastCityPos = this.player.getPosition2D()
    const entry = this.restaurant.entrance
    this.player.interiorBounds = {
      minX: RESTAURANT_ORIGIN.x - 5.1,
      maxX: RESTAURANT_ORIGIN.x + 5.1,
      minZ: RESTAURANT_ORIGIN.z - 3.55,
      maxZ: RESTAURANT_ORIGIN.z + 3.55,
    }
    this.player.setPosition3D(entry.x, entry.y, entry.z)
    this.player.setYaw(entry.yaw)
    this.cameraRig.snap()
    this.hud.setLocation('Restaurant « Le Fleuve »')
    this.hud.showToast('Bienvenue au Fleuve ! Installe-toi (E sur une table).')
    this.saveNow()
  }

  private exitRestaurant(): void {
    if (this.currentBill) {
      this.hud.showToast('On ne sort pas sans régler l’addition !')
      return
    }
    this.mode = 'city'
    this.player.interiorBounds = null
    this.player.setSeated(false)
    this.seatedTable = null
    this.player.setPosition3D(CITY_DOOR_EXIT.x, 0, CITY_DOOR_EXIT.z)
    this.player.setYaw(CITY_DOOR_EXIT.yaw)
    this.cameraRig.snap()
    this.hud.setLocation(describeLocation(CITY_DOOR_EXIT.x, CITY_DOOR_EXIT.z))
    this.hud.showToast('Tu ressors du Fleuve. Bonne journée !')
    this.saveNow()
  }

  private seatAt(table: RestaurantTable): void {
    this.seatedTable = table
    this.player.setSeated(true)
    this.player.setPosition3D(table.seat.x, 0, table.seat.z)
    this.player.setYaw(table.seat.yaw)
    this.hud.showToast(`Tu t’assois — ${table.label}. (E pour te lever, une fois l’addition réglée)`)
  }

  private standUp(): void {
    if (this.currentBill) {
      this.hud.showToast('Règle d’abord l’addition (bouton « Payer » dans la carte).')
      return
    }
    this.seatedTable = null
    this.player.setSeated(false)
    this.hud.showToast('Tu te lèves de la table.')
  }

  private openMenu(): void {
    if (!this.seatedTable) {
      this.hud.showToast('Assieds-toi d’abord (E sur une table).')
      return
    }
    this.ui = 'menu'
    this.player.movementLocked = true
    if (this.currentBill) {
      this.menuPanel.showBill(this.currentBill.itemIds, this.currentBill.total)
    }
    this.menuPanel.openPanel()
    document.exitPointerLock()
  }

  // ================= Restaurant : commande, repas, addition =================

  private handleOrder(itemIds: string[]): void {
    if (this.currentBill) {
      this.hud.showToast('Adama a déjà ta commande en cuisine.')
      return
    }
    const total = orderTotal(itemIds)
    if (this.stats.cash < total) {
      this.hud.showToast(`Pas assez d’argent — addition ${formatMoney(total)}, tu as ${formatMoney(this.stats.cash)}.`)
      return
    }
    this.currentBill = { itemIds: [...itemIds], total, eaten: false }
    if (this.seatedTable) this.spawnPlates(this.seatedTable, itemIds)
    this.menuPanel.showBill(itemIds, total)
    this.hud.showToast('🍽️ Adama apporte ta commande…')
  }

  private handleEat(): void {
    if (!this.currentBill) return
    if (this.currentBill.eaten) {
      this.hud.showToast('Tu as déjà dégusté ce repas.')
      return
    }
    let calories = 0
    for (const id of this.currentBill.itemIds) {
      const item = findMenuItem(id)
      if (!item) continue
      calories += item.calories
      this.stats = applyMeal(this.stats, item)
    }
    this.currentBill.eaten = true
    this.player.character.applyBodyMorph(this.stats.weightKg, this.stats.muscleKg)
    this.refreshLifeHud()
    this.hud.showToast(`😋 Un régal — +${calories} kcal.`)
  }

  private handlePay(): void {
    if (!this.currentBill) return
    const { total } = this.currentBill
    if (this.stats.cash < total) {
      this.hud.showToast(`Pas assez d’argent. Il manque ${formatMoney(total - this.stats.cash)}.`)
      return
    }
    this.stats = { ...this.stats, cash: this.stats.cash - total }
    this.clearPlates()
    this.currentBill = null
    this.menuPanel.resetToCarte()
    this.refreshLifeHud()
    this.hud.showToast(`💵 Addition payée : ${formatMoney(total)} — merci et à bientôt !`)
    this.menuPanel.close()
    this.saveNow()
  }

  private spawnPlates(table: RestaurantTable, itemIds: string[]): void {
    let slot = 0
    for (const id of itemIds) {
      const item = findMenuItem(id)
      if (!item) continue
      const plate = new THREE.Group()
      const dish = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.13, 0.028, 18),
        new THREE.MeshStandardMaterial({ color: '#f2ede2', roughness: 0.35 })
      )
      dish.position.y = 0.015
      plate.add(dish)
      const foodColor =
        id === 'thieboudienne' ? '#e0b64a'
        : id === 'maffe' ? '#8a5a2a'
        : id === 'yassa' ? '#e8d06a'
        : id === 'poulet-bicyclette' ? '#b96a35'
        : id === 'gingembre' ? '#c96a1e'
        : '#bcd8e8'
      if (id === 'eau' || id === 'gingembre') {
        const glass = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.045, 0.14, 12),
          new THREE.MeshStandardMaterial({ color: foodColor, roughness: 0.15, transparent: true, opacity: 0.85 })
        )
        glass.position.y = 0.1
        plate.add(glass)
      } else {
        const mound = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 12, 9),
          new THREE.MeshStandardMaterial({ color: foodColor, roughness: 0.75 })
        )
        mound.scale.y = 0.55
        mound.position.y = 0.045
        plate.add(mound)
      }
      const col = slot % 3
      const row = Math.floor(slot / 3)
      plate.position.set(-0.3 + col * 0.3, 0, -0.22 + row * 0.34)
      table.plateAnchor.add(plate)
      slot += 1
    }
    table.plateAnchor.visible = true
  }

  private clearPlates(): void {
    if (!this.restaurant) return
    for (const table of this.restaurant.tables) {
      table.plateAnchor.clear()
      table.plateAnchor.visible = false
    }
  }

  // ================= Dialogue =================

  private affinityOf(id: string): number {
    return this.affinity.get(id) ?? 0
  }

  private conversationOf(id: string): DialogueTurn[] {
    let convo = this.conversations.get(id)
    if (!convo) {
      convo = []
      this.conversations.set(id, convo)
    }
    return convo
  }

  private roleLabelFor(id: string, npc: DialogueNpc): string {
    if (id === ADAMA.id) return 'serveur au Fleuve'
    return ROLE_LABELS[npc.role] ?? 'habitant(e)'
  }

  private openDialogue(npcId: string): void {
    const npc = npcId === ADAMA.id ? ADAMA : dialogueNpcFor(npcId)
    if (!npc) return
    this.ui = 'dialogue'
    this.dialogueTargetId = npcId
    this.player.movementLocked = true
    const history = this.conversationOf(npcId)
    this.dialoguePanel.openWith(
      { id: npc.id, fullName: `${npc.firstName} ${npc.lastName}`, age: npc.age, roleLabel: this.roleLabelFor(npcId, npc) },
      this.affinityOf(npcId),
      history
    )
    if (history.length === 0) {
      const opener =
        npcId === ADAMA.id
          ? 'Bienvenue au Fleuve ! Installe-toi — je t’apporte la carte dans un instant. Enfin… tout de suite, en fait.'
          : this.affinityOf(npcId) >= 25
            ? `Tiens, ${npc.firstName} ! Ça faisait un moment. Tu vas bien ?`
            : 'Bonjour.'
      this.pushNpcLine(npcId, opener)
    }
    document.exitPointerLock()
  }

  private pushNpcLine(npcId: string, text: string): void {
    const convo = this.conversationOf(npcId)
    convo.push({ role: 'npc', text })
    if (this.dialoguePanel.isOpen()) {
      this.dialoguePanel.appendBubble('npc', text)
    }
  }

  private async handleDialogueSend(text: string): Promise<void> {
    const npcId = this.dialogueTargetId
    if (!npcId) return
    const npc = npcId === ADAMA.id ? ADAMA : dialogueNpcFor(npcId)
    if (!npc) return

    const convo = this.conversationOf(npcId)
    const playerLine: DialogueTurn = { role: 'player', text }
    convo.push(playerLine)
    this.dialoguePanel.appendBubble('player', text)
    this.dialoguePanel.setThinking(true)

    const ctx = {
      npc,
      affinity: this.affinityOf(npcId),
      history: convo.slice(-12),
      day: this.gameClock.day,
    }
    try {
      const { reply } = await getNpcReply(ctx, text)
      if (!this.dialoguePanel.isOpen() || this.dialogueTargetId !== npcId) return

      const next = Math.max(-100, Math.min(100, this.affinityOf(npcId) + reply.affinityDelta))
      this.affinity.set(npcId, next)
      convo.push({ role: 'npc', text: reply.text })
      this.dialoguePanel.appendBubble('npc', reply.text)
      this.dialoguePanel.renderAffinity(next)

      if (reply.givesPhone && !this.contacts.some((c) => c.npcId === npcId)) {
        const phone = generateMalianPhone(npcId)
        this.contacts.push({ npcId, name: `${npc.firstName} ${npc.lastName}`, phone })
        this.hud.showToast(`📞 ${npc.firstName} ajouté(e) à tes contacts : ${phone}`, 6000)
      }
      if (reply.acceptedInvite === true) {
        this.hud.showToast(`🍽️ ${npc.firstName} accepte de venir au Fleuve.`, 5500)
      }
      this.saveNow()
    } finally {
      this.dialoguePanel.setThinking(false)
    }
  }

  private closePanel(): void {
    this.ui = null
    this.dialogueTargetId = null
    this.player.movementLocked = false
    // Re-verrouille le pointeur ; si le navigateur refuse, le joueur cliquera.
    const canvas = this.renderer.domElement
    try {
      canvas.requestPointerLock()
    } catch {
      // L'utilisateur recliquera sur « Reprendre la partie ».
    }
    window.setTimeout(() => {
      if (document.pointerLockElement !== canvas) {
        this.hud.setOverlay('paused')
      }
    }, 450)
  }

  // ================= Interactions contextuelles =================

  private resolvePromptTarget() {
    const pp = this.player.getPosition2D()
    if (this.mode === 'restaurant' && this.restaurant) {
      const tableItems = this.restaurant.tables.map((table) => ({
        id: table.id,
        type: 'other' as const,
        label: this.seatedTable === table ? `Se lever (${table.label})` : `S’asseoir — ${table.label}`,
        x: table.x,
        z: table.z,
        radius: 1.5,
        message: '',
      }))
      const exit = {
        id: 'exit-restaurant',
        type: 'other' as const,
        label: 'Sortir du restaurant',
        x: this.restaurant.exitZone.x,
        z: this.restaurant.exitZone.z,
        radius: this.restaurant.exitZone.radius,
        message: '',
      }
      const adama = [
        {
          x: this.restaurant.waiter.x,
          z: this.restaurant.waiter.z,
          fullName: 'Adama Coulibaly',
          age: ADAMA.age,
        },
      ]
      return findPromptTarget(pp.x, pp.z, [...tableItems, exit], adama)
    }
    const npcPrompts = this.npcs.map((npc) => ({
      x: npc.group.position.x,
      z: npc.group.position.z,
      fullName: npc.fullName,
      age: npc.spec.age,
    }))
    return findPromptTarget(pp.x, pp.z, INTERACTABLES, npcPrompts)
  }

  private handleInteract(): void {
    const target = this.resolvePromptTarget()
    if (!target) return

    if (this.mode === 'restaurant') {
      if (target.kind === 'npc') {
        this.openDialogue(ADAMA.id)
        return
      }
      if (target.message === '' && target.label === 'Sortir du restaurant') {
        this.exitRestaurant()
        return
      }
      // Table ?
      const pp = this.player.getPosition2D()
      const table = this.restaurant?.tables.find(
        (t) => Math.hypot(pp.x - t.x, pp.z - t.z) <= 1.5
      )
      if (table) {
        if (this.seatedTable === table) {
          this.standUp()
        } else if (!this.seatedTable) {
          this.seatAt(table)
          this.openMenu()
        } else {
          this.hud.showToast('Lève-toi d’abord de ta table.')
        }
      }
      return
    }

    // Mode ville
    if (target.kind === 'npc') {
      const fullName = target.message.replace(/^npc:/, '')
      const npc = this.npcs.find((n) => n.fullName === fullName)
      if (npc) this.openDialogue(npc.spec.id)
      return
    }
    if (target.label.startsWith('Entrer au restaurant')) {
      this.enterRestaurant()
      return
    }
    this.hud.showToast(target.message)
  }

  // ================= Boucle principale =================

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

    if (!this.ready) {
      this.renderer.render(this.scene, this.camera)
      return
    }

    // L'horloge de jeu n'avance que lorsque le joueur joue (pause au menu / panneaux).
    if (locked && !this.ui) this.gameClock.update(dt)

    // Dérive faim/énergie selon le temps de jeu écoulé.
    const totalMinutes = this.gameClock.day * 24 * 60 + this.gameClock.minutes
    const elapsedGameMinutes = totalMinutes - this.lastClockMinutesTotal
    if (elapsedGameMinutes > 0) {
      this.stats = tickTime(this.stats, elapsedGameMinutes)
      this.lastClockMinutesTotal = totalMinutes
    }

    // Joueur (uniquement sous pointer lock, panneaux fermés).
    const look = this.input.consumeLookDelta()
    const wheel = this.input.consumeWheel()
    if (locked && !this.ui) {
      const colliders = this.mode === 'restaurant' && this.restaurant ? this.restaurant.colliders : this.cityColliders
      this.player.update(dt, this.input, this.cameraRig.forwardFlat(), colliders)
    } else {
      // Garde le rig vivant même panneaux ouverts (respiration idle).
      this.player.character.setMovement(0, dt)
      this.player.character.update(dt)
    }

    // Caméra (toujours active ; la souris ne compte que si le jeu est au premier plan).
    this.cameraRig.update(dt, this.player.position, locked && !this.ui ? look : { dx: 0, dy: 0 }, locked && !this.ui ? wheel : 0)

    // PNJ : vivants même dans le menu (ville vivante en toile de fond).
    for (const npc of this.npcs) npc.update(dt)
    if (this.mode === 'city') this.separateNpcs()

    // Adama : fait face au joueur lorsqu'on s'approche.
    if (this.adamaTurn && this.mode === 'restaurant') {
      const wp = this.player.position
      const dx = wp.x - this.adamaTurn.group.position.x
      const dz = wp.z - this.adamaTurn.group.position.z
      if (Math.hypot(dx, dz) < 4.5) {
        const targetYaw = Math.atan2(dx, dz)
        this.adamaTurn.group.rotation.y = targetYaw
      }
      this.adamaTurn.setMovement(0, dt)
      this.adamaTurn.update(dt)
    }

    // Joueur vs PNJ : le joueur contourne (poussée simple) — en ville uniquement.
    if (this.mode === 'city') {
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
    }

    // Prompt contextuel (bâtiment / table / PNJ).
    const target = this.resolvePromptTarget()
    this.hud.setPrompt(this.ui ? null : target ? target.label : null)

    if (locked && !this.ui && this.input.consumeInteract() && target) {
      this.handleInteract()
    }

    // HUD : horloge + lieu courants + stats (throttled 0.5 s).
    this.hud.setClock(this.gameClock.label())
    this.hudTimer += dt
    if (this.hudTimer > 0.5) {
      this.hudTimer = 0
      this.refreshLifeHud()
    }
    if (this.mode === 'city') {
      const pp = this.player.getPosition2D()
      this.lastCityPos = { x: pp.x, z: pp.z }
      const location = describeLocation(pp.x, pp.z)
      if (location !== this.lastLocation) {
        this.lastLocation = location
        this.hud.setLocation(location)
      }
    } else {
      if (this.lastLocation !== 'Restaurant « Le Fleuve »') {
        this.lastLocation = 'Restaurant « Le Fleuve »'
        this.hud.setLocation(this.lastLocation)
      }
    }

    // Sauvegarde périodique (toutes les 45 s de jeu actif).
    this.saveTimer += dt
    if (this.saveTimer > 45) {
      this.saveTimer = 0
      this.saveNow()
    }

    // Le soleil accompagne le joueur (ombres nettes à proximité).
    const pp = this.player.position
    this.sun.position.set(pp.x + 38, 56, pp.z + 27)
    this.sun.target.position.set(pp.x, 0, pp.z)
    this.sun.target.updateMatrixWorld()

    this.renderer.render(this.scene, this.camera)
  }
}
