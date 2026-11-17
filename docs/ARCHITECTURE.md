# CITY LIFE GAME — Architecture & décisions techniques

## 1. Vision et contraintes

- Monde ouvert urbain **réaliste**, jouable dans le navigateur.
- Personnages : **modèles humains rigged glTF** locaux (voir `public/assets/ASSETS.md`) — plus aucun humanoïde procédural.
- Textures d'environnement : procédurales (canvas). Aucune dépendance de runtime autre que `three` et `@supabase/supabase-js`.
- Les modules métier purs (données de ville, collisions, horloge, math) sont **sans DOM** et couverts par des tests (`vitest`).

## 2. Choix structurants

| Décision | Pourquoi |
|---|---|
| **Three.js + WebGL** | Standard du web, perf native, écosystème glTF/draco/KTX2 pour brancher de vrais assets plus tard (Étape 9). |
| **TypeScript strict** | Refactorings sûrs sur un projet qui va grossir (9 étapes). `noUnusedLocals`, `exactOptionalPropertyTypes` assoupli pour l'interop. |
| **Vite** | Dev server instantané, build ESM, `import.meta.env` pour les variables `VITE_*`. |
| **Supabase (schéma `city_life_game` uniquement)** | Déjà provisionné, RLS complet, 40 tables. Le jeu ne lit/écrit que ce schéma. |
| **DOM pour le HUD** | Le HUD (menus, prompts, toasts) en DOM/CSS est plus net, accessible et moins coûteux en dev qu'un HUD WebGL. Le monde 3D reste 100 % canvas WebGL. |
| **Caméra 3e personne orbitale** | Standard GTA-like : pointer lock, yaw/pitch amortis, zoom molette. |

### 2.1 Ce que la vertical slice EST — et N'EST PAS (honnêteté technique)

- **Humains rigged réels** chargés en glTF : avatar Ready Player Me (joueur), Michelle (PNJ♀), Soldier (PNJ♂) — skinning GPU, clips Idle/Walk/Run (Soldier), **retarget** mixamo→RPM vérifié headless (0 cible manquante).
- Ce sont des assets de qualité « exemple de moteur », pas des MetaHuman : pas d'expressions faciales actives, pas de vêtements échangeables, 2 silhouettes PNJ de base (variées par échelle 1,58–1,85 m + teinte légère). Textures KHR embarquées (PBR métal/roughness).
- Bâtiments : volumes + textures canvas procédurales — **le style n'est pas photoréaliste** ; seul l'intérieur du Fleuve est décoré (zellige, comptoir, enseigne…).
- Le restaurant est une **salle parallèle** (x=1000, z=1000) : téléportation par la porte, collisions/rendu/lumières dédiées — pas de fenêtre sur rue, pas de découpe de façade.
- Dialogue : moteur local déterministe (intentions, personnalité, affinité, humeur du jour) — bon et gratuit, mais pas une IA générative. L'IA générative est **prête mais non déployée** (clé dédiée requise).
- Sauvegarde : **localStorage** (navigateur) — cloud Supabase (`saves`, `character_body`) prévu avec l'auth (RLS) ; aucun contournement de RLS n'est tenté.

### 2.2 Chemin d'évolution vers le photoréalisme (sans réécriture)

1. **Personnages** : branches `RiggedKind = 'player' | 'female' | 'male'` déjà en place — swap des GLB (RPM API haute qualité, Fab/MetaHuman sous licence propre, pipeline `SkeletonUtils.clone` + `AnimationMixer` inchangé). Morphs corporels (poids/muscle) déjà appliqués sur les bones.
2. **Expressions faciales** : morph targets présents sur le mesh RPM (Wolf3D_Head) — à piloter par l'humeur (fatigue, joie, colère) avec les émotions PNJ.
3. **Bâtiments** : `generateBuildings()` produit des AABBs + specs. Un pack modulaire (ex. Quaternius CC0, ou kit Blender) remplacera les boîtes en gardant colliders et ancres.
4. **Matériaux** : stack PBR complète (albedo/normal/roughness KHR), `RoomEnvironment` en IBL, shadow cascades (CSM).
5. **Post-process** : EffectComposer — SSAO, bloom sélectif (déjà ACESFilmic).
6. **Streaming** : tuiles (`cityData` partitionné) quand la population dépassera ~10 k entités.

## 3. Carte du code

```
src/
├── main.ts                Bootstrap (#app → Game)
├── Game.ts                Orchestration : scène, lumières, boucle, interactions, HUD
├── core/                  —— purs, testables (aucune API DOM/Three) ——
│   ├── gameClock.ts       Jour 1, 08:00 ; 2 min de jeu / seconde réelle
│   ├── collision.ts       Cercle vs AABB / cercle vs cercle / clamp monde
│   ├── mathUtils.ts       clamp, damp (exp), dampAngle (plus court arc), lerp
│   ├── simulation.ts      Simulation de vie : faim/énergie, calories→poids (7 700 kcal/kg),
│   │                      morphologie (facteurs), formatMoney FCFA
│   ├── saveGame.ts        Sauvegarde JSON versionnée (parse tolérant) — localStorage
│   └── dialogueEngine.ts  Dialogue français libre : intentions par motif, réponse
│                          composée (personnalité×affinité×humeur du jour), donne
│                          le numéro au-delà de +25 d'affinité, invitation au-delà de +40
├── world/
│   ├── cityData.ts        Source de vérité layout : routes, trottoirs, régions,
│   │                      parc, ancres, génération déterministe (mulberry32),
│   │                      spawns PNJ, groundHeightAt() (bordures)
│   ├── textures.ts        Textures canvas procédurales (façades avec enseignes,
│   │                      asphalte, dalles, herbe, zébras, panneau bus)
│   └── cityBuilder.ts     Construction du monde : sol, chaussées, trottoirs
│                          segmentés aux intersections + coins, bâtiments,
│                          lampadaires, fontaine, bancs, arbres, arrêt de bus
├── entities/
│   ├── RiggedCharacter.ts Personnages glTF : GLTFLoader + SkeletonUtils.clone,
│   │                      clips Idle/Walk/Run (retarget mixamo→RPM), damping
│   │                      de poids d'action, posture assise procédurale,
│   │                      morphs poids/muscle sur bones, dispose()
│   ├── Player.ts          Déplacement caméra-relatif (ZQSD/WASD/flèches),
│   │                      marche 3,15 m/s, course 5,5 m/s, collisions, yaw amorti,
│   │                      bornes intérieures (restaurant) ou monde extérieur
│   └── NPC.ts             Piétons : marche le long de trottoirs, virages aux
│                          intersections, pauses, demi-tours, séparation douce
├── systems/
│   ├── Input.ts           Clavier (e.code) + souris pointer lock + molette + E
│   ├── CameraRig.ts       Orbite 3e personne amortie, zoom, clamp sol
│   └── InteractionSystem.ts  Cible la plus proche (PNJ ou lieu) → prompt + toast
├── ui/
│   ├── hud.ts             HUD DOM : marque, lieu, horloge, statut Supabase,
│   │                      prompt contextuel, toasts, overlay start/pause
│   └── hud.css            Système visuel (noir/or, glassmorphism, français)
└── net/
    └── supabase.ts        Client singleton (clé publishable, schéma
                           city_life_game, RLS) + sonde checkSupabaseConnection()
```

## 4. Données & Supabase

### 4.1 Schéma

40 tables, RLS activées partout. Catalogues (`districts`, `locations`, `npcs`, …) : `SELECT` pour `authenticated`. Lignes privées (`saves`, `characters`, …) : politiques `own_rows`/`own_characters`. Contrainte clé : `npcs.romanceable ⇒ age ≥ 18` (respectée par le seed) et `characters.age ≥ 18`.

### 4.2 Contrat de coordonnées

`locations.pos_x / pos_y` = coordonnées `x / z` du monde 3D (mètres). Le jeu et la migration `20261117120000_seed_centre_ville.sql` partagent les MÊMES positions (supérette à (22, 8), restaurant à (-20, -9), gym à (34, -9), arrêt de bus à (9, 9), parc à (-38, 40)). Idem pour les identités PNJ (UUID fixes `b0000000-…-0001`… `0010`).

### 4.3 Flux prévu aux étapes suivantes

- Étape 2 : auth (email ou anonyme) → `players.user_id = auth.uid()`, création de `characters` + `character_body`, sauvegarde dans `saves` (jsonb `state`).
- Étape 3 : `conversations` + `messages` persistés ; génération IA dans une **Edge Function** (`dialogue-npc`) qui lit le PNJ (personnalité, humeur, affinité) et écrit la réponse ; la clé d'IA vit en secret d'Edge Function (`supabase secrets set`), jamais côté client.
- Étapes 5–8 : `jobs`, `transactions`, `character_vehicles`, … déjà prêtes.

## 5. Performance & budget

- ~35 bâtiments, ~120 lampes/meubles, ~45 arbres → ~300 draw calls, un seul niveau de shadow map 2048 qui **suit le joueur**.
- Fog linéaire (80→265 m) + `powerPreference: 'high-performance'`, pixelRatio plafonné à 1,75.
- Textures ≤ 512², génération unique au chargement.
- Prochaine étape de perf : instancing pour lampadaires/arbres (`InstancedMesh`), merge des façades.

## 6. Tests & qualité

`vitest` sur les modules purs : `collision`, `gameClock`, `mathUtils`, `cityData` (déterminisme de génération, zéro chevauchement bâtiment/chaussée/trottoir, interactables hors bâtiments, PNJ adultes, `groundHeightAt`). **35 tests**, tous verts. Le build production passe `tsc --noEmit` en strict.

## 7. Sécurité

- Clé publishable uniquement côté client ; `.env` git-ignoré ; `.env.example` documente le contrat.
- Aucune clé IA côté client — les dialogues IA passeront par Edge Functions (Étape 3).
- Le jeu n'accorde aucune confiance au client : toute persistance passera par RLS (`auth.uid()`).

## 8. Conventions

- Française pour le texte joueur (UI, toasts, documentation utilisateur) ; code et identifiants en anglais.
- Modules à effet de bord (Three, DOM) isolés des modules purs testés.
- Une étape à la fois ; jamais de merge vers `main` sans build + tests verts.


## 9. La vertical slice « Le Fleuve » — flux complet

```
Porte (E) ─→ téléport intérieur (salle parallèle) ─→ Adama (serveur, PNJ)
        │
        ├─ E sur table → s'asseoir (posture assise procédurale, caméra suit)
        ├─ Carte (E sur table assis) → choix plats → Commander
        │     → assiettes générées sur la table (meshes), Adama apporte
        ├─ Déguster → applyMeal() : faim/énergie/calories/poids (+ morphs osseux)
        ├─ Payer l'addition → cash −= total, assiettes débarrassées, saveNow()
        └─ Sortir (bloqué tant que l'addition n'est pas réglée) → retour ville
```

**Simulation** : faim/énergie dérivent avec les minutes de jeu (tickTime), 1 point de faim ≈ 40 min ; 7 700 kcal ≈ +1 kg.
**Sauvegarde** : localStorage `citylife.save.v1` — stats + position (toujours dehors) + horloge + affinités + contacts. Auto à l'entrée/sortie de salle, après paiement, après partage de numéro, toutes les 45 s, au `beforeunload`.
**Dialogue** : E sur un PNJ → panneau libre (français) → moteur local (ou IA si `VITE_DIALOGUE_ENDPOINT` pointe sur l'Edge Function déployée).

## 10. Ce qui est consciemment encore un chantier (ne pas confondre avec un bug)

- Superérette / Mali Fitness / bus / parc : **fermés** pour l'instant (toast honnête), pas des maquettes.
- Adama (serveur) est un PNJ **client uniquement** (pas dans le seed Supabase — la DB ne sera pas migrée sans accord).
- Edge Function `city-life-dialogue` présente dans le dépôt mais délibérément **non déployée** (clé d'IA dédiée requise ; aucune clé tierce n'est réutilisée).
- Aucune vérification visuelle WebGL n'est possible dans le sandbox de l'agent (pas de navigateur) : le rendu se valide via la preview ; les tests headless couvrent logique + DOM + parsing GLB.
