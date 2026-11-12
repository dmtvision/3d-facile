/**
 * TutoKit — boîte à outils pour piloter 3D-Facile de façon fiable et reproductible
 * (création de tutoriels, captures d'écran, vérifications automatiques).
 *
 * Utilisation : injecter ce fichier dans la page de l'application (après son chargement), par exemple :
 *   await import('/docs/tutorial-kit/tutokit.js')            // si la page est servie depuis le dossier du projet
 * ou coller son contenu dans la console / un outil « exécuter du JavaScript ».
 * Ensuite : await TutoKit.ready(); await TutoKit.reset(); …
 *
 * Toutes les actions passent par l'interface réelle (clics sur les boutons, événements souris sur la scène)
 * sauf indication contraire, pour que les captures montrent exactement ce que voit l'utilisateur.
 * Chaque fonction asynchrone attend que l'application ait fini de réagir (images rendues, popups ajustés).
 */
(function () {
  const VERSION = '1.0.0';
  const DEFAULT_COLOR = '#ff4757';
  const SHAPES = ['cube', 'sphere', 'cylinder', 'cone', 'torus', 'pyramid'];
  const STAMPS = ['eye_single', 'eyes_cartoon', 'mouth', 'nose', 'ear', 'hand', 'foot', 'wings', 'horns', 'antenna',
    'tail', 'bow', 'crown', 'cone_hat', 'heart', 'star', 'flower', 'wheel'];
  const TOOLS = ['tube', 'balloon', 'shape3d', 'pillar', 'stamp', 'edit', 'eraser'];
  const PROFILES = ['square', 'hexagon', 'fluted', 'wall', 'round'];

  const $ = (sel) => document.querySelector(sel);
  const app = () => window.kidiApp;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const frames = (n = 2) => new Promise(r => {
    let k = 0;
    const step = () => (++k >= n ? r() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
  // Attente robuste : quelques images + un délai (les popups s'ajustent à l'image suivante, l'aperçu des trous après ~0,3 s)
  const settle = async (ms = 250) => { await Promise.race([frames(2), sleep(120)]); await sleep(ms); };

  function fail(msg, extra) {
    const err = new Error('[TutoKit] ' + msg);
    if (extra !== undefined) err.details = extra;
    throw err;
  }

  function hex(n) { return '#' + Number(n).toString(16).padStart(6, '0'); }

  // ------------------------------------------------------------------ coordonnées
  function camera() { return app().sceneManager.camera; }

  /** Point du monde (mm, Y = hauteur) -> pixel écran (coordonnées de la fenêtre). */
  function toScreen(p) {
    const cam = camera();
    cam.updateMatrixWorld(true);
    const v = new THREE.Vector3(p[0], p[1], p[2]).project(cam);
    const out = { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, behind: v.z > 1 };
    if (!Number.isFinite(out.x) || !Number.isFinite(out.y)) {
      fail('Projection impossible (fenêtre de taille nulle ?). Faites une capture d\'écran pour « réveiller » le navigateur puis rechargez.');
    }
    return out;
  }

  function overlay() { return document.getElementById('draw-overlay'); }

  function pointer(type, x, y, opts = {}) {
    overlay().dispatchEvent(new PointerEvent(type, {
      clientX: x, clientY: y, pointerId: opts.pointerId || 1, button: opts.button || 0,
      buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true,
      pointerType: opts.pointerType || 'mouse', shiftKey: !!opts.shift, ctrlKey: !!opts.ctrl, altKey: !!opts.alt
    }));
  }

  // ------------------------------------------------------------------ préparation
  async function ready(timeoutMs = 10000) {
    const t0 = performance.now();
    while (!(window.kidiApp && window.THREE && app().sceneManager)) {
      if (performance.now() - t0 > timeoutMs) fail('Application non chargée (window.kidiApp absent). Vérifier que le dossier vendor/ est bien servi.');
      await sleep(100);
    }
    if (!window.innerWidth || !window.innerHeight) {
      return { ok: false, reason: 'Fenêtre de taille nulle : le navigateur est masqué. Faire une capture d\'écran puis recharger la page.' };
    }
    try { toScreen([0, 0, 0]); } catch (e) {
      return { ok: false, reason: e.message };
    }
    return { ok: true, version: VERSION, size: [window.innerWidth, window.innerHeight], compact: document.documentElement.classList.contains('compact') };
  }

  /**
   * Remet l'application dans un état connu et identique à chaque fois.
   * opts: { tool:'tube', color:'#ff4757', size:20, mirror:false, view:'front', hint:true, keepSettings:true }
   */
  async function reset(opts = {}) {
    const o = Object.assign({ tool: 'tube', color: DEFAULT_COLOR, size: 20, mirror: false, view: 'front', hint: true }, opts);
    const a = app();
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    if (a.keyTransform && a.keyTransform.state) a.keyTransform.cancel();
    a.editManager.deselect();
    a.editManager.editMinimized = false;
    a.clearAll(false);
    try {
      localStorage.removeItem('kidi3d_autosave');
      Object.keys(localStorage).filter(k => k.startsWith('kidi3d_geo_')).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* stockage indisponible : sans importance */ }
    if (a.mirrorMode !== o.mirror) $('#btn-mirror').click();
    await tool(o.tool);
    // couleur : on revient à l'état « aucune couleur choisie » (les tampons gardent leurs couleurs naturelles)
    a.colorChosen = false;
    a.currentColor = parseInt(o.color.replace('#', ''), 16);
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.toggle('active', s.dataset.color === o.color));
    await size(o.size);
    await view(o.view);
    hint(o.hint);
    clearToasts();
    clearHighlights();
    await settle(300);
    return state();
  }

  // ------------------------------------------------------------------ réglages de l'interface
  async function tool(name) {
    if (!TOOLS.includes(name)) fail(`Outil inconnu « ${name} ». Valeurs : ${TOOLS.join(', ')}`);
    const btn = $(`.magic-tool-btn[data-tool="${name}"]`);
    if (!btn) fail(`Bouton d'outil introuvable pour « ${name} »`);
    if (btn.offsetParent === null) fail(`L'outil « ${name} » est masqué (réglage enseignant « Outils & Pédagogie »).`);
    btn.click();
    await settle();
    return app().currentTool;
  }

  /** Choisit une couleur comme un clic sur la palette (en mode Bouger avec une sélection, cela la colorie). */
  async function color(value) {
    const sw = $(`.color-swatch[data-color="${value.toLowerCase()}"]`);
    if (!sw) fail(`Couleur absente de la palette : ${value}. Valeurs : ${[...document.querySelectorAll('.color-swatch')].map(s => s.dataset.color).join(', ')}`);
    sw.click();
    await settle();
    return hex(app().currentColor);
  }

  /** Curseur « Taille » (12 à 45). En mode Bouger avec une sélection, redimensionne la sélection. */
  async function size(mm) {
    const input = $('#input-global-thickness');
    const v = Math.max(+input.min, Math.min(+input.max, Math.round(mm)));
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    return app().currentThickness;
  }

  async function mirror(on) {
    if (app().mirrorMode !== !!on) $('#btn-mirror').click();
    await settle();
    return app().mirrorMode;
  }

  /** Choix dans un panneau d'options : forme 3D, tampon ou profil de pilier. */
  async function pick(kind, value) {
    if (kind === 'shape') {
      if (!SHAPES.includes(value)) fail(`Forme inconnue « ${value} ». Valeurs : ${SHAPES.join(', ')}`);
      if (app().currentTool !== 'shape3d') await tool('shape3d');
      $(`#geo-shapes-dock .geo-item[data-stamp="${value}"]`).click();
    } else if (kind === 'stamp') {
      if (!STAMPS.includes(value)) fail(`Tampon inconnu « ${value} ». Valeurs : ${STAMPS.join(', ')}`);
      if (app().currentTool !== 'stamp') await tool('stamp');
      if ($('#stamps-drawer').classList.contains('hidden')) await tool('stamp'); // petit écran : le tiroir se referme après un choix
      $(`#stamps-drawer .stamp-item[data-stamp="${value}"]`).click();
    } else if (kind === 'profile') {
      if (!PROFILES.includes(value)) fail(`Profil inconnu « ${value} ». Valeurs : ${PROFILES.join(', ')}`);
      if (app().currentTool !== 'pillar') await tool('pillar');
      $(`#pillar-profiles-dock .profile-btn[data-profile="${value}"]`).click();
    } else fail('pick(kind) : kind = shape | stamp | profile');
    await settle();
    return app().activeStamp;
  }

  /** Proportions avant pose (outil Formes) : { x, y, z } de 0.2 à 3, linked = true/false. */
  async function placementProportions({ x, y, z, linked } = {}) {
    if (app().currentTool !== 'shape3d') fail('placementProportions : choisir d\'abord l\'outil Formes (tool("shape3d")).');
    const lockBtn = $('#btn-toggle-placement-lock');
    if (linked !== undefined && lockBtn.classList.contains('on') !== !!linked) lockBtn.click();
    for (const [axis, val] of [['x', x], ['y', y], ['z', z]]) {
      if (val === undefined) continue;
      const el = $(`#scale-place-${axis}`);
      el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await settle();
    return Object.assign({}, app().placementScale);
  }

  // ------------------------------------------------------------------ caméra
  /**
   * view('front' | 'side' | 'top') comme les boutons de l'interface (avec animation),
   * ou view({ theta, phi, distance, target:[x,y,z] }) pour un cadrage précis et instantané (angles en degrés ;
   * theta = rotation autour de la verticale, phi = 0 dessus / 90 horizontal).
   */
  async function view(v) {
    const cc = app().cameraController;
    if (typeof v === 'string') {
      const btn = $(`.cam-pill[data-view="${v}"]`);
      if (!btn) fail(`Vue inconnue « ${v} » (front | side | top)`);
      btn.click();
      // on termine l'animation tout de suite pour des captures nettes
      cc.theta = cc.targetTheta; cc.phi = cc.targetPhi; cc.distance = cc.targetDistance; cc.updateCameraPosition();
    } else {
      const d2r = Math.PI / 180;
      if (v.theta !== undefined) cc.theta = cc.targetTheta = v.theta * d2r;
      if (v.phi !== undefined) cc.phi = cc.targetPhi = Math.max(0.1, Math.min(Math.PI / 2.02, v.phi * d2r));
      if (v.distance !== undefined) cc.distance = cc.targetDistance = Math.max(cc.minDistance, Math.min(cc.maxDistance, v.distance));
      if (v.target) cc.target.set(v.target[0], v.target[1], v.target[2]);
      cc.isAutoRotating = false;
      cc.updateCameraPosition();
    }
    await settle(200);
    return cameraState();
  }

  function cameraState() {
    const cc = app().cameraController;
    const r2d = 180 / Math.PI;
    return { theta: Math.round(cc.theta * r2d), phi: Math.round(cc.phi * r2d), distance: Math.round(cc.distance), target: cc.target.toArray().map(n => Math.round(n)) };
  }

  /** Cadre la caméra sur toutes les formes (ou sur une liste d'indices) avec une marge. */
  async function frame(indices, { theta = 25, phi = 70, margin = 1.6 } = {}) {
    const a = app();
    const list = (indices || a.userMeshes.map((_, i) => i)).map(i => a.userMeshes[i]).filter(Boolean);
    if (!list.length) return view({ theta, phi, distance: 300, target: [0, 40, 0] });
    const box = new THREE.Box3();
    list.forEach(m => { m.updateWorldMatrix(true, true); box.expandByObject(m); });
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const fov = camera().fov * Math.PI / 180;
    return view({ theta, phi, distance: Math.max(90, (r * margin) / Math.tan(fov / 2)), target: [c.x, c.y, c.z] });
  }

  // ------------------------------------------------------------------ gestes dans la scène
  /** Tracé à la souris à partir de points ÉCRAN [[x,y],…] (pixels). Fonctionne pour Trait, Ballon, Pilier. */
  async function strokeScreen(points, { stepPx = 6 } = {}) {
    if (!['tube', 'balloon', 'pillar'].includes(app().currentTool)) fail(`strokeScreen : l'outil actif doit être Trait, Ballon ou Pilier (actuel : ${app().currentTool}).`);
    if (points.length < 2) fail('strokeScreen : au moins 2 points');
    const before = app().userMeshes.length;
    const dense = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / stepPx));
      for (let k = 0; k < n; k++) dense.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    dense.push(points[points.length - 1]);
    pointer('pointerdown', dense[0][0], dense[0][1]);
    for (const [x, y] of dense.slice(1)) pointer('pointermove', x, y);
    const last = dense[dense.length - 1];
    pointer('pointerup', last[0], last[1]);
    await settle(300);
    const created = app().userMeshes.length - before;
    return { created, toasts: toasts() };
  }

  /** Tracé à partir de points du MONDE [[x,y,z],…] (mm). La profondeur finale dépend des règles de l'application (§5.1 du guide). */
  async function strokeWorld(points, opts) {
    return strokeScreen(points.map(p => { const s = toScreen(p); return [s.x, s.y]; }), opts);
  }

  /** Contour fermé (Ballon) : cercle / ellipse à l'écran autour d'un point du monde. */
  async function balloonAt(center, { rx = 60, ry = 45, segments = 28 } = {}) {
    if (app().currentTool !== 'balloon') await tool('balloon');
    const c = toScreen(center);
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([c.x + Math.cos(a) * rx, c.y + Math.sin(a) * ry]);
    }
    return strokeScreen(pts);
  }

  /** Clic dans la scène sur un point du monde (pose de forme / tampon, sélection, gomme). drag = [dx,dy] px pour orienter un tampon. */
  async function clickAt(world, { drag = null, shift = false, ctrl = false, holdMs = 0 } = {}) {
    const s = toScreen(world);
    const before = app().userMeshes.length;
    pointer('pointerdown', s.x, s.y, { shift, ctrl });
    if (holdMs) await sleep(holdMs);
    if (drag) {
      const n = 8;
      for (let k = 1; k <= n; k++) pointer('pointermove', s.x + drag[0] * k / n, s.y + drag[1] * k / n, { shift, ctrl });
    }
    pointer('pointerup', s.x + (drag ? drag[0] : 0), s.y + (drag ? drag[1] : 0), { shift, ctrl });
    await settle(300);
    return { created: app().userMeshes.length - before, toasts: toasts() };
  }

  /** Pose la forme / le tampon actif à un point du monde (sol : y = 0 ; sur une forme : viser sa surface). */
  async function placeAt(world, opts) {
    if (!['stamp', 'shape3d'].includes(app().currentTool)) fail('placeAt : choisir d\'abord une forme (pick("shape", …)) ou un tampon (pick("stamp", …)).');
    return clickAt(world, opts);
  }

  /**
   * Point de la SURFACE d'une forme réellement touché par un clic, du côté demandé :
   * 'top' | 'front' | 'back' | 'left' | 'right' | 'center'. On part du bord de la boîte englobante de ce côté et on se
   * rapproche du centre jusqu'à ce que le rayon de la caméra touche bien cette forme (un clic qui « rase » la forme
   * tomberait sinon sur le plateau, voire hors du plateau). Renvoie { point, normal, screen } ou lève une erreur.
   */
  function surfacePoint(index, side = 'top', offset = null) {
    const m = mesh(index);
    const box = new THREE.Box3().setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    const anchor = c.clone();
    if (side === 'top') anchor.y = box.max.y;
    else if (side === 'front') anchor.z = box.max.z;
    else if (side === 'back') anchor.z = box.min.z;
    else if (side === 'left') anchor.x = box.min.x;
    else if (side === 'right') anchor.x = box.max.x;
    if (offset) { anchor.x += offset[0]; anchor.y += offset[1]; anchor.z += offset[2]; c.x += offset[0]; c.y += offset[1]; c.z += offset[2]; }
    let blocker = null;
    const rc = new THREE.Raycaster();
    for (let t = 0.04; t <= 1.0001; t += 0.04) {
      const p = anchor.clone().lerp(c, t);
      const s = toScreen(p.toArray());
      const ndc = new THREE.Vector2((s.x / window.innerWidth) * 2 - 1, -(s.y / window.innerHeight) * 2 + 1);
      rc.setFromCamera(ndc, camera());
      const hits = rc.intersectObjects(app().userMeshes, true);
      if (!hits.length) continue;
      let top = hits[0].object;
      while (top.parent && top.parent !== app().sceneManager.modelGroup) top = top.parent;
      if (top === m) return { point: hits[0].point.toArray(), normal: MeshGenerator.getWorldNormal(hits[0]).toArray(), screen: [s.x, s.y] };
      if (hits.some(h => { let o = h.object; while (o.parent && o.parent !== app().sceneManager.modelGroup) o = o.parent; return o === m; })) blocker = app().userMeshes.indexOf(top);
    }
    if (blocker !== null) fail(`La forme n°${index} est cachée côté « ${side} » par la forme n°${blocker} : un clic toucherait celle-ci. Utiliser un décalage (placeOn(${index}, '${side}', {offset:[0,-8,0]})) ou une autre vue.`);
    fail(`Aucun point visible de la forme n°${index} côté « ${side} » depuis cette vue. Changer de vue (ex. view({theta:20, phi:60})) ou de côté.`);
  }

  /** Pose la forme / le tampon actif SUR une forme existante, du côté demandé (voir surfacePoint). */
  async function placeOn(index, side = 'top', opts = {}) {
    const sp = surfacePoint(index, side, opts.offset || null);
    return placeAt(sp.point, opts);
  }

  /** Glisser une forme sélectionnable avec la souris (mode Bouger), de son centre vers un déplacement écran [dx,dy]. */
  async function dragMesh(index, [dx, dy]) {
    const m = mesh(index);
    if (app().currentTool !== 'edit') await tool('edit');
    const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
    const s = toScreen(c.toArray());
    pointer('pointerdown', s.x, s.y);
    await sleep(180); // au-delà du temps de latence (toucher ≠ glisser)
    const n = 12;
    for (let k = 1; k <= n; k++) pointer('pointermove', s.x + dx * k / n, s.y + dy * k / n);
    pointer('pointerup', s.x + dx, s.y + dy);
    await settle(300);
    return meshInfo(m, app().userMeshes.indexOf(m));
  }

  // ------------------------------------------------------------------ sélection & clavier
  function mesh(index) {
    const list = app().userMeshes;
    const i = index === 'last' ? list.length - 1 : index;
    const m = list[i];
    if (!m) fail(`Forme n°${index} introuvable (il y en a ${list.length}).`);
    return m;
  }

  /** Sélectionne une ou plusieurs formes (indices) en passant en mode Bouger, comme un clic / Maj + clic. */
  async function select(indices) {
    const arr = Array.isArray(indices) ? indices : [indices];
    if (app().currentTool !== 'edit') await tool('edit');
    const em = app().editManager;
    em.setSelection(arr.map(mesh));
    await settle(400);
    return state().selection;
  }

  /** Clique un bouton de l'interface par son id (ex. 'btn-edit-copy'). Vérifie qu'il est visible. */
  async function button(id, { shift = false } = {}) {
    const el = document.getElementById(id);
    if (!el) fail(`Bouton #${id} introuvable.`);
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') fail(`Bouton #${id} masqué (panneau fermé ou réglage enseignant).`);
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: shift }));
    await settle(350);
    return state();
  }

  /**
   * Touches comme au clavier : keys('g','x','2','0','Enter') ou keys({key:'z', shift:true}).
   * Le pointeur de souris utilisé par G/R/S est la dernière position connue (voir mouseTo()).
   */
  async function keys(...list) {
    for (const k of list) {
      const o = typeof k === 'string' ? { key: k } : k;
      const code = o.code || (/^[0-9]$/.test(o.key) ? 'Digit' + o.key : undefined);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: o.key, code, shiftKey: !!o.shift, ctrlKey: !!o.ctrl, altKey: !!o.alt, bubbles: true, cancelable: true }));
      await sleep(30);
    }
    await settle(250);
    return state();
  }

  /** Déplace le « curseur » (pour G/R/S à la souris) vers un pixel écran ou un point du monde. */
  async function mouseTo(target) {
    const s = Array.isArray(target) && target.length === 3 ? toScreen(target) : { x: target[0], y: target[1] };
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: s.x, clientY: s.y, bubbles: true }));
    await settle(80);
    return s;
  }

  // ------------------------------------------------------------------ état & vérifications
  function meshInfo(m, index) {
    m.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(m);
    const sz = box.getSize(new THREE.Vector3());
    const ud = m.userData || {};
    return {
      index,
      type: ud.type,
      subtype: ud.stampType || ud.profile || ud.name || null,
      color: ud.color != null ? hex(ud.color) : null,
      position: m.position.toArray().map(n => Math.round(n * 10) / 10),
      size: [sz.x, sz.y, sz.z].map(n => Math.round(n * 10) / 10),
      bottom: Math.round(box.min.y * 10) / 10,
      locked: !!ud.locked,
      cutter: !!ud.cutter
    };
  }

  function visiblePanels() {
    return ['balloon-options-dock', 'pillar-profiles-dock', 'geo-shapes-dock', 'stamps-drawer', 'edit-action-bar', 'camera-dock', 'modal-export', 'modal-teacher']
      .filter(id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; });
  }

  function toasts() { return [...document.querySelectorAll('#toast-container .toast')].map(t => t.innerText.trim()); }

  /** Photographie complète de l'état (à comparer au résultat attendu de chaque étape). */
  function state() {
    const a = app();
    const em = a.editManager;
    return {
      tool: a.currentTool,
      size: a.currentThickness,
      color: hex(a.currentColor),
      colorChosen: !!a.colorChosen,
      mirror: !!a.mirrorMode,
      activeItem: a.activeStamp,
      compact: document.documentElement.classList.contains('compact'),
      meshes: a.userMeshes.map(meshInfo),
      selection: em.selection.map(m => a.userMeshes.indexOf(m)),
      panels: visiblePanels(),
      popupMinimized: !!em.editMinimized,
      keyMode: a.keyTransform && a.keyTransform.state ? a.keyTransform.state.mode : null,
      hud: ($('#key-hud') && !$('#key-hud').classList.contains('hidden')) ? $('#key-hud').innerText : null,
      toasts: toasts(),
      hint: $('#kid-hint').classList.contains('hidden') ? null : $('#hint-text').innerText,
      camera: cameraState(),
      undoSteps: a.historyStack.length
    };
  }

  /** Assertion simple : expect(state => condition, 'message'). Lève une erreur claire si faux. */
  function expect(predicate, message) {
    const s = state();
    let ok = false;
    try { ok = !!predicate(s); } catch (e) { fail(`${message} (erreur : ${e.message})`, s); }
    if (!ok) fail(`Vérification échouée : ${message}`, s);
    return true;
  }

  // ------------------------------------------------------------------ captures d'écran
  /** Masque / affiche la bulle d'aide. */
  function hint(show) { $('#kid-hint').classList.toggle('hidden', !show); }

  function clearToasts() { const c = $('#toast-container'); if (c) c.innerHTML = ''; }

  /** Prépare une capture propre : messages éphémères retirés, bulle d'aide au choix. */
  async function cleanUI({ hint: showHint = false, toasts: keepToasts = false } = {}) {
    if (!keepToasts) clearToasts();
    hint(showHint);
    await settle(150);
  }

  /**
   * Rectangle écran d'un élément, d'un id ou d'une forme (index) — pour recadrer une capture.
   * Les valeurs sont en pixels CSS de la page (0..innerWidth). Si l'outil de capture renvoie une image d'une autre
   * largeur (ex. 800 px pour une page de 1024 px), passer cette largeur en 3e argument : la région est convertie.
   */
  function rect(target, pad = 8, frameWidth = null) {
    let r;
    if (typeof target === 'number' || target === 'last') {
      const box = new THREE.Box3().setFromObject(mesh(target));
      const pts = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(toScreen([x, y, z]));
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      r = { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
    } else {
      const el = typeof target === 'string' ? (document.getElementById(target) || $(target)) : target;
      if (!el) fail(`rect : élément « ${target} » introuvable`);
      r = el.getBoundingClientRect();
    }
    const x0 = Math.max(0, Math.floor(r.left - pad)), y0 = Math.max(0, Math.floor(r.top - pad));
    const x1 = Math.min(window.innerWidth, Math.ceil(r.right + pad)), y1 = Math.min(window.innerHeight, Math.ceil(r.bottom + pad));
    const k = frameWidth ? frameWidth / window.innerWidth : 1;
    const R = (n) => Math.round(n * k);
    return { x: R(x0), y: R(y0), width: R(x1 - x0), height: R(y1 - y0), region: [R(x0), R(y0), R(x1), R(y1)], scale: k };
  }

  /** Entoure un élément (id / sélecteur / index de forme) avec un cadre numéroté, pour les captures annotées. */
  function highlight(target, label = '', color = '#e11d48') {
    const r = rect(target, 6); // pixels CSS (le cadre est dessiné dans la page)
    const box = document.createElement('div');
    box.className = 'tutokit-hl';
    Object.assign(box.style, {
      position: 'fixed', left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px',
      border: `3px solid ${color}`, borderRadius: '12px', zIndex: 99999, pointerEvents: 'none', boxShadow: '0 0 0 3px rgba(255,255,255,0.8)'
    });
    if (label) {
      const tag = document.createElement('span');
      tag.textContent = label;
      Object.assign(tag.style, {
        position: 'absolute', top: '-14px', left: '-14px', minWidth: '26px', height: '26px', padding: '0 6px', borderRadius: '13px',
        background: color, color: '#fff', font: '800 15px/26px system-ui, sans-serif', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      });
      box.appendChild(tag);
    }
    document.body.appendChild(box);
    return r;
  }

  function clearHighlights() { document.querySelectorAll('.tutokit-hl').forEach(n => n.remove()); }

  // ------------------------------------------------------------------ export (sans téléchargement)
  /** Lance l'export STL comme le bouton « Télécharger .STL » mais capture le fichier pour le mesurer. */
  async function exportSTL() {
    let blob = null;
    const orig = Exporter3D.triggerDownload;
    Exporter3D.triggerDownload = (b) => { blob = b; };
    try {
      $('#btn-download-stl').click();
      // le bouton attend le moteur de fusion (asynchrone) : on attend le fichier jusqu'à 10 s
      const t0 = performance.now();
      while (!blob && performance.now() - t0 < 10000) await sleep(50);
    } finally { Exporter3D.triggerDownload = orig; }
    await settle(100);
    if (!blob) return { ok: false, toasts: toasts() };
    const dv = new DataView(await blob.arrayBuffer());
    const n = dv.getUint32(80, true);
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    let vol = 0;
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;
      const v = [0, 1, 2].map(k => [0, 1, 2].map(j => dv.getFloat32(o + k * 12 + j * 4, true)));
      v.forEach(p => p.forEach((c, j) => { mn[j] = Math.min(mn[j], c); mx[j] = Math.max(mx[j], c); }));
      const [A, B, C] = v;
      vol += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
    }
    return {
      ok: true, triangles: n, bytes: blob.size,
      sizeXYZ: [0, 1, 2].map(c => Math.round((mx[c] - mn[c]) * 10) / 10), // X largeur, Y profondeur, Z hauteur (repère d'impression)
      bottomZ: Math.round(mn[2] * 100) / 100, volumeMm3: Math.round(vol), toasts: toasts()
    };
  }

  // ------------------------------------------------------------------ étapes de tutoriel
  /**
   * Exécute une étape décrite par un objet :
   * { id, title, action: async (T) => {...}, expect: (state) => bool, wait: ms,
   *   highlight: [{ target: 'tool-edit' | 0 | '#sel', label: '1', color }], crop: 'edit-action-bar' | index,
   *   showHint: false, showToasts: false }
   * Renvoie { id, title, state, crop } : il reste à prendre la capture d'écran (outil du navigateur) puis à la recadrer.
   */
  async function runStep(step, { frameWidth = null } = {}) {
    clearHighlights();
    if (step.action) await step.action(window.TutoKit);
    await settle(step.wait || 300);
    if (step.expect) expect(step.expect, step.title || step.id);
    await cleanUI({ hint: !!step.showHint, toasts: !!step.showToasts });
    (step.highlight || []).forEach((h, i) => highlight(h.target, h.label || String(i + 1), h.color));
    const crop = step.crop !== undefined ? rect(step.crop, step.cropPad || 12, frameWidth) : null;
    return { id: step.id, title: step.title, state: state(), crop };
  }

  window.TutoKit = {
    VERSION, SHAPES, STAMPS, TOOLS, PROFILES,
    ready, reset, settle, sleep,
    tool, color, size, mirror, pick, placementProportions,
    view, frame, cameraState, toScreen,
    strokeScreen, strokeWorld, balloonAt, clickAt, placeAt, placeOn, surfacePoint, dragMesh,
    select, button, keys, mouseTo,
    state, expect, toasts, meshInfo: (i) => meshInfo(mesh(i), i),
    hint, cleanUI, clearToasts, rect, highlight, clearHighlights,
    exportSTL, runStep
  };
})();
