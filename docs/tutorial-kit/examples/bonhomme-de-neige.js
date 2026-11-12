/**
 * Exemple de tutoriel prêt à exécuter avec TutoKit : « Un bonhomme de neige » (6-8 ans).
 * Chargement (dans la page de l'application, après tutokit.js) :
 *   await import('/docs/tutorial-kit/examples/bonhomme-de-neige.js');
 *   for (const step of window.TUTO_BONHOMME.steps) {
 *     const r = await TutoKit.runStep(step, { frameWidth: <largeur de la capture> });
 *     // -> prendre la capture d'écran, la recadrer avec r.crop.region si présent, l'enregistrer sous `${r.id}.png`
 *   }
 * Chaque étape vérifie l'état obtenu (expect) : si une vérification échoue, une erreur claire est levée
 * et le tutoriel ne doit PAS être publié tel quel.
 */
window.TUTO_BONHOMME = {
  title: 'Un bonhomme de neige',
  age: '6-8 ans',
  duration: '10 minutes',
  device: 'ordinateur (souris)',
  steps: [
    {
      id: '00-depart',
      title: 'Ouvre 3D-Facile : la feuille est vide',
      text: "Au démarrage, l'outil « Trait » est choisi et le plateau est vide.",
      action: async (T) => { await T.reset(); await T.view({ theta: 20, phi: 65, distance: 260, target: [0, 40, 0] }); },
      expect: (s) => s.meshes.length === 0 && s.tool === 'tube',
      showHint: true
    },
    {
      id: '01-outil-formes',
      title: 'Choisis l\'outil « Formes » puis la « Sphère »',
      text: 'Dans la barre du bas, groupe CONSTRUIRE, clique sur « Formes ». Dans le panneau de droite, clique sur « Sphère ».',
      action: async (T) => { await T.pick('shape', 'sphere'); },
      expect: (s) => s.tool === 'shape3d' && s.activeItem === 'sphere' && s.panels.includes('geo-shapes-dock'),
      highlight: [{ target: 'tool-shapes', label: '1' }, { target: '#geo-shapes-dock .geo-item[data-stamp="sphere"]', label: '2' }]
    },
    {
      id: '02-grosse-boule',
      title: 'Règle la Taille sur 45 et clique au centre du plateau',
      text: 'Glisse le curseur « Taille » tout à droite (45 mm), puis clique au milieu du plateau : la grosse boule apparaît.',
      action: async (T) => { await T.size(45); await T.placeAt([0, 0, 0]); },
      expect: (s) => s.meshes.length === 1 && s.meshes[0].subtype === 'sphere' && s.meshes[0].bottom === 0,
      highlight: [{ target: '#input-global-thickness', label: '1' }]
    },
    {
      id: '03-boule-du-milieu',
      title: 'Taille 33 : pose une boule sur la première',
      text: 'Mets la Taille sur 33 et clique sur le dessus de la grosse boule : la nouvelle boule s\'y colle (elle s\'enfonce un tout petit peu pour bien tenir à l\'impression).',
      action: async (T) => { await T.size(33); await T.placeOn(0, 'top'); },
      expect: (s) => s.meshes.length === 2 && s.meshes[1].bottom > 30
    },
    {
      id: '04-tete',
      title: 'Taille 22 : pose la tête',
      text: 'Mets la Taille sur 22 et clique sur le dessus de la boule du milieu.',
      action: async (T) => { await T.size(22); await T.placeOn(1, 'top'); },
      expect: (s) => s.meshes.length === 3 && s.meshes[2].bottom > s.meshes[1].bottom
    },
    {
      id: '05-yeux',
      title: 'Ajoute les yeux avec l\'outil « Tampon »',
      text: 'Clique sur « Tampon », choisis « Deux yeux », Taille 14, puis clique sur le devant de la tête, un peu en haut.',
      action: async (T) => { await T.pick('stamp', 'eyes_cartoon'); await T.size(14); await T.placeOn(2, 'front', { offset: [0, 3, 0] }); },
      expect: (s) => s.meshes.length === 4 && s.meshes[3].subtype === 'eyes_cartoon',
      highlight: [{ target: 'tool-stamps', label: '1' }]
    },
    {
      id: '06-nez',
      title: 'Ajoute le nez',
      text: 'Choisis le tampon « Nez », Taille 12, et clique sur le devant de la tête, sous les yeux.',
      action: async (T) => { await T.pick('stamp', 'nose'); await T.size(12); await T.placeOn(2, 'front', { offset: [0, -4, 0] }); },
      expect: (s) => s.meshes.length === 5 && s.meshes[4].subtype === 'nose'
    },
    {
      id: '07-peindre-en-blanc',
      title: 'Peins les boules en blanc',
      text: 'Clique sur « Bouger », clique sur la grosse boule, puis Maj + clic sur les deux autres. Clique enfin sur la pastille blanche de la palette.',
      action: async (T) => { await T.select([0, 1, 2]); await T.color('#ffffff'); },
      expect: (s) => s.meshes.slice(0, 3).every(m => m.color === '#ffffff') && s.tool === 'edit',
      highlight: [{ target: 'tool-edit', label: '1' }, { target: '.color-swatch[data-color="#ffffff"]', label: '2' }]
    },
    {
      id: '08-fini',
      title: 'Clique sur « Fini ! » et admire ton bonhomme',
      text: 'Le cadre violet disparaît. Tourne autour avec la boule « Tourne ton dessin » ou les boutons Face / Côté / Dessus.',
      action: async (T) => { await T.button('btn-edit-deselect'); await T.frame(null, { theta: 25, phi: 70 }); },
      expect: (s) => s.selection.length === 0 && s.meshes.length === 5
    },
    {
      id: '09-imprimer',
      title: 'Prépare l\'impression',
      text: 'Clique sur « Imprimer mon dessin » : la fenêtre indique les dimensions réelles. Clique sur « Télécharger .STL ».',
      action: async (T) => { await T.button('btn-print-modal'); },
      expect: (s) => s.panels.includes('modal-export'),
      highlight: [{ target: 'btn-download-stl', label: '1' }],
      crop: '#modal-export .modal-card'
    }
  ]
};
