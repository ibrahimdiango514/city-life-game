import { describe, it, expect } from 'vitest'
import {
  generateBuildings,
  buildingAABB,
  ANCHOR_BUILDINGS,
  INTERACTABLES,
  NPC_SPAWNS,
  REGION_BOUNDS,
  ROAD_CENTERS,
  ROAD_WIDTH,
  SIDEWALK_WIDTH,
  SIDEWALK_LINES,
  WORLD_HALF,
  PARK_RECT,
  groundHeightAt,
} from '../src/world/cityData'

const CORRIDOR = ROAD_WIDTH / 2 + SIDEWALK_WIDTH // route + trottoirs de chaque côté

function aabbOverlap(a: ReturnType<typeof buildingAABB>, b: ReturnType<typeof buildingAABB>): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ
}

describe('generateBuildings', () => {
  const buildings = generateBuildings()

  it('est déterministe (même ville à chaque appel)', () => {
    const again = generateBuildings()
    expect(again).toEqual(buildings)
  })

  it('inclut les bâtiments ancres', () => {
    const ids = new Set(buildings.map((b) => b.id))
    for (const anchor of ANCHOR_BUILDINGS) expect(ids.has(anchor.id)).toBe(true)
  })

  it('produit une ville dense mais pas vide', () => {
    expect(buildings.length).toBeGreaterThanOrEqual(20)
  })

  it('aucun bâtiment n’empiète sur route ou trottoir', () => {
    // Une chaussée + trottoirs = une bande de 20 m de large sur tout l'axe.
    for (const b of buildings) {
      const box = buildingAABB(b)
      for (const c of ROAD_CENTERS) {
        expect(
          box.minX < c + CORRIDOR && box.maxX > c - CORRIDOR,
          `bâtiment ${b.id} sur la bande x=${c}`
        ).toBe(false)
        expect(
          box.minZ < c + CORRIDOR && box.maxZ > c - CORRIDOR,
          `bâtiment ${b.id} sur la bande z=${c}`
        ).toBe(false)
      }
    }
  })

  it('tous les bâtiments sont dans les limites du monde', () => {
    for (const b of buildings) {
      const box = buildingAABB(b)
      expect(box.minX).toBeGreaterThanOrEqual(-WORLD_HALF)
      expect(box.maxX).toBeLessThanOrEqual(WORLD_HALF)
      expect(box.minZ).toBeGreaterThanOrEqual(-WORLD_HALF)
      expect(box.maxZ).toBeLessThanOrEqual(WORLD_HALF)
    }
  })

  it('deux bâtiments ne se chevauchent pas', () => {
    const boxes = buildings.map(buildingAABB)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(aabbOverlap(boxes[i], boxes[j])).toBe(false)
      }
    }
  })
})

describe('interactables', () => {
  const buildings = generateBuildings().map(buildingAABB)

  it('sont positionnés dans le monde et hors des bâtiments', () => {
    for (const item of INTERACTABLES) {
      expect(Math.abs(item.x)).toBeLessThan(WORLD_HALF)
      expect(Math.abs(item.z)).toBeLessThan(WORLD_HALF)
      for (const box of buildings) {
        const inside = item.x > box.minX && item.x < box.maxX && item.z > box.minZ && item.z < box.maxZ
        expect(inside).toBe(false)
      }
    }
  })

  it('ont des rayons d’interaction positifs et des identifiants uniques', () => {
    const ids = new Set<string>()
    for (const item of INTERACTABLES) {
      expect(item.radius).toBeGreaterThan(0)
      expect(ids.has(item.id)).toBe(false)
      ids.add(item.id)
    }
  })
})

describe('NPC_SPAWNS', () => {
  it('ne comporte que des adultes (18+) — relations réservées aux adultes', () => {
    for (const npc of NPC_SPAWNS) expect(npc.age).toBeGreaterThanOrEqual(18)
  })

  it('identifiants uniques', () => {
    const ids = new Set(NPC_SPAWNS.map((n) => n.id))
    expect(ids.size).toBe(NPC_SPAWNS.length)
  })

  it('génèrent les PNJ sur des axes de trottoir existants', () => {
    for (const npc of NPC_SPAWNS) {
      expect(SIDEWALK_LINES).toContain(npc.line as (typeof SIDEWALK_LINES)[number])
    }
  })
})

describe('layout de base', () => {
  it('le parc ne chevauche aucune route', () => {
    for (const c of ROAD_CENTERS) {
      const overlapX = PARK_RECT.minX < c + CORRIDOR && PARK_RECT.maxX > c - CORRIDOR
      const overlapZ = PARK_RECT.minZ < c + CORRIDOR && PARK_RECT.maxZ > c - CORRIDOR
      expect(!(overlapX && overlapZ)).toBe(true)
    }
  })

  it('les régions couvrent la carte sans trou central', () => {
    expect(REGION_BOUNDS.length).toBe(4)
  })
})

describe('groundHeightAt', () => {
  it('relève trottoirs et coins de rue, pas les chaussées', () => {
    expect(groundHeightAt(8, 30)).toBeCloseTo(0.16, 5)   // trottoir vertical, hors intersection
    expect(groundHeightAt(30, 8)).toBeCloseTo(0.152, 5)  // trottoir horizontal, hors intersection
    expect(groundHeightAt(9, 9)).toBeCloseTo(0.158, 5)   // plaque de coin
    expect(groundHeightAt(8, 0)).toBe(0)                 // coupure de trottoir à l'intersection
    expect(groundHeightAt(0, 0)).toBe(0)                 // chaussée
    expect(groundHeightAt(3, 3)).toBe(0)                 // chaussée
  })
})
