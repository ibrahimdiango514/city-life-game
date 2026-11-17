# CITY LIFE GAME — Assets 3D : provenance & licences

Tous les modèles sont **locaux** : `public/assets/models/characters/`.
Aucune requête externe n'est faite à l'exécution (pas de CDN, pas de tracking).

| Fichier | Taille | Origine | Licence / droits | Usage en jeu |
|---|---|---|---|---|
| `readyplayer.me.glb` | 1,8 Mo | Dépôt officiel three.js — `examples/models/gltf/readyplayer.me.glb` (avatar Ready Player Me) | Exemple three.js (MIT). L'avatar embarqué est un asset de démonstration Ready Player Me — RPM autorise l'usage de tels avatars dans les apps (les avatars créés par les utilisateurs restent la propriété de leurs auteurs). Inclus ici comme asset de jeu, pas redistribué séparément. | **Avatar du joueur** |
| `Soldier.glb` | 2,2 Mo | Dépôt officiel three.js — `examples/models/gltf/Soldier.glb` | Exemple three.js (MIT). Modèle issu du workflow Mixamo (Adobe) — usage libre et gratuit dans des projets, y compris commerciaux, sans redistribution autonome. Inclus ici comme asset de jeu. | **PNJ masculins** |
| `Michelle.glb` | 3,3 Mo | Dépôt officiel three.js — `examples/models/gltf/Michelle.glb` | Exemple three.js (MIT), asset Mixamo (voir ci-dessus). | **PNJ féminins** |

## Squelettes & animations

- Rigs **Mixamo** (67/65 joints), mêmes noms de joints à un préfixe près.
- Clips utilisés : `Idle`, `Walk`, `Run` (fournis par `Soldier.glb`).
  - PNJ (Soldier/Michelle, joints `mixamorig:*`) : clips utilisés **tels quels**.
  - Joueur (RPM, joints sans préfixe) : clips **reciblés** en mémoire en retirant
    le préfixe `mixamorig` (les noms de tracks sont préalablement normalisés par
    PropertyBinding — vérifié par smoke test headless : 0 cible manquante,
    0 warning, sur les 3 chemins de rig).
- Pas de clip `Sit` fourni : la position assise est une **posture procédurale**
  (flexion cuisses/genoux + bassin abaissé, fondu doux). Un vrai clip « Sit »
  Mixamo pourra être ajouté au même pipeline sans changer l'API.

## Limites connues (transparence totale)

- **Ce sont des personnages humains rigged de qualité « jeu de démonstration »**,
  pas un scan photogrammétrique haut de gamme. Pour le niveau « MetaHuman » :
  intégrer Ready Player Me en **mode API** (avatars réalistes gratuits, clé à
  fournir par le propriétaire) ou Fab/MetaHuman — le pipeline
  GLB → RiggedCharacter → mixer est déjà prêt à les accueillir.
- Les PNJ partagent 2 silhouettes de base (homme/femme) variées par **échelle
  (1,58–1,85 m)** et **teinte légère** des matériaux (déterministe par id).
- Morph targets : présents sur le mesh RPM (visage), non exploités pour
  l'instant (expressions faciales à venir avec les émotions PNJ).

## Supprimés de la distribution

- `Xbot.glb` (mannequin robotique — hors thème « humains »), `RobotExpressive.glb`,
  `Horse.glb`, `kira.glb` : retirés ; le repo reste léger et chaque asset distribué
  est justifié ci-dessus.
- LeePerrySmith (scan de tête **CC-BY 3.0**) : non inclus ; candidat documenté pour
  une future étape « visages ultra-réalistes » (attribution requise si utilisé).

## Textures & autres assets

- Toutes les textures de ville / intérieur / enseignes : **générées en canvas**
  à l'exécution (`src/world/textures.ts`) — aucun fichier tiers.
- Aucune ressource sous droit d'auteur non listée ici n'est utilisée.
