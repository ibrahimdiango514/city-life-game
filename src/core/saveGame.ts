/**
 * saveGame.ts — Sérialisation des sauvegardes (PURE, testable).
 * Persistée via localStorage par GameState ; ici : pur JSON <-> SaveData.
 */
import { BASE_STATS, type SimStats } from './simulation'

export const SAVE_KEY = 'citylife.save.v1'
export const SAVE_VERSION = 1

export interface ContactEntry {
  npcId: string
  name: string
  phone: string
}

export interface SaveData {
  version: number
  stats: SimStats
  /** Position dans le monde (toujours le dehors : on reprend en ville). */
  position: { x: number; z: number; yaw: number }
  /** Horloge de jeu (jour + minutes). */
  clock: { day: number; minutes: number }
  /** Affinité par PNJ (−100 … +100). */
  affinity: Record<string, number>
  contacts: ContactEntry[]
  savedAt: number
}

export function createEmptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    stats: { ...BASE_STATS },
    position: { x: 8, z: -30, yaw: Math.PI },
    clock: { day: 1, minutes: 8 * 60 },
    affinity: {},
    contacts: [],
    savedAt: Date.now(),
  }
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save)
}

/** Tolérant : retourne null si le JSON est invalide ou la version inconnue. */
export function parseSave(json: string | null | undefined): SaveData | null {
  if (!json) return null
  try {
    const raw = JSON.parse(json) as Partial<SaveData>
    if (raw.version !== SAVE_VERSION) return null
    if (!raw.stats || typeof raw.stats.cash !== 'number') return null
    const base = BASE_STATS
    return {
      version: SAVE_VERSION,
      stats: {
        cash: num(raw.stats.cash, base.cash),
        hunger: num(raw.stats.hunger, base.hunger),
        energy: num(raw.stats.energy, base.energy),
        weightKg: num(raw.stats.weightKg, base.weightKg),
        muscleKg: num(raw.stats.muscleKg, base.muscleKg),
        caloriesToday: num(raw.stats.caloriesToday, 0),
      },
      position: {
        x: num(raw.position?.x, 8),
        z: num(raw.position?.z, -30),
        yaw: num((raw.position as { yaw?: number } | undefined)?.yaw, Math.PI),
      },
      clock: {
        day: num(raw.clock?.day, 1),
        minutes: num(raw.clock?.minutes, 8 * 60),
      },
      affinity: raw.affinity && typeof raw.affinity === 'object' ? { ...raw.affinity } : {},
      contacts: Array.isArray(raw.contacts) ? raw.contacts.filter(isContact) : [],
      savedAt: num(raw.savedAt, Date.now()),
    }
  } catch {
    return null
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function isContact(v: unknown): v is ContactEntry {
  if (!v || typeof v !== 'object') return false
  const c = v as Record<string, unknown>
  return typeof c.npcId === 'string' && typeof c.name === 'string' && typeof c.phone === 'string'
}
