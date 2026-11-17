/**
 * DialoguePanel.ts — Panneau de conversation (DOM).
 * Le joueur écrit en français libre ; le PNJ répond (IA si configurée,
 * sinon moteur local). Inclut : entête PNJ + affinité, historique de
 * messages, saisie + Entrée, raccourcis ("Salut", "Numéro ?", "Inviter").
 */
import type { DialogueTurn } from '../core/dialogueEngine'

export interface DialoguePanelNpc {
  id: string
  fullName: string
  age: number
  roleLabel: string
}

export class DialoguePanel {
  readonly root: HTMLDivElement
  onSend: ((text: string) => void) | null = null
  onClose: (() => void) | null = null

  private readonly nameEl: HTMLDivElement
  private readonly metaEl: HTMLDivElement
  private readonly heartsEl: HTMLDivElement
  private readonly messagesEl: HTMLDivElement
  private readonly input: HTMLInputElement
  private readonly sendBtn: HTMLButtonElement
  private readonly thinkingEl: HTMLDivElement
  private open = false

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'clg-panel clg-dialogue'
    this.root.setAttribute('aria-hidden', 'true')
    this.root.innerHTML = `
      <div class="clg-panel-head">
        <div class="clg-avatar" data-role="avatar">A</div>
        <div class="clg-panel-id">
          <div class="clg-panel-name" data-role="name">PNJ</div>
          <div class="clg-panel-meta" data-role="meta">26 ans · habitant(e)</div>
          <div class="clg-hearts" data-role="hearts" aria-label="Affinité"></div>
        </div>
        <button class="clg-panel-close" data-role="close" type="button" aria-label="Fermer la conversation">✕</button>
      </div>
      <div class="clg-messages" data-role="messages" aria-live="polite"></div>
      <div class="clg-thinking" data-role="thinking">…</div>
      <div class="clg-chips">
        <button type="button" data-chip="Salut !">👋 Salut&nbsp;!</button>
        <button type="button" data-chip="Tu peux me donner ton numéro ?">📞 Demander le numéro</button>
        <button type="button" data-chip="On va manger ensemble au restaurant ?">🍽️ Inviter au resto</button>
        <button type="button" data-chip="Au revoir.">🚶 Au revoir</button>
      </div>
      <form class="clg-composer" data-role="form">
        <input type="text" data-role="input" placeholder="Écris ton message…" autocomplete="off" maxlength="240" aria-label="Message pour le PNJ" />
        <button type="submit" data-role="send">Envoyer</button>
      </form>
    `
    container.appendChild(this.root)

    this.nameEl = this.mustFind('[data-role="name"]')
    this.metaEl = this.mustFind('[data-role="meta"]')
    this.heartsEl = this.mustFind('[data-role="hearts"]')
    this.messagesEl = this.mustFind('[data-role="messages"]')
    this.thinkingEl = this.mustFind('[data-role="thinking"]')
    this.input = this.mustFind('[data-role="input"]')
    this.sendBtn = this.mustFind('[data-role="send"]')
    const closeBtn = this.mustFind<HTMLButtonElement>('[data-role="close"]')
    closeBtn.addEventListener('click', () => this.close())

    const form = this.mustFind<HTMLFormElement>('[data-role="form"]')
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const text = this.input.value.trim()
      if (text.length === 0) return
      this.input.value = ''
      this.onSend?.(text)
    })

    for (const chip of this.root.querySelectorAll<HTMLButtonElement>('[data-chip]')) {
      chip.addEventListener('click', () => {
        this.input.value = ''
        this.onSend?.(chip.dataset.chip ?? '')
      })
    }

  }

  private mustFind<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector)
    if (!el) throw new Error(`DialoguePanel : élément introuvable (${selector})`)
    return el
  }

  openWith(npc: DialoguePanelNpc, affinity: number, history: DialogueTurn[]): void {
    this.open = true
    this.root.setAttribute('aria-hidden', 'false')
    this.root.classList.add('is-visible')
    this.nameEl.textContent = npc.fullName
    this.metaEl.textContent = `${npc.age} ans · ${npc.roleLabel}`
    const avatar = this.mustFind<HTMLDivElement>('[data-role="avatar"]')
    avatar.textContent = npc.fullName.split(' ').map((p) => p[0] ?? '').slice(0, 2).join('').toUpperCase()
    this.renderAffinity(affinity)
    this.messagesEl.innerHTML = ''
    for (const turn of history.slice(-14)) {
      this.appendBubble(turn.role === 'player' ? 'player' : 'npc', turn.text)
    }
    this.thinkingEl.classList.remove('is-visible')
    window.setTimeout(() => this.input.focus(), 30)
  }

  renderAffinity(value: number): void {
    // 5 cœurs : seuils -40, -10, 10, 35, 65
    const thresholds = [-40, -10, 10, 35, 65]
    this.heartsEl.innerHTML = thresholds
      .map((t) => {
        const filled = value >= t
        const hot = value >= 65 && t === 65
        return `<span class="clg-heart${filled ? ' is-filled' : ''}${hot ? ' is-hot' : ''}">${filled ? '♥' : '♡'}</span>`
      })
      .join('')
  }

  appendBubble(role: 'player' | 'npc', text: string): void {
    const bubble = document.createElement('div')
    bubble.className = `clg-bubble clg-bubble-${role}`
    bubble.textContent = text
    this.messagesEl.appendChild(bubble)
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  setThinking(thinking: boolean): void {
    this.thinkingEl.classList.toggle('is-visible', thinking)
    this.sendBtn.disabled = thinking
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
