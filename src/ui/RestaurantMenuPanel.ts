/**
 * RestaurantMenuPanel.ts — La carte du restaurant « Le Fleuve » (DOM).
 * Vue « carte » : choisir des plats → « Commander ».
 * Vue « table » : après commande — « Déguster » puis « Payer l'addition ».
 */
import { LE_FLEUVE_MENU, type MenuItem } from '../data/menu'
import { formatMoney } from '../core/simulation'

export type MenuPanelView = 'carte' | 'addition'

export class RestaurantMenuPanel {
  readonly root: HTMLDivElement
  onOrder: ((itemIds: string[]) => void) | null = null
  onEat: (() => void) | null = null
  onPay: (() => void) | null = null
  onClose: (() => void) | null = null

  private readonly listEl: HTMLDivElement
  private readonly totalEl: HTMLSpanElement
  private readonly orderBtn: HTMLButtonElement
  private readonly eatBtn: HTMLButtonElement
  private readonly payBtn: HTMLButtonElement
  private readonly billEl: HTMLDivElement
  private readonly titleEl: HTMLDivElement
  private readonly quantities = new Map<string, number>()
  private open = false
  private view: MenuPanelView = 'carte'
  private billTotal = 0

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'clg-panel clg-menu'
    this.root.setAttribute('aria-hidden', 'true')
    this.root.innerHTML = `
      <div class="clg-panel-head">
        <div class="clg-avatar clg-avatar-resto">🍴</div>
        <div class="clg-panel-id">
          <div class="clg-panel-name">Le Fleuve — La Carte</div>
          <div class="clg-panel-meta">Cuisine malienne &amp; grillades · service à table</div>
        </div>
        <button class="clg-panel-close" data-role="close" type="button" aria-label="Fermer la carte">✕</button>
      </div>
      <div class="clg-menu-list" data-role="list"></div>
      <div class="clg-menu-foot">
        <div class="clg-menu-total"><span data-role="title">Total</span><strong><span data-role="total">0 FCFA</span></strong></div>
        <div class="clg-menu-actions">
          <button class="clg-btn clg-btn-ghost" data-role="eat" type="button" hidden>😋 Déguster le repas</button>
          <button class="clg-btn clg-btn-primary" data-role="order" type="button">Commander</button>
          <button class="clg-btn clg-btn-pay" data-role="pay" type="button" hidden>💵 Payer l'addition</button>
        </div>
      </div>
      <div class="clg-bill" data-role="bill" hidden></div>
    `
    container.appendChild(this.root)

    this.listEl = this.mustFind('[data-role="list"]')
    this.totalEl = this.mustFind('[data-role="total"]')
    this.orderBtn = this.mustFind('[data-role="order"]')
    this.eatBtn = this.mustFind('[data-role="eat"]')
    this.payBtn = this.mustFind('[data-role="pay"]')
    this.billEl = this.mustFind('[data-role="bill"]')
    this.titleEl = this.mustFind('[data-role="title"]')

    const closeBtn = this.mustFind<HTMLButtonElement>('[data-role="close"]')
    closeBtn.addEventListener('click', () => this.close())
    this.orderBtn.addEventListener('click', () => {
      const ids = this.selectedIds()
      if (ids.length > 0) this.onOrder?.(ids)
    })
    this.eatBtn.addEventListener('click', () => this.onEat?.())
    this.payBtn.addEventListener('click', () => this.onPay?.())

    for (const item of LE_FLEUVE_MENU) this.quantities.set(item.id, 0)
    this.render()
  }

  private mustFind<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector)
    if (!el) throw new Error(`RestaurantMenuPanel : élément introuvable (${selector})`)
    return el
  }

  private selectedIds(): string[] {
    const ids: string[] = []
    for (const [id, qty] of this.quantities) {
      for (let i = 0; i < qty; i++) ids.push(id)
    }
    return ids
  }

  private selectedTotal(): number {
    return LE_FLEUVE_MENU.reduce((sum, item) => sum + item.price * (this.quantities.get(item.id) ?? 0), 0)
  }

  private render(): void {
    if (this.view === 'carte') {
      this.titleEl.textContent = 'Total'
      this.listEl.innerHTML = LE_FLEUVE_MENU.map((item) => this.rowHtml(item, this.quantities.get(item.id) ?? 0)).join('')
      for (const button of this.listEl.querySelectorAll<HTMLButtonElement>('[data-inc]')) {
        button.addEventListener('click', () => {
          const id = button.dataset.inc as string
          this.quantities.set(id, Math.min(9, (this.quantities.get(id) ?? 0) + 1))
          this.render()
        })
      }
      for (const button of this.listEl.querySelectorAll<HTMLButtonElement>('[data-dec]')) {
        button.addEventListener('click', () => {
          const id = button.dataset.dec as string
          this.quantities.set(id, Math.max(0, (this.quantities.get(id) ?? 0) - 1))
          this.render()
        })
      }
      this.totalEl.textContent = formatMoney(this.selectedTotal())
      this.orderBtn.hidden = false
      this.eatBtn.hidden = true
      this.payBtn.hidden = true
      this.billEl.hidden = true
    } else {
      // Vue addition : résumé de la commande passée.
      this.titleEl.textContent = 'Addition'
      this.listEl.innerHTML = `<div class="clg-bill-lines">${this.billSummaryHtml()}</div>`
      this.totalEl.textContent = formatMoney(this.billTotal)
      this.orderBtn.hidden = true
      this.eatBtn.hidden = false
      this.payBtn.hidden = false
      this.billEl.hidden = true
    }
  }

  private billLines: string[] = []

  private billSummaryHtml(): string {
    return this.billLines.join('')
  }

  private rowHtml(item: MenuItem, qty: number): string {
    return `
      <div class="clg-dish${qty > 0 ? ' is-chosen' : ''}">
        <div class="clg-dish-info">
          <div class="clg-dish-name">${item.name}</div>
          <div class="clg-dish-meta">${item.calories} kcal · ${item.satiety > 0 ? `+${item.satiety} faim` : 'pour la soif'}</div>
        </div>
        <div class="clg-dish-price">${formatMoney(item.price)}</div>
        <div class="clg-qty">
          <button type="button" data-dec="${item.id}" aria-label="Retirer un ${item.name}">−</button>
          <span>${qty}</span>
          <button type="button" data-inc="${item.id}" aria-label="Ajouter un ${item.name}">+</button>
        </div>
      </div>`
  }

  /** Passe en vue « addition » avec les plats servis. */
  showBill(itemIds: string[], total: number): void {
    this.view = 'addition'
    this.billTotal = total
    const counts = new Map<string, number>()
    for (const id of itemIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    this.billLines = LE_FLEUVE_MENU.filter((item) => counts.has(item.id)).map(
      (item) => `<div class="clg-bill-line"><span>${counts.get(item.id)} × ${item.name}</span><span>${formatMoney(counts.get(item.id)! * item.price)}</span></div>`
    )
    this.render()
  }

  /** Repasse en vue « carte » (après paiement) et remet les quantités à zéro. */
  resetToCarte(): void {
    this.view = 'carte'
    for (const item of LE_FLEUVE_MENU) this.quantities.set(item.id, 0)
    this.billLines = []
    this.billTotal = 0
    this.render()
  }

  openPanel(): void {
    this.open = true
    this.root.setAttribute('aria-hidden', 'false')
    this.root.classList.add('is-visible')
  }

  isOpen(): boolean {
    return this.open
  }

  close(): void {
    if (!this.open) return
    this.open = false
    this.root.classList.remove('is-visible')
    this.root.setAttribute('aria-hidden', 'true')
    this.onClose?.()
  }
}
