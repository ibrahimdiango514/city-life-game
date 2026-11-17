/**
 * InteractionSystem.ts — Détecte la cible interactive la plus pertinente
 * (bâtiment, mobilier urbain, PNJ) à portée et construit le prompt contextuel.
 */
import type { InteractableSpec } from '../world/cityData'

export interface PromptTarget {
  kind: 'interactable' | 'npc'
  label: string
  message: string
  /** Score normalisé (distance / rayon) — plus petit = plus proche. */
  score: number
}

export interface NpcPromptInfo {
  x: number
  z: number
  fullName: string
  age: number
}

const NPC_INTERACT_DISTANCE = 2.4

export function findPromptTarget(
  px: number,
  pz: number,
  interactables: InteractableSpec[],
  npcs: NpcPromptInfo[]
): PromptTarget | null {
  let best: PromptTarget | null = null

  for (const item of interactables) {
    const dist = Math.hypot(px - item.x, pz - item.z)
    if (dist <= item.radius) {
      const score = dist / item.radius
      if (!best || score < best.score) {
        best = { kind: 'interactable', label: item.label, message: item.message, score }
      }
    }
  }

  for (const npc of npcs) {
    const dist = Math.hypot(px - npc.x, pz - npc.z)
    if (dist <= NPC_INTERACT_DISTANCE) {
      const score = dist / NPC_INTERACT_DISTANCE
      if (!best || score < best.score) {
        best = {
          kind: 'npc',
          label: `Parler à ${npc.fullName} · ${npc.age} ans`,
          message: `npc:${npc.fullName}`,
          score,
        }
      }
    }
  }

  return best
}

/** Salutations affichées lors d'une tentative de conversation (placeholder Étape 3). */
export function greetingFor(name: string): string {
  const greetings = [
    `« Salut, ça va ? »`,
    `« Ah, bonsoir ! Vous cherchez quelque chose ? »`,
    `« Bonjour. Belle journée, non ? »`,
    `« Ça va, ça va… et vous-même ? »`,
    `« Doucement avec le soleil, aujourd'hui. »`,
  ]
  const first = name.split(' ')[0]
  const line = greetings[Math.floor(Math.random() * greetings.length)]
  return `${first} : ${line}\n(Les dialogues intelligents arrivent à l'Étape 3 — IA, personnalité et émotions.)`
}
