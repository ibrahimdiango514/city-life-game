/**
 * RiggedCharacter.ts — Personnages humains RÉELS (rigs glTF/GLB).
 *
 * Remplace les humanoïdes procéduraux : modèles professionnels chargés via
 * GLTFLoader, Mixamo-compatible, retargetés entre squelettes identiques.
 *
 * Modèles inclus (voir public/assets/ASSETS.md) :
 *  - player  : readyplayer.me.glb (Ready Player Me, humain réaliste, rig Mixamo
 *              sans préfixe — les clips sont reciblés en supprimant « mixamorig: »)
 *  - female  : Michelle.glb (exemple officiel three.js / Mixamo)
 *  - male    : Soldier.glb  (exemple officiel three.js / Mixamo)
 *
 * Les trois squelettes sont des squelettes Mixamo à 65-67 joints : mêmes noms
 * de joints (à un préfixe près), même hiérarchie → les clips Idle/Walk/Run de
 * Soldier s'appliquent partout après renommage.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { clamp, damp } from '../core/mathUtils'

export type RiggedKind = 'player' | 'female' | 'male'

interface SourceRig {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
  /** Hauteur monde du mesh en unités du fichier (minY ≈ 0). */
  height: number
}

export interface RiggedAssets {
  spawn(kind: RiggedKind, opts?: { height?: number; shade?: number }): RiggedCharacter
}

function stripMixamoPrefix(clip: THREE.AnimationClip): THREE.AnimationClip {
  // ⚠ three r150+ sanitize les noms de nœuds dans les tracks (« mixamorig:Hips »
  // devient « mixamorigHips » en mémoire) : on retire donc le préfixe AVEC ou SANS « : ».
  const copy = clip.clone()
  copy.tracks = clip.tracks.map((track) => {
    const t = track.clone()
    t.name = t.name.replace(/^mixamorig[:.]?/, '')
    return t
  })
  return copy
}

/** Normalise un nom de bone : « mixamorig:Hips » → « Hips ». */
function boneKey(name: string): string {
  return name.replace(/^mixamorig:/u, '')
}

export async function loadRiggedAssets(baseUrl: string): Promise<RiggedAssets> {
  const loader = new GLTFLoader()
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const load = (file: string) => loader.loadAsync(`${base}assets/models/characters/${file}`)

  const [soldier, michelle, rpm] = await Promise.all([
    load('Soldier.glb'),
    load('Michelle.glb'),
    load('readyplayer.me.glb'),
  ])

  const soldierClips = {
    idle: soldier.animations.find((a) => a.name === 'Idle') ?? soldier.animations[0],
    walk: soldier.animations.find((a) => a.name === 'Walk') ?? soldier.animations[0],
    run: soldier.animations.find((a) => a.name === 'Run') ?? soldier.animations[0],
  }
  const rpmClips = {
    idle: stripMixamoPrefix(soldierClips.idle),
    walk: stripMixamoPrefix(soldierClips.walk),
    run: stripMixamoPrefix(soldierClips.run),
  }

  const measure = (scene: THREE.Object3D): number => {
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    return Math.max(0.01, box.max.y - box.min.y)
  }

  const sources: Record<RiggedKind, { source: SourceRig; clips: { idle: THREE.AnimationClip; walk: THREE.AnimationClip; run: THREE.AnimationClip } }> = {
    player: {
      source: { scene: rpm.scene, animations: rpm.animations, height: measure(rpm.scene) },
      clips: rpmClips,
    },
    female: {
      source: { scene: michelle.scene, animations: michelle.animations, height: measure(michelle.scene) },
      clips: soldierClips, // mêmes noms de joints mixamorig:*
    },
    male: {
      source: { scene: soldier.scene, animations: soldier.animations, height: measure(soldier.scene) },
      clips: soldierClips,
    },
  }

  return {
    spawn(kind, opts) {
      return new RiggedCharacter(sources[kind], opts)
    },
  }
}

const WALK_REFERENCE_SPEED = 1.45
const RUN_REFERENCE_SPEED = 3.6

export class RiggedCharacter {
  /** Groupe racine à positionner sur le personnage (origine aux pieds). */
  readonly group: THREE.Group
  readonly height: number

  private readonly root: THREE.Object3D
  private readonly mixer: THREE.AnimationMixer
  private readonly idle: THREE.AnimationAction
  private readonly walk: THREE.AnimationAction
  private readonly run: THREE.AnimationAction
  private readonly bones = new Map<string, THREE.Bone>()
  private readonly hipsBaseY: number
  private readonly baseBoneScale = new Map<string, THREE.Vector3>()
  private speedSmoothed = 0
  private idleWeight = 1
  private walkWeight = 0
  private runWeight = 0
  private sitBlend = 0
  private morphWeight = 0
  private morphMuscle = 0

  constructor(
    entry: { source: SourceRig; clips: { idle: THREE.AnimationClip; walk: THREE.AnimationClip; run: THREE.AnimationClip } },
    opts?: { height?: number; shade?: number },
  ) {
    const { source, clips } = entry
    const targetHeight = opts?.height ?? source.height
    const scale = targetHeight / source.height

    this.root = skeletonClone(source.scene)
    this.root.scale.setScalar(scale)

    const shade = clamp(opts?.shade ?? 0, -0.1, 0.1)
    this.root.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh
      if ((mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh || (obj as THREE.Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = false
        // Les meshes skinned ont souvent un boundingSphere statique faux :
        // on évite un culling erroné à l'écran.
        obj.frustumCulled = false
      }
      if (shade !== 0) {
        const m = obj as THREE.Mesh
        if (m.isMesh) {
          const list = Array.isArray(m.material) ? m.material : [m.material]
          const cloned = list.map((mat) => {
            const copy = mat.clone()
            if ('color' in copy && copy.color instanceof THREE.Color) {
              copy.color.offsetHSL(0, 0, shade * 0.6)
            }
            return copy
          })
          m.material = Array.isArray(m.material) ? cloned : cloned[0]
        }
      }
    })

    // Index des bones (sans préfixe).
    this.root.traverse((obj) => {
      const bone = obj as THREE.Bone
      if ((bone as unknown as { isBone?: boolean }).isBone) {
        this.bones.set(boneKey(bone.name), bone)
        this.baseBoneScale.set(boneKey(bone.name), bone.scale.clone())
      }
    })

    this.group = new THREE.Group()
    this.group.name = 'rigged-character'
    this.group.add(this.root)
    this.height = targetHeight

    const hips = this.bones.get('Hips')
    this.hipsBaseY = hips ? hips.position.y : 1

    this.mixer = new THREE.AnimationMixer(this.root)
    this.idle = this.mixer.clipAction(clips.idle)
    this.walk = this.mixer.clipAction(clips.walk)
    this.run = this.mixer.clipAction(clips.run)
    for (const action of [this.idle, this.walk, this.run]) {
      action.enabled = true
      action.setEffectiveWeight(action === this.idle ? 1 : 0)
      action.play()
    }
    this.idle.setEffectiveWeight(1)
    this.walk.setEffectiveWeight(0)
    this.run.setEffectiveWeight(0)
  }

  /** État de déplacement appelé chaque frame (speed en m/s). */
  setMovement(speed: number, dt: number): void {
    this.speedSmoothed = damp(this.speedSmoothed, speed, 8, dt)
    const s = this.speedSmoothed
    const targetIdle = s < 0.22 ? 1 : 0
    const runBlend = clamp((s - 2.9) / 2.6, 0, 1)
    const moveBlend = clamp(s / 1.1, 0, 1)
    const targetWalk = moveBlend * (1 - runBlend)
    const targetRun = moveBlend * runBlend

    this.idleWeight = damp(this.idleWeight, targetIdle, 10, dt)
    this.walkWeight = damp(this.walkWeight, targetWalk, 10, dt)
    this.runWeight = damp(this.runWeight, targetRun, 10, dt)

    this.idle.setEffectiveWeight(this.idleWeight)
    this.walk.setEffectiveWeight(this.walkWeight)
    this.run.setEffectiveWeight(this.runWeight)

    this.walk.timeScale = clamp(s / WALK_REFERENCE_SPEED, 0.6, 2.3)
    this.run.timeScale = clamp(s / RUN_REFERENCE_SPEED, 0.7, 2.1)
  }

  /** Assied / lève le personnage (fondu doux). */
  setSeated(seated: boolean, dt: number): void {
    this.sitBlend = damp(this.sitBlend, seated ? 1 : 0, 10, dt)
  }

  get isSeatedEnough(): boolean {
    return this.sitBlend > 0.6
  }

  /** Morphs corporels : poids (masse), muscle. Appliqué aux bones du torse et des membres. */
  applyBodyMorph(weightKg: number, muscleKg: number): void {
    this.morphWeight = clamp((weightKg - 78) / 45, -0.32, 0.6)
    this.morphMuscle = clamp((muscleKg - 30) / 20, -0.3, 0.8)
    this.applyBoneScales()
  }

  private applyBoneScales(): void {
    const w = this.morphWeight
    const m = this.morphMuscle
    const set = (key: string, kx: number, ky: number, kz: number) => {
      const bone = this.bones.get(key)
      const base = this.baseBoneScale.get(key)
      if (!bone || !base) return
      bone.scale.set(base.x * kx, base.y * ky, base.z * kz)
    }
    // Tourse & bassin : le poids modifie surtout la silhouette (x/z).
    set('Hips', 1 + w * 0.85, 1 + w * 0.3, 1 + w * 0.9)
    set('Spine', 1 + w * 0.8, 1 + w * 0.25, 1 + w * 0.9)
    set('Spine1', 1 + w * 0.8, 1 + w * 0.25, 1 + w * 0.9)
    set('Spine2', 1 + w * 0.65, 1 + w * 0.2, 1 + w * 0.75)
    // Bras : le muscle épaissit épaules/biceps/avant-bras, le poids ajoute un peu.
    const arm = 1 + m * 0.55 + w * 0.22
    set('LeftShoulder', arm, 1, arm)
    set('RightShoulder', arm, 1, arm)
    set('LeftArm', arm, 1, arm)
    set('RightArm', arm, 1, arm)
    set('LeftForeArm', arm, 1, arm)
    set('RightForeArm', arm, 1, arm)
    set('LeftHand', 1 + m * 0.25, 1, 1 + m * 0.25)
    set('RightHand', 1 + m * 0.25, 1, 1 + m * 0.25)
    // Jambes : cuisses + mollets (muscle + poids).
    const thigh = 1 + m * 0.4 + w * 0.5
    set('LeftUpLeg', thigh, 1, thigh)
    set('RightUpLeg', thigh, 1, thigh)
    const calf = 1 + m * 0.45 + w * 0.35
    set('LeftLeg', calf, 1, calf)
    set('RightLeg', calf, 1, calf)
  }

  /** À appeler chaque frame (après setMovement) — mixer + posture assise. */
  update(dt: number): void {
    this.mixer.update(dt)

    if (this.sitBlend > 0.001) {
      const k = this.sitBlend
      const hips = this.bones.get('Hips')
      if (hips) hips.position.y = this.hipsBaseY - 0.46 * k
      const add = (key: string, x: number) => {
        const bone = this.bones.get(key)
        if (bone) bone.rotation.x += x * k
      }
      add('LeftUpLeg', -1.32)
      add('RightUpLeg', -1.32)
      add('LeftLeg', 1.5)
      add('RightLeg', 1.5)
      add('Spine', 0.08)
      add('Spine1', 0.08)
    }
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.root.removeFromParent()
  }
}
