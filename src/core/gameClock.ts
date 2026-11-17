/**
 * GameClock — Horloge interne du jeu (module pur, sans DOM/Three.js).
 * Jour 1, 08:00 au démarrage. 1 seconde réelle = `minutesPerRealSecond` minutes de jeu.
 */
export type DayPhase = 'Matin' | 'Après-midi' | 'Soir' | 'Nuit'

export class GameClock {
  day: number
  minutes: number
  /** Combien de minutes de jeu s'écoulent par seconde réelle. */
  readonly minutesPerRealSecond: number

  constructor(day = 1, startMinutes = 8 * 60, minutesPerRealSecond = 2) {
    this.day = day
    this.minutes = startMinutes
    this.minutesPerRealSecond = minutesPerRealSecond
  }

  update(dtSeconds: number): void {
    if (dtSeconds <= 0) return
    this.minutes += dtSeconds * this.minutesPerRealSecond
    while (this.minutes >= 24 * 60) {
      this.minutes -= 24 * 60
      this.day += 1
    }
  }

  get hours(): number {
    return Math.floor(this.minutes / 60)
  }

  get minuteOfHour(): number {
    return Math.floor(this.minutes % 60)
  }

  /** "08:05" */
  timeHHMM(): string {
    const h = String(this.hours).padStart(2, '0')
    const m = String(this.minuteOfHour).padStart(2, '0')
    return `${h}:${m}`
  }

  phase(): DayPhase {
    const h = this.hours
    if (h >= 6 && h < 12) return 'Matin'
    if (h >= 12 && h < 18) return 'Après-midi'
    if (h >= 18 && h < 22) return 'Soir'
    return 'Nuit'
  }

  /** Étiquette complète pour le HUD : "Jour 1 · 08:05 · Matin" */
  label(): string {
    return `Jour ${this.day} · ${this.timeHHMM()} · ${this.phase()}`
  }

  /** Fraction de la journée [0..1) — utile pour le cycle solaire (étapes ultérieures). */
  progress(): number {
    return this.minutes / (24 * 60)
  }
}
