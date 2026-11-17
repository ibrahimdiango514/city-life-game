/**
 * cityBuilder.ts — Construit le quartier « Centre-Ville » : sol, routes,
 * trottoirs, îlots, bâtiments (procéduraux + ancres), mobilier urbain, arbres.
 * Retourne le groupe à ajouter à la scène et les colliders AABB du monde.
 */
import * as THREE from 'three'
import type { AABB } from '../core/collision'
import {
  WORLD_HALF, ROAD_CENTERS, ROAD_WIDTH, SIDEWALK_WIDTH, SIDEWALK_LINES,
  REGION_BOUNDS, PARK_RECT, buildingAABB, generateBuildings, mulberry32, sidewalkSpans,
} from './cityData'
import {
  facadeTexture, roadTexture, plainAsphaltTexture, sidewalkTexture,
  plazaTexture, grassTexture, groundTexture, crosswalkTexture, busSignTexture,
} from './textures'

export interface BuiltCity {
  group: THREE.Group
  colliders: AABB[]
}

const S = WORLD_HALF * 2

function addCollider(colliders: AABB[], x: number, z: number, halfW: number, halfD: number) {
  colliders.push({ minX: x - halfW, maxX: x + halfW, minZ: z - halfD, maxZ: z + halfD })
}

export function buildCity(): BuiltCity {
  const group = new THREE.Group()
  group.name = 'city'
  const colliders: AABB[] = []

  // ---------- Sol général ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 640),
    new THREE.MeshStandardMaterial({ map: groundTexture(), color: '#8f8e86', roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  group.add(ground)

  // ---------- Îlots (dalles / parc) ----------
  for (const [x0, x1] of REGION_BOUNDS) {
    for (const [z0, z1] of REGION_BOUNDS) {
      const w = x1 - x0
      const d = z1 - z0
      const isPark = x0 === PARK_RECT.minX && x1 === PARK_RECT.maxX && z0 === PARK_RECT.minZ && z1 === PARK_RECT.maxZ
      const tex = isPark ? grassTexture() : plazaTexture()
      tex.repeat.set(isPark ? w / 7 : w / 6, isPark ? d / 7 : d / 6)
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 1 })
      )
      patch.rotation.x = -Math.PI / 2
      patch.position.set((x0 + x1) / 2, 0.02, (z0 + z1) / 2)
      patch.receiveShadow = true
      group.add(patch)
    }
  }

  // ---------- Chaussées ----------
  const roadVertTex = roadTexture()
  roadVertTex.repeat.set(1, S / 12)
  const roadHorzTex = roadTexture()
  roadHorzTex.center.set(0.5, 0.5)
  roadHorzTex.rotation = Math.PI / 2
  roadHorzTex.repeat.set(S / 12, 1)
  const roadMatV = new THREE.MeshStandardMaterial({ map: roadVertTex, roughness: 0.94 })
  const roadMatH = new THREE.MeshStandardMaterial({ map: roadHorzTex, roughness: 0.94 })

  for (const cx of ROAD_CENTERS) {
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, S), roadMatV)
    vertical.rotation.x = -Math.PI / 2
    vertical.position.set(cx, 0.01, 0)
    vertical.receiveShadow = true
    group.add(vertical)

    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(S, ROAD_WIDTH), roadMatH)
    horizontal.rotation.x = -Math.PI / 2
    horizontal.position.set(0, 0.012, cx)
    horizontal.receiveShadow = true
    group.add(horizontal)
  }

  // ---------- Dalles d'intersection (asphalte nu) ----------
  const plainTex = plainAsphaltTexture()
  const plainMat = new THREE.MeshStandardMaterial({ map: plainTex, roughness: 0.96 })
  for (const cx of ROAD_CENTERS) {
    for (const cz of ROAD_CENTERS) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH + 0.15, ROAD_WIDTH + 0.15), plainMat)
      patch.rotation.x = -Math.PI / 2
      patch.position.set(cx, 0.015, cz)
      patch.receiveShadow = true
      group.add(patch)
    }
  }

  // ---------- Trottoirs (segments coupés aux intersections, rehaussés) ----------
  const addSidewalkSegments = (line: number, vertical: boolean) => {
    for (const [a, b] of sidewalkSpans()) {
      const len = b - a
      const tex = sidewalkTexture()
      if (vertical) tex.repeat.set(1, len / 4)
      else tex.repeat.set(len / 4, 1)
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })
      const h = vertical ? 0.16 : 0.152
      const box = vertical
        ? new THREE.BoxGeometry(SIDEWALK_WIDTH, h, len)
        : new THREE.BoxGeometry(len, h, SIDEWALK_WIDTH)
      const mesh = new THREE.Mesh(box, mat)
      mesh.position.set(vertical ? line : (a + b) / 2, h / 2, vertical ? (a + b) / 2 : line)
      mesh.receiveShadow = true
      group.add(mesh)
    }
  }
  for (const line of SIDEWALK_LINES) {
    addSidewalkSegments(line, true)
    addSidewalkSegments(line, false)
  }

  // Plaques de coin aux intersections (continuité visuelle des trottoirs)
  const cornerMat = new THREE.MeshStandardMaterial({ color: '#b3b1aa', roughness: 0.9 })
  for (const cx of ROAD_CENTERS) {
    for (const cz of ROAD_CENTERS) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.158, 4.35), cornerMat)
          plate.position.set(cx + sx * 8, 0.079, cz + sz * 8)
          plate.receiveShadow = true
          group.add(plate)
        }
      }
    }
  }

  // ---------- Passages piétons (intersection centrale) ----------
  const zebraTex = crosswalkTexture()
  const zebraMat = new THREE.MeshStandardMaterial({ map: zebraTex, transparent: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 })
  const zebraGeo = new THREE.PlaneGeometry(9.5, 3.1)
  const zebraGeoEW = zebraGeo.clone().rotateZ(Math.PI / 2)
  const zebN = new THREE.Mesh(zebraGeo, zebraMat); zebN.rotation.x = -Math.PI / 2; zebN.position.set(0, 0.025, -8.1)
  const zebS = new THREE.Mesh(zebraGeo, zebraMat); zebS.rotation.x = -Math.PI / 2; zebS.position.set(0, 0.025, 8.1)
  const zebE = new THREE.Mesh(zebraGeoEW, zebraMat); zebE.rotation.x = -Math.PI / 2; zebE.position.set(8.1, 0.025, 0)
  const zebW = new THREE.Mesh(zebraGeoEW, zebraMat); zebW.rotation.x = -Math.PI / 2; zebW.position.set(-8.1, 0.025, 0)
  group.add(zebN, zebS, zebE, zebW)

  // ---------- Bâtiments ----------
  const roofMat = new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.97 })
  const bottomMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 1 })
  for (const spec of generateBuildings()) {
    const sideMat = new THREE.MeshStandardMaterial({ map: facadeTexture(spec), roughness: 0.82, metalness: 0.05 })
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w, spec.h, spec.d),
      [sideMat, sideMat, roofMat, bottomMat, sideMat, sideMat]
    )
    mesh.position.set(spec.x, spec.h / 2, spec.z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = spec.commercialName ?? spec.id
    group.add(mesh)
    colliders.push(buildingAABB(spec))
  }

  // ---------- Lampadaires ----------
  const poleMat = new THREE.MeshStandardMaterial({ color: '#5f636a', roughness: 0.6, metalness: 0.55 })
  const headMat = new THREE.MeshStandardMaterial({ color: '#3c3f45', roughness: 0.5, metalness: 0.4, emissive: '#ffedb5', emissiveIntensity: 0.28 })
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 4.7, 10)
  const armGeo = new THREE.BoxGeometry(1.35, 0.09, 0.09)
  const headGeo = new THREE.BoxGeometry(0.62, 0.13, 0.26)

  const addLamp = (x: number, z: number, facing: 1 | -1, horizontal: boolean) => {
    const lamp = new THREE.Group()
    const pole = new THREE.Mesh(poleGeo, poleMat)
    pole.position.y = 2.35
    pole.castShadow = true
    const arm = new THREE.Mesh(armGeo, poleMat)
    arm.position.set(facing * 0.62, 4.62, 0)
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.set(facing * 1.2, 4.56, 0)
    lamp.add(pole, arm, head)
    lamp.position.set(x, 0.16, z) // sur le trottoir
    if (horizontal) lamp.rotation.y = Math.PI / 2
    group.add(lamp)
    addCollider(colliders, x, z, 0.18, 0.18)
  }

  let lampIndex = 0
  for (const cx of ROAD_CENTERS) {
    for (let t = -102; t <= 102; t += 34) {
      if (ROAD_CENTERS.some((cz) => Math.abs(t - cz) < 9)) continue
      const side = lampIndex % 2 === 0 ? 1 : -1
      addLamp(cx + side * 8.9, t, side === 1 ? -1 : 1, false)
      lampIndex++
    }
    for (let t = -85; t <= 85; t += 34) {
      if (ROAD_CENTERS.some((cz) => Math.abs(t - cz) < 9)) continue
      const side = lampIndex % 2 === 0 ? 1 : -1
      // Sur route horizontale le lampadaire est tourné de 90° : le sens du bras s'inverse.
      addLamp(t, cx + side * 8.9, side === 1 ? 1 : -1, true)
      lampIndex++
    }
  }

  // ---------- Arrêt de bus (« Centre-Ville », direction Gare Routière) ----------
  {
    const busStop = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.1, 8), poleMat)
    pole.position.y = 1.55
    pole.castShadow = true
    const signTex = busSignTexture()
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide, roughness: 0.5 })
    const sign = new THREE.Mesh(new THREE.CircleGeometry(0.46, 24), signMat)
    sign.position.y = 2.75
    const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.45), new THREE.MeshStandardMaterial({ color: '#4c5a68', roughness: 0.6, metalness: 0.3 }))
    benchSeat.position.set(-1.5, 0.48, 0.35)
    benchSeat.castShadow = true
    busStop.add(pole, sign, benchSeat)
    busStop.position.set(9, 0.16, 9)
    group.add(busStop)
    addCollider(colliders, 9, 9, 0.14, 0.14)
  }

  // ---------- Fontaine du parc ----------
  {
    const fountain = new THREE.Group()
    const stone = new THREE.MeshStandardMaterial({ color: '#a8adb4', roughness: 0.75 })
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.15, 0.8, 28), stone)
    basin.position.y = 0.4
    basin.castShadow = true
    basin.receiveShadow = true
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.14, 12, 32), stone)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.82
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1.78, 28),
      new THREE.MeshStandardMaterial({ color: '#3f6b8a', roughness: 0.12, metalness: 0.35 })
    )
    water.rotation.x = -Math.PI / 2
    water.position.y = 0.66
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.5, 16), stone)
    column.position.y = 1.55
    column.castShadow = true
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), new THREE.MeshStandardMaterial({ color: '#c9cdd3', roughness: 0.35, metalness: 0.5 }))
    orb.position.y = 2.42
    orb.castShadow = true
    fountain.add(basin, rim, water, column, orb)
    fountain.position.set(-46, 0, 33)
    group.add(fountain)
    addCollider(colliders, -46, 33, 2.2, 2.2)
  }

  // ---------- Bancs du parc ----------
  const benchMat = new THREE.MeshStandardMaterial({ color: '#4a3826', roughness: 0.8 })
  const benchLeg = new THREE.MeshStandardMaterial({ color: '#2e2e33', roughness: 0.5, metalness: 0.5 })
  const addBench = (x: number, z: number, rotY: number) => {
    const bench = new THREE.Group()
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.45), benchMat)
    seat.position.y = 0.46
    seat.castShadow = true
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 0.07), benchMat)
    back.position.set(0, 0.78, -0.22)
    back.rotation.x = -0.14
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.4), benchLeg)
    legA.position.set(-0.68, 0.23, 0)
    const legB = legA.clone()
    legB.position.x = 0.68
    bench.add(seat, back, legA, legB)
    bench.position.set(x, 0.02, z)
    bench.rotation.y = rotY
    group.add(bench)
  }
  addBench(-29, 47.5, 0.6)
  addBench(-49, 49, -0.35)

  // ---------- Arbres (parc + trottoirs) ----------
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#59452e', roughness: 0.95 })
  const foliageMats = [
    new THREE.MeshStandardMaterial({ color: '#40693a', roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: '#4d7a3c', roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: '#37592f', roughness: 0.95 }),
  ]
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.25, 9)
  const leafGeo = new THREE.SphereGeometry(1, 12, 10)

  const addTree = (x: number, z: number, scale: number, rng: () => number, yBase = 0) => {
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(trunkGeo, trunkMat)
    trunk.position.y = 0.62
    trunk.castShadow = true
    const mat = foliageMats[Math.floor(rng() * foliageMats.length)]
    const blob1 = new THREE.Mesh(leafGeo, mat)
    blob1.scale.set(1.05, 0.95, 1.05)
    blob1.position.y = 1.75
    blob1.castShadow = true
    const blob2 = new THREE.Mesh(leafGeo, mat)
    blob2.scale.set(0.68, 0.62, 0.68)
    blob2.position.set(0.35, 2.45, 0.15)
    blob2.castShadow = true
    tree.add(trunk, blob1, blob2)
    tree.position.set(x, yBase, z)
    tree.scale.setScalar(scale)
    group.add(tree)
    addCollider(colliders, x, z, 0.34 * scale, 0.34 * scale)
  }

  const parkRng = mulberry32(424242)
  for (let i = 0; i < 22; i++) {
    const x = PARK_RECT.minX + 4 + parkRng() * (PARK_RECT.maxX - PARK_RECT.minX - 8)
    const z = PARK_RECT.minZ + 4 + parkRng() * (PARK_RECT.maxZ - PARK_RECT.minZ - 8)
    // Garder l'espace de l'interaction « repos » et la fontaine dégagés.
    if (Math.hypot(x - -38, z - 40) < 3.2) continue
    if (Math.hypot(x - -46, z - 33) < 3.6) continue
    addTree(x, z, 0.85 + parkRng() * 0.6, parkRng)
  }

  const sidewalkTreeRng = mulberry32(13579)
  const sideTreeSpots: Array<{ x: number; z: number }> = [
    { x: -8 + 1.35, z: 26 }, { x: -8 - 1.35, z: -46 },
    { x: 8 + 1.35, z: -66 }, { x: 8 - 1.35, z: 56 },
    { x: 68 + 1.3, z: -32 }, { x: -68 - 1.3, z: 46 },
    { x: -68 + 1.3, z: -78 }, { x: 68 - 1.3, z: 76 },
    { x: -84 + 1.3, z: 14 }, { x: 84 - 1.3, z: -54 },
  ]
  for (const spot of sideTreeSpots) {
    addTree(spot.x, spot.z, 0.62 + sidewalkTreeRng() * 0.2, sidewalkTreeRng, 0.16)
  }

  return { group, colliders }
}
