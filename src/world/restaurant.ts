/**
 * restaurant.ts — Intérieur du restaurant « Le Fleuve ».
 *
 * Construit une salle jouable complète, positionnée loin dans le monde
 * (x=1000, z=1000 — la « salle parallèle » noie la transition ville ⇄
 * intérieur sans téléport visuel ni seconde passe de rendu).
 *
 * Comprend : sol zellige, murs, comptoir + machine, tableau de la carte,
 * 5 tables rondes + chaises (places assises interactives), banquette,
 * suspension, plantes, et Adama le serveur (PNJ).
 */
import * as THREE from 'three'
import type { AABB } from '../core/collision'
import {
  restaurantFloorTexture,
  restaurantWallTexture,
  woodTexture,
  menuBoardTexture,
  tableclothTexture,
} from './textures'

export const RESTAURANT_ORIGIN = { x: 1000, z: 1000 } as const

const ROOM_W = 11 // x
const ROOM_D = 8 // z
const ROOM_H = 3.4

export interface RestaurantTable {
  id: string
  /** Centre (monde). */
  x: number
  z: number
  /** Place assise (monde) + cap pour faire face à la table. */
  seat: { x: number; z: number; yaw: number }
  /** Ancre (enfant du groupe restaurant) pour poser les assiettes sur la table. */
  plateAnchor: THREE.Group
  label: string
}

export interface BuiltRestaurant {
  group: THREE.Group
  colliders: AABB[]
  tables: RestaurantTable[]
  /** Zone de sortie (monde). */
  exitZone: { x: number; z: number; radius: number }
  /** Point d'apparition en entrant (monde) + cap (face au Nord). */
  entrance: { x: number; y: number; z: number; yaw: number }
  /** Position (monde) du serveur Adama. */
  waiter: { x: number; z: number; yaw: number }
}

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

export function buildRestaurant(): BuiltRestaurant {
  const group = new THREE.Group()
  group.name = 'restaurant-le-fleuve'
  const ox = RESTAURANT_ORIGIN.x
  const oz = RESTAURANT_ORIGIN.z

  const wallTex = restaurantWallTexture()
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: '#e9e0cd', roughness: 0.94 })
  const wallMatDark = new THREE.MeshStandardMaterial({ color: '#6b5a44', roughness: 0.9 })
  const woodTex = woodTexture()
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, color: '#7a5533', roughness: 0.72 })
  const woodDark = new THREE.MeshStandardMaterial({ color: '#4a3421', roughness: 0.6 })
  const clothMat = new THREE.MeshStandardMaterial({ map: tableclothTexture(), roughness: 0.92 })
  const floorTex = restaurantFloorTexture()
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.05 })
  const accentMat = new THREE.MeshStandardMaterial({ color: '#8a2f2b', roughness: 0.6 })

  const worldAABB = (cx: number, cz: number, hw: number, hd: number): AABB => ({
    minX: ox + cx - hw,
    maxX: ox + cx + hw,
    minZ: oz + cz - hd,
    maxZ: oz + cz + hd,
  })
  const aabbs: AABB[] = []

  // ---------- Sol & plafond ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.001
  floor.receiveShadow = true
  group.add(floor)

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), wallMatDark)
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = ROOM_H
  group.add(ceiling)

  // ---------- Murs (avec ouverture pour la porte au Sud) ----------
  const wallT = 0.24
  // Nord (fond de la salle, z = +D/2)
  group.add(box(ROOM_W, ROOM_H, wallT, wallMat, 0, ROOM_H / 2, ROOM_D / 2 - wallT / 2))
  aabbs.push(worldAABB(0, ROOM_D / 2 - wallT / 2, ROOM_W / 2, wallT / 2))
  // Ouest (x = -W/2)
  group.add(box(wallT, ROOM_H, ROOM_D, wallMat, -ROOM_W / 2 + wallT / 2, ROOM_H / 2, 0))
  aabbs.push(worldAABB(-ROOM_W / 2 + wallT / 2, 0, wallT / 2, ROOM_D / 2))
  // Est (x = +W/2)
  group.add(box(wallT, ROOM_H, ROOM_D, wallMat, ROOM_W / 2 - wallT / 2, ROOM_H / 2, 0))
  aabbs.push(worldAABB(ROOM_W / 2 - wallT / 2, 0, wallT / 2, ROOM_D / 2))
  // Sud : deux segments + linteau au-dessus de la porte (porte 1.5 m au centre)
  const doorW = 1.5
  const seg = (ROOM_W - doorW) / 2
  group.add(box(seg, ROOM_H, wallT, wallMat, -(doorW / 2 + seg / 2), ROOM_H / 2, -ROOM_D / 2 + wallT / 2))
  group.add(box(seg, ROOM_H, wallT, wallMat, doorW / 2 + seg / 2, ROOM_H / 2, -ROOM_D / 2 + wallT / 2))
  group.add(box(doorW, ROOM_H - 2.1, wallT, wallMat, 0, 2.1 + (ROOM_H - 2.1) / 2, -ROOM_D / 2 + wallT / 2))
  aabbs.push(worldAABB(-(doorW / 2 + seg / 2), -ROOM_D / 2 + wallT / 2, seg / 2, wallT / 2))
  aabbs.push(worldAABB(doorW / 2 + seg / 2, -ROOM_D / 2 + wallT / 2, seg / 2, wallT / 2))

  // Porte ouverte (panneau sur le côté) + cadre
  const doorLeaf = box(doorW / 2, 2.05, 0.06, accentMat, -(doorW / 2 + doorW / 4) + 0.02, 1.03, -ROOM_D / 2 + wallT + 0.05)
  doorLeaf.rotation.y = -0.62
  group.add(doorLeaf)
  const frameMat = woodDark
  group.add(box(0.14, 2.16, 0.3, frameMat, -doorW / 2 - 0.07, 1.08, -ROOM_D / 2 + wallT / 2))
  group.add(box(0.14, 2.16, 0.3, frameMat, doorW / 2 + 0.07, 1.08, -ROOM_D / 2 + wallT / 2))
  group.add(box(doorW + 0.28, 0.14, 0.3, frameMat, 0, 2.16, -ROOM_D / 2 + wallT / 2))

  // ---------- Fenêtres au Nord (émissives) ----------
  const windowMat = new THREE.MeshStandardMaterial({
    color: '#fff7e0',
    emissive: '#ffe9b8',
    emissiveIntensity: 0.9,
    roughness: 0.4,
  })
  for (const wx of [-3.2, 0, 3.2]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.25), windowMat)
    win.position.set(wx, 1.95, ROOM_D / 2 - wallT - 0.005)
    win.rotation.y = Math.PI
    group.add(win)
    const sill = box(2.3, 0.09, 0.12, frameMat, wx, 1.28, ROOM_D / 2 - wallT - 0.06)
    group.add(sill)
  }

  // ---------- Comptoir Est + machine + caisse ----------
  const counter = box(1.15, 1.08, 5.6, woodMat, ROOM_W / 2 - wallT - 0.62, 0.54, 0.6)
  group.add(counter)
  group.add(box(1.32, 0.06, 5.8, woodDark, ROOM_W / 2 - wallT - 0.62, 1.11, 0.6))
  aabbs.push(worldAABB(ROOM_W / 2 - wallT - 0.62, 0.6, 0.72, 2.9))
  // Machine à expresso
  const machine = box(0.52, 0.36, 0.6, new THREE.MeshStandardMaterial({ color: '#9aa1ac', roughness: 0.35, metalness: 0.75 }), ROOM_W / 2 - wallT - 0.62, 1.33, 1.6)
  group.add(machine)
  group.add(box(0.2, 0.16, 0.3, new THREE.MeshStandardMaterial({ color: '#2e2e34', roughness: 0.4, metalness: 0.6 }), ROOM_W / 2 - wallT - 0.62, 1.59, 1.75))
  // Caisse enregistreuse
  group.add(box(0.42, 0.3, 0.38, new THREE.MeshStandardMaterial({ color: '#3c4a5a', roughness: 0.4, metalness: 0.35 }), ROOM_W / 2 - wallT - 0.62, 1.3, -0.6))
  // Étagère derrière le comptoir + bouteilles
  group.add(box(0.16, 0.05, 4.6, woodDark, ROOM_W / 2 - wallT - 0.08, 2.15, 0.6))
  const bottleColors = ['#7a3a2a', '#2a5a4a', '#c9b06a', '#4a3a6a', '#8a2f2b']
  bottleColors.forEach((c, i) => {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.075, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.25 })
    )
    bottle.position.set(ROOM_W / 2 - wallT - 0.08, 2.38, -1.3 + i * 0.95)
    group.add(bottle)
  })

  // ---------- Tableau de la carte (mur Est, au-dessus du comptoir) ----------
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.1),
    new THREE.MeshStandardMaterial({ map: menuBoardTexture(), roughness: 0.85 })
  )
  board.position.set(ROOM_W / 2 - wallT - 0.02, 2.35, 0.6)
  board.rotation.y = -Math.PI / 2
  group.add(board)

  // ---------- Tables rondes + chaises ----------
  const tableTopGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.055, 22)
  const pedestalGeo = new THREE.CylinderGeometry(0.085, 0.105, 0.69, 12)
  const baseGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.05, 16)
  const chairSeatGeo = new THREE.BoxGeometry(0.44, 0.06, 0.44)
  const chairBackGeo = new THREE.BoxGeometry(0.44, 0.52, 0.05)
  const chairLegGeo = new THREE.BoxGeometry(0.045, 0.45, 0.045)

  const tableDefs: Array<{ id: string; label: string; x: number; z: number }> = [
    { id: 'table-1', label: 'Table 1 (près de la banquette)', x: -3.7, z: 2.0 },
    { id: 'table-2', label: 'Table 2 (fond de la salle)', x: -3.7, z: -1.5 },
    { id: 'table-3', label: 'Table 3 (fenêtres)', x: 0.3, z: 2.5 },
    { id: 'table-4', label: 'Table 4 (centre)', x: 0.3, z: -0.6 },
    { id: 'table-5', label: 'Table 5 (près du comptoir)', x: -1.6, z: 0.5 },
  ]

  const tables: RestaurantTable[] = []
  tableDefs.forEach((def) => {
    const top = new THREE.Mesh(tableTopGeo, clothMat)
    top.position.set(def.x, 0.745, def.z)
    top.castShadow = true
    top.receiveShadow = true
    group.add(top)
    const pedestal = new THREE.Mesh(pedestalGeo, woodDark)
    pedestal.position.set(def.x, 0.38, def.z)
    group.add(pedestal)
    const tbase = new THREE.Mesh(baseGeo, woodDark)
    tbase.position.set(def.x, 0.025, def.z)
    group.add(tbase)
    aabbs.push(worldAABB(def.x, def.z, 0.78, 0.78))

    // Ancre d'assiettes (masquée jusqu'à la commande) — positions LOCALES au groupe.
    const plateAnchor = new THREE.Group()
    plateAnchor.position.set(def.x, 0.775, def.z)
    plateAnchor.visible = false
    group.add(plateAnchor)

    // 3 chaises autour (deux décoratives, une = place assise face nord)
    const chairAngles = [Math.PI * 0.5, Math.PI * 1.16, Math.PI * 1.84]
    chairAngles.forEach((angle) => {
      const cx = def.x + Math.cos(angle) * 1.08
      const cz = def.z + Math.sin(angle) * 1.08
      const chair = new THREE.Group()
      const seat = new THREE.Mesh(chairSeatGeo, woodMat)
      seat.position.y = 0.45
      seat.castShadow = true
      chair.add(seat)
      const back = new THREE.Mesh(chairBackGeo, woodMat)
      // Dossier à l'opposé de la table.
      back.position.set(Math.cos(angle) * 0.2, 0.72, Math.sin(angle) * 0.2)
      back.rotation.y = -angle + Math.PI / 2
      chair.add(back)
      for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]] as const) {
        const leg = new THREE.Mesh(chairLegGeo, woodDark)
        leg.position.set(lx, 0.225, lz)
        chair.add(leg)
      }
      chair.position.set(cx, 0, cz)
      chair.rotation.y = -angle - Math.PI / 2
      group.add(chair)
    })

    // Place assise : chaise plein sud de la table, face à la table.
    const seatAngle = Math.PI * 1.5
    const seatX = def.x + Math.cos(seatAngle) * 1.08
    const seatZ = def.z + Math.sin(seatAngle) * 1.08
    const yaw = Math.atan2(def.x - seatX, def.z - seatZ)

    tables.push({
      id: def.id,
      x: ox + def.x,
      z: oz + def.z,
      seat: { x: ox + seatX, z: oz + seatZ, yaw },
      plateAnchor,
      label: def.label,
    })
  })

  // ---------- Banquette Ouest ----------
  group.add(box(0.7, 0.48, 4.6, accentMat, -ROOM_W / 2 + wallT + 0.4, 0.24, 0.4))
  group.add(box(0.22, 1.05, 4.6, accentMat, -ROOM_W / 2 + wallT + 0.13, 0.53, 0.4))
  aabbs.push(worldAABB(-ROOM_W / 2 + wallT + 0.4, 0.4, 0.42, 2.35))

  // ---------- Suspensions (visuelles) + lampes ----------
  const lampMat = new THREE.MeshStandardMaterial({ color: '#2e2b26', roughness: 0.5, metalness: 0.3 })
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd77a', emissiveIntensity: 2.2 })
  for (const lx of [-2.4, 0.6]) {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 6), lampMat)
    cord.position.set(lx, ROOM_H - 0.37, 0.4)
    group.add(cord)
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 14, 1, true), lampMat)
    shade.position.set(lx, ROOM_H - 0.82, 0.4)
    group.add(shade)
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), bulbMat)
    bulb.position.set(lx, ROOM_H - 0.92, 0.4)
    group.add(bulb)
  }

  // ---------- Plantes d'intérieur ----------
  const potMat = new THREE.MeshStandardMaterial({ color: '#b0603a', roughness: 0.8 })
  const leafMat = new THREE.MeshStandardMaterial({ color: '#3f6a34', roughness: 0.85 })
  for (const [px, pz] of [[-4.6, -3.0], [4.6, -3.0]] as const) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.42, 10), potMat)
    pot.position.set(px, 0.21, pz)
    group.add(pot)
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), leafMat)
    foliage.position.set(px, 0.72, pz)
    foliage.scale.y = 1.15
    group.add(foliage)
  }

  // ---------- Lumières dédiées ----------
  const hemi = new THREE.HemisphereLight('#fff1dc', '#4a4036', 0.85)
  group.add(hemi)
  const warm1 = new THREE.PointLight('#ffd9a0', 60, 11, 2)
  warm1.position.set(-1.2, 2.45, 0.6)
  group.add(warm1)
  const warm2 = new THREE.PointLight('#ffcf90', 35, 9, 2)
  warm2.position.set(-3.7, 2.45, 0.6)
  group.add(warm2)

  group.position.set(ox, 0, oz)

  return {
    group,
    colliders: aabbs,
    tables,
    exitZone: { x: ox, z: oz - ROOM_D / 2 + 0.7, radius: 1.35 },
    entrance: { x: ox, y: 0, z: oz - ROOM_D / 2 + 1.5, yaw: 0 },
    waiter: { x: ox + 3.6, z: oz + 0.6, yaw: -Math.PI / 2 },
  }
}
