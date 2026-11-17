# CITY LIFE GAME

**Simulateur de vie urbaine en 3D, dans le navigateur.**
Inspiré de la liberté de déplacement de GTA, avec une simulation sociale, économique et personnelle poussée au maximum.

Vous êtes un homme qui arrive dans une grande ville. À vous d'y construire votre vie : rencontres, travail, études, logement, voiture, sport, crime… et surtout, vos propres choix.

> **État actuel : VERTICAL SLICE — premier vrai morceau du jeu (2026-11-17)**
> Vous contrôlez un **humain réaliste rigged** (Ready Player Me) dans le quartier **Centre-Ville** (inspiration Bamako).
> Vous pouvez : explorer la ville, parler aux 10 habitants (français libre, moteur local ou IA en option),
> **entrer dans le restaurant « Le Fleuve »**, prendre une table, commander à la carte, manger, payer l'addition —
> votre **faim, votre énergie, votre poids et votre argent (FCFA)** évoluent pour de vrai.
> La progression est **sauvegardée** (localStorage, `citylife.save.v1`) et reprise au rechargement.
> La suite (logement, supermarché, sport, téléphone/contacts, travail, criminalité, transports…) arrive étape par étape — voir `docs/ARCHITECTURE.md`.
>
> **Nouveau depuis l'Étape 1 :** humains glTF rigged (fini les capsules), intérieur complet du Fleuve jouable,
> simulation de vie, dialogues avec mémoire d'affinité, sauvegarde.

---

## Démarrage rapide

**Prérequis :** Node.js ≥ 20, npm ≥ 10.

```bash
npm install
cp .env.example .env      # puis renseignez vos valeurs (voir section Supabase)
npm run dev               # http://localhost:5173
```

**Build de production :**

```bash
npm run build             # tsc --noEmit + vite build → dist/
npm run preview           # sert le build (port 4173)
```

**Tests :**

```bash
npm test                  # vitest — 54 tests (layout, collisions, horloge, math, simulation, dialogue, sauvegarde)
npm run typecheck
```

---

## Contrôles

| Action | Touche |
|---|---|
| Se déplacer | `Z Q S D` ou `W A S D` ou flèches (AZERTY & QWERTY) |
| Courir | `Shift` |
| Regarder | Souris (pointer lock au clic) |
| Zoom caméra | Molette |
| Interagir / Parler | `E` |
| Menu / Pause | `Échap` |

---

## Supabase (schéma `city_life_game`)

Le jeu utilise **uniquement** le schéma PostgreSQL `city_life_game` de votre projet Supabase existant. Aucun autre schéma n'est touché, aucune donnée existante n'est modifiée.

**Sécurité (non négociable) :**

- Seule la clé **publishable** (ou `anon` legacy) va dans `.env` / le navigateur. Elle est publique par conception et bornée par les politiques **RLS**.
- **Jamais** de clé `service_role` / `sb_secret_…` dans le frontend, le dépôt Git ou le navigateur.
- Les futures fonctionnalités IA (dialogues libres, Étape 3) passeront par des **Supabase Edge Functions** : les clés d'IA ne quittent jamais le serveur.
- Le fichier `.env` est git-ignoré ; seul `.env.example` (sans valeurs) est versionné.

**Migration appliquée (0001 — `supabase/migrations/20261117120000_seed_centre_ville.sql`) :**

| Table | Contenu |
|---|---|
| `districts` | 1 quartier « Centre-Ville » (wealth 4, crime 2) |
| `locations` | Supérette Chez Fatou (shop), Restaurant Le Fleuve (restaurant), Mali Fitness (other), Arrêt de bus (other), Parc de la Liberté (park) — coordonnées alignées sur la ville 3D |
| `npcs` | 10 PNJ adultes (19–42 ans) avec personnalités, routines, `attractiveness`, `romanceable` (contrainte `romanceable_adults_only` respectée) — tous `18+` |

La migration est **idempotente** (`ON CONFLICT (id) DO NOTHING`) et **additive** uniquement.

> Note : avant l'auth complète (Étape 2), les lectures RLS catalogues requièrent une session authentifiée. Le jeu fonctionne donc hors-ligne pour cette étape ; la sonde de connexion HUD rapporte honnêtement l'état réel (connecté / non configuré / erreur).
> Pour activer les lectures catalogue côté jeu, exposer le schéma `city_life_game` dans les réglages API (schémas exposés) **et** mettre en place l'auth — prévu à l'Étape 2.

---

## Architecture (résumé)

```
src/
├── core/        # modules purs, sans DOM — testables (horloge, collisions, math, simulation, sauvegarde, dialogue)
├── world/       # cityData (layout pur), cityBuilder, restaurant (intérieur jouable), textures canvas
├── entities/    # RiggedCharacter (GLB + mixer + morphs + posture assise), Player, PNJ
├── systems/     # Input, CameraRig (3e personne), InteractionSystem
├── ui/          # HUD DOM, DialoguePanel, RestaurantMenuPanel (styles dans hud.css)
├── data/        # menu du Fleuve, profils sociaux PNJ (miroir du seed Supabase)
└── net/         # Client Supabase sécurisé + client dialogue (IA optionnelle, repli local)
tests/           # vitest — modules purs uniquement
supabase/
└── migrations/  # SQL versionné
docs/
└── ARCHITECTURE.md  # décisions techniques détaillées
```

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour le détail (moteur de rendu, pipeline personnages et chemin d'évolution vers de vrais assets glTF, performance, modèle de données).

---

## Feuille de route (une étape à la fois, avec votre feu vert)

1. **Étape 1 — Fondations** ✅ (poussée : commit a4a99c4)
2. **Vertical slice — humains glTF + restaurant jouable + simulation + sauvegarde** ✅ (cette mise à jour)
   - Reste hors slice, prévu ensuite : auth Supabase + sync `saves` cloud, contacts/téléphone/SMS, supermarché, logement, gym, travail, criminalité, transports, relations 18+, véhicules, animaux.
3. Étape 3 — Dialogues génératifs branchés sur l'Edge Function (`supabase/functions/city-life-dialogue/`, fournie mais non déployée — requiert une clé d'IA DÉDIÉE)
4. Étape 4 — Relations sociales & amoureuses (adultes 18+ uniquement, consentement RP)
5. Étape 5 — Travail & économie
6. Étape 6 — Ville & transports (bus, car, taxi, moto, voiture)
7. Étape 7 — Logement & vie quotidienne (maisons, animaux, supermarchés, restaurants, vêtements)
8. Étape 8 — Criminalité & sécurité (police, prison, défense)
9. Étape 9 — Histoire & finition (missions, fins multiples, optimisation graphique)

**Règle d'or :** relations amoureuses réservées aux PNJ adultes (18+). Les PNJ gardent leur personnalité et peuvent refuser librement.
