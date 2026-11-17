/**
 * npcProfiles.ts — Profil social des 10 habitants (miroir client du seed Supabase).
 *
 * La source canonique reste `city_life_game.npcs` (rôle, personnalité, romanceable).
 * Ce miroir existe pour que le dialogue fonctionne en local/offline ;
 * il DOIT rester identique à supabase/migrations/…seed_centre_ville…sql.
 * Adama (serveur du Fleuve) est un PNJ 100 % client — absent du seed pour ne
 * pas dédoubler les migrations.
 */
import type { DialogueNpc } from '../core/dialogueEngine'
import { NPC_SPAWNS } from '../world/cityData'

const PROFILES: Record<string, { role: DialogueNpc['role']; personality: DialogueNpc['personality']; romanceable: boolean }> = {
  'b0000000-0000-4000-8000-000000000001': { role: 'shopkeeper', personality: { openness: 7, humor: 6, ambition: 6, patience: 5, loyalty: 7 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000002': { role: 'worker', personality: { openness: 5, humor: 7, ambition: 7, patience: 6, loyalty: 6 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000003': { role: 'student', personality: { openness: 8, humor: 8, ambition: 4, patience: 3, loyalty: 5 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000004': { role: 'worker', personality: { openness: 4, humor: 5, ambition: 8, patience: 7, loyalty: 8 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000005': { role: 'shopkeeper', personality: { openness: 6, humor: 5, ambition: 7, patience: 8, loyalty: 9 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000006': { role: 'worker', personality: { openness: 9, humor: 9, ambition: 5, patience: 2, loyalty: 4 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000007': { role: 'worker', personality: { openness: 7, humor: 7, ambition: 6, patience: 6, loyalty: 6 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000008': { role: 'other', personality: { openness: 3, humor: 4, ambition: 9, patience: 9, loyalty: 8 }, romanceable: true },
  'b0000000-0000-4000-8000-000000000009': { role: 'student', personality: { openness: 8, humor: 6, ambition: 3, patience: 4, loyalty: 5 }, romanceable: false },
  'b0000000-0000-4000-8000-000000000010': { role: 'worker', personality: { openness: 5, humor: 6, ambition: 7, patience: 8, loyalty: 9 }, romanceable: false },
}

export function dialogueNpcFor(id: string): DialogueNpc | null {
  const spec = NPC_SPAWNS.find((n) => n.id === id)
  const profile = PROFILES[id]
  if (!spec || !profile) return null
  return {
    id: spec.id,
    firstName: spec.firstName,
    lastName: spec.lastName,
    age: spec.age,
    role: profile.role,
    personality: profile.personality,
    romanceable: profile.romanceable,
  }
}

/** Adama Coulibaly, 29 ans — serveur du restaurant « Le Fleuve » (PNJ client uniquement). */
export const ADAMA: DialogueNpc = {
  id: 'waiter-adama',
  firstName: 'Adama',
  lastName: 'Coulibaly',
  age: 29,
  role: 'shopkeeper',
  personality: { openness: 7, humor: 7, ambition: 5, patience: 9, loyalty: 6 },
  romanceable: false,
}

export const ROLE_LABELS: Record<string, string> = {
  shopkeeper: 'commerçant(e)',
  student: 'étudiant(e)',
  worker: 'travailleur / travailleuse',
  police: 'policier(ère)',
  teacher: 'enseignant(e)',
  criminal: 'personne louche…',
  civilian: 'habitant(e)',
  other: 'habitant(e)',
}
