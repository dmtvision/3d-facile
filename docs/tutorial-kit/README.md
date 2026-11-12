# Kit tutoriels 3D-Facile — mode d'emploi pour une IA

Ce dossier permet à une IA (ou à un rédacteur) de **produire des tutoriels détaillés avec captures d'écran, sans erreur**,
en pilotant l'application réelle et en **vérifiant chaque étape** avant de l'écrire.

| Fichier | Rôle |
|---|---|
| [`../GUIDE_UTILISATION.md`](../GUIDE_UTILISATION.md) | Guide complet : libellés exacts, comportements, valeurs, limites. **Source de vérité pour le texte.** |
| [`app-reference.json`](app-reference.json) | La même référence en **données** : identifiants des boutons, libellés, plages, raccourcis, messages. **Source de vérité pour les sélecteurs.** |
| [`tutokit.js`](tutokit.js) | Bibliothèque à injecter dans la page : actions reproductibles, état vérifiable, annotations, recadrage, export mesuré. |
| [`examples/bonhomme-de-neige.js`](examples/bonhomme-de-neige.js) | Tutoriel complet en 10 étapes vérifiées : **le modèle à copier**. |

> Tout ce kit a été exécuté et vérifié sur l'application (ordinateur 1024×768 et smartphone 390×844 simulé).
> Les identifiants et libellés de `app-reference.json` ont été contrôlés automatiquement contre la page.

---

## 1. Règles d'or (à respecter strictement)

1. **Ne jamais écrire une étape sans l'avoir exécutée** avec `TutoKit` et sans que sa vérification (`expect`) soit passée.
2. **Copier les libellés** depuis `app-reference.json` ou le guide, jamais de mémoire ni par paraphrase (« Bouger », pas « Déplacer l'objet » ; « Plus grand », pas « Agrandir »).
3. **Une capture par étape**, prise **après** `runStep` (l'interface est stable, les messages éphémères retirés, les repères numérotés posés).
4. **Toujours partir de `TutoKit.reset()`** : l'application restaure sinon automatiquement le dessin précédent (sauvegarde du navigateur).
5. **Ne pas promettre ce qui n'existe pas** : voir `notFeatures` dans `app-reference.json` et la section « Limites » du guide.
6. **Axes** : dans l'atelier, X = gauche/droite (rouge), Y = haut/bas (vert), Z = avant/arrière (bleu). Ne pas utiliser le vocabulaire de Blender (Z = hauteur) sauf pour parler du fichier exporté.
7. Si une vérification échoue : **corriger le scénario** (vue, position, taille), jamais le texte pour « coller » à un résultat faux.

---

## 2. Démarrage

### 2.1 Servir l'application
Depuis la racine du projet :
```bash
python -m http.server 8791
```
Puis ouvrir `http://localhost:8791/index.html?t=<horodatage>` (le paramètre évite les fichiers en cache).
Aucune connexion internet n'est nécessaire : bibliothèques et polices sont dans `vendor/`.

### 2.2 Charger le kit dans la page
Dans l'outil « exécuter du JavaScript » du navigateur piloté :
```js
await import('/docs/tutorial-kit/tutokit.js?' + Date.now());
const r = await TutoKit.ready();      // { ok: true, size: [w, h], compact: false, version }
await TutoKit.reset();                // état connu : outil Trait, Taille 20, rouge, vue de face, aucune forme
```
Si `ready()` renvoie `ok: false` (« Fenêtre de taille nulle » / « Projection impossible ») : le navigateur est masqué.
**Prendre une capture d'écran** (cela le réveille), **recharger la page**, puis recommencer.

### 2.3 Tailles d'écran conseillées pour les captures
| Cible | Taille | Remarques |
|---|---|---|
| Ordinateur | 1280×800 (ou 1024×768) | interface complète |
| Smartphone | 390×844 (portrait) | mode compact automatique : barre en icônes, panneau caméra replié (🧭), volets au-dessus des outils |
| Tablette | 768×1024 | aussi en mode compact (largeur ≤ 820 px) |

Après tout changement de taille de fenêtre : **recharger la page** puis `ready()` + `reset()`.

---

## 3. Boucle de production d'un tutoriel

```
pour chaque étape :
  1. r = await TutoKit.runStep(étape, { frameWidth: <largeur des captures> })
       → exécute l'action, attend, VÉRIFIE (lève une erreur sinon), nettoie l'écran, pose les repères numérotés
  2. prendre la capture d'écran
  3. si r.crop : recadrer avec r.crop.region = [x0, y0, x1, y1] (déjà converti dans le repère de la capture)
  4. enregistrer sous « NN-identifiant.png » ; écrire le texte de l'étape avec les libellés exacts
```

Format d'une étape (voir l'exemple complet) :
```js
{
  id: '02-grosse-boule',                       // nom du fichier image
  title: 'Règle la Taille sur 45 et clique au centre du plateau',
  text: 'Glisse le curseur « Taille » tout à droite (45 mm)…',   // texte du tutoriel
  action: async (T) => { await T.size(45); await T.placeAt([0, 0, 0]); },
  expect: (s) => s.meshes.length === 1 && s.meshes[0].bottom === 0,
  highlight: [{ target: '#input-global-thickness', label: '1' }],  // cadres numérotés (id, sélecteur CSS ou n° de forme)
  crop: 'edit-action-bar',                     // optionnel : zone à recadrer (id, sélecteur ou n° de forme)
  showHint: false, showToasts: false, wait: 300
}
```

Exécution de l'exemple fourni :
```js
await import('/docs/tutorial-kit/tutokit.js?' + Date.now());
await import('/docs/tutorial-kit/examples/bonhomme-de-neige.js?' + Date.now());
await TutoKit.ready();
for (const step of TUTO_BONHOMME.steps) {
  const r = await TutoKit.runStep(step, { frameWidth: 800 });
  // → capture d'écran ici (une par étape)
}
```

---

## 4. Référence de l'API `TutoKit`

### Préparation
| Fonction | Effet | Renvoie |
|---|---|---|
| `ready()` | attend l'application, contrôle la taille de fenêtre et la projection | `{ ok, size, compact, version }` |
| `reset(opts)` | vide la scène, l'historique et la sauvegarde ; outil, taille, couleur, miroir, vue, bulle d'aide connus. `opts` : `{ tool:'tube', color:'#ff4757', size:20, mirror:false, view:'front', hint:true }` | `state()` |

### Interface
| Fonction | Effet |
|---|---|
| `tool(name)` | clique un outil : `tube` (Trait), `balloon` (Ballon), `shape3d` (Formes), `pillar` (Pilier), `stamp` (Tampon), `edit` (Bouger), `eraser` (Gomme). Erreur si l'outil est masqué par l'enseignant |
| `pick('shape' \| 'stamp' \| 'profile', id)` | choisit une forme / un tampon / un profil de pilier (rouvre le tiroir si besoin sur petit écran) |
| `size(mm)` | curseur « Taille » (12–45). **En mode Bouger avec sélection, redimensionne la sélection** |
| `color(hex)` | clic sur une pastille. **Compte comme un choix de couleur** (les tampons suivants prennent cette couleur) ; en mode Bouger, colorie la sélection |
| `mirror(true/false)` | bouton « Miroir » |
| `placementProportions({x,y,z,linked})` | proportions avant pose (outil Formes), 0,2 à 3 |
| `button(id, {shift})` | clique n'importe quel bouton par son id (liste dans `app-reference.json`). Erreur s'il est masqué |

### Caméra
| Fonction | Effet |
|---|---|
| `view('front' \| 'side' \| 'top')` | comme les boutons Face / Côté / Dessus (animation terminée immédiatement) |
| `view({ theta, phi, distance, target })` | cadrage précis et instantané (degrés ; `phi` 0 = dessus, 90 = horizontal). Recommandé pour les captures : `{ theta: 20, phi: 65, distance: 260, target: [0, 40, 0] }` |
| `frame(indices?, { theta, phi, margin })` | cadre toutes les formes (ou certaines) |
| `toScreen([x,y,z])` | point du monde (mm) → pixel de la page |

### Gestes dans la scène
| Fonction | Effet |
|---|---|
| `strokeWorld([[x,y,z],…])` / `strokeScreen([[x,y],…])` | tracé à la souris (Trait, Ballon, Pilier). Renvoie `{ created, toasts }` |
| `balloonAt([x,y,z], {rx, ry})` | contour fermé (ellipse) pour l'outil Ballon |
| `placeAt([x,y,z], {drag:[dx,dy]})` | pose la forme / le tampon actif à ce point (sol : y = 0). `drag` = rester appuyé et glisser pour orienter |
| `placeOn(n, 'top' \| 'front' \| 'back' \| 'left' \| 'right' \| 'center', {offset:[x,y,z]})` | pose **sur la forme n°n**, en visant un point réellement touché par le clic |
| `surfacePoint(n, côté, offset)` | le point qui sera touché (sans cliquer) |
| `clickAt([x,y,z], {shift, ctrl})` | clic générique (sélection en mode Bouger, Gomme…) |
| `dragMesh(n, [dx, dy])` | glisse la forme n°n à la souris (mode Bouger), en respectant le temps de latence |
| `select(n \| [n,…])` | passe en mode Bouger et sélectionne (équivaut à clic + Maj+clic) |
| `keys('g','x','2','0','Enter')` / `keys({key:'z', ctrl:true})` | touches clavier (raccourcis G/R/S, Ctrl+Z…) |
| `mouseTo([x,y,z] \| [px,py])` | déplace le curseur (pour G/R/S à la souris) |

### État, vérification, captures
| Fonction | Effet |
|---|---|
| `state()` | `{ tool, size, color, colorChosen, mirror, activeItem, compact, meshes:[{index,type,subtype,color,position,size,bottom,locked,cutter}], selection, panels, popupMinimized, keyMode, hud, toasts, hint, camera, undoSteps }` |
| `expect(s => condition, 'message')` | lève une erreur détaillée (avec l'état) si faux |
| `runStep(étape, {frameWidth})` | exécute une étape complète (voir §3) |
| `cleanUI({hint, toasts})` | retire les messages éphémères, masque/affiche la bulle d'aide |
| `highlight(cible, '1', couleur)` / `clearHighlights()` | cadre numéroté autour d'un bouton, d'un panneau ou d'une forme |
| `rect(cible, marge, frameWidth)` | zone à recadrer ; `region` = `[x0,y0,x1,y1]` dans le repère de la capture si `frameWidth` est donné |
| `exportSTL()` | exporte comme « Télécharger .STL » **sans télécharger** et mesure le fichier : `{ triangles, sizeXYZ, bottomZ, volumeMm3 }` (Z = hauteur d'impression) |

Les formes sont numérotées dans l'**ordre de création** (0, 1, 2…). Types (`type`) : `tube`, `balloon`, `pillar`, `stamp` (formes 3D et tampons ; `subtype` = `sphere`, `heart`…), `imported`.

---

## 5. Pièges connus (tous rencontrés et vérifiés)

| Piège | Conséquence | Parade |
|---|---|---|
| Navigateur masqué / fenêtre de taille 0 | projection `NaN`, clics au mauvais endroit | capture d'écran pour réveiller, recharger, `ready()` |
| Sauvegarde automatique | l'ancien dessin réapparaît au chargement | toujours `reset()` |
| Clic exactement sur le bord / sommet d'une forme vue de profil | le rayon rase la forme, tombe sur le plateau ou **hors du plateau** (« ⚠️ Reste sur le plateau… ») | `placeOn(n, côté)` au lieu de `placeAt`, ou une vue en 3/4 (`phi` ≈ 60–70) |
| Une forme en cache une autre (ex. yeux devant la tête) | le clic pose sur la forme de devant | `placeOn(n, 'front', {offset:[0,-5,0]})` ; le kit signale « cachée par la forme n°k » |
| `strokeWorld` | la profondeur réelle du trait est décidée par l'application (sur une forme, près d'une forme, sur le plateau…) | vérifier `state().meshes` ; ne pas annoncer de coordonnées précises |
| Messages éphémères (2,5 s) et bulle d'aide | encombrent les captures | `cleanUI()` (fait par `runStep`) ; `showHint:true` si la bulle doit apparaître |
| Popups ajustés à l'image suivante, aperçu des trous après ~0,3 s | capture « entre deux états » | attendre (`runStep` le fait ; augmenter `wait` à 1500 ms pour les trous) |
| Capture plus petite que la page (ex. 800 px pour 1024 px) | recadrage décalé | `rect(…, marge, largeurCapture)` ou `runStep(…, { frameWidth })` |
| `color()` | active le « choix de couleur » : les tampons posés ensuite prennent cette couleur | appeler `color()` **après** les tampons qui doivent garder leurs couleurs naturelles, ou `reset()` |
| `size()` en mode Bouger avec une sélection | redimensionne la sélection au lieu de régler les prochains traits | changer d'outil ou désélectionner avant |
| Changement de taille de fenêtre | le mode compact se décide au chargement / redimensionnement | recharger la page |
| Tiroir des tampons sur petit écran | se referme après chaque choix | `pick('stamp', …)` le rouvre ; dans le texte, dire « touche à nouveau Tampon » |
| Trous | l'aperçu creusé nécessite internet et un instant de repos | `wait: 1500` ; l'export creuse toujours |
| Clavier AZERTY | les chiffres du haut demandent Maj | dans les tutos, recommander le pavé numérique |

---

## 6. Rédiger le texte d'une étape

- **Verbe d'action + libellé exact + lieu** : « Dans la barre du bas, groupe CONSTRUIRE, clique sur « Formes ». »
- **Résultat attendu** observable : « La grosse boule apparaît au centre du plateau. »
- **Repères numérotés** sur la capture = ordre des clics décrit dans le texte.
- **Valeurs** : celles réellement utilisées dans `action` (Taille 45, rotation 22,5°…).
- **Périphérique** : préciser souris / clavier / doigt quand le geste diffère (voir guide §4 et §16).
- Pour les enfants : phrases courtes, tutoiement, icônes de l'interface (✋, 🎨, 🖨️).

---

## 7. Check-list avant publication
- [ ] Toutes les étapes ont été exécutées par `runStep` sans erreur, dans l'ordre, depuis `reset()`.
- [ ] Chaque capture correspond à son étape (même `id`), recadrage vérifié visuellement.
- [ ] Libellés identiques à `app-reference.json` ; aucune fonction de `notFeatures` promise.
- [ ] Les valeurs du texte = celles des actions.
- [ ] Une étape finale montre le résultat et, si utile, l'export (`exportSTL()` donne les dimensions réelles).
- [ ] Version smartphone : refaire les captures en 390×844 si le tutoriel vise les téléphones.
