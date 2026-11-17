/**
 * Input.ts — Clavier + souris (pointer lock) + molette.
 * Codes physiques (e.code) : ZQSD (AZERTY) et WASD (QWERTY) au même endroit.
 */
export class Input {
  private keys = new Set<string>()
  private lookDX = 0
  private lookDY = 0
  private wheelDelta = 0
  private interactQueued = false

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault()
    if (e.code === 'KeyE' && !e.repeat) this.interactQueued = true
    this.keys.add(e.code)
  }
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }
  private readonly onMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === this.canvas) {
      this.lookDX += e.movementX
      this.lookDY += e.movementY
    }
  }
  private readonly onWheel = (e: WheelEvent) => {
    if (document.pointerLockElement === this.canvas) {
      e.preventDefault()
      this.wheelDelta += Math.sign(e.deltaY)
    }
  }
  private readonly onBlur = () => {
    this.keys.clear()
  }

  constructor(private readonly canvas: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    document.addEventListener('mousemove', this.onMouseMove)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('blur', this.onBlur)
  }

  axisForward(): number {
    const f = this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0
    const b = this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0
    return f - b
  }

  axisRight(): number {
    const r = this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0
    const l = this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0
    return r - l
  }

  isRunDown(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
  }

  /** Consomme le delta souris accumulé depuis la dernière frame. */
  consumeLookDelta(): { dx: number; dy: number } {
    const d = { dx: this.lookDX, dy: this.lookDY }
    this.lookDX = 0
    this.lookDY = 0
    return d
  }

  /** Consomme les crans de molette (±1 par cran). */
  consumeWheel(): number {
    const w = this.wheelDelta
    this.wheelDelta = 0
    return w
  }

  /** Vrai une seule fois par appui sur E. */
  consumeInteract(): boolean {
    if (this.interactQueued) {
      this.interactQueued = false
      return true
    }
    return false
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    document.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('blur', this.onBlur)
  }
}
