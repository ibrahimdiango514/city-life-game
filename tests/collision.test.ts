import { describe, it, expect } from 'vitest'
import {
  clampToWorld,
  pointInAABB,
  resolveCircleVsAABB,
  resolveCircleVsCircle,
  type AABB,
} from '../src/core/collision'

const box: AABB = { minX: 10, maxX: 20, minZ: -5, maxZ: 5 }

describe('resolveCircleVsAABB', () => {
  it('ne touche pas un cercle déjà hors de la boîte', () => {
    const p = resolveCircleVsAABB({ x: 0, z: 0 }, 1, box)
    expect(p).toEqual({ x: 0, z: 0 })
  })

  it('repousse un cercle côté X', () => {
    const p = resolveCircleVsAABB({ x: 9.4, z: 0 }, 1, box)
    expect(p.x).toBeCloseTo(9, 5)
    expect(p.z).toBe(0)
  })

  it('repousse un cercle côté Z', () => {
    const p = resolveCircleVsAABB({ x: 15, z: 5.4 }, 1, box)
    expect(p.x).toBe(15)
    expect(p.z).toBeCloseTo(6, 5)
  })

  it('repousse depuis un coin (diagonale)', () => {
    const p = resolveCircleVsAABB({ x: 9.3, z: 5.3 }, 1, box)
    const d = Math.hypot(p.x - 10, p.z - 5)
    expect(d).toBeGreaterThanOrEqual(0.99)
  })

  it('expulse un cercle dont le centre est dans la boîte (axe le plus proche)', () => {
    const p = resolveCircleVsAABB({ x: 11, z: 0 }, 0.5, box) // le plus proche : minX (10) → pousse vers -x
    expect(p.x).toBeCloseTo(9.5, 5)
    expect(p.z).toBe(0)
  })

  it('expulse un cercle dont le centre est dans la boîte (autre axe)', () => {
    const p = resolveCircleVsAABB({ x: 15, z: 4.6 }, 0.5, box) // le plus proche : maxZ (5)
    expect(p.z).toBeCloseTo(5.5, 5)
    expect(p.x).toBe(15)
  })
})

describe('resolveCircleVsCircle', () => {
  it('sépare deux cercles qui se chevauchent', () => {
    const p = resolveCircleVsCircle({ x: 0, z: 0 }, 1, { x: 1.2, z: 0 }, 1)
    expect(p.x).toBeCloseTo(-0.8, 5)
  })

  it('laisse deux cercles distants en place', () => {
    const p = resolveCircleVsCircle({ x: 0, z: 0 }, 1, { x: 5, z: 0 }, 1)
    expect(p).toEqual({ x: 0, z: 0 })
  })
})

describe('clampToWorld', () => {
  it('enferme le joueur dans le monde', () => {
    expect(clampToWorld({ x: 500, z: -500 }, 120, 0.4)).toEqual({ x: 119.6, z: -119.6 })
  })
})

describe('pointInAABB', () => {
  it('détecte un point dans la boîte', () => {
    expect(pointInAABB(15, 0, box)).toBe(true)
    expect(pointInAABB(25, 0, box)).toBe(false)
  })
})
