/**
 * humanoid.ts — Fabrique de personnages humanoïdes procéduraux.
 *
 * Rendu « humain crédible » sans asset externe : proportions anatomiques
 * (~1/7,5 tête), ellipsoïde de tête, capsules pour membres, visage discret
 * (yeux, nez, bouche), coiffures. Conçu pour être remplacé plus tard par de
 * vrais modèles glTF (Meshopt/Draco) sans changer l'API : seuls les rigs
 * changent, le gameplay manipule HumanoidRig.
 */
import * as THREE from 'three'

export type HairStyle = 'short' | 'afro' | 'bald'

export interface HumanoidOptions {
  height: number
  skin: string
  shirt: string
  pants: string
  hair: string
  hairStyle: HairStyle
  shoes?: string
  /** 0.88 élancé … 1.18 costaud. Défaut 1. */
  build?: number
}

export interface HumanoidRig {
  /** Origine aux pieds, le personnage fait face à +Z. */
  group: THREE.Group
  body: THREE.Group
  head: THREE.Group
  hipL: THREE.Group
  hipR: THREE.Group
  kneeL: THREE.Group
  kneeR: THREE.Group
  shoulderL: THREE.Group
  shoulderR: THREE.Group
  elbowL: THREE.Group
  elbowR: THREE.Group
  phase: number
  /** 0 = immobile, 1 = marche — lissé. */
  moveAmount: number
  height: number
}

export interface HumanoidAnimInput {
  /** Vitesse horizontale réelle en m/s. */
  speed: number
  dt: number
  /** 0 immobile, 1 en déplacement. */
  moving: 0 | 1
  /** 0 marche … 1 course. */
  runBlend: number
  /** Temps global (secondes) pour les respirations/balancements idle. */
  time: number
}

const std = (color: string, roughness: number, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness })

function ellipsoid(rx: number, ry: number, rz: number, material: THREE.MeshStandardMaterial): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), material)
  mesh.scale.set(rx, ry, rz)
  mesh.castShadow = true
  return mesh
}

function capsule(radius: number, length: number, material: THREE.MeshStandardMaterial): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length), 6, 14), material)
  mesh.castShadow = true
  return mesh
}

export function createHumanoid(options: HumanoidOptions): HumanoidRig {
  const H = options.height
  const build = options.build ?? 1

  // --- Proportions anatomiques ---
  const legH = 0.48 * H
  const torsoH = 0.295 * H
  const shoulderY = legH + torsoH
  const armR = 0.0215 * H * (0.85 + build * 0.3)
  const legR = 0.038 * H * (0.85 + build * 0.3)
  const torsoR = 0.075 * H * build
  const hipHalfW = 0.052 * H * build + legR * 0.32
  const shoulderHalfW = 0.104 * H * build + armR * 0.42
  const upperArm = 0.172 * H
  const forearm = 0.152 * H
  const upperLeg = 0.235 * H
  const lowerLeg = 0.228 * H

  // --- Matériaux ---
  const skin = std(options.skin, 0.52)
  const skinSoft = std(options.skin, 0.68)
  const shirt = std(options.shirt, 0.82)
  const pants = std(options.pants, 0.8)
  const shoes = std(options.shoes ?? '#26221e', 0.42, 0.08)
  const hair = std(options.hair, 0.9)

  const group = new THREE.Group()
  group.name = 'humanoid'
  const body = new THREE.Group()
  group.add(body)

  // --- Bassin + torse ---
  const pelvis = ellipsoid(torsoR * 1.02, 0.072 * H, torsoR * 0.8, pants)
  pelvis.position.y = legH + 0.012 * H
  body.add(pelvis)

  const torso = capsule(torsoR, torsoH - torsoR * 0.9, shirt)
  torso.scale.set(1, 1, 0.74) // torse aplati (pas un tube)
  torso.position.y = legH + torsoH * 0.52
  body.add(torso)

  // --- Tête ---
  const headRy = 0.088 * H
  const headRx = 0.068 * H
  const headRz = 0.075 * H
  const headCenterY = shoulderY + 0.028 * H + headRy * 0.72

  const head = new THREE.Group()
  head.position.y = headCenterY

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.032 * H, 0.038 * H, 0.055 * H, 12), skinSoft)
  neck.position.y = -0.055 * H
  neck.castShadow = true
  head.add(neck)

  const skull = ellipsoid(headRx, headRy, headRz, skin)
  head.add(skull)

  // Visage : yeux, nez, bouche — discrets mais humains.
  const eyeGeo = new THREE.SphereGeometry(0.0082 * H * 1.15, 10, 8)
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#241a12', roughness: 0.25 })
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
  eyeL.position.set(-0.027 * H, 0.008 * H, headRz * 0.88)
  const eyeR = eyeL.clone()
  eyeR.position.x = 0.027 * H
  head.add(eyeL, eyeR)

  const nose = ellipsoid(0.0085 * H, 0.013 * H, 0.0085 * H, skinSoft)
  nose.position.set(0, -0.012 * H, headRz * 0.99)
  head.add(nose)

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.026 * H, 0.0028 * H, 0.001), new THREE.MeshStandardMaterial({ color: '#4a2c22', roughness: 0.6 }))
  mouth.position.set(0, -0.034 * H, headRz * 0.92)
  head.add(mouth)

  // --- Coiffure ---
  if (options.hairStyle === 'short') {
    const cap = ellipsoid(headRx * 1.03, headRy * 0.66, headRz * 1.03, hair)
    cap.position.set(0, headRy * 0.42, -headRz * 0.06)
    head.add(cap)
  } else if (options.hairStyle === 'afro') {
    const afro = ellipsoid(headRx * 1.5, headRy * 1.15, headRz * 1.5, hair)
    afro.position.set(0, headRy * 0.48, -headRz * 0.08)
    head.add(afro)
  } // bald : rien

  body.add(head)

  // --- Bras ---
  const makeArm = (side: 1 | -1) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * shoulderHalfW, shoulderY + 0.004 * H, 0)
    const upper = capsule(armR, upperArm - armR * 0.7, shirt)
    upper.position.y = -upperArm / 2
    shoulder.add(upper)

    const elbow = new THREE.Group()
    elbow.position.y = -upperArm
    const fore = capsule(armR * 0.86, forearm - armR * 0.7, skin)
    fore.position.y = -forearm / 2
    elbow.add(fore)
    const hand = ellipsoid(armR * 1.02, armR * 1.35, armR * 0.72, skin)
    hand.position.y = -forearm - armR * 0.7
    elbow.add(hand)
    shoulder.add(elbow)
    return { shoulder, elbow }
  }
  const armL = makeArm(-1)
  const armR_ = makeArm(1)
  body.add(armL.shoulder, armR_.shoulder)

  // --- Jambes ---
  const makeLeg = (side: 1 | -1) => {
    const hip = new THREE.Group()
    hip.position.set(side * hipHalfW, legH - 0.004 * H, 0)
    const thigh = capsule(legR, upperLeg - legR * 0.7, pants)
    thigh.position.y = -upperLeg / 2
    hip.add(thigh)

    const knee = new THREE.Group()
    knee.position.y = -upperLeg
    const shin = capsule(legR * 0.82, lowerLeg - legR * 0.7, pants)
    shin.position.y = -lowerLeg / 2
    knee.add(shin)

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.072 * H, 0.06 * H, 0.148 * H), shoes)
    shoe.position.set(0, -lowerLeg + 0.03 * H, 0.032 * H)
    shoe.castShadow = true
    knee.add(shoe)
    hip.add(knee)
    return { hip, knee }
  }
  const legL = makeLeg(-1)
  const legR_ = makeLeg(1)
  group.add(legL.hip, legR_.hip)

  const rig: HumanoidRig = {
    group, body, head,
    hipL: legL.hip, hipR: legR_.hip,
    kneeL: legL.knee, kneeR: legR_.knee,
    shoulderL: armL.shoulder, shoulderR: armR_.shoulder,
    elbowL: armL.elbow, elbowR: armR_.elbow,
    phase: Math.random() * Math.PI * 2,
    moveAmount: 0,
    height: H,
  }
  return rig
}

/** Anime la marche / course / idle. À appeler chaque frame. */
export function animateHumanoid(rig: HumanoidRig, input: HumanoidAnimInput): void {
  const { dt, speed, moving, runBlend, time } = input
  rig.moveAmount += (moving - rig.moveAmount) * (1 - Math.exp(-8 * dt))
  const mv = rig.moveAmount

  rig.phase += speed * dt * 1.9
  const p = rig.phase

  const swingAmp = (0.5 + 0.45 * runBlend) * mv
  const swing = Math.sin(p) * swingAmp

  // Hanches (rotation.x > 0 => jambe vers l'arrière)
  rig.hipL.rotation.x = swing
  rig.hipR.rotation.x = -swing

  // Genoux : flexion uniquement vers l'arrière (max ~1,9 rad)
  const kneeAmp = (0.62 + 0.85 * runBlend) * mv
  rig.kneeL.rotation.x = Math.max(0.05, -Math.sin(p)) * kneeAmp + 0.04
  rig.kneeR.rotation.x = Math.max(0.05, Math.sin(p)) * kneeAmp + 0.04

  // Épaules : opposition croisée naturelle
  rig.shoulderL.rotation.x = -swing * 0.78 - 0.06 * mv
  rig.shoulderR.rotation.x = swing * 0.78 - 0.06 * mv
  rig.shoulderL.rotation.z = 0.1 + 0.1 * runBlend * mv
  rig.shoulderR.rotation.z = -0.1 - 0.1 * runBlend * mv

  // Coudes : balancement + pompage en course
  const elbowAmp = (0.3 + runBlend * 0.62) * (0.35 + 0.65 * mv)
  rig.elbowL.rotation.x = -(elbowAmp + Math.max(0, -Math.sin(p)) * 0.5 * mv)
  rig.elbowR.rotation.x = -(elbowAmp + Math.max(0, Math.sin(p)) * 0.5 * mv)

  // Torse : inclinaison en course + balancement idle
  rig.body.rotation.x = 0.13 * runBlend * mv
  rig.body.rotation.z = Math.sin(time * 1.3) * 0.014 * (1 - mv)
  rig.body.position.y = Math.abs(Math.cos(p)) * 0.042 * mv

  // Tête : légère avance en course, respiration au repos
  rig.head.rotation.x = 0.07 * runBlend * mv + Math.sin(time * 1.7) * 0.008 * (1 - mv)
}
