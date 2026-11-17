/**
 * supabase.ts — Client Supabase SÉCURISÉ pour le frontend.
 *
 * - Utilise exclusivement la clé PUBLISHABLE (ou anon), jamais une clé secrète.
 * - Toutes les requêtes ciblent le schéma PostgreSQL `city_life_game`.
 * - Les politiques RLS sont la frontière de sécurité : le jeu ne peut lire
 *   que ce qui est prévu pour son état d'authentification.
 * - Les futures fonctions IA (dialogues, Étape 3) passeront par des Edge
 *   Functions — aucune clé d'IA ne transitera ici.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && publishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(url as string, publishableKey as string, {
      db: { schema: 'city_life_game' },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null

export type SupabaseConnectionStatus = 'connected' | 'unconfigured' | 'error'

export interface SupabaseConnectionResult {
  status: SupabaseConnectionStatus
  detail: string
}

/**
 * Sonde honnête de la connexion : tente une lecture head-count sur le catalogue
 * `districts` (policy read_catalog). N'invente pas de faux « connecté ».
 */
export async function checkSupabaseConnection(): Promise<SupabaseConnectionResult> {
  if (!supabase) {
    return {
      status: 'unconfigured',
      detail:
        'Variables VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY absentes. ' +
        'Copiez .env.example vers .env et renseignez la clé publishable du projet.',
    }
  }

  try {
    const { error, count } = await supabase
      .from('districts')
      .select('id', { count: 'exact', head: true })

    if (error) {
      const msg = error.message ?? String(error)
      if (/schema|PGRST002|PGRST106|not exposed/i.test(msg)) {
        return {
          status: 'error',
          detail:
            `Schéma city_life_game non exposé via l'API REST (${msg}). ` +
            'À régler lors de la mise en place de l’auth (Étape 2) : exposer city_life_game ' +
            'dans les schémas API du projet Supabase.',
        }
      }
      // Erreur d'auth/RLS : la connexion réseau fonctionne mais la session est anonyme —
      // comportement attendu avant l'Étape 2.
      if (/JWT|permission|RLS|policy|401|403/i.test(msg)) {
        return {
          status: 'error',
          detail:
            `Connexion réseau OK mais lecture restreinte (${msg}). ` +
            'Les lectures catalogue requièrent une session authentifiée — auth complète à l’Étape 2.',
        }
      }
      return { status: 'error', detail: msg }
    }

    return {
      status: 'connected',
      detail:
        `Schéma city_life_game joignable. ${count ?? 0} quartier(s) visible(s) pour cette session ` +
        '(politiques RLS : lecture catalogue pour les sessions authentifiées).',
    }
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) }
  }
}
