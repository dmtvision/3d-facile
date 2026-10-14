/**
 * Kidi3D - Repères autour des formes sélectionnées
 *
 * Forme seule :
 *   Largeur (rouge), Hauteur (vert), Profondeur (bleu) : petites pastilles rondes au bout des 3 axes
 *   de la forme, reliées au centre par un fin trait de la même couleur. Tirer vers l'extérieur agrandit,
 *   vers l'intérieur rétrécit. (La taille globale se règle avec le curseur du bas.)
 *   Tourner (orange) : petite pastille ronde, glisser à gauche / à droite, accroche tous les 15°.
 * Déplacer (carrés gris-bleu, volontairement différents des pastilles rondes) :
 *   « Déplacer » déplace sur le plateau, « Monter » monte ou descend.
 * Plusieurs formes (Maj + clic) : seulement Tourner et Déplacer, autour de leur centre commun.
 * Formes verrouillées : aucun repère. Courbes : leurs points bleus.
 *
 * Pour ne pas gêner :
 *  - les repères sont discrets (petits, un peu transparents) et s'effacent pendant que la caméra bouge ;
 *  - clic droit (pivoter), clic milieu (déplacer) et molette sur un repère pilotent la caméra comme ailleurs ;
 *  - une zone morte évite les gestes involontaires, et les noms n'apparaissent qu'au survol.
 */

class TransformHandles {
  constructor(editManager) {
    this.em = editManager;
    this.app = editManager.app;
    this.active = null;
    this.camDrag = null;

    this.DEAD_ZONE = 8;        // px : en dessous, rien ne bouge
    this.MIN_RATIO = 0.25;     // limites d'un seul geste
    this.MAX_RATIO = 4;
    this.SNAP_ANGLE = Math.PI / 12; // 15°

    const arrow = '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M3 14 H25 M3 14 L9 8 M3 14 L9 20 M25 14 L19 8 M25 14 L19 20"/></svg>';
    this.defs = [
      { id: 'width', axis: 'x', label: 'Largeur', color: '#dc2626', icon: arrow, fallback: [1, 0], size: 34,
        hint: 'Largeur : tire vers l\'extérieur pour élargir, vers l\'intérieur pour rétrécir' },
      { id: 'height', axis: 'y', label: 'Hauteur', color: '#16a34a', icon: arrow, fallback: [0, -1], size: 34,
        hint: 'Hauteur : tire vers l\'extérieur pour allonger, vers l\'intérieur pour raccourcir' },
      { id: 'depth', axis: 'z', label: 'Profondeur', color: '#2563eb', icon: arrow, fallback: [-0.8, -0.6], size: 34,
        hint: 'Profondeur : tire vers l\'extérieur pour épaissir, vers l\'intérieur pour amincir' },
      { id: 'rotate', label: 'Tourner', color: '#f59e0b', size: 28,
        icon: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M22 14 A8 8 0 1 1 19.7 8.3 M22 4 V9.5 H16.5"/></svg>',
        hint: 'Tourner : glisse à gauche ou à droite' },
      { id: 'move', label: 'Déplacer', color: '#475569', square: true, size: 30,
        icon: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 3 V25 M3 14 H25 M14 3 L10 7 M14 3 L18 7 M14 25 L10 21 M14 25 L18 21 M3 14 L7 10 M3 14 L7 18 M25 14 L21 10 M25 14 L21 18"/></svg>',
        hint: 'Déplacer sur le plateau : glisse pour poser la forme ailleurs' },
      { id: 'lift', label: 'Monter', color: '#0f766e', square: true, size: 30,
        icon: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 4 V19 M14 4 L9 9 M14 4 L19 9 M14 19 L9 14 M14 19 L19 14 M6 25 H22"/></svg>',
        hint: 'Monter ou descendre : glisse vers le haut ou le bas' }
    ];

    this.container = document.createElement('div');
    this.container.id = 'transform-handles';
    this.container.className = 'hidden';

    // Traits d'axes (centre → repère), blancs sous la couleur pour rester lisibles sur tout fond
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'tf-lines');
    this.lines = {};
    this.defs.filter(d => d.axis).forEach(def => {
      const under = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      under.setAttribute('class', 'tf-line-under');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'tf-line');
      line.setAttribute('stroke', def.color);
      this.svg.append(under, line);
      this.lines[def.id] = [under, line];
    });
    this.dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.dot.setAttribute('class', 'tf-center');
    this.dot.setAttribute('r', '4');
    this.svg.appendChild(this.dot);
    this.container.appendChild(this.svg);

    this.els = {};
    this.defs.forEach(def => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `tf-handle tf-${def.id}${def.square ? ' tf-square' : ''}`;
      b.style.setProperty('--tf-color', def.color);
      b.style.setProperty('--tf-base', def.size);
      b.style.cursor = def.id === 'rotate' ? 'grab' : (def.square ? 'move' : 'pointer');
      b.title = def.hint;
      b.setAttribute('aria-label', def.label);
      b.innerHTML = `<span class="tf-icon">${def.icon}</span><span class="tf-name">${def.label}</span>`;
      b.addEventListener('pointerdown', (e) => this.onDown(e, def));
      b.addEventListener('pointermove', (e) => this.onMove(e));
      b.addEventListener('pointerup', (e) => this.onUp(e));
      b.addEventListener('pointercancel', (e) => this.onUp(e));
      // La navigation ne doit jamais être bloquée par un repère : molette et clic droit passent à la caméra
      b.addEventListener('wheel', (e) => { e.preventDefault(); this.app.cameraController.onWheel(e.deltaY); }, { passive: false });
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      this.container.appendChild(b);
      this.els[def.id] = b;
    });

    this.bubble = document.createElement('div');
    this.bubble.className = 'tf-bubble hidden';
    this.container.appendChild(this.bubble);

    document.body.appendChild(this.container);

    this.navUntil = 0;
    this.lastCam = '';
  }

  hide() {
    this.container.classList.add('hidden');
  }

  // ------------------------------------------------------------------ géométrie
  /** Boîte de la forme dans son propre repère (avant échelle) : centre et demi-dimensions. */
  getLocalBox(m) {
    m.updateWorldMatrix(true, true);
    const inv = m.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    m.traverse(c => {
      if (!c.isMesh || !c.geometry) return;
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
      const rel = new THREE.Matrix4().multiplyMatrices(inv, c.matrixWorld);
      box.union(c.geometry.boundingBox.clone().applyMatrix4(rel));
    });
    if (box.isEmpty()) box.set(new THREE.Vector3(-5, -5, -5), new THREE.Vector3(5, 5, 5));
    return { center: box.getCenter(new THREE.Vector3()), half: box.getSize(new THREE.Vector3()).multiplyScalar(0.5) };
  }

  project(worldPoint) {
    const p = worldPoint.clone().project(this.app.sceneManager.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
  }

  rayAt(x, y) {
    const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.app.sceneManager.camera);
    return rc.ray;
  }

  /** Zone libre de l'écran (hors panneaux et docks) où les repères peuvent se placer. */
  getFreeZone(ui) {
    const rect = id => { const e = document.getElementById(id); return e && !e.classList.contains('hidden') ? e.getBoundingClientRect() : null; };
    const dock = rect('camera-dock'), bar = rect('edit-action-bar'), top = rect('top-bar'), tools = rect('tools-dock');
    return {
      left: (dock ? dock.right : 0) + 30 * ui,
      right: (bar ? bar.left : window.innerWidth) - 30 * ui,
      top: (top ? top.bottom : 70) + 26 * ui,
      bottom: (tools ? tools.top : window.innerHeight) - 30 * ui
    };
  }

  /** Vrai pendant que la caméra bouge (clic droit, clic milieu, flèches, molette, boule d'orientation) : les repères s'effacent. */
  isNavigating() {
    const cam = this.app.sceneManager.camera;
    const key = [cam.position.x, cam.position.y, cam.position.z, cam.quaternion.x, cam.quaternion.y, cam.quaternion.z].map(v => v.toFixed(3)).join('|');
    const now = performance.now();
    if (key !== this.lastCam) { this.lastCam = key; this.navUntil = now + 260; }
    return now < this.navUntil;
  }

  // ------------------------------------------------------------------ affichage
  update() {
    if (this.active || this.camDrag) return; // pendant un geste, les repères ne bougent pas sous le doigt

    const em = this.em;
    const sel = em.selection;
    const targets = em.getTargets();
    const multi = sel.length > 1;
    const single = sel.length === 1;

    if (!sel.length || !targets.length || em.isDraggingMesh || em.isDraggingHandle || em.pendingRegen ||
        (single && (em.isCurve(sel[0]) || em.isLocked(sel[0])))) {
      this.hide();
      return;
    }

    // Repères effacés pendant la navigation caméra
    this.container.classList.toggle('is-nav', this.isNavigating());

    const ui = this.app.getUIScale ? this.app.getUIScale() : 1;

    // Boîte écran de toute la sélection
    const box = em.unionBox(sel);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const p = this.project(new THREE.Vector3(x, y, z));
          if (p.behind) { this.hide(); return; }
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        }
      }
    }

    const MIN = 120 * ui;
    const halfW = Math.max((maxX - minX) / 2, MIN / 2);
    const halfH = Math.max((maxY - minY) / 2, MIN / 2);
    const pad = 20 * ui;
    const zone = this.getFreeZone(ui);
    const clampPt = p => ({ x: Math.min(zone.right, Math.max(zone.left, p.x)), y: Math.min(zone.bottom, Math.max(zone.top, p.y)) });

    // Centre : celui de la forme (forme seule) ou de la sélection
    const c = single
      ? this.project(sel[0].localToWorld(this.getLocalBox(sel[0]).center))
      : this.project(box.getCenter(new THREE.Vector3()));
    this.center = { x: c.x, y: c.y };

    const placed = {}; // id -> {x, y}
    const dirs = {};   // id -> vecteur unitaire écran (repères d'axe)
    const taken = [];
    const near = (a, b) => Math.abs(a.x - b.x) < 66 * ui && Math.abs(a.y - b.y) < 54 * ui;

    // Repères d'axe : au bout de chaque axe de la forme, dans la direction où l'axe apparaît à l'écran
    if (single) {
      const m = sel[0];
      const lb = this.getLocalBox(m);

      this.defs.filter(d => d.axis).forEach(def => {
        const e = new THREE.Vector3(); e[def.axis] = lb.half[def.axis];
        const end = this.project(m.localToWorld(lb.center.clone().add(e)));
        let dx = end.x - c.x, dy = end.y - c.y;
        let len = Math.hypot(dx, dy);
        if (len < 14) { [dx, dy] = def.fallback; len = 0; }          // axe qui pointe vers la caméra
        let ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
        const radius = Math.max(len, 62 * ui) + pad;

        // Évite de se superposer à un repère déjà posé : on tourne légèrement la direction
        let p = { x: c.x + ux * radius, y: c.y + uy * radius };
        for (let k = 0; k < 8 && taken.some(t => near(t, p)); k++) {
          const a = Math.atan2(uy, ux) + (k % 2 ? -1 : 1) * (0.55 * Math.ceil((k + 1) / 2));
          ux = Math.cos(a); uy = Math.sin(a);
          p = { x: c.x + ux * radius, y: c.y + uy * radius };
        }
        p = clampPt(p);
        taken.push(p);
        placed[def.id] = p;
        dirs[def.id] = { x: ux, y: uy };
      });
    }
    this.dirs = dirs;

    // Repères fixes : on prend le premier emplacement libre autour de la forme
    const slots = {
      rotate: [[0, 1], [1, 1], [1, -1]],
      move: [[-1, 1], [-1, -1], [0, 1]],
      lift: [[-1, 0], [-1, -1], [-1, 1]]
    };
    ['rotate', 'move', 'lift'].forEach(id => {
      let chosen = null;
      for (const [sx, sy] of slots[id]) {
        const raw = { x: c.x + sx * (halfW + pad), y: c.y + sy * (halfH + pad) };
        const cl = clampPt(raw);
        const reachable = Math.hypot(cl.x - raw.x, cl.y - raw.y) < 6;
        if (reachable && !taken.some(t => near(t, cl))) { chosen = cl; break; }
      }
      if (!chosen) {
        // Aucun emplacement libre : on prend le premier, à l'écart des autres
        const [sx, sy] = slots[id][0];
        chosen = clampPt({ x: c.x + sx * (halfW + pad), y: c.y + sy * (halfH + pad) });
      }
      taken.push(chosen);
      placed[id] = chosen;
    });

    // Application à l'écran
    this.defs.forEach(def => {
      const el = this.els[def.id];
      const p = placed[def.id];
      if (!p) { el.style.display = 'none'; return; }
      el.style.display = 'flex';
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      if (def.axis) {
        const d = dirs[def.id];
        el.querySelector('.tf-icon svg').style.transform = `rotate(${(Math.atan2(d.y, d.x) * 180) / Math.PI}deg)`;
      }
    });

    this.defs.filter(d => d.axis).forEach(def => {
      const p = placed[def.id];
      this.lines[def.id].forEach(l => {
        if (!p) { l.setAttribute('visibility', 'hidden'); return; }
        l.setAttribute('visibility', 'visible');
        l.setAttribute('x1', c.x); l.setAttribute('y1', c.y);
        l.setAttribute('x2', p.x); l.setAttribute('y2', p.y);
      });
    });
    this.dot.setAttribute('cx', c.x);
    this.dot.setAttribute('cy', c.y);
    this.dot.setAttribute('visibility', single ? 'visible' : 'hidden');

    this.container.classList.toggle('is-multi', multi);
    this.container.classList.remove('hidden');
  }

  // ------------------------------------------------------------------ gestes
  onDown(e, def) {
    const el = this.els[def.id];

    // Clic droit / milieu (ou Alt + glisser) : c'est de la navigation, la caméra prend la main
    if (e.button !== 0 || e.altKey) {
      if (this.app.cameraController.onPointerDown(e)) {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.camDrag = { el, id: e.pointerId };
      }
      return;
    }

    const em = this.em;
    const targets = em.getTargets();
    if (!targets.length) return;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture(e.pointerId);

    // Pour déplacer : point de départ sur le plateau (plan horizontal) ou sur un plan vertical face à la caméra
    let plane = null, p0 = null;
    if (def.id === 'move' || def.id === 'lift') {
      const pivot = em.unionBox(targets).getCenter(new THREE.Vector3());
      if (def.id === 'move') {
        plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -pivot.y);
      } else {
        const n = this.app.sceneManager.camera.getWorldDirection(new THREE.Vector3());
        n.y = 0;
        if (n.lengthSq() < 1e-4) n.set(0, 0, 1);
        plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n.normalize().negate(), pivot);
      }
      p0 = this.rayAt(e.clientX, e.clientY).intersectPlane(plane, new THREE.Vector3());
    }

    this.active = {
      def,
      el,
      targets,
      plane,
      p0,
      start: { x: e.clientX, y: e.clientY },
      moved: false,
      center: { ...this.center },
      dir: this.dirs && this.dirs[def.id] ? { ...this.dirs[def.id] } : null,
      base: targets.map(m => ({ m, scale: m.scale.clone(), quat: m.quaternion.clone(), pos: m.position.clone() }))
    };
    el.classList.add('is-dragging');
    this.container.classList.add('is-busy');
  }

  onMove(e) {
    // Navigation caméra démarrée depuis un repère
    if (this.camDrag) { this.app.cameraController.onPointerMove(e); return; }

    const a = this.active;
    if (!a) return;

    const dx = e.clientX - a.start.x;
    const dy = e.clientY - a.start.y;
    if (!a.moved && Math.hypot(dx, dy) < this.DEAD_ZONE) return; // zone morte
    a.moved = true;

    // On repart toujours de l'état initial du geste : pas de dérive, et on peut revenir au point de départ
    a.base.forEach(b => {
      b.m.scale.copy(b.scale);
      b.m.quaternion.copy(b.quat);
      b.m.position.copy(b.pos);
      b.m.updateMatrixWorld(true);
    });

    const em = this.em;
    const clamp = r => Math.min(this.MAX_RATIO, Math.max(this.MIN_RATIO, r));
    const c = a.center;
    const kind = a.def.id;
    let text = '';

    if (kind === 'rotate') {
      // 1 px = 0,7°, accroche douce tous les 15°
      let angle = (dx * 0.7 * Math.PI) / 180;
      const snapped = Math.round(angle / this.SNAP_ANGLE) * this.SNAP_ANGLE;
      if (Math.abs(angle - snapped) < (4 * Math.PI) / 180) angle = snapped;
      em.rotateSelection(a.targets, -angle);
      text = `${Math.round((angle * 180) / Math.PI)}°`;
    } else if (kind === 'move' || kind === 'lift') {
      const p = a.plane && this.rayAt(e.clientX, e.clientY).intersectPlane(a.plane, new THREE.Vector3());
      if (p && a.p0) {
        const d = p.clone().sub(a.p0);
        if (kind === 'move') {
          em.moveSelection(a.targets, d.x, 0, d.z);
          text = `${Math.round(Math.hypot(d.x, d.z))} mm`;
        } else {
          em.moveSelection(a.targets, 0, d.y, 0);
          text = `${d.y >= 0 ? '+' : ''}${Math.round(d.y)} mm`;
        }
      }
    } else if (a.dir) {
      // Axe : on mesure le déplacement le long de la direction du repère à l'écran
      const along = (px, py) => (px - c.x) * a.dir.x + (py - c.y) * a.dir.y;
      const d0 = Math.max(28, along(a.start.x, a.start.y));
      const r = clamp(Math.max(0.01, along(e.clientX, e.clientY)) / d0);
      const axis = a.def.axis;
      em.transformAboutPivot(mm => { mm.scale[axis] *= r; }, a.targets[0]);
      text = `${a.def.label} ×${r.toFixed(2)}`;
    }

    em.updateHalo();
    em.syncScaleSliders();
    this.showBubble(a.el, text);
  }

  onUp(e) {
    if (this.camDrag) {
      this.app.cameraController.onPointerUp();
      try { this.camDrag.el.releasePointerCapture(this.camDrag.id); } catch (err) { /* déjà relâché */ }
      this.camDrag = null;
      return;
    }

    const a = this.active;
    if (!a) return;
    try { a.el.releasePointerCapture(e.pointerId); } catch (err) { /* déjà relâché */ }
    a.el.classList.remove('is-dragging');
    this.container.classList.remove('is-busy');
    this.bubble.classList.add('hidden');
    this.active = null;

    if (a.moved) {
      this.em.syncTransformVisuals(false);
      this.em.commitChange();
      if (window.soundFx) window.soundFx.playPop();
    }
  }

  showBubble(el, text) {
    this.bubble.textContent = text;
    this.bubble.style.left = el.style.left;
    this.bubble.style.top = el.style.top;
    this.bubble.classList.remove('hidden');
  }
}

window.TransformHandles = TransformHandles;
