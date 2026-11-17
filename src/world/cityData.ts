/**
 * cityData.ts — Données de layout du monde (module pur, sans Three.js).
 *
 * Le quartier « Centre-Ville » (Bamako-inspired) est une grille :
 *  - 3 routes Nord-Sud (x = -76, 0, 76) et 3 routes Est-Ouest (z = -76, 0, 76)
 *  - trottoirs de 4 m de part et d'autre de chaque chaussée (12 m)
 *  - 16 îlots bâtissables ; l'îlot Nord-Ouest central est le « Parc de la Liberté »
 *
 * Ces coordonnées sont la source de vérité unique : le moteur 3D, les tests
 * et la migration Supabase (supabase/migrations/…seed_centre_ville…) utilisent
 * les mêmes positions.
 */

export const WORLD_HALF = 120
export const ROAD_CENTERS = [-76, 0, 76] as const
export const ROAD_WIDTH = 12
export const SIDEWALK_WIDTH = 4

/** Demi-coupure des trottoirs aux intersections (moitié de chaussée + marge). */
const INTERSECT_CUT = ROAD_WIDTH / 2 + 0.45
export const SIDEWALK_TOP_VERTICAL = 0.16
export const SIDEWALK_TOP_HORIZONTAL = 0.152
export const SIDEWALK_TOP_CORNER = 0.158

let cachedSpans: ReadonlyArray<readonly [number, number]> | null = null
/** Spans de trottoir = compléments des bandes d'intersection, le long d'un axe. */
export function sidewalkSpans(): ReadonlyArray<readonly [number, number]> {
  if (cachedSpans) return cachedSpans
  const intervals = [...ROAD_CENTERS]
    .map((c) => [c - INTERSECT_CUT, c + INTERSECT_CUT] as const)
    .sort((p, q) => p[0] - q[0])
  const spans: Array<readonly [number, number]> = []
  let cursor = -WORLD_HALF
  for (const [a, b] of intervals) {
    if (a > cursor) spans.push([cursor, a] as const)
    cursor = Math.max(cursor, b)
  }
  if (cursor < WORLD_HALF) spans.push([cursor, WORLD_HALF] as const)
  cachedSpans = spans
  return spans
}

/**
 * Hauteur du sol (y) en un point : trottoirs rehaussés (bordures),
 * plaques de coin aux intersections, 0 ailleurs. Module pur.
 */
export function groundHeightAt(x: number, z: number): number {
  // Plaques de coin des intersections (x ≈ ±8 et z ≈ ±8 autour de chaque croisement).
  for (const cx of ROAD_CENTERS) {
    for (const cz of ROAD_CENTERS) {
      if (Math.abs(Math.abs(x - cx) - 8) <= 2.3 && Math.abs(Math.abs(z - cz) - 8) <= 2.3) {
        return SIDEWALK_TOP_CORNER
      }
    }
  }
  const spans = sidewalkSpans()
  for (const line of SIDEWALK_LINES) {
    if (Math.abs(x - line) <= SIDEWALK_WIDTH / 2) {
      for (const [a, b] of spans) if (z >= a && z <= b) return SIDEWALK_TOP_VERTICAL
    }
    if (Math.abs(z - line) <= SIDEWALK_WIDTH / 2) {
      for (const [a, b] of spans) if (x >= a && x <= b) return SIDEWALK_TOP_HORIZONTAL
    }
  }
  return 0
}

/** Axes des trottoirs (centres des bandes de trottoir). */
export const SIDEWALK_LINES = [-84, -68, -8, 8, 68, 84] as const

/** Îlots : zones bâties entre les trottoirs (mêmes bornes en x et en z). */
export const REGION_BOUNDS: ReadonlyArray<readonly [number, number]> = [
  [-120, -86],
  [-66, -10],
  [10, 66],
  [86, 120],
] as const

/** Parc de la Liberté : îlot x ∈ [-66,-10], z ∈ [10,66]. */
export const PARK_RECT = { minX: -66, maxX: -10, minZ: 10, maxZ: 66 } as const
export const PARK_INTERACTABLE_POS = { x: -38, z: 40 } as const

export type BuildingPalette = 'concrete' | 'sand' | 'brick' | 'terracotta' | 'slate' | 'cream'

export interface BuildingSpec {
  id: string
  /** Centre (x, z). */
  x: number
  z: number
  /** Empreinte au sol (largeur x, profondeur z) et hauteur totale, en mètres. */
  w: number
  d: number
  h: number
  floors: number
  palette: BuildingPalette
  /** Bâtiment ancre (commerce) — porte côté trottoir, RDC commercial. */
  commercial?: boolean
  commercialName?: string
}

/** Bâtiments ancres (commerces / lieux importants) — positions synchronisées avec la migration Supabase. */
export const ANCHOR_BUILDINGS: BuildingSpec[] = [
  { id: 'anchor-superette', x: 22, z: 16.5, w: 16, d: 13, h: 11, floors: 3, palette: 'terracotta', commercial: true, commercialName: 'Supérette « Chez Fatou »' },
  { id: 'anchor-restaurant', x: -20, z: -16.5, w: 16, d: 13, h: 9, floors: 2, palette: 'sand', commercial: true, commercialName: 'Restaurant « Le Fleuve »' },
  { id: 'anchor-gym', x: 34, z: -16.5, w: 14, d: 13, h: 10.5, floors: 3, palette: 'slate', commercial: true, commercialName: 'Salle de sport « Mali Fitness »' },
]

/** RNG déterministe (mulberry32) — même ville à chaque chargement. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function buildingAABB(b: BuildingSpec) {
  return { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 }
}

function intersects(a: { minX: number; maxX: number; minZ: number; maxZ: number }, b: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ
}

const PALETTES: BuildingPalette[] = ['concrete', 'sand', 'brick', 'terracotta', 'slate', 'cream']

/**
 * Génère la liste complète des bâtiments (ancres + compléments procéduraux).
 * Déterministe : à seed fixe, le layout est identique à chaque chargement.
 */
export function generateBuildings(): BuildingSpec[] {
  const rng = mulberry32(20261117)
  const buildings: BuildingSpec[] = [...ANCHOR_BUILDINGS]
  const exclusions = ANCHOR_BUILDINGS.map((b) => {
    const e = buildingAABB(b)
    const pad = 1.5
    return { minX: e.minX - pad, maxX: e.maxX + pad, minZ: e.minZ - pad, maxZ: e.maxZ + pad }
  })

  let counter = 0
  for (const [x0, x1] of REGION_BOUNDS) {
    for (const [z0, z1] of REGION_BOUNDS) {
      const isPark = x0 === PARK_RECT.minX && x1 === PARK_RECT.maxX && z0 === PARK_RECT.minZ && z1 === PARK_RECT.maxZ
      if (isPark) continue

      const w = x1 - x0
      const d = z1 - z0
      // Nombre de cellules dans la grille de l'îlot.
      const cols = w > 45 ? 2 : 1
      const rows = d > 45 ? 2 : 1
      const cellW = w / cols
      const cellD = d / rows

      for (let cx = 0; cx < cols; cx++) {
        for (let cz = 0; cz < rows; cz++) {
          const cellX0 = x0 + cx * cellW
          const cellZ0 = z0 + cz * cellD
          const margin = 3
          const bw = (cellW - margin * 2) * (0.62 + rng() * 0.2)
          const bd = (cellD - margin * 2) * (0.62 + rng() * 0.2)
          const maxJitterX = Math.max(0, (cellW - margin * 2 - bw) / 2)
          const maxJitterZ = Math.max(0, (cellD - margin * 2 - bd) / 2)
          const bx = cellX0 + cellW / 2 + (rng() * 2 - 1) * maxJitterX
          const bz = cellZ0 + cellD / 2 + (rng() * 2 - 1) * maxJitterZ
          const height = 7 + Math.pow(rng(), 1.35) * 19 // 7 → 26 m
          const candidate: BuildingSpec = {
            id: `bld-${counter++}`,
            x: bx,
            z: bz,
            w: bw,
            d: bd,
            h: height,
            floors: Math.max(2, Math.round(height / 3.1)),
            palette: PALETTES[Math.floor(rng() * PALETTES.length)],
          }
          const box = buildingAABB(candidate)
          if (exclusions.some((e) => intersects(box, e))) continue
          buildings.push(candidate)
        }
      }
    }
  }
  return buildings
}

export type InteractableType = 'shop' | 'restaurant' | 'gym' | 'transport' | 'park'

export interface InteractableSpec {
  id: string
  type: InteractableType
  /** Libellé du prompt, ex. « Entrer dans la Supérette ». */
  label: string
  x: number
  z: number
  radius: number
  /** Message affiché quand le joueur appuie sur E. */
  message: string
}

export const INTERACTABLES: InteractableSpec[] = [
  {
    id: 'int-superette', type: 'shop', label: 'Entrer dans la Supérette « Chez Fatou »',
    x: 22, z: 8, radius: 2.4,
    message: 'Supérette « Chez Fatou » — Commerces et achats arrivent à l’Étape 2 & 7. Pour l’instant, la caisse est fermée.',
  },
  {
    id: 'int-restaurant', type: 'restaurant', label: 'Entrer au restaurant « Le Fleuve »',
    x: -20, z: -9, radius: 2.4,
    message: 'Restaurant « Le Fleuve » — Le menu complet (et l’addition !) vous attendra à l’Étape 7.',
  },
  {
    id: 'int-gym', type: 'gym', label: 'Entrer à « Mali Fitness »',
    x: 34, z: -9, radius: 2.4,
    message: 'Salle de sport « Mali Fitness » — La musculation et le suivi du corps arrivent avec l’Étape 2 & 7.',
  },
  {
    id: 'int-bus', type: 'transport', label: 'Prendre le bus direction Gare Routière',
    x: 9, z: 9, radius: 2.6,
    message: 'Arrêt de bus « Centre-Ville » — Le réseau bus / car / taxi arrive à l’Étape 6 (Ville & transports).',
  },
  {
    id: 'int-parc', type: 'park', label: 'Se reposer sous les arbres',
    x: PARK_INTERACTABLE_POS.x, z: PARK_INTERACTABLE_POS.z, radius: 3.2,
    message: 'Parc de la Liberté — Vous respirez. Un instant de calme dans le Centre-Ville.',
  },
]

export type NpcGender = 'female' | 'male'
export type HairStyle = 'short' | 'afro' | 'bald'

export interface NpcSpawnSpec {
  /** UUID stable + gender 'female'|'male' (alignés sur les CHECK constraints de city_life_game.npcs). */
  id: string
  firstName: string
  lastName: string
  gender: NpcGender
  /** Réservé aux adultes (18+) — les relations amoureuses seront filtrées sur cette base. */
  age: number
  height: number
  skin: string
  shirt: string
  pants: string
  hair: string
  hairStyle: HairStyle
  /** Marche le long d'une ligne de trottoir : « x » = axe Est-Ouest sur la ligne z donnée, « z » = axe Nord-Sud sur la ligne x donnée. */
  axis: 'x' | 'z'
  line: number
  t: number
}

/** PNJ adultes du prototype — mêmes personnes que dans la migration Supabase. */
export const NPC_SPAWNS: NpcSpawnSpec[] = [
  { id: 'b0000000-0000-4000-8000-000000000001', firstName: 'Awa', lastName: 'Diarra', gender: 'female', age: 26, height: 1.65, skin: '#7d5133', shirt: '#c1467a', pants: '#2e3a4d', hair: '#14100d', hairStyle: 'short', axis: 'x', line: 8, t: -34 },
  { id: 'b0000000-0000-4000-8000-000000000002', firstName: 'Moussa', lastName: 'Traoré', gender: 'male', age: 31, height: 1.82, skin: '#5d3a24', shirt: '#3a5a8c', pants: '#1f2937', hair: '#0f0c0a', hairStyle: 'short', axis: 'x', line: -8, t: 22 },
  { id: 'b0000000-0000-4000-8000-000000000003', firstName: 'Fatoumata', lastName: 'Koné', gender: 'female', age: 22, height: 1.6, skin: '#8d5a3b', shirt: '#e9c46a', pants: '#33415c', hair: '#171310', hairStyle: 'afro', axis: 'z', line: 8, t: 42 },
  { id: 'b0000000-0000-4000-8000-000000000004', firstName: 'Ibrahim', lastName: 'Touré', gender: 'male', age: 29, height: 1.77, skin: '#6f452c', shirt: '#e8e4da', pants: '#3d3d3d', hair: '#100d0b', hairStyle: 'short', axis: 'z', line: -8, t: -52 },
  { id: 'b0000000-0000-4000-8000-000000000005', firstName: 'Kadidia', lastName: 'Diallo', gender: 'female', age: 34, height: 1.68, skin: '#4e3120', shirt: '#2a9d8f', pants: '#54385e', hair: '#120f0c', hairStyle: 'short', axis: 'x', line: 68, t: 4 },
  { id: 'b0000000-0000-4000-8000-000000000006', firstName: 'Seydou', lastName: 'Coulibaly', gender: 'male', age: 24, height: 1.8, skin: '#7d5133', shirt: '#f4f1ea', pants: '#22303f', hair: '#15110e', hairStyle: 'short', axis: 'x', line: -68, t: 18 },
  { id: 'b0000000-0000-4000-8000-000000000007', firstName: 'Aminata', lastName: 'Sangaré', gender: 'female', age: 28, height: 1.63, skin: '#6f452c', shirt: '#e3645f', pants: '#20242b', hair: '#161210', hairStyle: 'afro', axis: 'z', line: 68, t: -38 },
  { id: 'b0000000-0000-4000-8000-000000000008', firstName: 'Boubacar', lastName: 'Cissé', gender: 'male', age: 38, height: 1.85, skin: '#5d3a24', shirt: '#595959', pants: '#2b2b2b', hair: '#0e0c0a', hairStyle: 'bald', axis: 'z', line: -68, t: 28 },
  { id: 'b0000000-0000-4000-8000-000000000009', firstName: 'Mariam', lastName: 'Keïta', gender: 'female', age: 19, height: 1.58, skin: '#8d5a3b', shirt: '#8ecae6', pants: '#34495e', hair: '#181410', hairStyle: 'short', axis: 'x', line: -84, t: -12 },
  { id: 'b0000000-0000-4000-8000-000000000010', firstName: 'Youssouf', lastName: 'Dembélé', gender: 'male', age: 42, height: 1.78, skin: '#4e3120', shirt: '#6a994e', pants: '#23272e', hair: '#100e0c', hairStyle: 'short', axis: 'z', line: 84, t: 58 },
]

export const PLAYER_SPAWN = { x: 8, z: -30, yaw: Math.PI } as const
