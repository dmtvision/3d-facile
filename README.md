# 🪄 Kidi3D V3 - Logiciel de Dessin 3D Magique pour Enfants & Impression 3D

Application web légère, intuitive et robuste conçue pour les enfants de 6 à 10 ans, prête à être déposée sur votre serveur web.

---

## 🆕 Version 5 - Simplifiée pour les 4-10 ans

- **Sphère d'orientation** agrandie : les lettres X / Y / Z ne sont plus coupées et sont dessinées par-dessus les axes.
- **Interface plus lisible** : gros boutons avec mots simples (Annuler, Tout effacer, Imprimer mon dessin, Trait, Ballon, Pilier, Tampon, Bouger, Gomme), dock du bas sur deux rangées (outils / taille + couleurs), onglets et tampons en grosses tuiles.
- **Outil Miroir** 🪞 : dessine d'un côté, la copie symétrique apparaît de l'autre (traits, ballons, piliers, tampons). Un plan doré montre l'axe de symétrie.
- **Gomme** : la forme visée devient rouge avant d'être effacée.
- **Bouger** : le panneau de commandes se place à côté de la forme (plus jamais dessus), avec des libellés écrits, plus *Copier* 👯 et *Retourner* ↔️. Chaque action est annulable.
- **Annuler / Refaire** grisés quand ils sont inutiles, raccourcis `Ctrl+Z` / `Ctrl+Y`.
- Textes d'aide simplifiés avec pictogrammes.

---

## ✨ Nouveautés de la Version 3

1. **Vue de Face Droite par Défaut :**
   - La caméra regarde désormais la scène bien de face, permettant de construire des personnages et des bâtiments debout et stables sur le lit d'impression 3D sans effet penché.

2. **Sphère d'Orientation 3D (Gizmo XYZ Interactif) :**
   - Une mini-sphère 3D stylisée dans le panneau de gauche affiche en temps réel les 3 axes colorés :
     - 🔴 **Axe X (Rouge)** : Droite / Gauche
     - 🟢 **Axe Y (Vert)** : Haut / Bas
     - 🔵 **Axe Z (Bleu)** : Devant / Derrière
   - L'enfant peut faire pivoter le monde 3D en glissant directement son doigt ou sa souris sur cette sphère.

3. **D-Pad Ergonomique en Croix :**
   - Disposition logique type manette de jeu :
     - ⬆️ **Haut** / ⬇️ **Bas** / ⬅️ **Gauche** / ➡️ **Droite**
     - Au centre : **`➕` Zoom avant** (au-dessus) et **`➖` Zoom arrière** (en-dessous).

4. **Navigation Souris Complète :**
   - **Molette :** Zoom avant / arrière progressif.
   - **Clic Milieu + Glisser :** Rotation orbitale 3D directe de la scène.
   - **Clic Droit + Glisser :** Déplacement latéral / vertical libre (Pan).

5. **Outil Ballon Gonflé Biseauté (100% Manifold) :**
   - Dès qu'un contour fermé est tracé, il se transforme en une forme solide extrudée avec un **biseau doux arrondi** et une épaisseur solide garantie pour l'impression 3D.

6. **Piliers & Murs Droits Biseautés :**
   - Piliers verticaux bien droits, coupés plats à la base ($Y=0$) et au sommet, avec angles biseautés doux.

7. **Aperçu Fantôme (Ghost) & Rotation au Posé :**
   - Au survol avec l'outil Tampon, un fantôme translucide montre l'emplacement exact et s'aligne automatiquement perpendiculaire à la surface.
   - En maintenant le clic enfoncé et en bougeant la souris, on fait pivoter le tampon avant de le poser définitivement.

8. **Mode Modification avec Halo & Widget Ancré :**
   - L'objet sélectionné est entouré d'un **halo néon cyan éclatant**.
   - Les commandes de modification (grandir, rétrécir, monter, descendre, tourner, supprimer) s'affichent **directement autour de l'objet sélectionné** et le suivent à l'écran.

9. **Alternance Automatique des Couleurs :**
   - Chaque nouvel objet prend automatiquement une couleur distincte dans un nuancier harmonieux pour différencier facilement les membres et parties du corps.

10. **Biseau Systématique :**
    - Tous les cubes, piliers et formes à angles saillants intègrent un biseau doux pour éviter les arêtes vives à l'impression 3D.

---

## 🚀 Déploiement

Transférez simplement le contenu du dossier `draw-soft` vers votre serveur web (Apache, Nginx, cPanel, OVH, etc.).
- Aucun backend requis (100% HTML5 / CSS3 / JavaScript Vanilla ES6 + Three.js).
