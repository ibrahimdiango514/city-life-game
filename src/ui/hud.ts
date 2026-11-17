/**
 * HUD.ts — Interface en DOM : barre supérieure (marque, lieu, horloge,
 * statut Supabase), prompt contextuel, toasts, panneau de contrôles,
 * écran de démarrage / pause. Tout le texte joueur est en français.
 */

export type SupabaseStatus = 'connected' | 'unconfigured' | 'error'
export type OverlayMode = 'hidden' | 'start' | 'paused'

const CONTROLS_HTML = `
  <div class="row"><span class="clg-kbd">Z / W</span><span class="clg-kbd">Q / A</span><span class="clg-kbd">S</span><span class="clg-kbd">D</span> Se déplacer</div>
  <div class="row"><span class="clg-kbd">Shift</span> Courir</div>
  <div class="row"><span class="clg-kbd">Souris</span> Regarder</div>
  <div class="row"><span class="clg-kbd">Molette</span> Zoom</div>
  <div class="row"><span class="clg-kbd">E</span> Interagir</div>
  <div class="row"><span class="clg-kbd">Échap</span> Menu</div>
`

export class HUD {
  readonly root: HTMLDivElement
  onPlayRequested: (() => void) | null = null

  private readonly overlay: HTMLDivElement
  private readonly overlayKicker: HTMLDivElement
  private readonly title: HTMLHeadingElement
  private readonly tagline: HTMLParagraphElement
  private readonly playButton: HTMLButtonElement
  private readonly prompt: HTMLDivElement
  private readonly promptText: HTMLSpanElement
  private readonly toast: HTMLDivElement
  private readonly clockEl: HTMLDivElement
  private readonly locationEl: HTMLSpanElement
  private readonly supabaseEl: HTMLDivElement
  private readonly supabaseLabel: HTMLSpanElement

  private toastTimer: ReturnType<typeof setTimeout> | null = null
  private lastPrompt: string | null = null
  private lastClock = ''
  private lastLocation = ''

  constructor(container: HTMLElement) {
    this.root = document.createElement('div')
    this.root.className = 'clg-root'
    this.root.innerHTML = `
      <div class="clg-vignette"></div>
      <div class="clg-crosshair"></div>

      <header class="clg-topbar">
        <div class="clg-brand">
          <div class="clg-logo">CITY LIFE <em>GAME</em></div>
          <div class="clg-stage">Étape 1 · Fondations — Centre-Ville</div>
          <div class="clg-location">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z" stroke="#ffd98a" stroke-width="1.6"/>
              <circle cx="12" cy="10" r="2.4" fill="#ffd98a"/>
            </svg>
            <span data-role="location">Centre-Ville</span>
          </div>
        </div>
        <div class="clg-status">
          <div class="clg-clock" data-role="clock">Jour 1 · 08:00 · Matin</div>
          <div class="clg-supabase is-unconfigured" data-role="supabase" title="Vérification de la connexion…">
            <span class="dot"></span><span data-role="supabase-label">Supabase : vérification…</span>
          </div>
        </div>
      </header>

      <div class="clg-controls">${CONTROLS_HTML}</div>

      <div class="clg-prompt" data-role="prompt">
        <span class="clg-kbd">E</span><span data-role="prompt-text"></span>
      </div>

      <div class="clg-toast" data-role="toast"></div>

      <div class="clg-overlay" data-role="overlay">
        <div class="clg-overlay-inner">
          <div class="clg-kicker" data-role="kicker">Étape 1 — Fondations · Prototype jouable</div>
          <h1 class="clg-title" data-role="title">CITY LIFE<br/><em>GAME</em></h1>
          <p class="clg-tagline" data-role="tagline">Vivez une vraie vie au cœur de la ville.</p>
          <button class="clg-play" data-role="play" type="button">Cliquer pour jouer</button>
          <div class="clg-overlay-controls">
            <div class="row"><span class="clg-kbd">Z / W</span>+<span class="clg-kbd">Q / A</span>+<span class="clg-kbd">S</span>+<span class="clg-kbd">D</span> Marcher</div>
            <div class="row"><span class="clg-kbd">Shift</span> Courir</div>
            <div class="row"><span class="clg-kbd">Souris</span> Regarder autour</div>
            <div class="row"><span class="clg-kbd">Molette</span> Zoom</div>
            <div class="row"><span class="clg-kbd">E</span> Parler / interagir</div>
            <div class="row"><span class="clg-kbd">Échap</span> Menu</div>
          </div>
          <p class="clg-disclaimer">Personnages adultes uniquement · Simulation évolutive</p>
        </div>
      </div>
    `
    container.appendChild(this.root)

    this.overlay = this.mustFind('[data-role="overlay"]')
    this.overlayKicker = this.mustFind('[data-role="kicker"]')
    this.title = this.mustFind('[data-role="title"]')
    this.tagline = this.mustFind('[data-role="tagline"]')
    this.playButton = this.mustFind('[data-role="play"]')
    this.prompt = this.mustFind('[data-role="prompt"]')
    this.promptText = this.mustFind('[data-role="prompt-text"]')
    this.toast = this.mustFind('[data-role="toast"]')
    this.clockEl = this.mustFind('[data-role="clock"]')
    this.locationEl = this.mustFind('[data-role="location"]')
    this.supabaseEl = this.mustFind('[data-role="supabase"]')
    this.supabaseLabel = this.mustFind('[data-role="supabase-label"]')

    this.playButton.addEventListener('click', () => {
      this.onPlayRequested?.()
    })
  }

  private mustFind<T extends HTMLElement>(selector: string): T {
    const el = this.root.querySelector<T>(selector)
    if (!el) throw new Error(`HUD : élément introuvable (${selector})`)
    return el
  }

  setPrompt(text: string | null): void {
    if (text === this.lastPrompt) return
    this.lastPrompt = text
    if (text) {
      this.promptText.textContent = text
      this.prompt.classList.add('is-visible')
    } else {
      this.prompt.classList.remove('is-visible')
    }
  }

  showToast(message: string, durationMs = 5200): void {
    this.toast.textContent = message
    this.toast.classList.add('is-visible')
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('is-visible')
      this.toastTimer = null
    }, durationMs)
  }

  setClock(label: string): void {
    if (label === this.lastClock) return
    this.lastClock = label
    this.clockEl.textContent = label
  }

  setLocation(label: string): void {
    if (label === this.lastLocation) return
    this.lastLocation = label
    this.locationEl.textContent = label
  }

  setSupabase(status: SupabaseStatus, detail: string): void {
    this.supabaseEl.classList.remove('is-connected', 'is-error', 'is-unconfigured')
    this.supabaseEl.classList.add(`is-${status}`)
    this.supabaseEl.title = detail
    this.supabaseLabel.textContent =
      status === 'connected' ? 'Supabase : connecté' : status === 'error' ? 'Supabase : erreur' : 'Supabase : non configuré'
  }

  setOverlay(mode: OverlayMode): void {
    if (mode === 'hidden') {
      this.overlay.classList.add('is-hidden')
      return
    }
    this.overlay.classList.remove('is-hidden')
    if (mode === 'start') {
      this.overlayKicker.textContent = 'Étape 1 — Fondations · Prototype jouable'
      this.title.innerHTML = 'CITY LIFE<br/><em>GAME</em>'
      this.tagline.textContent = 'Vivez une vraie vie au cœur de la ville.'
      this.playButton.textContent = 'Cliquer pour jouer'
    } else {
      this.overlayKicker.textContent = 'Partie suspendue'
      this.title.innerHTML = 'PAUSE'
      this.tagline.textContent = 'Le temps s’arrête dans le Centre-Ville…'
      this.playButton.textContent = 'Reprendre la partie'
    }
  }
}
