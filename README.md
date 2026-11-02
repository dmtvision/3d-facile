# 🪄 3D-Facile — atelier de dessin 3D pour enfants (4-10 ans)

Application web sans installation (JavaScript + Three.js r128, aucun outil de build) : l'enfant dessine en 3D et
exporte son modèle en **STL / OBJ** pour l'imprimer. Il suffit de déposer le dossier sur un serveur web
(ou de lancer un petit serveur local) et d'ouvrir `index.html`.

> 📖 **Guide d'utilisation complet** (libellés exacts, valeurs, étapes, recettes de tutoriels) : [docs/GUIDE_UTILISATION.md](docs/GUIDE_UTILISATION.md)

## Outils

| Groupe | Outils |
|---|---|
| Dessiner | **Trait** (boudin 3D), **Ballon** (forme gonflée, avec épaisseur / bords / lissage réglables) |
| Construire | **Formes** (cube, sphère…, proportions réglables), **Pilier**, **Tampon** (yeux, couronne, cornes, ailes…) |
| Modifier | **Bouger** (poignées, flèches, rotations, copie, verrouillage, trou), **Gomme** |
| Symétrie | **Miroir** : on dessine d'un côté, l'autre se fait tout seul |

## Souris et raccourcis

| Action | Geste |
|---|---|
| Pivoter la vue | Clic droit + glisser |
| Déplacer la vue | Clic milieu + glisser, ou **Alt** + glisser |
| Zoomer | Molette, ou **Maj** + glisser (haut = s'approcher) |
| Modifier une forme (quel que soit l'outil) | **Ctrl** + clic sur la forme |
| Sélectionner plusieurs formes | **Maj** + clic (en mode Bouger) |
| Annuler / Refaire | `Ctrl+Z` / `Ctrl+Y` |

## Importer un modèle 3D

Le bouton **📥 Importer** (ou un glisser-déposer sur la fenêtre) ouvre un fichier **.stl** (binaire ou texte) ou **.obj**.
Le modèle est remis à l'endroit, centré, mis à une taille adaptée au plateau (~45 %) et posé sur la table dans un espace libre.
Il devient une forme comme les autres (déplacer, tourner, agrandir, colorier, copier, verrouiller, trou…) avec en plus, dans le popup :
**Basculer 90° / Pencher 90°**, **Poser**, **Taille auto**, **Taille réelle** (celle du fichier) et **Centrer**.
Les STL sont lus avec Z vers le haut ; les OBJ avec Y vers le haut (sauf ceux exportés par l'appli). Limite : 400 000 triangles.
Les modèles importés sont conservés dans la sauvegarde automatique (si assez légers) et dans les fichiers projet `.kid3d`.

## Formes « trou » (booléen)

Dans le popup de *Bouger*, le bouton **Creuser les autres formes** transforme la forme en trou : elle apparaît en rouge
translucide, n'est pas imprimée et retire de la matière à toutes les formes qu'elle traverse. L'aperçu du résultat
est calculé en direct quand la scène est au repos (réglage enseignant : *Aperçu en direct des trous*). L'export STL/OBJ
applique toujours la soustraction (moteur [manifold-3d](https://github.com/elalish/manifold), chargé depuis un CDN,
avec une découpe de secours intégrée si le moteur n'est pas disponible).

## Réglages enseignant (⚙️)

Taille du plateau (120 à 400 mm), échelle de travail (plus de place pour créer, l'export est ramené à la taille réelle),
taille de l'interface, épaisseur minimale, coupe des modèles au niveau de la table (activée par défaut), socle automatique,
aperçu des trous, outils visibles, code PIN.

## Export

Un seul bouton **Imprimer mon dessin** : `Export3D.stl` ou `Export3D.obj`, modèle étanche (2-manifold), posé à plat sur la table.
Le projet peut aussi être sauvegardé / rouvert (`.kid3d`). L'autosauvegarde utilise le stockage local du navigateur.

## Organisation du code

```
index.html            interface
css/style.css         styles (sections par version)
js/app.js             application, outils, sauvegarde, export
js/engine/            scene, caméra, meshGen (traits, ballons, tampons), curves, editMode,
                      transformHandles, exporter (STL/OBJ, coupe à la table), csg + booleanPreview (trous)
js/ui/                fenêtre enseignant, sons
```
