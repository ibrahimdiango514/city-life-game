import { describe, it, expect } from 'vitest'
import { clamp, damp, dampAngle, lerp } from '../src/core/mathUtils'

describe('clamp', () => {
  it('borne les valeurs', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
  })
})

describe('damp / lerp', () => {
  it('lerp interpole linéairement', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
  })
  it('damp converge vers la cible', () => {
    let v = 0
    for (let i = 0; i < 200; i++) v = damp(v, 10, 6, 1 / 60)
    expect(v).toBeGreaterThan(9.9)
  })
})

describe('dampAngle', () => {
  it('emprunte le plus court chemin angulaire', () => {
    // De 0 vers 3π/2 : doit tourner dans le sens négatif (−π/2), pas +3π/2.
    const next = dampAngle(0, (3 * Math.PI) / 2, 10, 0.016)
    expect(next).toBeLessThan(0)
  })
  it('reste stable sur une cible lointaine équivalente', () => {
    const next = dampAngle(0.1, 0.1 + Math.PI * 2, 10, 0.016)
    expect(Math.abs(next - 0.1)).toBeLessThan(0.05)
  })
})
