# CITY LIFE GAME — Architecture & décisions techniques

## 1. Vision et contraintes

- Monde ouvert urbain **réaliste**, jouable dans le navigateur, évolutif vers un vrai rendu 3D.
- Zéro asset binaire dans le dépôt pour le moment : tout est **procédural** (géométrie + textures canvas). Aucune dépendance de runtime autre que `three` et `@supabase/supabase-js`.
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

### 2.1 Ce que ce prototype N'EST PAS (honnêteté technique)

- Pas de photoréalisme : les bâtiments sont des volumes texturés procéduralement, les personnages des humanoïdes stylisés à **proportions anatomiques réalistes** (tête ≈ 1/7,4, épaules larges, mains/pieds différenciés, visage discret). C'est la base saine, pas le produit final.
- Aucun claim de "réaliste" au-delà de ce que le pipeline procédural permet. Le plan ci-dessous mène au réalisme.

### 2.2 Chemin d'évolution vers le réalisme (sans réécriture)

1. **Personnages** : la fabrique `createHumanoid()` expose `HumanoidRig` (groupe, pivots, membre par membre). Remplacer le contenu par des modèles glTF (Meshoid, morph targets) ne change ni `Player`, ni `NPC`, ni les collisions, ni la logique d'animation (les clips glTF piloteront les mêmes pivots via un mixer).
2. **Bâtiments** : `generateBuildings()` produit des AABBs + specs. Un pack d'assets modulaire (Kitbash/Blender) remplacera les boîtes tout en gardant les colliders et les ancres.
3. **Matériaux** : passer de `MeshStandardMaterial` seul à une stack PBR (albedo/normal/roughness en textures KHR), un `RoomEnvironment` en IBL, et du shadow mapping cascades (CSM) pour couvrir tout le monde.
4. **Post-process** : EffectComposer — SSAO, bloom sélectif, tonemapping déjà ACESFilmic en place.
5. **Streaming** : partitionner `cityData.ts` en tuiles (chunked world) quand la population dépassera ~10 k entités.

## 3. Carte du code

```
src/
├── main.ts                Bootstrap (#app → Game)
├── Game.ts                Orchestration : scène, lumières, boucle, interactions, HUD
├── core/                  —— purs, testables (aucune API DOM/Three) ——
│   ├── gameClock.ts       Jour 1, 08:00 ; 2 min de jeu / seconde réelle
│   ├── collision.ts       Cercle vs AABB / cercle vs cercle / clamp monde
│   └── mathUtils.ts       clamp, damp (exp), dampAngle (plus court arc), lerp
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
│   ├── humanoid.ts        Fabrique d'humanoïdes + animation procédurale
│   │                      (marche/course/idle : hanches, genoux, épaules, coudes)
│   ├── Player.ts          Déplacement caméra-relatif (ZQSD/WASD/flèches),
│   │                      marche 3,15 m/s, course 5,5 m/s, collisions, yaw amorti
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
