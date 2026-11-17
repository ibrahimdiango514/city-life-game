/**
 * Player.ts — Personnage jouable : déplacement caméra-relatif (marche/course),
 * collisions monde, orientation amortie, animation du rig.
 */
import * as THREE from 'three'
import { animateHumanoid, type HumanoidRig } from './humanoid'
import { clampToWorld, resolveCircleVsAABB, type AABB } from '../core/collision'
import { clamp, damp, dampAngle } from '../core/mathUtils'
import { WORLD_HALF, groundHeightAt } from '../world/cityData'
import type { Input } from '../systems/Input'

const WALK_SPEED = 3.15
const RUN_SPEED = 5.5
const PLAYER_RADIUS = 0.38

export class Player {
  readonly rig: HumanoidRig
  readonly group: THREE.Group
  private speed = 0
  private facing: number
  private moveAmount = 0

  constructor(rig: HumanoidRig, spawn: { x: number; z: number; yaw: number }) {
    this.rig = rig
    this.group = rig.group
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

  update(dt: number, time: number, input: Input, cameraForward: { x: number; z: number }, colliders: AABB[]): void {
    const fAxis = input.axisForward()
    const rAxis = input.axisRight()

    // Droit = avant tourné de -90° sur le plan XZ.
    const rx = -cameraForward.z
    const rz = cameraForward.x

    let dx = cameraForward.x * fAxis + rx * rAxis
    let dz = cameraForward.z * fAxis + rz * rAxis
    const len = Math.hypot(dx, dz)
    const moving = len > 0.001
    if (moving) {
      dx /= len
      dz /= len
    }

    const runBlendTarget = moving && input.isRunDown() ? 1 : 0
    const targetSpeed = moving ? (runBlendTarget === 1 ? RUN_SPEED : WALK_SPEED) : 0
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
    const clamped = clampToWorld({ x: nx, z: nz }, WORLD_HALF, PLAYER_RADIUS)
    this.group.position.set(clamped.x, groundHeightAt(clamped.x, clamped.z), clamped.z)

    const runBlend = this.speed > 0.1 ? clamp((this.speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1) : 0
    this.moveAmount = damp(this.moveAmount, moving ? 1 : 0, 8, dt)

    animateHumanoid(this.rig, {
      speed: this.speed,
      dt,
      moving: this.moveAmount > 0.12 ? 1 : 0,
      runBlend,
      time,
    })
  }
}
