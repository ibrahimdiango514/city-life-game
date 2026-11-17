/**
 * Player.ts — Personnage jouable : déplacement caméra-relatif (marche/course),
 * collisions monde, orientation amortie, animation du rig glTF.
 */
import * as THREE from 'three'
import type { RiggedCharacter } from './RiggedCharacter'
import { clampToWorld, resolveCircleVsAABB, type AABB } from '../core/collision'
import { damp, dampAngle } from '../core/mathUtils'
import { WORLD_HALF, groundHeightAt } from '../world/cityData'
import type { Input } from '../systems/Input'

const WALK_SPEED = 3.15
const RUN_SPEED = 5.5
const PLAYER_RADIUS = 0.38

export class Player {
  readonly character: RiggedCharacter
  readonly group: THREE.Group
  private speed = 0
  private facing: number
  private seated = false
  /** Verrouille le déplacement (ex. panneau dialogue/menu ouvert). */
  movementLocked = false
  /** Limites intérieures (rect du monde) ou null = extérieur. */
  interiorBounds: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null

  constructor(character: RiggedCharacter, spawn: { x: number; z: number; yaw: number }) {
    this.character = character
    this.group = character.group
    this.group.position.set(spawn.x, 0, spawn.z)
    this.facing = spawn.yaw
    this.group.rotation.y = spawn.yaw
  }

  get position(): THREE.Vector3 {
    return this.group.position
  }

  getPosition2D(): { x: number; z: number } {
    return { x: this.group.position.x, z: this.group.position.z }
  }

  setPosition2D(x: number, z: number): void {
    this.group.position.set(x, 0, z)
  }

  setPosition3D(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z)
  }

  setYaw(yaw: number): void {
    this.facing = yaw
    this.group.rotation.y = yaw
  }

  getYaw(): number {
    return this.facing
  }

  setSeated(seated: boolean): void {
    this.seated = seated
  }

  get isSeated(): boolean {
    return this.seated
  }

  update(dt: number, input: Input, cameraForward: { x: number; z: number }, colliders: AABB[]): void {
    let targetSpeed = 0
    let dx = 0
    let dz = 0
    let moving = false

    if (!this.movementLocked && !this.seated) {
      const fAxis = input.axisForward()
      const rAxis = input.axisRight()

      // Droit = avant tourné de -90° sur le plan XZ.
      const rx = -cameraForward.z
      const rz = cameraForward.x

      dx = cameraForward.x * fAxis + rx * rAxis
      dz = cameraForward.z * fAxis + rz * rAxis
      const len = Math.hypot(dx, dz)
      moving = len > 0.001
      if (moving) {
        dx /= len
        dz /= len
      }

      const run = moving && input.isRunDown()
      targetSpeed = moving ? (run ? RUN_SPEED : WALK_SPEED) : 0
    }

    this.speed = damp(this.speed, targetSpeed, 9, dt)

    if (moving && this.speed > 0.4) {
      const targetYaw = Math.atan2(dx, dz)
      this.facing = dampAngle(this.facing, targetYaw, 11, dt)
      this.group.rotation.y = this.facing
    }

    // Intégration + collisions (2 passes pour les coins).
    let nx = this.group.position.x + dx * this.speed * dt
    let nz = this.group.position.z + dz * this.speed * dt
    for (let pass = 0; pass < 2; pass++) {
      for (const box of colliders) {
        const resolved = resolveCircleVsAABB({ x: nx, z: nz }, PLAYER_RADIUS, box)
        nx = resolved.x
        nz = resolved.z
      }
    }
    if (this.interiorBounds) {
      nx = Math.max(this.interiorBounds.minX, Math.min(this.interiorBounds.maxX, nx))
      nz = Math.max(this.interiorBounds.minZ, Math.min(this.interiorBounds.maxZ, nz))
      this.group.position.set(nx, 0, nz)
    } else {
      const clamped = clampToWorld({ x: nx, z: nz }, WORLD_HALF, PLAYER_RADIUS)
      this.group.position.set(clamped.x, groundHeightAt(clamped.x, clamped.z), clamped.z)
    }

    this.character.setMovement(this.seated || this.movementLocked ? 0 : this.speed, dt)
    this.character.setSeated(this.seated, dt)
    this.character.update(dt)
  }
}
