/** Utilitaires mathématiques purs — testables sans DOM. */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Interpolation exponentielle amortie (frame-rate indépendante). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt)
}

/** Interpolation angulaire amortie par le plus court chemin (radians). */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = (target - current) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return current + delta * (1 - Math.exp(-lambda * dt))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
