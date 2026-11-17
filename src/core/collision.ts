/**
 * Collision / contraintes spatiales — module pur (testable sans DOM).
 * Le monde est plan (repère XZ). Les bâtiments sont des AABB,
 * les arbres/lampadaires sont approchés par des AABB également.
 */

export interface CirclePos {
  x: number
  z: number
}

export interface AABB {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

/** Pousse un cercle (joueur, PNJ) hors d'un AABB. Retourne la position corrigée. */
export function resolveCircleVsAABB(p: CirclePos, radius: number, box: AABB): CirclePos {
  const cx = Math.max(box.minX, Math.min(p.x, box.maxX))
  const cz = Math.max(box.minZ, Math.min(p.z, box.maxZ))
  const dx = p.x - cx
  const dz = p.z - cz
  const d2 = dx * dx + dz * dz

  if (d2 >= radius * radius) {
    return { x: p.x, z: p.z }
  }

  if (d2 === 0) {
    // Le centre du cercle est dans la boîte : on pousse selon le plus petit axe de sortie.
    const pushLeft = p.x - box.minX
    const pushRight = box.maxX - p.x
    const pushNear = p.z - box.minZ
    const pushFar = box.maxZ - p.z
    const m = Math.min(pushLeft, pushRight, pushNear, pushFar)
    if (m === pushLeft) return { x: box.minX - radius, z: p.z }
    if (m === pushRight) return { x: box.maxX + radius, z: p.z }
    if (m === pushNear) return { x: p.x, z: box.minZ - radius }
    return { x: p.x, z: box.maxZ + radius }
  }

  const d = Math.sqrt(d2)
  const push = (radius - d) / d
  return { x: p.x + dx * push, z: p.z + dz * push }
}

/** Pousse le cercle A hors du cercle B (séparation douce entre personnages). */
export function resolveCircleVsCircle(a: CirclePos, radiusA: number, b: CirclePos, radiusB: number): CirclePos {
  const dx = a.x - b.x
  const dz = a.z - b.z
  const d2 = dx * dx + dz * dz
  const minDist = radiusA + radiusB
  if (d2 >= minDist * minDist) return { x: a.x, z: a.z }
  if (d2 === 0) return { x: a.x + minDist, z: a.z }
  const d = Math.sqrt(d2)
  const push = (minDist - d) / d
  return { x: a.x + dx * push, z: a.z + dz * push }
}

/** Maintient un point à l'intérieur des limites du monde jouable. */
export function clampToWorld(p: CirclePos, halfSize: number, radius: number): CirclePos {
  const limit = halfSize - radius
  return {
    x: Math.max(-limit, Math.min(limit, p.x)),
    z: Math.max(-limit, Math.min(limit, p.z)),
  }
}

/** Vrai si le point est à l'intérieur d'un AABB (utile pour valider les cibles des PNJ). */
export function pointInAABB(x: number, z: number, box: AABB): boolean {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ
}
