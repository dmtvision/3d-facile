# Instructions pour les agents IA — 3D-Facile

Application web (HTML + JavaScript + Three.js r128, sans build) pour dessiner en 3D et exporter en STL/OBJ. Public : enfants de 6 à 10 ans. Fonctionne sans aucun appel extérieur (bibliothèques et polices dans `vendor/`).

## Écrire un tutoriel (avec captures d'écran)
Lire et suivre **[`docs/tutorial-kit/README.md`](docs/tutorial-kit/README.md)**. En résumé :
1. Servir le dossier (`python -m http.server 8791`) et ouvrir `http://localhost:8791/index.html?t=<horodatage>`.
2. Injecter le kit : `await import('/docs/tutorial-kit/tutokit.js?' + Date.now()); await TutoKit.ready(); await TutoKit.reset();`
3. Décrire chaque étape (action + vérification + repères), l'exécuter avec `TutoKit.runStep()`, **puis** prendre la capture.
4. Textes : libellés exacts de [`docs/tutorial-kit/app-reference.json`](docs/tutorial-kit/app-reference.json) et de [`docs/GUIDE_UTILISATION.md`](docs/GUIDE_UTILISATION.md).
5. Modèle complet et vérifié : [`docs/tutorial-kit/examples/bonhomme-de-neige.js`](docs/tutorial-kit/examples/bonhomme-de-neige.js).

Ne jamais décrire une fonction absente (liste `notFeatures` de la référence) ni écrire une étape non exécutée.

## Modifier le code
- Point d'entrée `index.html` ; logique dans `js/app.js` et `js/engine/*.js` ; styles `css/style.css`.
- Après une modification de JS/CSS, incrémenter le paramètre `?v=` des balises `<script>`/`<link>` de `index.html` (cache).
- Les textes de l'interface sont en français ; garder le tutoiement et les libellés courts pour les enfants.
- Mettre à jour `docs/GUIDE_UTILISATION.md` et `docs/tutorial-kit/app-reference.json` quand un libellé ou un comportement change.
