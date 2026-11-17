/**
 * dialogueEngine.ts — Moteur de dialogue LOCAL (v1, pur, testable).
 *
 * Conversations en français libres : détection d'intentions par motif,
 * réponses composées selon la personnalité du PNJ (openness/humour/patience/
 * ambition/loyalty), le contexte (affinité, historique) et l'humeur du jour.
 * Utilisé en repli quand l'IA générative (Edge Function `city-life-dialogue`)
 * n'est pas configurée ou indisponible — le jeu reste 100 % jouable hors-ligne.
 */

export interface DialogueNpc {
  id: string
  firstName: string
  lastName: string
  age: number
  role: string
  personality: {
    openness?: number
    humor?: number
    ambition?: number
    patience?: number
    loyalty?: number
  }
  romanceable: boolean
}

export interface DialogueTurn {
  role: 'player' | 'npc'
  text: string
}

export interface DialogueResult {
  text: string
  affinityDelta: number
  /** Le PNJ accepte de donner son numéro (seuil d'affinité atteint). */
  givesPhone: boolean
  /** Réponse à une invitation (null si pas d'invitation dans le message). */
  acceptedInvite: boolean | null
  /** Étiquette d'humeur affichée dans l'UI. */
  mood: string
}

export interface DialogueContext {
  npc: DialogueNpc
  affinity: number
  history: DialogueTurn[]
  /** Jour de jeu (pour varier l'humeur quotidienne de façon stable). */
  day: number
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .trim()
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Humeur du jour, stable pour un PNJ donné sur une journée de jeu. */
export function dailyMood(npcId: string, day: number): number {
  const h = hashString(`${npcId}:${day}`)
  return 0.72 + (h % 1000) / 1000 * 0.56 // 0.72 … 1.28
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function personality(ctx: DialogueContext, key: 'openness' | 'humor' | 'ambition' | 'patience' | 'loyalty', fallback = 5): number {
  const v = ctx.npc.personality[key]
  return typeof v === 'number' ? v : fallback
}

const PHONE_THRESHOLD = 25
const INVITE_THRESHOLD = 40

/** Point d'entrée : répond au message du joueur. */
export function replyTo(ctx: DialogueContext, playerText: string): DialogueResult {
  const npc = ctx.npc
  const name = npc.firstName
  const t = normalizeText(playerText)
  if (t.length === 0) {
    return result(pick([`${name} attend, un sourcil levé.`, '…'], 1), 0, ctx)
  }

  const seed = (hashString(t) ^ (ctx.history.length * 2654435761) ^ (ctx.day * 40503)) >>> 0
  const openness = personality(ctx, 'openness')
  const humor = personality(ctx, 'humor')
  const patience = personality(ctx, 'patience')
  const loyalty = personality(ctx, 'loyalty')
  const ambition = personality(ctx, 'ambition')
  const mood = dailyMood(npc.id, ctx.day)
  const affinity = ctx.affinity

  const warm = affinity + (mood - 1) * 30 + (openness - 5) * 4

  // ---- Insultes / agressivité ----
  if (/(idiot|idiote|nulle?|moche|debile|degage|imbecile|stupide|cretin|sale)/.test(t)) {
    const text = patience >= 6
      ? pick([`${name} soupire. « Calme-toi, vraiment… passe ta journée. »`, `« Tu es de mauvaise humeur ou c'est comme ça tous les jours ? » demande ${name}, las(se).`], seed)
      : pick([`« La prochaine fois, garde-le pour toi. » lâche ${name}, froid(e).`, `${name} recule d'un pas. « Non mais ça va pas ? »`], seed)
    return result(text, -14, ctx)
  }

  // ---- Salutations ----
  if (/^(salut|bonjour|bonsoir|hey|coucou|hello|yo|cc)\b/.test(t) || /^(salut|bonjour|bonsoir) (ca|ça) va/.test(t)) {
    const greet = warm >= 30
      ? pick([`« Ah, salut ! Ça fait plaisir de te voir par ici. » sourit ${name}.`, `« Salut toi ! Alors, quoi de neuf ? » répond ${name}, chaleureux(se).`], seed)
      : warm >= 0
        ? pick([`« Salut. » ${name} hoche la tête, poliment.`, `« Bonsoir. » répond ${name} d'un ton neutre.`], seed)
        : pick([`${name} te dévisage puis détourne le regard. « Mmh. »`, `« Bonsoir. » dit ${name}, sec.`], seed)
    return result(greet, 2, ctx)
  }

  // ---- Comment vas-tu ? ----
  if (/(comment (ca|ça|va)|tu vas bien|la forme|quoi de neuf|ca roule)/.test(t)) {
    const dayMood = mood >= 1.1 ? 'en pleine forme' : mood >= 0.9 ? 'honnêtement, ça va' : 'un peu fatigué(e), mais ça va aller'
    const extra = ambition >= 7 ? ' On bosse beaucoup ces temps-ci.' : humor >= 7 ? ' Le quartier est calme, c’est suspect.' : ''
    return result(`« Bah, ${dayMood}.${extra} Et toi, comment ça va ? » demande ${name}.`, 2, ctx)
  }

  // ---- Nom ----
  if (/(ton nom|tu t'appelles|t'appelles comment|qui es[- ]tu|t'es qui|ton prenom)/.test(t)) {
    return result(`« Moi, c'est ${name} ${npc.lastName}. Et toi ? » sourit ${name}.`, 2, ctx)
  }

  // ---- Âge ----
  if (/(quel age|ton age|tu as quel age|t'as quel age)/.test(t)) {
    return result(`« J'ai ${npc.age} ans, tu peux compter si tu veux. » ${name} lève les yeux au ciel.`, 1, ctx)
  }

  // ---- Métier / occupation ----
  if (/(travail|metier|boulot|tu fais quoi|tu fais dans la vie|profession)/.test(t)) {
    const jobLine = jobDescription(npc.role, name)
    return result(`${jobLine}`, 2, ctx)
  }

  // ---- Blagues / humour ----
  if (/(blague|marrant|rigole|drole|humour|fais[- ]moi rire)/.test(t)) {
    if (humor >= 6) {
      return result(pick([`${name} éclate de rire. « Toi alors… ok : pourquoi le riz aux aubergines va chez le psy ? Parce qu'il est trop frit ! »`, `« Ha ! Tiens : j'ai raté mon arrêt de bus ce matin. Le plus dur, c'est de rater un arrêt qui n'est même pas encore construit. »`], seed), 4, ctx)
    }
    return result(`${name} ne rit pas vraiment. « Je suis plus du genre sérieux, moi. » dit ${name}, à moitié souriant(e).`, 1, ctx)
  }

  // ---- Compliment / flirt (adultes uniquement par construction des données) ----
  if (/(belle|beau|joli|superbe|elegante?|classe|attirant|craquant|charme|yeux|sourire)/.test(t)) {
    if (!npc.romanceable) {
      return result(`${name} lève une main. « Merci pour le compliment… mais gardons ça léger, d'accord ? » dit ${name}, bienveillant(e) mais ferme.`, 1, ctx)
    }
    if (affinity >= 15) {
      const line = pick([`${name} rougit presque. « Arrêêête… bon. Merci, toi non plus tu ne t'es pas trop mal réveillé(e). »`, `« Oh… tu dragues ? » ${name} penche la tête, amusé(e). « Ça se passe mieux que je ne pensais. »`], seed)
      return result(line, 6, ctx)
    }
    return result(`${name} se racle la gorge. « …Merci ? » dit ${name}, pas vraiment convaincu(e) — ou pas encore.`, 2, ctx)
  }

  // ---- Numéro de téléphone ----
  if (/(numero|number|telephone|contact|portable|joindre)/.test(t)) {
    const after = affinity + 1
    if (after >= PHONE_THRESHOLD) {
      return result(`${name} prend ton téléphone. « Bon… je te fais confiance pour ne pas spammer. Voilà. » (${name} vient de t'ajouter à ses contacts.)`, 3, ctx, { givesPhone: true })
    }
    return result(pick([`« On se connaît à peine pour ça, non ? » ${name} sourit, sans donner suite.`, `« Demande-moi plutôt de te présenter d'abord à un ami commun. » élude ${name} poliment.`], seed), 0, ctx)
  }

  // ---- Invitation (restaurant / sortie) ----
  if (/(resto|restaurant|manger ensemble|boire un verre|sortir avec|d[iî]ner avec|dejeuner avec|invit)/.test(t)) {
    const ok = affinity + 0 >= INVITE_THRESHOLD || (openness >= 7 && affinity >= 10)
    if (ok) {
      return result(`${name} réfléchit une seconde, puis sourit. « D'accord. Le Fleuve, ça ira très bien. Vendredi, même heure ? »`, 5, ctx, { acceptedInvite: true })
    }
    return result(`${name} hausse les épaules. « On verra ça quand on se connaîtra mieux. » dit ${name}, sympa mais réservé(e).`, 0, ctx, { acceptedInvite: false })
  }

  // ---- Vie / rêves / ambitions ----
  if (/(reve|ambition|futur|projet|objectif|envie)/.test(t)) {
    if (ambition >= 7) {
      return result(`« Franchement ? J'ai des projets qui dépassent ce quartier. » ${name} regarde au loin. « Mais les rêves ne paient pas le loyer, donc je bosse. »`, 3, ctx)
    }
    return result(`« Mes rêves ? » ${name} y réfléchit. « Un bon boulot, la tranquillité… et une connexion qui coupe pas quand il pleut. »`, 2, ctx)
  }

  // ---- Loyauté / conseil ----
  if (/(conseil|confiance|aide|ami|amie)/.test(t)) {
    if (loyalty >= 7) {
      return result(`« Pour toi ? Je peux t'aider. Mais retiens bien : un vrai ami ne te ment jamais. » dit ${name}, sérieux(se).`, 4, ctx)
    }
    return result(`${name} hoche la tête. « Chacun ses affaires, mais tu peux compter sur un minimum. »`, 2, ctx)
  }

  // ---- Au revoir ----
  if (/(au revoir|salut|ciao|a plus|a bientot|bonne (soiree|journee|nuit)|bye)\b/.test(t)) {
    return result(pick([`« À bientôt alors. » ${name} lève la main en guise d'au revoir.`, `« Bonne route ! » dit ${name} en retournant à ses occupations.`], seed), 1, ctx)
  }

  // ---- Repli : relance vivante ----
  const fallbacks = [
    `${name} opine. « Intéressant. Et toi, tu en penses quoi ? »`,
    `« Mmh, je vois. » ${name} croise les bras. « Tu habites dans le quartier ? »`,
    `${name} réfléchit, puis sourit. « Toi au moins tu discutes, c'est rare. »`,
    `« Ha, tu me surprends. » dit ${name}. « Continue, je t'écoute. »`,
  ]
  return result(pick(fallbacks, seed), 0, ctx)
}

function result(text: string, affinityDelta: number, ctx: DialogueContext, extra?: { givesPhone?: boolean; acceptedInvite?: boolean }): DialogueResult {
  const after = ctx.affinity + affinityDelta
  const moodTag = after >= 40 ? 'proche' : after >= 15 ? 'sympa' : after >= 0 ? 'neutre' : after >= -30 ? 'méfiant(e)' : 'hostile'
  return {
    text,
    affinityDelta,
    givesPhone: extra?.givesPhone ?? false,
    acceptedInvite: extra?.acceptedInvite ?? null,
    mood: moodTag,
  }
}

function jobDescription(role: string, name: string): string {
  switch (role) {
    case 'shopkeeper': return `« Je travaille à la supérette du coin — Chez Fatou. » sourit ${name}. « On connaît tout le monde, ici. »`
    case 'student': return `« Je suis étudiant(e). » ${name} soupire puis sourit. « Les études, la bibliothèque, les fins de mois difficiles… le grand luxe. »`
    case 'worker': return `« Je travaille, oui — la journée n'est pas de tout repos. » dit ${name}. « Et toi, tu fais quoi ? »`
    case 'police': return `« Je suis dans la police. » ${name} montre sa plaque discrètement. « Alors restons du bon côté, hein. »`
    case 'teacher': return `« J'enseigne. » dit ${name}, un sourire las mais fier.`
    case 'criminal': return `${name} te dévisage longuement. « Disons que je m'occupe de certaines affaires sensibles. » dit ${name}, un sourire en coin.`
    default: return `« Je me débrouille. » répond ${name}, volontairement vague. « Chacun son chemin, non ? »`
  }
}

/** Génère un numéro malien fictif pour un PNJ (unique par PNJ via seed). */
let phoneCounter = 0
export function generateMalianPhone(npcId: string): string {
  const h = hashString(npcId) + (phoneCounter++) * 7919
  const prefix = ['76', '77', '78', '79', '65', '66', '90', '91', '92', '93'][h % 10]
  const h2 = h * 2654435761 >>> 0
  return `+223 ${prefix} ${String(h2 % 100).padStart(2, '0')} ${String((h2 >>> 8) % 100).padStart(2, '0')} ${String((h2 >>> 16) % 100).padStart(2, '0')}`
}
