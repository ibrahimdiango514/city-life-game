// @vitest-environment jsdom
/**
 * tests/ui.dom.test.ts — fumée DOM : HUD et panneaux se construisent sans
 * erreur, les slots dynamiques fonctionnent. (Pas de WebGL ici — le rendu
 * 3D se vérifie dans le navigateur.)
 */
import { describe, it, expect } from 'vitest'
import { HUD } from '../src/ui/hud'
import { DialoguePanel } from '../src/ui/DialoguePanel'
import { RestaurantMenuPanel } from '../src/ui/RestaurantMenuPanel'

function makeContainer(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('HUD', () => {
  it('se construit et reflète les stats', () => {
    const c = makeContainer()
    const hud = new HUD(c)
    hud.setMoney('45 500 FCFA')
    hud.setHunger(55)
    hud.setEnergy(12)
    hud.setSaveState('saved')
    hud.setLoading(false)
    hud.setLoading(true)
    expect(c.querySelector('[data-role="cash"]')?.textContent).toBe('45 500 FCFA')
    expect(c.querySelector<HTMLDivElement>('[data-role="hunger"]')?.style.width).toBe('55%')
    expect(c.querySelector<HTMLDivElement>('[data-role="energy"]')?.style.width).toBe('12%')
    expect(c.querySelector<HTMLDivElement>('[data-role="energy"]')?.classList.contains('is-low')).toBe(true)
    hud.setClock('Jour 2 · 14:30 · Après-midi')
    expect(c.querySelector('[data-role="clock"]')?.textContent).toContain('Jour 2')
  })
})

describe('DialoguePanel', () => {
  it('ouvre, affiche les messages et l’affinité', () => {
    const c = makeContainer()
    const panel = new DialoguePanel(c)
    panel.openWith(
      { id: 'n1', fullName: 'Awa Diarra', age: 26, roleLabel: 'commerçante' },
      12,
      [{ role: 'player', text: 'Salut !' }]
    )
    expect(c.querySelector('[data-role="name"]')?.textContent).toBe('Awa Diarra')
    expect(c.querySelectorAll('.clg-bubble').length).toBe(1)
    panel.appendBubble('npc', 'Bonjour toi !')
    expect(c.querySelectorAll('.clg-bubble').length).toBe(2)
    panel.appendBubble('npc', 'Ça va ?')
    panel.renderAffinity(50)
    expect(panel.isOpen()).toBe(true)
    panel.close()
    expect(panel.isOpen()).toBe(false)
  })

  it('désactive l’envoi pendant « thinking »', () => {
    const c = makeContainer()
    const panel = new DialoguePanel(c)
    panel.setThinking(true)
    const send = c.querySelector<HTMLButtonElement>('[data-role="send"]')
    expect(send?.disabled).toBe(true)
  })
})

describe('RestaurantMenuPanel', () => {
  it('parcourt le cycle : carte → commande → addition → reset', () => {
    const c = makeContainer()
    const menu = new RestaurantMenuPanel(c)
    menu.openPanel()
    // Deux maffés + une eau
    const inc = (id: string, n: number) => {
      for (let i = 0; i < n; i++) {
        c.querySelector<HTMLButtonElement>(`[data-inc="${id}"]`)?.click()
      }
    }
    inc('maffe', 2)
    inc('eau', 1)
    expect(c.querySelector('[data-role="total"]')?.textContent).toBe('6 300 FCFA')
    let ordered: string[] | null = null
    menu.onOrder = (ids) => { ordered = ids }
    c.querySelector<HTMLButtonElement>('[data-role="order"]')?.click()
    expect(ordered).toEqual(['maffe', 'maffe', 'eau'])
    menu.showBill(ordered ?? [], 6300)
    expect(c.querySelector('[data-role="total"]')?.textContent).toBe('6 300 FCFA')
    menu.resetToCarte()
    expect(c.querySelector('[data-role="total"]')?.textContent).toBe('0 FCFA')
    menu.close()
    expect(menu.isOpen()).toBe(false)
  })
})
