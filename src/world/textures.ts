/**
 * textures.ts — Textures procédurales (canvas) : aucun asset externe requis.
 * Chaque texture est déterministe pour stabiliser le rendu entre sessions.
 */
import * as THREE from 'three'
import { mulberry32, type BuildingPalette, type BuildingSpec } from './cityData'

function makeCanvas(size: number, height?: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = height ?? size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D non supporté')
  return [canvas, ctx]
}

function toTexture(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, alpha: number, rng: () => number) {
  for (let i = 0; i < count; i++) {
    const v = rng() > 0.5 ? 255 : 0
    ctx.fillStyle = `rgba(${v},${v},${v},${(rng() * alpha).toFixed(3)})`
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2)
  }
}

const PALETTE_COLORS: Record<BuildingPalette, { base: string; dark: string; light: string }> = {
  concrete: { base: '#b9b5ab', dark: '#8f8b82', light: '#d2cfc6' },
  sand: { base: '#cbb593', dark: '#a08e70', light: '#e3d3b8' },
  brick: { base: '#a9715a', dark: '#7d4f3e', light: '#c7927e' },
  terracotta: { base: '#b0623f', dark: '#84452b', light: '#cd8a61' },
  slate: { base: '#8d9299', dark: '#656a71', light: '#b2b7bd' },
  cream: { base: '#d8cfc0', dark: '#aaa190', light: '#eee7da' },
}

/** Façade réaliste : soubassement commercial, étages de fenêtres, quelques fenêtres allumées, enseigne pour les commerces. */
export function facadeTexture(spec: BuildingSpec): THREE.CanvasTexture {
  const S = 512
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(hashString(spec.id))
  const colors = PALETTE_COLORS[spec.palette]

  // Fond avec léger dégradé vertical (plus sombre à la base).
  const grad = ctx.createLinearGradient(0, 0, 0, S)
  grad.addColorStop(0, colors.light)
  grad.addColorStop(0.35, colors.base)
  grad.addColorStop(1, colors.dark)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 900, 0.08, rng)

  // Bandeau de toit (parapet).
  ctx.fillStyle = colors.dark
  ctx.fillRect(0, 0, S, 14)

  const floors = spec.floors
  const groundFloorPx = Math.round(S / (floors + 0.35)) // RDC un peu plus haut
  const upperPx = (S - groundFloorPx) / Math.max(1, floors - 1)
  const cols = Math.max(2, Math.round(spec.w / 3.4))
  const cellW = S / cols

  // --- RDC commercial ---
  const gTop = S - groundFloorPx
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  ctx.fillRect(0, gTop, S, groundFloorPx)
  if (spec.commercial) {
    // Porte centrée.
    const doorW = S * 0.14
    const doorH = groundFloorPx * 0.62
    const doorX = S / 2 - doorW / 2
    const doorY = S - doorH
    ctx.fillStyle = '#2c2620'
    ctx.fillRect(doorX - 6, doorY - 6, doorW + 12, doorH + 6)
    ctx.fillStyle = '#574433'
    ctx.fillRect(doorX, doorY, doorW, doorH)
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    ctx.fillRect(doorX + doorW * 0.55, doorY, doorW * 0.18, doorH)
    // Auvent coloré.
    ctx.fillStyle = '#8a2f2b'
    ctx.fillRect(0, gTop + 8, S, 16)
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = 'bold 26px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (spec.commercialName) ctx.fillText(spec.commercialName.toUpperCase(), S / 2, gTop + 18, S - 40)
    // Grandes vitrines.
    ctx.fillStyle = '#1d2833'
    ctx.fillRect(S * 0.07, gTop + 34, S * 0.24, groundFloorPx - 60)
    ctx.fillRect(S * 0.69, gTop + 34, S * 0.24, groundFloorPx - 60)
  } else {
    // Entrée résidentielle simple.
    const doorW = S * 0.1
    const doorH = groundFloorPx * 0.56
    ctx.fillStyle = '#33291f'
    ctx.fillRect(S / 2 - doorW / 2, S - doorH, doorW, doorH)
  }

  // --- Étages : fenêtres ---
  for (let f = 0; f < floors - 1; f++) {
    const floorTop = S - groundFloorPx - (f + 1) * upperPx
    for (let c = 0; c < cols; c++) {
      const wx = c * cellW + cellW * 0.24
      const ww = cellW * 0.52
      const wy = floorTop + upperPx * 0.24
      const wh = upperPx * 0.52
      // Cadre.
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8)
      // Vitre : dégradé sombre, rarement éclairée.
      const lit = rng() < 0.16
      const wg = ctx.createLinearGradient(0, wy, 0, wy + wh)
      if (lit) {
        wg.addColorStop(0, '#ffdf9e')
        wg.addColorStop(1, '#c79a4b')
      } else {
        wg.addColorStop(0, '#3b4a5c')
        wg.addColorStop(0.5, '#232d3a')
        wg.addColorStop(1, '#151c26')
      }
      ctx.fillStyle = wg
      ctx.fillRect(wx, wy, ww, wh)
      // Croisillon.
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(wx + ww / 2 - 2, wy, 4, wh)
      ctx.fillRect(wx, wy + wh / 2 - 2, ww, 4)
      // Rebord de fenêtre.
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(wx - 4, wy + wh + 4, ww + 8, 4)
    }
  }

  return toTexture(canvas)
}

/** Carreau de chaussée (12 m de long) : asphalte + lignes latérales + pointillés centraux. */
export function roadTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(987654321)
  ctx.fillStyle = '#34343a'
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 2600, 0.16, rng)
  // Légère variation centrale (traces de pneus).
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.fillRect(S * 0.3, 0, S * 0.09, S)
  ctx.fillRect(S * 0.61, 0, S * 0.09, S)
  // Lignes latérales continues.
  ctx.fillStyle = 'rgba(235,235,225,0.75)'
  ctx.fillRect(10, 0, 5, S)
  ctx.fillRect(S - 15, 0, 5, S)
  // Pointillés centraux.
  ctx.fillStyle = 'rgba(235,235,225,0.85)'
  ctx.fillRect(S / 2 - 3, 34, 6, 74)
  return toTexture(canvas)
}

/** Asphalte nu (intersections). */
export function plainAsphaltTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(135792468)
  ctx.fillStyle = '#35353b'
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 2400, 0.15, rng)
  return toTexture(canvas)
}

/** Béton de trottoir — dalles. */
export function sidewalkTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(246813579)
  ctx.fillStyle = '#b3b1aa'
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 1500, 0.1, rng)
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 3
  for (let i = 0; i <= 2; i++) {
    const p = i * (S / 2)
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke()
  }
  return toTexture(canvas)
}

/** Dalle béton clair (intérieur des îlots). */
export function plazaTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(112233445)
  ctx.fillStyle = '#a3a196'
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 1200, 0.09, rng)
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'
  ctx.lineWidth = 2
  for (let i = 0; i <= 1; i++) {
    const p = i * S
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke()
  }
  return toTexture(canvas)
}

/** Herbe brûlée / savane urbaine. */
export function grassTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(554433221)
  ctx.fillStyle = '#5d7040'
  ctx.fillRect(0, 0, S, S)
  for (let i = 0; i < 5200; i++) {
    const shade = rng()
    ctx.fillStyle = shade > 0.66 ? 'rgba(140,158,84,0.5)' : shade > 0.33 ? 'rgba(84,104,52,0.5)' : 'rgba(60,76,36,0.5)'
    const s = 1 + rng() * 3
    ctx.fillRect(rng() * S, rng() * S, s, s)
  }
  return toTexture(canvas)
}

/** Sol général (sous tout le reste). */
export function groundTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(99887766)
  ctx.fillStyle = '#6b6a63'
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 2800, 0.12, rng)
  return toTexture(canvas, 24, 24)
}

/** Passage piéton (fond transparent, bandes blanches transversales). */
export function crosswalkTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128, 256)
  ctx.clearRect(0, 0, 128, 256)
  ctx.fillStyle = 'rgba(238,238,232,0.92)'
  const stripeW = 128 / 7
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(i * stripeW * 1.75, 0, stripeW, 256)
  }
  const tex = toTexture(canvas)
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/** Panneau d'arrêt de bus. */
export function busSignTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128)
  ctx.clearRect(0, 0, 128, 128)
  ctx.fillStyle = '#12467e'
  ctx.beginPath()
  ctx.roundRect(4, 4, 120, 120, 22)
  ctx.fill()
  ctx.strokeStyle = '#f2f2ee'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 54px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('BUS', 64, 68)
  const tex = toTexture(canvas)
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

/** Sol intérieur de restaurant : zellige chaud (carreaux crème/terre cuite). */
export function restaurantFloorTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(19283746)
  ctx.fillStyle = '#d8c9a3'
  ctx.fillRect(0, 0, S, S)
  const tile = 64
  for (let y = 0; y < S; y += tile) {
    for (let x = 0; x < S; x += tile) {
      const even = ((x + y) / tile) % 2 === 0
      ctx.fillStyle = even ? '#cbb586' : '#b98a5a'
      ctx.fillRect(x, y, tile, tile)
      ctx.strokeStyle = 'rgba(60,40,20,0.55)'
      ctx.lineWidth = 4
      ctx.strokeRect(x, y, tile, tile)
      speckle(ctx, 1, 0, 0, rng) // no-op mais garde rng cohérent
    }
  }
  return toTexture(canvas, 6, 6)
}

/** Mur intérieur : enduit clair avec soubassement. */
export function restaurantWallTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(56473829)
  ctx.fillStyle = '#e8dfc9'
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 700, 0.05, rng)
  ctx.fillStyle = '#8a5a33'
  ctx.fillRect(0, S - 40, S, 40) // soubassement bois
  return toTexture(canvas, 4, 1.6)
}

/** Bois pour mobilier intérieur (tables, banquette). */
export function woodTexture(): THREE.CanvasTexture {
  const S = 256
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(31241231)
  ctx.fillStyle = '#6e4a2a'
  ctx.fillRect(0, 0, S, S)
  for (let y = 0; y < S; y += 7) {
    ctx.strokeStyle = `rgba(30,18,8,${0.25 + rng() * 0.35})`
    ctx.lineWidth = 2 + rng() * 2
    ctx.beginPath()
    ctx.moveTo(0, y + rng() * 3)
    ctx.bezierCurveTo(S * 0.3, y + rng() * 6 - 3, S * 0.7, y + rng() * 6 - 3, S, y + rng() * 3)
    ctx.stroke()
  }
  speckle(ctx, S, 300, 0.08, rng)
  return toTexture(canvas)
}

/** Menu / ardoise murale avec le nom du restaurant. */
export function menuBoardTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 384)
  ctx.fillStyle = '#2b2b26'
  ctx.fillRect(0, 0, 512, 384)
  ctx.strokeStyle = '#c8a86b'
  ctx.lineWidth = 14
  ctx.strokeRect(10, 10, 492, 364)
  ctx.fillStyle = '#e8d8b0'
  ctx.textAlign = 'center'
  ctx.font = 'bold 46px Georgia, serif'
  ctx.fillText('LE FLEUVE', 256, 84)
  ctx.font = '22px Georgia, serif'
  ctx.fillStyle = '#c8a86b'
  ctx.fillText('— Cuisine malienne & grillades —', 256, 128)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#e8d8b0'
  ctx.font = '26px Georgia, serif'
  const lines = [
    'Thiéboudienne ........ 3 500',
    'Maffé poulet .......... 3 000',
    'Yassa cuisinère ....... 2 500',
    'Poulet bicyclette ...... 2 000',
    'Jus de gingembre .......... 500',
    'Eau minérale ............... 300',
  ]
  lines.forEach((l, i) => ctx.fillText(l, 56, 182 + i * 34))
  return toTexture(canvas)
}

/** Nappe de table ronde (claire, bords colorés). */
export function tableclothTexture(): THREE.CanvasTexture {
  const S = 128
  const [canvas, ctx] = makeCanvas(S)
  const rng = mulberry32(77665544)
  ctx.fillStyle = '#efe6d2'
  ctx.fillRect(0, 0, S, S)
  speckle(ctx, S, 200, 0.06, rng)
  ctx.strokeStyle = '#8a2f2b'
  ctx.lineWidth = 6
  ctx.strokeRect(4, 4, S - 8, S - 8)
  return toTexture(canvas)
}
