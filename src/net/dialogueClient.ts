/**
 * dialogueClient.ts — Réponses PNJ.
 *
 * Stratégie honnête à deux niveaux :
 *  1. Si la variable d'environnement `VITE_DIALOGUE_ENDPOINT` est définie,
 *     on tente une réponse générative via l'Edge Function `city-life-dialogue`
 *     (clé d'IA stockée côté serveur — JAMAIS dans le client).
 *  2. Sinon (ou en cas d'échec réseau/timeout), le moteur local
 *     `core/dialogueEngine` répond : le jeu reste 100 % jouable hors-ligne.
 *
 * L'Edge Function `supabase/functions/city-life-dialogue/index.ts` est prête
 * dans le dépôt ; elle n'est PAS déployée tant que le propriétaire n'a pas
 * fourni une clé d'IA dédiée (secret côté Supabase) — aucun secret tiers
 * n'est utilisé sans accord explicite.
 */
import { replyTo, type DialogueContext, type DialogueResult } from '../core/dialogueEngine'

export interface DialogueNpcInfo {
  id: string
  firstName: string
  lastName: string
  age: number
  role: string
  personality: Record<string, number>
  romanceable: boolean
}

const TIMEOUT_MS = 3800

export async function getNpcReply(
  ctx: DialogueContext,
  playerText: string,
): Promise<{ reply: DialogueResult; via: 'ia' | 'local' }> {
  const endpoint = import.meta.env.VITE_DIALOGUE_ENDPOINT as string | undefined
  if (endpoint) {
    try {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: playerText,
          npc: ctx.npc,
          affinity: ctx.affinity,
          day: ctx.day,
          history: ctx.history.slice(-10),
        }),
        signal: controller.signal,
      })
      window.clearTimeout(timer)
      if (res.ok) {
        const data = (await res.json()) as Partial<DialogueResult>
        if (typeof data.text === 'string' && data.text.trim().length > 0) {
          return {
            via: 'ia',
            reply: {
              text: data.text,
              affinityDelta: typeof data.affinityDelta === 'number' ? data.affinityDelta : 0,
              givesPhone: data.givesPhone === true,
              acceptedInvite: typeof data.acceptedInvite === 'boolean' ? data.acceptedInvite : null,
              mood: typeof data.mood === 'string' ? data.mood : 'neutre',
            },
          }
        }
      }
    } catch {
      // Repli silencieux sur le moteur local (hors-ligne / IA non configurée).
    }
  }
  return { via: 'local', reply: replyTo(ctx, playerText) }
}
