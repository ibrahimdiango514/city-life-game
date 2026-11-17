/**
 * simulation.ts — Modèle de simulation de vie (PUR, sans DOM/Three).
 * Faim, énergie, calories, poids, argent. Testé par tests/simulation.test.ts.
 */

export interface SimStats {
  /** Espèces en FCFA. */
  cash: number
  /** 0 = affamé … 100 = rassasié. */
  hunger: number
  /** 0 = épuisé … 100 = en forme. */
  energy: number
  weightKg: number
  muscleKg: number
  caloriesToday: number
}

export const BASE_STATS: SimStats = {
  cash: 50_000,
  hunger: 82,
  energy: 100,
  weightKg: 78,
  muscleKg: 30,
  caloriesToday: 0,
}

/** 1 faim-point perdu par jeu-minute × taux. ~6 points d'énergie/heure de jeu. */
export const HUNGER_PER_GAME_MINUTE = 6 / 60 / 4 // ≈ 1,5 / heure de jeu → équilibré sur 17 h d'éveil
export const ENERGY_PER_GAME_MINUTE = 5 / 60 / 6

export interface MealItem {
  calories: number
  satiety: number
  energy: number
}

export function clampStat(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v))
}

/** Applique un repas (une ligne de commande) aux stats. */
export function applyMeal(stats: SimStats, meal: MealItem): SimStats {
  const next = { ...stats }
  next.hunger = clampStat(next.hunger + meal.satiety)
  next.energy = clampStat(next.energy + meal.energy)
  next.caloriesToday += meal.calories
  // 7 700 kcal ≈ 1 kg de masse corporelle.
  next.weightKg = Math.round((next.weightKg + meal.calories / 7700) * 100) / 100
  return next
}

/** Dérive passive du temps de jeu (faim + énergie). */
export function tickTime(stats: SimStats, elapsedGameMinutes: number): SimStats {
  if (elapsedGameMinutes <= 0) return { ...stats }
  const next = { ...stats }
  next.hunger = clampStat(next.hunger - elapsedGameMinutes * HUNGER_PER_GAME_MINUTE)
  next.energy = clampStat(next.energy - elapsedGameMinutes * ENERGY_PER_GAME_MINUTE)
  return next
}

/** Poids affiché avec morphologie (pour le morph des os). */
export function bodyWeightFactor(weightKg: number): number {
  // 1.0 = morphologie de référence (78 kg). Amplifié pour rester visible en jeu.
  return 1 + ((weightKg - 78) / 45) * 0.9
}

export function bodyMuscleFactor(muscleKg: number): number {
  return 1 + ((muscleKg - 30) / 20) * 0.9
}

export function canAfford(cash: number, amount: number): boolean {
  return cash >= amount
}

/** Format FCFA : 45 500 FCFA (espaces insécables fins). */
export function formatMoney(amount: number): string {
  const rounded = Math.round(amount)
  const int = String(rounded)
  let out = ''
  for (let i = 0; i < int.length; i++) {
    const pos = int.length - i
    out += int[i]
    if (pos > 1 && pos % 3 === 1) out += ' '
  }
  return `${out} FCFA`
}

/** Maintien journalier approx. : Mifflin-St Jeor simplifié (homme, 1,75 m, activité modérée). */
export const MAINTENANCE_KCAL = 2600

export function dailyBalance(calories: number): number {
  return calories - MAINTENANCE_KCAL
}
