/**
 * CameraRig.ts — Caméra à la troisième personne : orbite souris (pointer lock),
 * zoom molette, suivi amorti du joueur, vue toujours au-dessus du sol.
 */
import * as THREE from 'three'
import { clamp, damp } from '../core/mathUtils'

export class CameraRig {
  yaw: number
  private pitch = 0.34
  private distance = 6.3
  private initialized = false
  private readonly target = new THREE.Vector3()
  private readonly desired = new THREE.Vector3()

  constructor(private readonly camera: THREE.PerspectiveCamera, initialYaw: number) {
    this.yaw = initialYaw
  }

  /** Vecteur avant horizontal projeté de la caméra (pour orienter le déplacement). */
  forwardFlat(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }
  }

  update(dt: number, playerPosition: THREE.Vector3, look: { dx: number; dy: number }, wheelSteps: number): void {
    this.yaw -= look.dx * 0.0022
    this.pitch = clamp(this.pitch + look.dy * 0.0016, 0.08, 1.12)
    this.distance = clamp(this.distance + wheelSteps * 0.7, 3.4, 9.6)

    this.target.set(playerPosition.x, playerPosition.y + 1.42, playerPosition.z)

    const cosP = Math.cos(this.pitch)
    const offsetX = Math.sin(this.yaw) * cosP
    const offsetY = Math.sin(this.pitch)
    const offsetZ = Math.cos(this.yaw) * cosP

    this.desired.set(
      this.target.x + offsetX * this.distance,
      this.target.y + offsetY * this.distance,
      this.target.z + offsetZ * this.distance
    )
    this.desired.y = Math.max(this.desired.y, 0.6)

    if (!this.initialized) {
      this.camera.position.copy(this.desired)
      this.initialized = true
    } else {
      const k = 1 - Math.exp(-11 * dt)
      this.camera.position.lerp(this.desired, k)
      // Amortisseur vertical plus rapide pour éviter de traverser le sol en descente.
      this.camera.position.y = damp(this.camera.position.y, this.desired.y, 14, dt)
    }
    this.camera.lookAt(this.target)
  }
}
