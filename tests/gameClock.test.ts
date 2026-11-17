import { describe, it, expect } from 'vitest'
import { GameClock } from '../src/core/gameClock'

describe('GameClock', () => {
  it('démarre le jour 1 à 08:00', () => {
    const clock = new GameClock()
    expect(clock.day).toBe(1)
    expect(clock.timeHHMM()).toBe('08:00')
    expect(clock.phase()).toBe('Matin')
  })

  it('avance le temps à la vitesse configurée', () => {
    const clock = new GameClock(1, 8 * 60, 2) // 2 min de jeu / s réelle
    clock.update(30) // 60 minutes
    expect(clock.timeHHMM()).toBe('09:00')
  })

  it('passe au jour suivant à minuit', () => {
    const clock = new GameClock(1, 23 * 60 + 30, 2)
    clock.update(30) // +60 min → 00:30, jour 2
    expect(clock.day).toBe(2)
    expect(clock.timeHHMM()).toBe('00:30')
    expect(clock.phase()).toBe('Nuit')
  })

  it('formate l’étiquette HUD complète', () => {
    const clock = new GameClock(3, 14 * 60 + 5)
    expect(clock.label()).toBe('Jour 3 · 14:05 · Après-midi')
  })

  it('la phase couvre la journée', () => {
    expect(new GameClock(1, 7 * 60).phase()).toBe('Matin')
    expect(new GameClock(1, 12 * 60).phase()).toBe('Après-midi')
    expect(new GameClock(1, 19 * 60).phase()).toBe('Soir')
    expect(new GameClock(1, 23 * 60).phase()).toBe('Nuit')
  })

  it('ignore les deltas négatifs ou nuls', () => {
    const clock = new GameClock()
    clock.update(0)
    clock.update(-5)
    expect(clock.timeHHMM()).toBe('08:00')
  })
})
