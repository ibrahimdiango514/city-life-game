/**
 * menu.ts — Carte du restaurant « Le Fleuve » (prix en FCFA).
 */
export interface MenuItem {
  id: string
  name: string
  price: number
  calories: number
  /** Satiété rendue (points de faim). */
  satiety: number
  /** Énergie rendue (points). */
  energy: number
}

export const LE_FLEUVE_MENU: MenuItem[] = [
  { id: 'thieboudienne', name: 'Thiéboudienne', price: 3500, calories: 780, satiety: 34, energy: 6 },
  { id: 'maffe', name: 'Maffé poulet', price: 3000, calories: 690, satiety: 30, energy: 5 },
  { id: 'yassa', name: 'Yassa cuisinère', price: 2500, calories: 610, satiety: 26, energy: 4 },
  { id: 'poulet-bicyclette', name: 'Poulet bicyclette', price: 2000, calories: 540, satiety: 22, energy: 4 },
  { id: 'gingembre', name: 'Jus de gingembre', price: 500, calories: 120, satiety: 5, energy: 9 },
  { id: 'eau', name: 'Eau minérale', price: 300, calories: 0, satiety: 0, energy: 2 },
]

export function findMenuItem(id: string): MenuItem | undefined {
  return LE_FLEUVE_MENU.find((item) => item.id === id)
}

export function orderTotal(ids: string[]): number {
  return ids.reduce((sum, id) => sum + (findMenuItem(id)?.price ?? 0), 0)
}
