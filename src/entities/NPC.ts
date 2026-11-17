/**
 * NPC.ts — Habitants du Centre-Ville.
 *
 * Comportement piéton réaliste : déambulation sur les axes de trottoir,
 * pauses aléatoires, demi-tours aux extrémités, virages aux intersections,
 * séparation douce entre piétons. (Le cerveau social complet — routines,
 * travail, vie privée — arrive avec les Étapes 2+ ; ici ils « vivent » en marchant.)
 */
import * as THREE from 'three'
import { animateHumanoid, createHumanoid, type HumanoidRig } from './humanoid'
import { dampAngle, clamp } from '../core/mathUtils'
import { SIDEWALK_LINES, groundHeightAt, type NpcSpawnSpec } from '../world/cityData'

const WALK_BOUNDS = 113

export class NPC {
  readonly spec: NpcSpawnSpec
  readonly rig: HumanoidRig
  readonly group: THREE.Group
  readonly fullName: string
  private axis: 'x' | 'z'
  private line: number
  private targetT: number
  private facing: number
  private speed: number
  private mode: 'walk' | 'pause'
  private pauseTimer = 0
  private timeOffset: number

  constructor(spec: NpcSpawnSpec) {
    this.spec = spec
    this.fullName = `${spec.firstName} ${spec.lastName}`
    this.rig = createHumanoid({
      height: spec.height,
      skin: spec.skin,
      shirt: spec.shirt,
      pants: spec.pants,
      hair: spec.hair,
      hairStyle: spec.hairStyle,
      build: spec.gender === 'male' ? 1.06 + (spec.age % 5) * 0.02 : 0.94,
    })
    this.group = this.rig.group
    this.axis = spec.axis
    this.line = spec.line
    this.timeOffset = Math.random() * 100
    this.speed = 1.05 + Math.random() * 0.45

    const startT = clamp(spec.t, -WALK_BOUNDS, WALK_BOUNDS)
    this.setPositionOnAxis(startT)
    // Cible initiale dans un sens aléatoire.
    const dir = Math.random() < 0.5 ? -1 : 1
    this.targetT = clamp(startT + dir * (18 + Math.random() * 38), -WALK_BOUNDS, WALK_BOUNDS)
    this.facing = this.computeFacing(this.targetT - startT)
    this.group.rotation.y = this.facing
    this.mode = 'walk'
  }

  getPosition2D(): { x: number; z: number } {
    return { x: this.group.position.x, z: this.group.position.z }
  }

  setPosition2D(x: number, z: number): void {
    this.group.position.set(x, 0, z)
  }

  /** Réaligne le PNJ sur son axe de trottoir (après une séparation douce). */
  snapToLane(): void {
    if (this.axis === 'x') this.group.position.z = this.line
    else this.group.position.x = this.line
    this.group.position.y = groundHeightAt(this.group.position.x, this.group.position.z)
  }

  distanceTo(x: number, z: number): number {
    const p = this.group.position
    return Math.hypot(p.x - x, p.z - z)
  }

  private setPositionOnAxis(t: number): void {
    if (this.axis === 'x') this.group.position.set(t, 0, this.line)
    else this.group.position.set(this.line, 0, t)
    this.group.position.y = groundHeightAt(this.group.position.x, this.group.position.z)
  }

  private currentT(): number {
    return this.axis === 'x' ? this.group.position.x : this.group.position.z
  }

  private computeFacing(delta: number): number {
    if (this.axis === 'x') return Math.atan2(Math.sign(delta), 0)
    return Math.atan2(0, Math.sign(delta))
  }

  /** Choisit la prochaine destination : même axe, ou virage à 90° si une intersection est proche. */
  private pickTarget(): void {
    const t = this.currentT()
    // Intersection proche sur l'axe transversal ? (ex. on marche le long de z=8, on passe x=8)
    const nearPerpLine = SIDEWALK_LINES.find((l) => Math.abs(t - l) < 1.6)

    const wantTurn = Math.random() < 0.35 && nearPerpLine !== undefined
    if (wantTurn && nearPerpLine !== undefined) {
      // Vire dans la rue transversale (mutation atomique des deux axes).
      this.axis = this.axis === 'x' ? 'z' : 'x'
      this.line = nearPerpLine
      // Repositionne précisément sur l'intersection.
      const nt = this.axis === 'x' ? this.group.position.x : this.group.position.z
      this.setPositionOnAxis(clamp(nt, -WALK_BOUNDS, WALK_BOUNDS))
      this.targetT = clamp(
        this.currentT() + (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 36),
        -WALK_BOUNDS,
        WALK_BOUNDS
      )
      return
    }

    // Avance sur le même axe.
    this.targetT = clamp(
      t + (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 44),
      -WALK_BOUNDS,
      WALK_BOUNDS
    )
    if (Math.abs(this.targetT - t) < 4) {
      this.targetT = clamp(t + (t > 0 ? -30 : 30), -WALK_BOUNDS, WALK_BOUNDS)
    }
  }

  update(dt: number, time: number): void {
    const t = this.currentT()

    if (this.mode === 'pause') {
      this.pauseTimer -= dt
      animateHumanoid(this.rig, { speed: 0, dt, moving: 0, runBlend: 0, time: time + this.timeOffset })
      if (this.pauseTimer <= 0) {
        this.pickTarget()
        this.mode = 'walk'
      }
      return
    }

    const delta = this.targetT - t
    const dist = Math.abs(delta)
    if (dist < 0.6) {
      this.mode = 'pause'
      this.pauseTimer = 1.6 + Math.random() * 3.6
      animateHumanoid(this.rig, { speed: 0, dt, moving: 0, runBlend: 0, time: time + this.timeOffset })
      return
    }

    const dir = Math.sign(delta)
    const step = Math.min(this.speed * dt, dist)
    this.setPositionOnAxis(t + dir * step)

    const targetYaw = this.computeFacing(delta)
    this.facing = dampAngle(this.facing, targetYaw, 8, dt)
    this.group.rotation.y = this.facing

    animateHumanoid(this.rig, {
      speed: this.speed,
      dt,
      moving: 1,
      runBlend: 0,
      time: time + this.timeOffset,
    })
  }
}
