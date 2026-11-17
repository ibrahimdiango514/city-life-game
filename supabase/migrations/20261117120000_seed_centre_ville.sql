-- ============================================================================
-- CITY LIFE GAME — Migration 0001 : Données du prototype « Centre-Ville »
-- ============================================================================
-- Portée STRICTEMENT limitée au schéma city_life_game.
-- - Aucune suppression, aucune modification de structure ou de données existantes.
-- - Idempotente : une seconde exécution n'insère aucun doublon (ON CONFLICT DO NOTHING).
-- - Les coordonnées (pos_x, pos_y) sont la position 2D "x/z" du monde 3D
--   (voir src/world/cityData.ts — source de vérité unique côté jeu).
-- - Les PNJ sont tous adultes (18+). Les relations amoureuses seront limitées
--   aux adultes par filtrage sur age >= 18 et romanceable = true.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- District : Centre-Ville
-- ---------------------------------------------------------------------------
insert into city_life_game.districts (id, name, description, wealth_level, crime_rate)
values (
  'a0000000-0000-4000-8000-000000000001',
  'Centre-Ville',
  'Quartier commercial et administratif du jeu (inspiration : Bamako). Rues animées, commerces de proximité, parc central, marché.',
  4,
  2
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Lieux (coordonnées synchronisées avec src/world/cityData.ts)
--   pos_x = axe X du monde, pos_y = axe Z du monde
-- ---------------------------------------------------------------------------
insert into city_life_game.locations (id, district_id, name, type, pos_x, pos_y, opens_at, closes_at, is_robbable)
values
  ('a0000000-0000-4000-8000-000000000101', 'a0000000-0000-4000-8000-000000000001', 'Supérette « Chez Fatou »', 'shop', 22, 8, '07:30', '21:00', true),
  ('a0000000-0000-4000-8000-000000000102', 'a0000000-0000-4000-8000-000000000001', 'Restaurant « Le Fleuve »', 'restaurant', -20, -9, '11:00', '23:00', true),
  ('a0000000-0000-4000-8000-000000000103', 'a0000000-0000-4000-8000-000000000001', 'Mali Fitness — Salle de sport', 'other', 34, -9, '05:30', '23:00', false),
  ('a0000000-0000-4000-8000-000000000104', 'a0000000-0000-4000-8000-000000000001', 'Arrêt de bus « Centre-Ville »', 'other', 9, 9, null, null, false),
  ('a0000000-0000-4000-8000-000000000105', 'a0000000-0000-4000-8000-000000000001', 'Parc de la Liberté', 'park', -38, 40, '06:00', '22:00', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Note : les types lieux sont contraints (restaurant, cafe, cinema, shop, bank, police_station,
-- university, high_school, employment_agency, workplace, residential, dealership, park, nightclub, other).
-- La salle de sport et l'arrêt de bus n'ont pas de type dédié dans le schéma → 'other'.

-- PNJ adultes du prototype (mêmes identités que NPC_SPAWNS côté jeu)
-- ---------------------------------------------------------------------------
insert into city_life_game.npcs
  (id, first_name, last_name, gender, age, role, personality, attractiveness, wealth, romanceable, daily_schedule)
values
  ('b0000000-0000-4000-8000-000000000001', 'Awa', 'Diarra', 'female', 26, 'shopkeeper',
   '{"openness": 7, "humor": 6, "ambition": 6, "patience": 5, "loyalty": 7}'::jsonb, 78, 45, true,
   '[{"time": "07:00", "activity": "marché du quartier"}, {"time": "09:00", "activity": "boutique de tissus"}, {"time": "13:00", "activity": "déjeuner"}, {"time": "18:30", "activity": "promenade au parc"}, {"time": "21:00", "activity": "retour à la maison"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000002', 'Moussa', 'Traoré', 'male', 31, 'worker',
   '{"openness": 5, "humor": 7, "ambition": 7, "patience": 6, "loyalty": 6}'::jsonb, 65, 62, true,
   '[{"time": "06:30", "activity": "salle de sport"}, {"time": "08:30", "activity": "bureau — agent de transit"}, {"time": "13:00", "activity": "déjeuner"}, {"time": "19:00", "activity": "terrain de football"}, {"time": "22:30", "activity": "retour à la maison"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000003', 'Fatoumata', 'Koné', 'female', 22, 'student',
   '{"openness": 8, "humor": 8, "ambition": 4, "patience": 3, "loyalty": 5}'::jsonb, 84, 30, true,
   '[{"time": "08:00", "activity": "fac — cours du matin"}, {"time": "12:30", "activity": "pause déjeuner"}, {"time": "15:00", "activity": "bibliothèque"}, {"time": "19:00", "activity": "sortie entre amis"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000004', 'Ibrahim', 'Touré', 'male', 29, 'worker',
   '{"openness": 4, "humor": 5, "ambition": 8, "patience": 7, "loyalty": 8}'::jsonb, 58, 55, true,
   '[{"time": "07:30", "activity": "trajet vers le marché"}, {"time": "09:00", "activity": "grossiste — gestion de stock"}, {"time": "14:00", "activity": "livraisons"}, {"time": "20:00", "activity": "comptabilité"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000005', 'Kadidia', 'Diallo', 'female', 34, 'shopkeeper',
   '{"openness": 6, "humor": 5, "ambition": 7, "patience": 8, "loyalty": 9}'::jsonb, 71, 60, true,
   '[{"time": "06:00", "activity": "préparation de la boutique"}, {"time": "08:00", "activity": "supérette Chez Fatou — aide familiale"}, {"time": "14:00", "activity": "pause"}, {"time": "17:30", "activity": "comptes et commandes"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000006', 'Seydou', 'Coulibaly', 'male', 24, 'worker',
   '{"openness": 9, "humor": 9, "ambition": 5, "patience": 2, "loyalty": 4}'::jsonb, 69, 38, true,
   '[{"time": "09:30", "activity": "réveil tardif"}, {"time": "11:00", "activity": "moto-taxi informel"}, {"time": "14:00", "activity": "pause déjeuner longue"}, {"time": "18:00", "activity": "match de playstation au maquis"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000007', 'Aminata', 'Sangaré', 'female', 28, 'worker',
   '{"openness": 7, "humor": 7, "ambition": 6, "patience": 6, "loyalty": 6}'::jsonb, 76, 70, true,
   '[{"time": "07:00", "activity": "course à pied au parc"}, {"time": "08:30", "activity": "banque — conseillère clientèle"}, {"time": "13:00", "activity": "déjeuner"}, {"time": "19:30", "activity": "lecture / amis"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000008', 'Boubacar', 'Cissé', 'male', 38, 'other',
   '{"openness": 3, "humor": 4, "ambition": 9, "patience": 9, "loyalty": 8}'::jsonb, 52, 88, true,
   '[{"time": "06:00", "activity": "café et journaux"}, {"time": "07:30", "activity": "promoteur immobilier"}, {"time": "13:00", "activity": "déjeuner d’affaires"}, {"time": "20:00", "activity": "club d’affaires"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000009', 'Mariam', 'Keïta', 'female', 19, 'student',
   '{"openness": 8, "humor": 6, "ambition": 3, "patience": 4, "loyalty": 5}'::jsonb, 82, 20, false,
   '[{"time": "08:30", "activity": "lycée — seconde"}, {"time": "13:00", "activity": "rentrée maison"}, {"time": "16:00", "activity": "cours de soutien"}, {"time": "18:00", "activity": "aide à la maison"}]'::jsonb),

  ('b0000000-0000-4000-8000-000000000010', 'Youssouf', 'Dembélé', 'male', 42, 'worker',
   '{"openness": 5, "humor": 6, "ambition": 7, "patience": 8, "loyalty": 9}'::jsonb, 55, 75, false,
   '[{"time": "05:30", "activity": "prière puis boutique"}, {"time": "07:00", "activity": "garagiste — ouverture"}, {"time": "13:00", "activity": "déjeuner à la maison"}, {"time": "19:00", "activity": "radio locale"}]'::jsonb)
on conflict (id) do nothing;
