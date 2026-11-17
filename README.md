# CITY LIFE GAME

**Simulateur de vie urbaine en 3D, dans le navigateur.**
Inspiré de la liberté de déplacement de GTA, avec une simulation sociale, économique et personnelle poussée au maximum.

Vous êtes un homme qui arrive dans une grande ville. À vous d'y construire votre vie : rencontres, travail, études, logement, voiture, sport, crime… et surtout, vos propres choix.

> **État actuel : ÉTAPE 1 — Fondations (prototype jouable)**
> Marchez dans le quartier **Centre-Ville** (inspiration Bamako), observez les habitants vivre, interagissez avec les lieux et les PNJ.
> Les étapes suivantes (téléphone, argent, dialogues IA, relations, travail, transports, logement, criminalité, histoire) arrivent une par une — jamais l'inverse.

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
npm test                  # vitest — 35 tests (layout, collisions, horloge, math)
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
├── core/        # modules purs, sans DOM — testables (horloge, collisions, math)
├── world/       # données de layout pures (cityData) + construction du monde 3D
├── entities/    # fabrique de humanoïdes procéduraux, Player, PNJ
├── systems/     # Input, CameraRig (3e personne), InteractionSystem
├── ui/          # HUD DOM (marque, horloge, lieu, statut Supabase, prompt, toasts)
└── net/         # Client Supabase sécurisé (schéma city_life_game)
tests/           # vitest — modules purs uniquement
supabase/
└── migrations/  # SQL versionné
docs/
└── ARCHITECTURE.md  # décisions techniques détaillées
```

Voir [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) pour le détail (moteur de rendu, pipeline personnages et chemin d'évolution vers de vrais assets glTF, performance, modèle de données).

---

## Feuille de route (une étape à la fois, avec votre feu vert)

1. **Étape 1 — Fondations** ✅ (ce prototype)
2. Étape 2 — Interface & simulation de vie : téléphone, argent, heure/calendrier, faim/énergie, poids/musculature, sauvegardes (auth + table `saves`)
3. Étape 3 — Dialogues intelligents : conversation libre, personnalités/émotions, Edge Function IA, SMS & appels
4. Étape 4 — Relations sociales & amoureuses (adultes 18+ uniquement, consentement RP)
5. Étape 5 — Travail & économie
6. Étape 6 — Ville & transports (bus, car, taxi, moto, voiture)
7. Étape 7 — Logement & vie quotidienne (maisons, animaux, supermarchés, restaurants, vêtements)
8. Étape 8 — Criminalité & sécurité (police, prison, défense)
9. Étape 9 — Histoire & finition (missions, fins multiples, optimisation graphique)

**Règle d'or :** relations amoureuses réservées aux PNJ adultes (18+). Les PNJ gardent leur personnalité et peuvent refuser librement.
