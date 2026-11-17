/**
 * tests/simulation.test.ts — garde-fous de la simulation de vie.
 * NB : vitest exécute ces tests sans WebGL ni DOM.
 */
import { describe, it, expect } from 'vitest'
import {
  BASE_STATS,
  applyMeal,
  tickTime,
  clampStat,
  formatMoney,
  canAfford,
  bodyWeightFactor,
  bodyMuscleFactor,
  dailyBalance,
} from '../src/core/simulation'
import { createEmptySave, serializeSave, parseSave } from '../src/core/saveGame'
import { replyTo, generateMalianPhone, type DialogueNpc } from '../src/core/dialogueEngine'

describe('simulation', () => {
  it('applyMeal restaure la faim et ajoute des calories', () => {
    const hungry = { ...BASE_STATS, hunger: 30 }
    const after = applyMeal(hungry, { calories: 700, satiety: 35, energy: 5 })
    expect(after.hunger).toBe(65)
    expect(after.energy).toBe(100) // clampé
    expect(after.caloriesToday).toBe(700)
    expect(after.weightKg).toBeGreaterThan(BASE_STATS.weightKg)
  })

  it('applyMeal borne la faim à 100', () => {
    const full = { ...BASE_STATS, hunger: 98 }
    const after = applyMeal(full, { calories: 100, satiety: 30, energy: 0 })
    expect(after.hunger).toBe(100)
  })

  it('tickTime fait baisser faim et énergie progressivement', () => {
    const before = { ...BASE_STATS }
    const after = tickTime(before, 120) // 2h de jeu
    expect(after.hunger).toBeLessThan(before.hunger)
    expect(after.energy).toBeLessThan(before.energy)
  })

  it('tickTime sur 0 minute ne change rien', () => {
    const after = tickTime({ ...BASE_STATS }, 0)
    expect(after.hunger).toBe(BASE_STATS.hunger)
  })

  it('clampStat borne entre 0 et 100', () => {
    expect(clampStat(-5)).toBe(0)
    expect(clampStat(150)).toBe(100)
    expect(clampStat(42)).toBe(42)
  })

  it('formatMoney formate en FCFA avec séparateurs', () => {
    expect(formatMoney(45500)).toBe('45 500 FCFA')
    expect(formatMoney(0)).toBe('0 FCFA')
    expect(formatMoney(1500000)).toBe('1 500 000 FCFA')
  })

  it('canAfford vérifie la trésorerie', () => {
    expect(canAfford(1000, 1000)).toBe(true)
    expect(canAfford(999, 1000)).toBe(false)
  })

  it('les facteurs de morphologie restent proches de 1', () => {
    expect(bodyWeightFactor(78)).toBeCloseTo(1, 5)
    expect(bodyMuscleFactor(30)).toBeCloseTo(1, 5)
    expect(bodyWeightFactor(95)).toBeGreaterThan(1)
    expect(bodyWeightFactor(60)).toBeLessThan(1)
  })

  it('dailyBalance compare aux maintenance', () => {
    expect(dailyBalance(2600)).toBe(0)
    expect(dailyBalance(3000)).toBe(400)
  })
})

describe('saveGame', () => {
  it('aller-retour sérialiser/parser préserve les données', () => {
    const save = createEmptySave()
    save.stats.cash = 42000
    save.stats.hunger = 55
    save.contacts.push({ npcId: 'n1', name: 'Awa Diarra', phone: '+223 76 12 34 56' })
    const json = serializeSave(save)
    const back = parseSave(json)
    expect(back).not.toBeNull()
    expect(back!.stats.cash).toBe(42000)
    expect(back!.stats.hunger).toBe(55)
    expect(back!.contacts).toHaveLength(1)
  })

  it('parseSave gère un JSON invalide', () => {
    expect(parseSave('{pas json')).toBeNull()
    expect(parseSave(null)).toBeNull()
    expect(parseSave('{"version":999}')).toBeNull()
  })
})

const NPC: DialogueNpc = {
  id: 'npc-test',
  firstName: 'Awa',
  lastName: 'Diarra',
  age: 26,
  role: 'shopkeeper',
  personality: { openness: 8, humor: 7, ambition: 5, patience: 7, loyalty: 6 },
  romanceable: true,
}

describe('dialogueEngine', () => {
  it('répond à une salutation', () => {
    const r = replyTo({ npc: NPC, affinity: 0, history: [], day: 1 }, 'Salut !')
    expect(r.text.toLowerCase()).toContain('awa')
    expect(r.affinityDelta).toBeGreaterThan(0)
  })

  it('un message vide ne plante pas', () => {
    const r = replyTo({ npc: NPC, affinity: 0, history: [], day: 1 }, '   ')
    expect(r.text.length).toBeGreaterThan(0)
  })

  it('refuse le numéro à affinité faible', () => {
    const r = replyTo({ npc: NPC, affinity: 0, history: [], day: 1 }, "Tu peux me donner ton numéro ?")
    expect(r.givesPhone).toBe(false)
  })

  it('donne le numéro à affinité suffisante', () => {
    const r = replyTo({ npc: NPC, affinity: 30, history: [], day: 1 }, "Je peux avoir ton numéro ?")
    expect(r.givesPhone).toBe(true)
  })

  it('accepte une invitation à affinité élevée', () => {
    const r = replyTo({ npc: NPC, affinity: 45, history: [], day: 1 }, "On va manger ensemble au resto ?")
    expect(r.acceptedInvite).toBe(true)
  })

  it('refuse une invitation à affinité faible', () => {
    const r = replyTo({ npc: NPC, affinity: 2, history: [], day: 1 }, "Viens dîner avec moi au restaurant")
    expect(r.acceptedInvite).toBe(false)
  })

  it('répond à une question sur le métier', () => {
    const r = replyTo({ npc: NPC, affinity: 0, history: [], day: 1 }, "Tu fais quoi dans la vie ?")
    expect(r.text).toContain('supérette')
  })

  it('génère des numéros maliens uniques-ish', () => {
    const p1 = generateMalianPhone('npc-a')
    expect(p1.startsWith('+223 ')).toBe(true)
  })
})
