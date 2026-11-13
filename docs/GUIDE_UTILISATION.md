# 3D-Facile — Guide d'utilisation complet (référence pour rédiger des tutoriels)

> **À qui s'adresse ce document ?** À une IA (ou à un rédacteur) qui doit produire des tutoriels précis et fiables sur l'application **3D-Facile**.
> Il décrit tout ce que fait l'application, avec les **libellés exacts** de l'interface (entre « guillemets »), les **valeurs chiffrées**, les **résultats attendus** à chaque étape, les **pièges** et les **limites connues**.
> Tout ce qui est écrit ici a été vérifié dans le code source de l'application ; les points non vérifiés sur appareil réel sont signalés par ⚠️.

---

## 0. Comment utiliser ce guide pour écrire un tutoriel

### 0.1 Règles à respecter
1. **Reprendre les libellés exacts** de l'interface (« Trait », « Bouger », « Creuser les autres formes »…). Ne jamais les paraphraser ni les traduire.
2. **Une action = une étape.** Chaque étape a : *l'action*, *ce que l'on doit voir ensuite* (résultat attendu), et si besoin *l'erreur fréquente*.
3. **Indiquer le périphérique** quand le geste change : 🖱️ souris, ⌨️ clavier, 👆 tactile (smartphone / tablette). Voir §4 et §16.
4. **Toujours préciser l'outil actif** (barre du bas) avant un geste dans la scène : le même clic fait des choses différentes selon l'outil.
5. **Vocabulaire des axes** : l'application affiche trois axes colorés. **X rouge = gauche/droite**, **Y vert = haut/bas** (la hauteur), **Z bleu = avant/arrière** (la profondeur). Les tutoriels doivent utiliser ce vocabulaire, pas celui de Blender (où Z est la hauteur). À l'**export**, les axes sont convertis (hauteur → Z) : voir §14.
6. **Ne pas promettre ce qui n'existe pas** : consulter §19 (limites) avant d'écrire une affirmation.
7. **Public cible de l'application** : enfants de 6 à 10 ans, avec un adulte (enseignant) pour les réglages et l'impression. Un tutoriel « enfant » utilise des phrases courtes et les icônes ; un tutoriel « enseignant » détaille réglages et impression.

### 0.2 Structure recommandée d'un tutoriel
1. **But** (ce qu'on obtient, avec une phrase et une image de résultat) · 2. **Matériel / réglages préalables** · 3. **Étapes numérotées** (action → résultat attendu) · 4. **Vérification** (comment savoir que c'est bon) · 5. **Pour l'impression** (épaisseurs, supports, orientation) · 6. **Problèmes fréquents**.

### 0.3 Captures d'écran utiles (à demander ou à décrire)
Barre du bas avec l'outil actif surligné · popup « Bouger » à droite · panneau de caméra à gauche (avec « Tout déplacer ») · fenêtre d'export · fenêtre « Espace Professeur ».

---

## 1. Présentation

**3D-Facile** (anciennement Kidi3D) est une application web (HTML + JavaScript + Three.js, sans installation) pour **dessiner en 3D** et **exporter un fichier STL ou OBJ** destiné à l'impression 3D.

Principes à connaître :
- **Tout est en millimètres** dans l'« espace de création ». Un réglage enseignant (« Espace de création ») peut agrandir cet espace ; l'export ramène alors le modèle à la taille réelle (§14).
- Le **plateau est circulaire** pour le dessin : on ne peut pas dessiner ni poser en dehors d'un disque de rayon *(taille du plateau ÷ 2) − 4 mm*. Le plateau d'impression réel est carré (réglage), la grille affichée correspond à sa taille.
- Chaque **forme** est un objet séparé : trait (tube), ballon, pilier, forme 3D, tampon, ou modèle importé. On peut les sélectionner, déplacer, tourner, agrandir, colorier, copier, verrouiller, effacer, ou transformer en **trou**.
- L'application **sauvegarde automatiquement** dans le navigateur et reprend le dessin au prochain lancement (§13).
- Le fichier exporté est **un seul volume étanche** (toutes les formes fusionnées) et **posé à plat** (le bas du modèle est sur le plateau), avec coupe automatique à la table si le réglage est activé (§14).

---

## 2. Lancer l'application

- Ouvrir `index.html` via un **petit serveur web** (par exemple `python -m http.server 8000` dans le dossier, puis `http://localhost:8000`) ou le déposer sur un hébergement statique. L'ouverture directe du fichier (`file://`) peut être bloquée par certains navigateurs.
- **Aucune connexion nécessaire** : Three.js, le moteur de fusion et de trous (manifold-3d) et les polices sont hébergés avec l'application (`vendor/`). Aucune requête ne part vers l'extérieur : l'application fonctionne sur un réseau d'établissement fermé et aucune donnée ne quitte le poste.
- Navigateurs récents (Chrome, Edge, Firefox, Safari) avec WebGL.
- Les données (dessin, réglages, modèles importés) sont stockées dans le **localStorage du navigateur** (clés `kidi3d_*`) : elles sont propres à un navigateur et à une adresse.
- Au démarrage : message « Bienvenue dans ton atelier 3D-Facile ! », outil **Trait** actif, vue de **face**, taille **20 mm**, couleur **rouge**, **son coupé** (🔇).

---

## 3. Cartographie de l'interface (ordinateur)

### 3.1 Barre du haut (de gauche à droite)
| Élément | Libellé / icône | Rôle |
|---|---|---|
| Logo | ✨ « 3DFacile » | Décoratif |
| Annuler | ↩️ « Annuler » | Annule la dernière action (aussi `Ctrl+Z`). Grisé s'il n'y a rien à annuler |
| Refaire | ↪️ « Refaire » | Rétablit l'action annulée (aussi `Ctrl+Y`) |
| Tout effacer | 🗑️ « Tout effacer » | Demande confirmation (« Veux-tu vraiment tout effacer pour recommencer à zéro ? ») puis vide la scène **et l'historique** |
| **Importer** | 📥 « Importer » | Ouvre un fichier `.stl` ou `.obj` (§11) |
| Sons | 🔇 / 🔊 | Active / coupe les effets sonores. **Le son est coupé par défaut** (icône 🔇) |
| Aide | ❓ | Affiche / masque la bulle d'aide |
| **Imprimer mon dessin** | 🖨️ (bouton rouge) | Ouvre la fenêtre d'export (§14) |
| Réglages | ⚙️ | Ouvre l'« Espace Professeur » (§15) |

### 3.2 Bulle d'aide
Une bulle (« kid-hint ») avec la baguette 🪄 explique l'outil actif. Un clic sur la bulle la ferme ; ❓ la rouvre. Textes exacts par outil :
- **Trait** : « ✏️ Dessine une ligne avec la souris : elle devient un tube 3D ! »
- **Ballon** : « 🎈 Dessine une forme fermée (reviens à ton point de départ) : elle se gonfle en ballon ! »
- **Pilier** : « 🏛️ Trace un trait de bas en haut : ça fait un pilier bien droit. »
- **Tampon** : « ⭐ Choisis un tampon, puis clique sur ton dessin. Reste appuyé et glisse pour l'orienter ! »
- **Formes** : « 🔷 Choisis une forme, règle ses proportions, puis clique pour la poser. »
- **Bouger** : « ✋ Touche une forme : bouge-la, agrandis-la, tourne-la, ou choisis une couleur pour la peindre ! »
- **Gomme** : « 🧽 Touche une forme pour la faire disparaître (elle devient rouge avant). »

### 3.3 Panneau de caméra (à gauche) — « 🧭 Tourne ton dessin »
De haut en bas :
1. **La boule d'orientation** (gizmo X/Y/Z, légende « 👆 Glisse sur la boule ») : glisser dessus fait tourner le point de vue.
2. **Croix de boutons** : ▲ « Regarder d'en haut » · ▼ « Regarder d'en bas » · ◀ « Tourner à gauche » · ▶ « Tourner à droite » (30° par appui) · au centre 🔍+ « Se rapprocher » et 🔍− « S'éloigner ».
3. **Trois vues** (icônes d'appareils photo) : **Face** (« Voir de face »), **Côté** (« Voir de côté »), **Dessus** (« Voir de dessus »).
4. **✥ Tout déplacer** (§8.9) : déplacer toute la sculpture sur le plateau.
5. **🖱️ Astuces souris** (menu déroulant) : rappel des gestes et raccourcis clavier.

### 3.4 Barre d'outils du bas (dock) — 4 groupes
| Groupe | Outil (libellé) | Identifiant interne | Icône |
|---|---|---|---|
| DESSINER | **Trait** | `tube` | courbe bleue |
| DESSINER | **Ballon** | `balloon` | ballon rose |
| CONSTRUIRE | **Formes** | `shape3d` | cube bleu |
| CONSTRUIRE | **Pilier** | `pillar` | colonne |
| CONSTRUIRE | **Tampon** | `stamp` | étoile orange |
| MODIFIER | **Bouger** | `edit` | croix de flèches violette |
| MODIFIER | **Gomme** | `eraser` | gomme rose |
| SYMÉTRIE | **Miroir : non / oui** | interrupteur | deux triangles |

Deuxième rangée : **Taille** (curseur + valeur en mm, petit point à gauche, gros point à droite) et **Couleur** (11 pastilles).
Les outils Ballon, Pilier, Formes, Tampon et Bouger peuvent être **masqués par l'enseignant** (§15).

### 3.5 Panneaux d'options (à droite, selon l'outil)
Un seul est utile à la fois ; chacun a un bouton ✖ pour le fermer.
- « 🎈 Mon ballon » (outil Ballon) — §5.2
- « 🏛️ Forme du pilier » (outil Pilier) — §5.4
- « 🔷 Formes 3D » avec « 📐 Proportions » (outil Formes) — §5.3
- Tiroir des **tampons** (outil Tampon) — §5.5
- **Popup de modification** (outil Bouger, quand une forme est sélectionnée) — §8

### 3.6 Messages éphémères (« toasts »)
Petits messages en bas à droite pendant ~2,5 s. La liste utile est en §18.

---

## 4. Naviguer dans la scène (caméra)

### 4.1 Souris (ordinateur) 🖱️
| Geste | Effet |
|---|---|
| **Clic droit + glisser** | **Pivoter** autour de la scène |
| **Clic milieu + glisser** (ou **Alt + glisser** avec le bouton gauche) | **Déplacer la vue** (panoramique) |
| **Molette** (ou **Maj + glisser** vers le haut/bas) | **Zoomer** (haut = s'approcher, bas = s'éloigner) |
| **Ctrl + clic** sur une forme | Passe en mode **Bouger** et **sélectionne** la forme, quel que soit l'outil actif |
| Glisser sur la **boule d'orientation** | Fait tourner la vue |

Notes :
- En mode **Bouger**, **Maj + clic** sur une forme sert à la **sélection multiple** ; **Maj + glisser** ne zoome que dans le vide (pas au-dessus d'une forme).
- Les **repères** de transformation s'effacent pendant que la caméra bouge et reviennent ensuite.
- Un réglage enseignant permet d'**inverser le sens du panoramique horizontal** (§15).

### 4.2 Boutons de l'interface
Croix ▲▼◀▶, 🔍+ / 🔍−, vues Face / Côté / Dessus (§3.3). Zoom par appui : 40 unités ; rotation par appui : 30°.

### 4.3 Clavier ⌨️
Pavé numérique **1** = vue de face, **3** = vue de côté, **7** = vue de dessus.

### 4.4 Tactile 👆 (smartphone / tablette)
- **Deux doigts** : **pincer / écarter** = zoom ; **glisser à deux doigts** = tourner la vue. Un seul doigt sert à dessiner / sélectionner.
- Si un doigt avait déjà commencé un trait, ce trait est **abandonné** dès que le deuxième doigt touche.
- Il n'y a **pas de panoramique** de la vue au doigt (utiliser « Tout déplacer » pour recentrer la sculpture).

---

## 5. Créer des formes

**Principe commun** : on choisit un outil dans la barre du bas, on règle la **Taille** et la **Couleur** (§6), puis on dessine ou on clique dans la scène. Chaque création est **annulable** (`Ctrl+Z`) et **sauvegardée automatiquement**.

### 5.1 Outil « Trait » — tube 3D
1. Sélectionner **Trait**.
2. 🖱️ Maintenir le bouton gauche et **dessiner** une ligne dans la scène ; 👆 glisser un doigt. Relâcher pour créer.
3. **Résultat** : un **boudin 3D lisse** (tube) suit le tracé, avec des extrémités arrondies.

Détails utiles :
- **Épaisseur** : *rayon = max(rayon minimal de sécurité × échelle de travail ; arrondi(Taille × 0,4))*. Exemple : Taille 20 → rayon 8 mm (tube de 16 mm de diamètre) ; Taille 45 → rayon 18 mm. Le **rayon minimal** vient du réglage enseignant (5 mm par défaut).
- Pendant le geste, un trait de **retour visuel** (de largeur proche de l'épaisseur réelle) est affiché.
- **Où le trait se place en profondeur** (important pour un tuto) : l'application cherche, dans l'ordre : (1) un point **sur une forme** touchée ; (2) la **forme la plus proche à moins de 60 pixels** à l'écran ; (3) le **plateau** si le tracé est dans le disque du plateau ; (4) à défaut, le **centre** de ce qui est déjà dessiné. → Pour dessiner *sur* une forme existante, **passer la souris sur elle**. Pour dessiner **dans le vide**, changer de vue (Face puis Côté) et ajuster avec « Bouger ».
- Un tracé trop court est ignoré (moins de 3 points).
- Si un point sort du plateau : message « ⚠️ Ton dessin dépasse du socle ! » et **rien n'est créé**.
- Avec **Miroir : oui**, une copie symétrique (plan x = 0) est créée en même temps (§7).

### 5.2 Outil « Ballon » — forme gonflée
1. Sélectionner **Ballon** ; le panneau « 🎈 Mon ballon » apparaît à droite.
2. **Dessiner une forme fermée** (revenir près du point de départ). Une zone blanche translucide apparaît quand le contour est considéré fermé (distance de fermeture ≈ 55 px). Même ouvert, le contour est refermé automatiquement à la création.
3. **Résultat** : un volume **gonflé, à bords arrondis**, orienté dans le plan de l'écran au moment du dessin (**la vue compte** : dessiner en vue de Face donne un ballon « debout », en vue de Dessus un ballon « à plat »).

Réglages du panneau (valables pour les **prochains** ballons ; modifiables ensuite avec « Bouger ») :
| Réglage | Plage | Effet |
|---|---|---|
| **Épaisseur** | 14 à 60 mm (×échelle de travail) | Épaisseur du ballon. Par défaut automatique : suit « Taille » (rayon × 2,2, minimum 14) |
| **Bords arrondis** | 0 à 100 % | Part de l'épaisseur arrondie (5 % à 45 % en interne). Par défaut ≈ 3,5 mm de biseau |
| **Contour lisse** | 1 à 5 | Nombre de lissages du contour dessiné (3 par défaut) |
| **↺ Réglages d'origine** | — | Revient à l'automatique |

### 5.3 Outil « Formes » — solides géométriques
1. Sélectionner **Formes** ; le panneau « 🔷 Formes 3D » apparaît.
2. Choisir une forme : **Cube**, **Sphère**, **Cylindre**, **Cône**, **Donut**, **Pyramide** (message « Forme 3D : … »).
3. (Facultatif) Régler **📐 Proportions** *avant* la pose : curseurs **Largeur**, **Hauteur**, **Profondeur** de ×0,2 à ×3 (pas 0,05). Le bouton **🔗 Liés / 🔓 Libres** lie ou délie les 3 axes ; **↺ Reset 1:1** remet 1:1. Un **aperçu translucide** suit la souris et montre l'effet immédiatement.
4. **Cliquer** dans la scène pour poser. **Résultat** : « ✨ Forme 3D posée ! ».

Détails :
- **Taille de base** = *Taille × 0,8 mm* (Taille 20 → 16 mm).
- Posée **sur le plateau** : elle repose à plat. Posée **sur une autre forme** : elle s'oriente selon la surface touchée et **s'enfonce de 1,5 mm** dans la matière pour bien « coller » (avec l'échelle de travail : 1,5 mm × échelle).
- **Rester appuyé et glisser** pendant la pose **incline** la forme (voir §5.5, même mécanisme).
- **Couleur** : une forme 3D est posée **avec la couleur choisie dans la palette** (rouge au démarrage). L'aperçu translucide la montre déjà. Pour changer la couleur d'une forme déjà posée : la sélectionner (« Bouger ») puis cliquer une couleur (§6.2).
- Hors du plateau : « ⚠️ Reste sur le plateau pour poser ton objet ! ».

### 5.4 Outil « Pilier »
1. Sélectionner **Pilier** ; choisir le profil dans « 🏛️ Forme du pilier » : **Carré**, **Hexagone**, **Cannelé**, **Mur**, **Rond** (message « Profil pilier : … »).
2. **Tracer un trait de bas en haut**.
3. **Résultat** : un pilier **parfaitement vertical** à la position moyenne du tracé, dont la hauteur va du point le plus bas au plus haut du tracé.

Détails : hauteur minimale 15 mm ; si le bas du tracé est sous 20 mm de hauteur, le pilier **part du plateau** (y = 0) ; section dimensionnée par le rayon du trait (rayon de « Taille » × 1,1) ; les extrémités sont **biseautées**.

### 5.5 Outil « Tampon » — éléments décoratifs
1. Sélectionner **Tampon** ; le tiroir s'ouvre avec 18 tampons : **Œil**, **Deux yeux**, **Bouche**, **Nez**, **Oreille**, **Main**, **Pied**, **Ailes**, **Cornes**, **Antenne**, **Queue**, **Nœud**, **Couronne**, **Chapeau**, **Cœur**, **Étoile**, **Fleur**, **Roue**.
2. Choisir un tampon (message « Tampon : … »). *Sur petit écran, le tiroir se referme alors pour dégager la vue : toucher « Tampon » pour le rouvrir.*
3. **Cliquer** sur le dessin pour coller. **Résultat** : « ✨ Tampon collé ! ».

**Orientation** : un simple clic place le tampon **perpendiculaire à la surface** touchée. Pour l'**incliner**, **garder le bouton appuyé et glisser** avant de relâcher : la direction du glissement donne le sens, la distance donne l'inclinaison (0° au départ jusqu'à 180° pour ≈ 120 px ; zone morte de 4 px). Un **aperçu translucide** montre le résultat.

Détails :
- **Taille** = *Taille × 0,8 mm*.
- Sur une forme existante, le tampon **s'enfonce de 1,5 mm** (×échelle) pour être solidaire à l'impression. Les tampons sont conçus avec une **racine** qui pénètre la surface (cornes, oreilles, mains, queue, antenne…).
- **Couleurs** : tant qu'**aucune couleur n'a été choisie dans la palette**, chaque tampon garde ses **couleurs naturelles** (cœur rouge, couronne dorée, chapeau violet…). Dès qu'on **clique une couleur**, les tampons posés ensuite prennent cette couleur sur leur **partie principale** (les détails gardent leurs teintes : pierres de la couronne, creux de l'oreille…). Les **yeux** colorient toujours leur **iris** avec la palette. Pour recolorier un tampon déjà posé : §6.2.
- Le **Miroir** crée la copie symétrique exacte (position, orientation, retournement).

### 5.6 Outil « Gomme »
1. Sélectionner **Gomme**. Survoler une forme : elle devient **rouge** (si elle n'est pas verrouillée).
2. **Cliquer** : « 🧽 Forme effacée ! » (annulable).
- Une forme **verrouillée** est refusée : « 🔒 Cette forme est verrouillée : déverrouille-la avec « Bouger » pour l'effacer. »

---

## 6. Taille et couleur

### 6.1 « Taille »
- **Curseur** de **12 à 45** (mm), valeur affichée à droite (« 20 mm »). Les boutons ronds aux extrémités donnent **12** (le plus fin) et **45** (le plus gros). Un point de couleur montre un aperçu.
- Sert à : l'**épaisseur** des traits, l'épaisseur des ballons (réglage auto), des piliers, la **taille** des formes 3D et des tampons (×0,8).
- **Avec une forme sélectionnée** (mode Bouger), le curseur **affiche et change la taille de la forme** : plus besoin d'ouvrir « Proportions ». Les proportions réglées sont conservées. Pour une sélection multiple, tout est mis à l'échelle autour du centre commun.

### 6.2 « Couleur » — palette
11 couleurs : rouge `#ff4757`, orange `#ffa502`, jaune `#f1c40f`, vert `#2ed573`, bleu `#1e90ff`, violet `#9b59b6`, rose `#ff6b81`, marron `#a0522d`, gris `#747d8c`, blanc `#ffffff`, noir `#2f3542`.
- **Hors mode Bouger** : choisit la couleur des **prochains traits, ballons, piliers et formes 3D**, des iris des yeux, et — une fois qu'une couleur a été choisie — de la partie principale des **prochains tampons**.
- **En mode Bouger avec une ou plusieurs formes sélectionnées** : **clic sur une couleur = colorie toute la sélection** (message « 🎨 Coloriée ! » / « 🎨 Formes coloriées ! »). Les formes verrouillées sont ignorées (« 🔒 Forme verrouillée… »), un trou refuse (« 🕳️ Un trou n'a pas de couleur : il est rouge pour le repérer. »).
- **Tampons** : si le tampon utilise la couleur choisie (iris des yeux), c'est cette partie qui change ; sinon sa **partie principale** est coloriée (ex. la bande de la couronne) et les détails gardent leurs teintes.
- Quand on sélectionne une forme dont la couleur fait partie de la palette, la pastille correspondante est mise en évidence.
- L'**OBJ** exporté **garde les couleurs** (une couleur par sommet, voir §14.4). Le **STL** n'a pas de couleurs (format sans couleur).

---

## 7. Symétrie (« Miroir »)
- Bouton **Miroir : non/oui** (message « 🪞 Miroir activé : dessine d'un côté, ça se copie de l'autre ! »). Un **plan doré translucide** au centre du plateau (x = 0) montre l'axe.
- Actif pour : **traits, ballons, piliers, formes 3D, tampons**. Chaque création produit son **jumeau** de l'autre côté du plan (gauche/droite).
- **Non appliqué** aux déplacements, rotations, copies, imports. Pour déplacer une forme et son jumeau, les sélectionner ensemble (Maj + clic).
- Conseil de tuto : dessiner un personnage (bras, oreilles, yeux) d'un seul côté avec Miroir actif.

---

## 8. Modifier : l'outil « Bouger »

### 8.1 Sélectionner
- 🖱️/👆 **Cliquer / toucher** une forme (outil Bouger). Un **cadre violet** l'entoure ; le **popup** s'ouvre à droite ; les repères apparaissent.
- **Sélection multiple** : **Maj + clic** sur d'autres formes (ajoute / retire). Raccourci clavier **A** = tout sélectionner, **Alt + A** = tout désélectionner.
- **Ctrl + clic** sur une forme avec **n'importe quel outil** = passer en Bouger et la sélectionner.
- **Clic dans le vide** = désélectionner (sauf avec Maj). Bouton **✔️ « Fini ! »** = désélectionner.
- **Déplacer à la souris** : une forme **non courbe** (forme 3D, tampon, pilier, modèle importé) peut être **glissée** directement ; un **fantôme** translucide montre la nouvelle position. **Toucher ≠ glisser** : un simple clic ou toucher **sélectionne sans rien bouger** ; le glissement ne démarre que si l'on déplace le pointeur d'au moins **8 pixels après environ 0,13 seconde** (ou d'un geste franc de **45 pixels**). La forme **ne saute pas** au départ et **garde son orientation** tant qu'elle glisse sur la même surface (sol, face plane) ; en passant sur une autre forme, elle s'y colle et s'oriente selon la surface. Les **courbes** (traits, ballons) **ne se glissent pas** (cela gênerait le placement) : utiliser les points bleus, le carré « Déplacer » ou les flèches du popup.
- Les formes restent **au-dessus du plateau** (jamais sous la table) et **dans le disque** du plateau pour les déplacements.

### 8.2 Les repères autour d'une forme seule (non courbe)
Petites pastilles reliées à la forme, **discrètes** (s'effacent pendant la navigation) :
| Repère | Couleur / forme | Geste | Effet |
|---|---|---|---|
| **Largeur** | rond rouge | tirer vers l'extérieur / l'intérieur | élargit / rétrécit selon l'axe X de la forme |
| **Hauteur** | rond vert | idem | axe Y |
| **Profondeur** | rond bleu | idem | axe Z |
| **Tourner** | rond orange (petit) | glisser à gauche / droite | rotation, **accroche tous les 15°** |
| **Déplacer** | **carré** gris-bleu | glisser | déplace sur le plateau |
| **Monter** | **carré** vert-bleu | glisser haut / bas | monte ou descend |
- Une **zone morte** de 8 px évite les gestes involontaires ; un seul geste est limité à ×0,25–×4. Le clic droit / milieu / molette sur un repère pilote la caméra comme ailleurs.
- **Sélection multiple** : seulement **Tourner**, **Déplacer** et **Monter**, autour du centre commun. **Formes verrouillées** et **courbes** : pas de repères.

### 8.3 Le popup de modification (à droite)
De haut en bas :
1. **🗑️ « Jeter »** (supprime la sélection ; « Élément supprimé ! ») · **✔️ « Fini ! »** (termine) · sur petit écran **▼ / ▲ Options** (replie / déplie).
2. **Libellé** : « ✋ 1 forme » / « ✋ N formes (dont n 🔒) » / « 🔒 1 forme verrouillée » + rappel « Maj + clic = plusieurs formes ».
3. Colonne gauche — **📍 Déplacer** : croix 3×3 de boutons (8 mm par appui, **dans le repère de la vue**) :
   ```
   ↻ Basculer   |  ↑ Monter   |  ↗ Reculer (vers le fond)
   ← Gauche     |  ✋ (centre) |  → Droite
   ↙ Avancer    |  ↓ Descendre |  ↻ Pencher
   ```
   - **Trois rotations, trois couleurs** (comme les axes) : **🟢 Pivoter** = tourner sur soi-même, à plat, autour de la verticale (boutons « À gauche » / « À droite », bloc « Pivoter ») ; **🔴 Basculer** = culbute vers l'avant, autour de l'axe gauche-droite de l'écran ; **🔵 Pencher** = bascule sur le côté, autour de l'axe de profondeur. Basculer et Pencher tournent de 22,5° par appui ; **Maj + clic** inverse le sens. Une forme posée sur la table **reste posée** après avoir basculé.
   - Légende colorée : ↔ gauche/droite (rouge), ↕ haut/bas (vert), ↗↙ avant/arrière (bleu), ↻ basculer/pencher.
   - Sous la croix : **🔒 « Verrouiller »** (§8.6) et **🕳️ « Creuser les autres formes »** (§10).
4. Colonne droite — selon la forme :
   - **📏 Épaisseur** (tubes) — curseur 4 à 40 mm.
   - **🔵 Épaisseur du point** — épaisseur d'**un seul** point de la courbe (curseur 2–50 mm), quand un point bleu est actif.
   - **🎈 Mon ballon** (ballons) — Épaisseur / Bords arrondis / Contour lisse / « ↺ Réglages d'origine » (§5.2).
   - **📐 Proportions** (formes seules, non courbes) — ouvert par défaut sur ordinateur, replié sur petit écran : **Largeur / Hauteur / Profondeur** ×0,2–×3 ; **🔗 Liés** conserve le rapport entre axes quand on change l'un d'eux ; **↺ Reset 1:1** remet la taille d'origine.
   - **📥 Modèle importé** (§11).
   - Trois blocs : **🔄 Pivoter (sur soi, à plat)** : **À gauche** ↺ / **À droite** ↻ (22,5° autour de l'axe vertical ; un tampon tourne autour de son propre « haut »), avec un rappel « Pivoter = sur soi · Basculer = vers l'avant · Pencher = sur le côté » ; **📏 Taille** : **Plus petit** (➖, ×0,87) et **Plus grand** (➕, ×1,15), côte à côte ; **🧩 Outils** : **Copier** (👯 : copie décalée de ±20 mm, libre même si l'original est verrouillé) et **Retourner** (↔️ miroir gauche-droite de la forme).
- En **sélection multiple**, « Proportions » et « Retourner » sont masqués ; les autres actions s'appliquent au groupe, autour du centre commun.

### 8.4 Modifier une courbe (traits et ballons) : les points bleus
- Une courbe sélectionnée affiche des **points bleus** (poignées) reliés par un fil. **Nombre limité selon la complexité** : **de 3 à 6** pour un trait, **de 4 à 6** pour un ballon (un trait droit en a peu, un tracé sinueux davantage, placés sur les vrais virages).
- **Glisser un point** déforme la courbe de manière **fluide** (les points voisins suivent, pondération lissée) et la forme est régénérée en direct. Le point actif devient **jaune** et un peu plus gros ; son **épaisseur** se règle avec « Épaisseur du point ».
- Pas de glisser-déposer de la courbe entière (voulu) : pour la déplacer, utiliser les **flèches** du popup, ou **G** au clavier (§12).

### 8.5 Rotation, échelle, copie, retournement — rappels de valeurs
Pas de rotation 22,5° · échelle ×1,15 (Plus grand) / ×0,87 (Plus petit) · copie +20 mm (côté libre du plateau) · repère Tourner : accroche 15° · proportions ×0,2–×3.

### 8.6 Verrouiller
**🔒 « Verrouiller »** (message « 🔒 Verrouillé : cette forme ne bougera plus. ») : la forme ne peut plus être déplacée, tournée, agrandie, coloriée ni effacée ; une pastille 🔒 flotte au-dessus ; le popup est grisé sauf le bouton **« Déverrouiller »** (« 🔓 Déverrouillé. »). Bandeau : « 🔒 Forme verrouillée : elle ne peut plus bouger. » Utile pour protéger une partie terminée.
- Les formes verrouillées **suivent quand même** l'ensemble avec **Tout déplacer** (§8.9).

### 8.7 Plusieurs formes en même temps
Maj + clic (ou **A**). Le libellé indique « ✋ N formes ». Déplacer / tourner / agrandir / colorier / verrouiller / copier / jeter s'appliquent à toutes les formes **non verrouillées**. Le curseur « Taille » met le groupe à l'échelle.

### 8.8 Annulation
Toute modification validée est annulable (`Ctrl+Z`). Un geste au clavier (§12) annulé avec **Échap** revient à l'état du début du geste.

### 8.9 « ✥ Tout déplacer » — déplacer toute la sculpture
Bloc dans le panneau de caméra (à gauche) : sur téléphone, ouvrir d'abord le panneau avec le bouton rond **🧭**.
- **Flèches ▲ ◀ ▶ ▼** : « Tout reculer (vers le fond) », « Tout à gauche », « Tout à droite », « Tout avancer (vers toi) » — pas de 8 mm (× échelle de travail), **dans le repère de la vue**. **Garder appuyé** répète le déplacement (au bout de 0,35 s).
- **✥ (au centre)** : **glisser** pour déplacer toute la sculpture dans le plan du plateau.
- **◎** : « Remettre toute la sculpture au centre du plateau » (« ◎ Sculpture centrée sur le plateau »).
- Concerne **toutes** les formes (y compris verrouillées et trous). Un geste = **un seul** état d'annulation. Reste dans le disque du plateau. Si rien n'est dessiné : « 🧱 Rien à déplacer pour l'instant ».

---

## 9. Rappel : effacer une forme
Trois façons, toutes annulables : **🗑️ « Jeter »** dans le popup (§8.3), la touche **Suppr** / **X** en mode Bouger (§12.4), ou l'outil **Gomme** (§5.6). Une forme **verrouillée** ne s'efface qu'après avoir été déverrouillée.

---

## 10. Les « trous » : retirer de la matière aux autres formes (booléen)

**But** : creuser une forme avec une autre (perçage, fente, encoche, trou de porte-clés, creux de coque…).

Pas à pas :
1. Créer (ou importer) la forme qui servira d'**outil de coupe**, la placer **là où l'on veut creuser**, en la faisant **traverser** la forme à creuser.
2. La sélectionner (« Bouger »), cliquer **🕳️ « Creuser les autres formes »** dans le popup. Message : « 🕳️ Trou ! Cette forme creusera les autres (elle ne sera pas imprimée). »
3. La forme devient **rouge translucide** (le « fantôme » du trou). Le bouton devient **🧱 « Redevenir une forme pleine »** (et, en multi-sélection, « Creuser avec ces formes »).
4. **Aperçu en direct** : au repos (quelques dixièmes de seconde après le dernier geste), les formes touchées s'affichent **déjà creusées**. Dès qu'on touche à quelque chose, l'affichage revient aux formes d'origine puis le creusé réapparaît. Désactivable dans les réglages enseignant (« Aperçu en direct des trous… ») si l'ordinateur ralentit. Au-delà de 24 formes touchées : « 🕳️ Trop de formes touchées : l'aperçu du trou est désactivé (l'export reste correct). »
5. **À l'export**, la soustraction est **toujours appliquée** ; les trous **ne sont pas imprimés**.

À savoir :
- **Toutes** les formes peuvent devenir des trous (tube, ballon, pilier, forme 3D, tampon, modèle importé). Plusieurs trous peuvent agir sur la même forme.
- Un trou ne se colorie pas. Il est ignoré par le socle automatique et par les dimensions affichées à l'export.
- Le moteur de calcul est **manifold-3d** (chargé depuis internet, garantit un résultat étanche). S'il est indisponible, une découpe de secours moins fiable est utilisée.
- Le trou est « sans épaisseur de sécurité » : prévoir **au moins 5 mm** de matière autour d'un trou pour l'impression.

---

## 11. Importer un modèle STL ou OBJ

1. Cliquer **📥 « Importer »** (barre du haut) et choisir un fichier **.stl** (binaire ou texte) ou **.obj**, **ou** glisser-déposer le fichier sur la fenêtre. Message « 📥 Import de « nom.stl »… ».
2. **Automatiquement** : le modèle est **remis à l'endroit** (STL : Z vers le haut ; OBJ : Y vers le haut, sauf ceux exportés par l'application), **centré**, mis à une **taille adaptée** (la plus grande dimension ≈ **45 %** du plateau), **posé sur la table** et placé dans un **espace libre** (premier emplacement sans chevauchement en spirale autour du centre).
3. Il est **sélectionné** en mode Bouger. Message « ✅ « nom » importé et posé sur le plateau (N triangles). Mal orienté ? Utilise « Basculer 90° ». »

Options du popup « **📥 Modèle importé** » :
| Bouton | Effet |
|---|---|
| **Basculer 90°** | Rotation de 90° vers l'avant (redresse un modèle couché), puis repose sur la table |
| **Pencher 90°** | Rotation de 90° sur le côté, puis repose sur la table |
| **Poser** | Ramène le bas du modèle exactement sur la table |
| **Taille auto** | Remet la taille automatique (≈ 45 % du plateau) |
| **Taille réelle** | Taille **d'origine du fichier** (celle qui sera imprimée, ×échelle de travail) |
| **Centrer** | Recentre sur le plateau |
Tout le reste fonctionne comme pour une autre forme : déplacer, tourner, proportions, curseur « Taille », colorier, copier, verrouiller, **trou**, raccourcis clavier G/R/S.

Limites et conservation :
- **Maximum 400 000 triangles** : au-delà, « 📥 Ce modèle est trop détaillé (… triangles). Simplifie-le puis réessaie. »
- Fichier illisible : « 📥 Je n'arrive pas à lire ce fichier. » / « 📥 Ce fichier ne contient pas de forme 3D que je sais lire. »
- Formats refusés : « 📥 Je sais importer les fichiers .stl et .obj ». Un `.kid3d` déposé : « 📂 Pour ouvrir un projet : Imprimer → Ouvrir un projet ».
- Les modèles sont conservés par la **sauvegarde automatique** (si assez légers : sinon « 💾 Ce modèle est trop lourd pour la sauvegarde automatique : pense à « Sauvegarder .kid3d ». ») et **dans les fichiers projet `.kid3d`**.
- Les couleurs, textures et matériaux du fichier sont **ignorés** (le modèle prend la couleur courante). Les modèles sont affichés avec des arêtes lissées jusqu'à 40°.
- Un modèle importé qui n'est **pas étanche** peut donner un résultat moins fiable en trou / export.

---

## 12. Raccourcis clavier « façon Blender » ⌨️

Ils agissent sur la **sélection** (mode Bouger). Sans sélection, **G**, **R**, **S** prennent la **forme sous le curseur**. Désactivés quand on tape dans un champ de texte ou quand une fenêtre (export, réglages) est ouverte. Un **bandeau sombre** en haut de l'écran indique le mode, l'axe, la valeur et les touches utiles.

### 12.1 Démarrer un geste
| Touche | Mode |
|---|---|
| **G** | **Déplacer** (« ✋ Déplacer ») |
| **R** | **Tourner** (« 🔄 Tourner ») — autour de l'axe de la vue |
| **S** | **Agrandir** (« ↔️ Agrandir ») |

### 12.2 Pendant le geste
| Touche / action | Effet |
|---|---|
| **Souris** | Calcule le déplacement, l'angle ou le facteur |
| **X / Y / Z** | **Contraint à un axe** : X gauche/droite, Y haut/bas, Z avant/arrière. **Appuyer encore** = axe **propre à la forme** (« de la forme »), **encore** = libre |
| **Maj + X/Y/Z** | **Plan sans cet axe** (déplacement) ou, en échelle, l'axe exclu |
| **R** (pendant Rotation) | **Bascule rotation « vue » ↔ rotation « libre »** (comme une boule : la souris tourne la forme autour de l'axe vertical et horizontal de l'écran) |
| **G / S / R** | Change de mode en cours de route (repart de l'état courant) |
| **Chiffres, `.` ou `,`, `-`, Retour arrière** | **Valeur exacte** : mm pour G (sur l'axe choisi, X par défaut), **degrés** pour R, **facteur** pour S. `-` inverse le signe |
| **Ctrl** (maintenu) | **Accroche** : 5 mm (déplacement le long d'un axe) / 15° (rotation) |
| **Entrée, Espace** ou **clic gauche** | **Valider** (un état d'annulation) |
| **Échap** ou **clic droit** | **Annuler** : retour exact à l'état du début (« ↩️ Annulé ») |

### 12.3 Exemples (à reprendre dans les tutoriels)
- **Déplacer de 20 mm à droite** : `G` · `X` · `2` `0` · `Entrée`.
- **Tourner de 90° autour de la verticale** : `R` · `Y` · `9` `0` · `Entrée`.
- **Doubler la taille** : `S` · `2` · `Entrée`.
- **Tourner librement comme une boule** : `R` · `R` · bouger la souris · clic pour valider.
- **Déplacer à la souris dans le sens avant/arrière seulement** : `G` · `Z` · bouger · clic.
- **Agrandir seulement la hauteur d'une forme** : `S` · `Y` · bouger · clic (agrandissement le long de l'axe de la forme ; une seule forme sélectionnée).

### 12.4 Autres raccourcis (hors geste)
| Touche | Effet |
|---|---|
| **A** / **Alt + A** | Tout sélectionner / tout désélectionner |
| **Suppr** ou **X** (mode Bouger, sélection) | Jeter la sélection (annulable) |
| **Maj + D** | Copier la sélection |
| **Pavé 1 / 3 / 7** | Vue de face / de côté / de dessus |
| **Ctrl + Z / Ctrl + Y** | Annuler / Refaire |

### 12.5 Particularités
- En rotation et en échelle, le **pivot** est le **centre de la forme** (forme seule) ou le **centre commun** (sélection multiple).
- **Contrainte d'axe en échelle** : uniquement pour **une seule** forme ; avec plusieurs, l'échelle reste uniforme.
- En **vue de face**, l'axe **Z** pointe vers la caméra : G + Z à la souris bouge à peine. Tourner un peu la vue ou **taper une valeur**.
- Pendant un geste, la forme reste **au-dessus de la table** ; un déplacement qui sortirait du plateau est bloqué à la dernière position valable.
- ⚠️ Sur clavier **AZERTY**, les chiffres de la rangée du haut nécessitent **Maj** : utiliser le **pavé numérique** pour saisir une valeur.

---

## 13. Annuler, effacer, sauvegarder

| Action | Comment | Détails |
|---|---|---|
| **Annuler / Refaire** | boutons ↩️ / ↪️ ou `Ctrl+Z` / `Ctrl+Y` | Message « ↩️ C'est annulé ! ». Chaque création, déplacement validé, coloriage, suppression, import… est une étape |
| **Tout effacer** | 🗑️ | Confirmation, puis scène **et historique** vidés (plus d'annulation possible) |
| **Sauvegarde automatique** | automatique | Dans le navigateur (`kidi3d_autosave`) ; le dessin **réapparaît au prochain lancement** |
| **Sauvegarder le projet** | 🖨️ Imprimer → **« Sauvegarder .kid3d »** | Télécharge `3D-Facile_AAAA-MM-JJ_HHhMM.kid3d` (JSON) : formes + modèles importés. « 💾 Projet sauvegardé ! » |
| **Reprise sur poste partagé** | automatique au démarrage | S'il reste un dessin : fenêtre « Un dessin est en cours sur ce poste » avec **« Reprendre le dessin »** ou **« Nouveau dessin »** (efface le dessin précédent) |
| **Ouvrir un projet** | 🖨️ Imprimer → **« Ouvrir un projet »** | Charge un `.kid3d`. « 🎉 Projet ouvert avec succès ! » ; sinon « Fichier projet non reconnu. » |
- La sauvegarde automatique **ne dépasse pas** la capacité du navigateur (quelques Mo) ; pour les gros modèles importés, utiliser le fichier projet.
- Changer de navigateur, d'ordinateur ou d'adresse **n'emporte pas** la sauvegarde automatique : exporter le `.kid3d`.

---

## 14. Exporter pour imprimer

### 14.1 La fenêtre « 🎉 Bravo ! Prêt pour l'Impression 3D ! »
Ouverte par **🖨️ « Imprimer mon dessin »**. Elle affiche :
- **Parties 3D** : nombre de formes (hors trous).
- **Dimensions réelles** : « L × P × H mm » **telles qu'elles seront imprimées** (après réduction éventuelle au plateau et coupe à la table).
- Une note éventuelle : « 📏 Ton dessin est imprimé N fois plus petit pour tenir sur le plateau. »
- **Finition de surface & Topologie** : **✨ Lisse & Haute Définition** (par défaut, recommandé pour imprimer) ou **🧊 Topologie Épurée (Pour Blender)** (maillage plus léger, pour la subdivision).
- **Fichier STL** — bouton **« Télécharger .STL »** → `3D-Facile_AAAA-MM-JJ_HHhMM.stl` (date et heure de l'export, aucune donnée personnelle). « 🚀 Fichier STL téléchargé ! ». Si certaines pièces n'ont pas pu être fusionnées : « ⚠️ Fichier STL téléchargé, mais certaines pièces n'ont pas pu être fusionnées : vérifie-le dans le trancheur avant d'imprimer. »
- **Fichier OBJ (Blender et autres logiciels 3D)** — « Avec les couleurs… » — bouton **« Télécharger .OBJ »** → `3D-Facile_AAAA-MM-JJ_HHhMM.obj`. « 🎨 Fichier OBJ téléchargé ! »
- **Sauvegarder le Projet** — « Sauvegarder .kid3d » / « Ouvrir un projet ».
- Si rien n'est dessiné : « Dessine d'abord quelque chose avant d'imprimer ! ».

### 14.2 Ce que fait l'export (dans cet ordre)
1. **Fusion** : toutes les formes sont **fusionnées en un seul volume étanche** (les parties qui se chevauchent ne forment plus qu'un objet, sans faces internes), avec le moteur manifold-3d.
1. **Trous** : les formes marquées « trou » sont soustraites du volume, puis retirées du fichier.
2. **Coupe à la table** (réglage activé par défaut) : tout ce qui est **sous le plateau** est supprimé et la coupe est **refermée par un fond plat** (fichier étanche). Désactivable (§15).
3. **Échelle d'impression** : le modèle est multiplié par *1 ÷ échelle de travail*. Puis, **s'il dépasse 90 % du plateau** (en largeur, profondeur ou hauteur), il est **réduit** pour tenir (marge de sécurité de 10 %). **Jamais agrandi.**
4. **Centrage** : le modèle est **centré** sur l'origine en X/Y d'impression et son **bas est à Z = 0**.
5. **Orientation** : les coordonnées sont converties pour les trancheurs : la **hauteur de l'atelier (Y) devient l'axe Z** de l'impression (rotation de 90° autour de X). Le bas du modèle repose donc sur le plateau dans Cura, PrusaSlicer, Bambu Studio…
6. **Socle automatique** (réglage « Générer automatiquement un socle… », désactivé par défaut) : ajoute un **disque plat de 3,5 mm** d'épaisseur dépassant de **15 mm** autour de la sculpture.

### 14.3 Rappel de l'échelle de travail
Réglage « Espace de création » : ×1 / ×1,5 / ×2 / ×3. Le plateau de dessin est agrandi d'autant ; à l'export le modèle est **divisé** par ce facteur. Le rayon minimal des traits et l'enfoncement de 1,5 mm sont aussi multipliés pour rester corrects une fois réduits.

### 14.4 Formats
- **STL binaire** : un seul volume étanche (vérifié : aucune arête ouverte ni partagée par plus de deux faces, faces bien orientées), sans couleur. Compatible Cura, Bambu Studio, PrusaSlicer, Toybox…
- **OBJ** : le même volume étanche, **avec les couleurs** (une couleur par sommet : `v x y z r g b`, lue par Blender, Bambu Studio, MeshLab… ; PrusaSlicer l'ignore) ; mêmes axes que le STL (Z vers le haut). Avec la finition « 🧊 Topologie Épurée (Pour Blender) », l'OBJ garde au contraire les formes séparées et leurs quadrilatères (pour retravailler dans Blender, pas pour imprimer). ⚠️ Un OBJ ouvert dans Blender avec ses réglages par défaut (Y vers le haut) apparaît **couché**.
- **`.kid3d`** : JSON du projet (pas un format d'impression).

### 14.5 Conseils d'impression à intégrer aux tutoriels
- **Matière** : PLA (non toxique, sans odeur). **Couche** : 0,20 mm (ou 0,28 mm en rapide). **Remplissage** : 10 à 15 %. **Supports** : arborescents si des bras sont dans le vide (onglet « 📖 Fiche Trancheur » de l'Espace Professeur).
- **Épaisseur minimale** : respecter 5 mm (rayon) ou plus ; éviter les parties très fines (queues, antennes) qui cassent au décollement.
- **Surplombs** : un bras horizontal ou une tête « flottante » demande des supports ; préférer des formes qui reposent sur le plateau.
- **Surface d'appui** : le bas est plat (coupe à la table) ; ajouter un **socle** si la sculpture est instable ou sur une petite surface.
- **Assemblages** : les tampons posés sur une forme **s'enfoncent de 1,5 mm** ; faire se **chevaucher** les formes (ne pas les laisser juste « se toucher ») pour qu'elles forment un seul objet.
- **Trous** : laisser de la matière autour (≥ 5 mm) et vérifier le résultat dans le trancheur.

---

## 15. Réglages enseignant (⚙️ « Espace Professeur »)

Ouverture : bouton **⚙️** (info-bulle « Paramètres Enseignant »). Si le **code secret** est activé : saisir le code (4 à 6 chiffres) puis « Déverrouiller » ; code faux : « Code incorrect. ». Le code n'est jamais affiché ni enregistré en clair (seulement son empreinte). Pour activer le verrou, il faut choisir un code de 4 à 6 chiffres. Code oublié : effacer les données du site dans le navigateur (cela réinitialise aussi les réglages). Enregistrer avec **« Enregistrer les réglages »** (« ✅ Réglages enregistrés ! »). Ils sont gardés dans le navigateur.

### Onglet « 🖨️ Imprimante 3D »
| Réglage | Valeurs | Défaut | Effet |
|---|---|---|---|
| **Dimensions du plateau d'impression** | 120 / 180 / 220 / 256 / 300 / 400 mm | **256** (« Grande ») | Taille de la grille et de la zone de dessin (et du plateau pris en compte à l'export) |
| **Espace de création (échelle d'impression)** | ×1 / ×1,5 / ×2 / ×3 | **×1** | Agrandit l'espace de dessin ; export réduit d'autant |
| **Rayon minimal des traits** | 8 / 5 / 3 mm | **5** | Rayon minimal des traits, ballons, piliers (un trait de rayon 5 mm fait 10 mm d'épaisseur). À Taille 12 le rayon vaut déjà 5 mm : seul « 8 mm » change quelque chose pour les petites tailles |
| **Couper les modèles au niveau de la table** | case | **cochée** | Fond plat, rien sous le plateau |
| **Aperçu en direct des trous** | case | **cochée** | Voir §10 ; décocher si l'ordinateur ralentit |
| **Générer automatiquement un socle…** | case | décochée | Disque de 3,5 mm sous la figurine (§14.2) |
| **Afficher le plateau sous forme de grille 3D** | case | cochée | Grille d'aide visuelle |
| **Inverser le sens du Pan horizontal** | case | décochée | Sens du déplacement de la vue |

### Onglet « 🎨 Outils & Pédagogie »
- Cases pour **masquer / afficher** : Outil Ballon Gonflé, Outil Pilier Droit, Formes Géométriques 3D, Tampons décoratifs, Outil Modifier, **Effets sonores** (décochés par défaut : le son est coupé tant qu'on ne l'active pas, avec ce réglage ou le bouton 🔊/🔇 de la barre du haut).
- **Taille de l'interface** : Automatique (par défaut, s'adapte à l'écran) / Petite (0,8) / Normale (1) / Grande (1,2) / Très grande (1,4 — écran tactile, jeunes enfants).
- **Verrouiller l'accès prof avec un code secret** (décoché par défaut) et **Changer le code secret** (jusqu'à 6 caractères).

### Onglet « 📖 Fiche Trancheur »
Recommandations d'impression en classe (§14.5).

---

## 16. Smartphone, tablette et petits écrans

### 16.1 Tablettes et écrans tactiles (mise en page complète)
Sur un écran tactile de plus de 820 px de large (iPad, tablette, écran interactif) :
- l'interface n'est **jamais réduite sous 100 %** et les boutons font **au moins 44 px** (taille conseillée pour le doigt) ;
- le **panneau caméra est replié** derrière le bouton rond **🧭** (comme sur téléphone) ; la vue se tourne aussi **à deux doigts** ;
- jusqu'à 1180 px de large, **Annuler** et **Refaire** n'affichent que leur flèche (↩️ ↪️ ; info-bulle conservée) pour que la barre du haut tienne sur une ligne ;
- le popup « Bouger » est allégé : légendes et rappels masqués, « Proportions » replié par défaut ;
- les astuces « souris » sont masquées.

Le zoom du navigateur (agrandir) est autorisé partout pour l'accessibilité.

### 16.2 Smartphones et petites fenêtres

Le **mode compact** s'active automatiquement quand la fenêtre fait **820 px de large ou moins**, ou **560 px de haut ou moins**.

| Élément | Comportement compact |
|---|---|
| **Barre du haut** | Icônes seules (le titre revient à partir de 600 px de large ; le logo disparaît sous 430 px) |
| **Barre d'outils** | **Grille** : 4 colonnes en portrait ; **une seule rangée de 8** en paysage. « Taille » et couleurs en dessous |
| **Panneau de caméra** | Replié : bouton rond **🧭** à gauche (sous la bulle d'aide) ; il ouvre le panneau (boule masquée sur écran bas) avec les vues et « ✥ Tout déplacer » |
| **Panneaux d'options et popup** | **Volet pleine largeur** posé juste **au-dessus** de la barre d'outils (portrait), limité à **la moitié de l'écran** ; en **paysage**, volet **à droite**, barre d'outils resserrée à gauche (icônes seules, couleurs sur deux rangées). Le contenu se **réduit** (jamais en dessous de ×0,5) pour tenir sans défiler |
| **Vue 3D** | Se **recentre** dans l'espace libre pour que la forme reste visible au-dessus / à côté du volet |
| **Popup « Bouger »** | Bouton **▼ Réduire / ▲ Options** pour le replier en simple barre (Jeter, Fini, Options). « Proportions » replié par défaut, légendes masquées |
| **Tampons** | Le tiroir se **referme** après le choix d'un tampon |
| **Fenêtres** (export, enseignant) | Réduites (jusqu'à ×0,6) pour tenir à l'écran |
| **Gestes** | Voir §4.4 : deux doigts = zoom / rotation |
| **Clavier** | Les raccourcis G/R/S nécessitent un clavier (tablette + clavier) |

✅ Interface compacte et gestes tactiles **validés sur smartphone** par le propriétaire de l'application ; ils ont aussi été vérifiés avec des tailles d'écran et des événements tactiles simulés.

---

## 17. Bonnes pratiques de conception pour l'impression (à enseigner)
1. **Construire sur le plateau** : la sculpture doit reposer sur la table (le bas sera coupé à plat).
2. **Faire se chevaucher** les formes pour qu'elles ne forment qu'une seule pièce (les tampons s'enfoncent déjà de 1,5 mm).
3. **Éviter le trop fin** : respecter l'épaisseur minimale (rayon 5 mm par défaut). Les antennes, queues et doigts très fins sont fragiles.
4. **Penser aux surplombs** : bras en l'air = supports. On peut aussi dessiner un **pilier** ou une forme en dessous.
5. **Utiliser Miroir** pour les créatures symétriques.
6. **Verrouiller** les parties terminées avant de continuer.
7. **Contrôler l'export** : lire les **dimensions réelles** dans la fenêtre d'export, ouvrir le STL dans le trancheur et vérifier l'orientation (le bas sur le plateau).
8. **Trous** : ils ne sont pas visibles à l'impression s'ils ne traversent rien ; vérifier avec l'aperçu en direct.

---

## 18. Messages et problèmes fréquents

| Message / symptôme | Cause | Solution |
|---|---|---|
| « ⚠️ Ton dessin dépasse du socle ! » | Un point du tracé est hors du disque du plateau | Dessiner plus près du centre ; agrandir le plateau (réglage) |
| « ⚠️ Reste sur le plateau pour poser ton objet ! » | Clic de pose hors disque | Cliquer plus près du centre |
| Le trait n'apparaît pas | Tracé trop court (< 3 points) | Tracer plus long |
| Le trait n'est pas « là où je dessine » (profondeur) | Aucun objet sous le curseur : placé sur le plateau ou au centre | Passer sur une forme existante ; changer de vue ; corriger avec Bouger |
| Je ne peux pas déplacer un trait à la souris | Voulu pour les courbes | Flèches du popup, carré « Déplacer », ou **G** |
| La forme ne bouge plus | Elle est verrouillée (🔒) | « Déverrouiller » dans le popup |
| « 🔒 Cette forme est verrouillée… » (Gomme) | Idem | Déverrouiller puis gommer |
| Je ne vois plus mes repères | Ils s'effacent pendant la navigation, absents pour courbes et formes verrouillées | Attendre / sélectionner une forme non courbe |
| Les trous ne s'affichent pas creusés | Aperçu désactivé, scène en mouvement, moteur pas encore chargé, trop de formes (> 24) | Attendre un instant, activer l'aperçu ; l'**export** creuse quand même |
| « 🕳️ Un trou n'a pas de couleur… » | On colorie un trou | Le repasser en forme pleine d'abord |
| « 📥 Ce modèle est trop détaillé… » | > 400 000 triangles | Simplifier le modèle avant import |
| Modèle importé couché | Orientation du fichier différente | « Basculer 90° » / « Pencher 90° » |
| Rien ne se charge / écran vide | Ouverture en `file://` ou fichiers `vendor/` manquants | Servir le dossier complet avec un serveur web |
| Perte du dessin | Autre navigateur / effacement des données du navigateur | Sauvegarder en `.kid3d` régulièrement |
| Le STL arrive « sur le dos » dans le trancheur | (corrigé) ancienne version exportait en Y vers le haut | Utiliser la version actuelle (export Z vers le haut) |

---

## 19. Limites connues et points d'attention (ne pas présenter comme des fonctions)
- **Plateau de dessin circulaire**, plateau d'impression carré : la zone dessinable est un disque inscrit.
- **Pas de grille magnétique** ni de mesure de cotes dans l'atelier (les dimensions réelles sont données à l'export).
- **Pas de panoramique au doigt** sur écran tactile.
- **Tampons et couleur** : les tampons gardent leurs couleurs naturelles tant qu'aucune couleur n'a été cliquée dans la palette (§5.5). Certains tampons à plusieurs pièces ne colorient que leur partie principale.
- **Couleurs à l'export** : seul l'OBJ (finition « Lisse ») les contient, par sommet ; le STL n'en a pas. Une imprimante multicolore lit l'OBJ selon son trancheur.
- **Rayon minimal** : le réglage « Rayon minimal des traits » s'applique au **rayon** (un tube de rayon 5 mm fait 10 mm de diamètre).
- **Modèles importés** : couleurs / textures ignorées ; limite 400 000 triangles ; peuvent ne pas être étanches.
- **Trous** : nécessitent internet pour le moteur robuste ; la découpe de secours est moins fiable sur les courbes.
- **Axe Z en vue de face** pour G/R/S : peu lisible à la souris (voir §12.5).
- **Fonctions absentes** : pas d'union/intersection booléenne (seulement soustraction), pas de texte 3D, pas de lissage/sculpture à la brosse, pas de réglage de matière/texture, pas de multi-couleur à l'export.
- Non vérifié dans tous les trancheurs ni sur tous les modèles de tablettes.

---

## 20. Recettes de tutoriels prêtes à adapter

> Chaque recette donne l'objectif, les réglages et les étapes avec résultat attendu. Adapter le vocabulaire à l'âge visé.

### Recette A — « Mon premier trait » (6–7 ans, 5 min)
1. Outil **Trait** actif (par défaut). Taille **20 mm**, couleur au choix.
2. Dessiner une ligne ondulée sur le plateau → **un tube 3D** apparaît.
3. Cliquer **Face / Côté / Dessus** pour le regarder sous plusieurs angles.
4. **Annuler** (↩️) pour essayer encore.
**Vérification** : le tube est lisse et posé sur la grille.

### Recette B — Un bonhomme de neige (6–8 ans)
1. **Formes** → **Sphère** : régler **Taille 45**, poser au centre (grosse boule du bas).
2. Poser une 2ᵉ **Sphère** (Taille 33) **sur** la première (elle s'enfonce de 1,5 mm), puis une 3ᵉ (Taille 22) pour la tête.
3. **Tampon** → **Œil** ou **Deux yeux** sur la tête ; **Nez** au milieu ; **Bouche** dessous.
4. **Bouger** → sélectionner une sphère → **clic sur Blanc** dans la palette pour la colorier.
5. **Trait** → dessiner deux bras ; **Miroir : oui** pour qu'ils soient symétriques.
**Impression** : les sphères se chevauchent ; prévoir un **socle** si la base est petite.

### Recette C — Un chat (7–9 ans) avec Miroir
1. **Miroir : oui**. **Ballon** (vue de **Face**) : dessiner un contour fermé pour la tête.
2. **Tampon → Oreille** de chaque côté (le jumeau apparaît tout seul), **Deux yeux**, **Nez**, **Queue** à l'arrière.
3. **Trait** fin (Taille 15) pour les moustaches (attention à l'épaisseur minimale).
4. **Bouger** → ajuster, **Verrouiller** la tête, continuer le corps.
**Pièges** : tampons trop petits = fragiles ; vérifier que les oreilles pénètrent bien la tête.

### Recette D — Un porte-clés avec trou (8–10 ans)
1. **Formes → Cylindre** (aplati : **Proportions** Hauteur ×0,3 avant la pose, Taille 45) = la plaque ; ajouter des **Tampons** décoratifs (étoile, cœur).
2. Poser un **Cylindre** fin (Taille 15) à l'endroit du trou de clé, qui **traverse** la plaque.
3. **Bouger** → sélectionner ce petit cylindre → **🕳️ Creuser les autres formes** : il devient rouge translucide et la plaque s'affiche percée.
4. **Imprimer** : le trou est percé dans le STL ; le cylindre n'est pas imprimé.
**Vérification** : dimensions affichées, trou visible dans le trancheur ; laisser ≥ 5 mm de matière autour du trou.

### Recette E — Une tour avec piliers et arche (9–10 ans)
1. **Pilier → Carré** : tracer de bas en haut quatre piliers aux coins ; **Pilier → Mur** pour des murs.
2. **Formes → Pyramide** ou **Cône** en toit.
3. **Bouger → A** (tout sélectionner) puis **Tout déplacer ◎** pour centrer la construction.
**Impression** : bien tout faire se chevaucher ; envisager un socle automatique.

### Recette F — Modifier un modèle existant (enseignant / grands)
1. **📥 Importer** un STL (ex. un personnage).
2. Si couché : **Basculer 90°**. **Taille réelle** pour voir la vraie taille, ou **Taille auto**.
3. Ajouter des **Tampons**, **Creuser** (trou) pour percer, **Bouger → G X 20 Entrée** pour décaler.
4. **Imprimer** → **Télécharger .STL**.

### Recette G — Maîtriser G / R / S (ados, adultes)
1. Sélectionner une forme. `G` `X` `3` `0` `Entrée` (30 mm à droite). `R` `Y` `4` `5` `Entrée` (45°). `S` `1` `.` `5` `Entrée` (×1,5).
2. `G` bouger la souris, `Échap` annule. `R` `R` rotation libre. `Ctrl` pour accrocher.
3. **Maj + D** copie, **Suppr** supprime, **A** tout sélectionner.

### Recette H — Imprimer correctement (enseignant)
1. **⚙️ Imprimante 3D** : choisir la **taille de plateau** de l'imprimante ; vérifier « Couper les modèles au niveau de la table ».
2. Dessiner/assembler ; ouvrir **🖨️ Imprimer mon dessin** ; relever les **Dimensions réelles** ; choisir **Lisse & Haute Définition**.
3. **Télécharger .STL**, ouvrir dans le trancheur : le modèle doit être **debout, posé sur le plateau**. PLA, couche 0,20 mm, remplissage 10–15 %, supports si besoin.

---

## 21. Annexes

### 21.1 Identifiants internes utiles (pour vérifier / automatiser)
Outils : `tube`, `balloon`, `shape3d`, `pillar`, `stamp`, `edit`, `eraser` (attribut `data-tool` des boutons). Formes 3D : `cube`, `sphere`, `cylinder`, `cone`, `torus`, `pyramid`. Tampons : `eye_single`, `eyes_cartoon`, `mouth`, `nose`, `ear`, `hand`, `foot`, `wings`, `horns`, `antenna`, `tail`, `bow`, `crown`, `cone_hat`, `heart`, `star`, `flower`, `wheel`. Profils de pilier : `square`, `hexagon`, `fluted`, `wall`, `round`. Types de forme (`userData.type`) : `tube`, `balloon`, `pillar`, `stamp`, `imported`.
Couleurs naturelles des tampons (utilisées tant qu'aucune couleur n'a été choisie dans la palette) : cœur `#ff4757`, couronne et étoile `#f1c40f`, ailes `#dbeafe`, oreille `#ffb8b8`, nez `#ff4757`, chapeau `#9b59b6`, roue `#2f3542`, pied `#34495e`, main et queue `#ffa502`, bouche `#e11d48`, cornes `#f8d9a0`, fleur `#ff6b81`, antenne `#ef4444`, nœud `#ec4899`. Les formes 3D (cube, sphère, cylindre, cône, donut, pyramide) prennent la couleur de la palette.

### 21.2 Stockage navigateur (`localStorage`)
`kidi3d_autosave` (dessin), `kidi3d_geo_<id>` (géométries importées), `kidi3d_bed_size`, `kidi3d_work_scale`, `kidi3d_min_thickness`, `kidi3d_truncate_bed`, `kidi3d_bool_preview`, `kidi3d_auto_base`, `kidi3d_show_grid`, `kidi3d_tool_*`, `kidi3d_sound`, `kidi3d_ui_scale`, `kidi3d_invert_pan_x`, `kidi3d_use_pin`, `kidi3d_teacher_pin`.

### 21.3 Fichiers du code
`index.html` (interface) · `css/style.css` · `js/app.js` (application, outils, sauvegarde, export, compact) · `js/engine/` : `scene.js`, `cameraController.js`, `gizmo.js`, `curves.js` (tracés), `meshGen.js` (traits, ballons, piliers, tampons, formes), `editMode.js` (sélection, popup, courbes), `transformHandles.js` (repères), `keyTransform.js` (raccourcis G/R/S), `csg.js` + `booleanPreview.js` (trous), `importer.js` (import STL/OBJ), `exporter.js` (STL/OBJ, coupe à la table) · `js/ui/` : `teacherModal.js`, `sound.js`.

### 21.4 Glossaire
- **Forme** : un objet de la scène. **Courbe** : trait ou ballon (modifiable par points bleus). **Trou** : forme qui retire de la matière aux autres. **Plateau** : surface d'impression (grille). **Table** : plan y = 0 sur lequel tout repose. **Manifold / étanche** : maillage fermé sans trou, requis pour imprimer. **Trancheur** : logiciel qui prépare l'impression (Cura, Bambu Studio, PrusaSlicer…). **Échelle de travail** : agrandissement de l'espace de dessin, annulé à l'export.

---

## 22. Check-list qualité d'un tutoriel
- [ ] Les **libellés** sont exacts (§3) et l'**outil actif** est indiqué avant chaque geste.
- [ ] Chaque étape a un **résultat attendu** observable.
- [ ] Le **périphérique** (souris / clavier / tactile) est précisé quand le geste diffère.
- [ ] Les **valeurs** (Taille, mm, degrés, facteurs) viennent de ce guide.
- [ ] Les **limites** (§19) ne sont pas contredites.
- [ ] La partie **impression** est cohérente (épaisseur, supports, orientation, dimensions réelles).
- [ ] Une **étape de vérification** conclut le tutoriel.
- [ ] Pas de vocabulaire de Blender pour les axes (X gauche/droite, Y haut/bas, Z avant/arrière dans l'atelier).
