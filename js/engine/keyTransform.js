/**
 * Raccourcis clavier façon Blender pour la sélection (mode « Bouger »).
 *
 *   G  déplacer      R  tourner (R encore : rotation libre)      S  agrandir
 *   X / Y / Z  contraint à un axe (encore : axe de la forme, encore : libre) ; Maj + axe : plan sans cet axe
 *   chiffres  valeur exacte (mm, degrés ou facteur)      Ctrl  accroche (5 mm / 15°)
 *   Entrée, Espace ou clic : valider      Échap ou clic droit : annuler
 *   Suppr / X : jeter   Maj+D : copier   A : tout sélectionner   Alt+A : désélectionner   pavé 1 / 3 / 7 : vues
 *
 * Les axes sont ceux du repère affiché dans l'appli : X gauche-droite, Y haut-bas, Z avant-arrière.
 */
class KeyTransform {
  constructor(app) {
    this.app = app;
    this.state = null;
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.swallowUp = false;

    this.hud = document.createElement('div');
    this.hud.id = 'key-hud';
    this.hud.className = 'key-hud hidden';
    document.body.appendChild(this.hud);

    window.addEventListener('pointermove', (e) => this.onPointerMove(e), true);
    window.addEventListener('pointerdown', (e) => this.onPointerDown(e), true);
    window.addEventListener('pointerup', (e) => this.onPointerUp(e), true);
    window.addEventListener('keydown', (e) => this.onKeyDown(e), true);
    window.addEventListener('contextmenu', (e) => { if (this.state) e.preventDefault(); }, true);
    window.addEventListener('blur', () => { if (this.state) this.cancel(); });
  }

  get em() { return this.app.editManager; }
  get cam() { return this.app.sceneManager.camera; }

  // ------------------------------------------------------------------ événements
  onPointerMove(e) {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.lastCtrl = !!e.ctrlKey;
    if (this.state) this.update();
  }

  onPointerDown(e) {
    if (!this.state) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.swallowUp = true;
    if (e.button === 0) this.confirm(); else this.cancel();
  }

  onPointerUp(e) {
    if (!this.swallowUp) return;
    this.swallowUp = false;
    e.stopImmediatePropagation();
  }

  isTyping(e) {
    const t = e.target;
    if (!t) return false;
    if (t.isContentEditable) return true;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'textarea' || tag === 'select') return true;
    if (tag === 'input') return !['range', 'checkbox', 'radio', 'button'].includes(t.type);
    return false;
  }

  onKeyDown(e) {
    if (!e.key) return;
    if (this.state) { this.modalKey(e); return; }
    if (this.isTyping(e) || e.repeat) return;
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    this.idleKey(e);
  }

  // ------------------------------------------------------------------ touches hors geste
  idleKey(e) {
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) return; // Ctrl+Z, Ctrl+Y… restent gérés ailleurs
    const em = this.em;

    if (e.altKey) {
      if (k === 'a') { em.deselect(); e.preventDefault(); }
      return;
    }
    if (e.code === 'Numpad1' || e.code === 'Numpad3' || e.code === 'Numpad7') {
      const view = { Numpad1: 'front', Numpad3: 'side', Numpad7: 'top' }[e.code];
      this.app.cameraController.setView(view);
      e.preventDefault();
      return;
    }
    if (k === 'g' || k === 'r' || k === 's') {
      if (e.shiftKey) return;
      e.preventDefault();
      this.start({ g: 'move', r: 'rotate', s: 'scale' }[k]);
      return;
    }
    if (k === 'a' && !e.shiftKey) {
      e.preventDefault();
      this.selectAll();
      return;
    }
    if (k === 'd' && e.shiftKey && em.selection.length) {
      e.preventDefault();
      const btn = document.getElementById('btn-edit-copy');
      if (btn) btn.click();
      return;
    }
    if ((k === 'delete' || k === 'x') && em.selection.length && this.app.currentTool === 'edit') {
      e.preventDefault();
      const btn = document.getElementById('btn-edit-delete');
      if (btn) btn.click();
    }
  }

  selectAll() {
    const editBtn = document.querySelector('.magic-tool-btn[data-tool="edit"]');
    if (this.app.currentTool !== 'edit' && editBtn) editBtn.click();
    const all = this.app.userMeshes.slice();
    if (!all.length) return;
    this.em.setSelection(all);
    this.app.showToast(`✋ ${all.length} forme${all.length > 1 ? 's' : ''} sélectionnée${all.length > 1 ? 's' : ''}`);
  }

  // ------------------------------------------------------------------ démarrage
  start(mode) {
    const em = this.em;
    if (!em.selection.length) {
      // Pas de sélection : on prend la forme sous le curseur
      const hovered = this.app.getTopLevelMeshAt(this.mouse);
      if (!hovered) { this.app.showToast('✋ Sélectionne d\'abord une forme (clique dessus, ou Ctrl + clic)'); return; }
      const editBtn = document.querySelector('.magic-tool-btn[data-tool="edit"]');
      if (this.app.currentTool !== 'edit' && editBtn) editBtn.click();
      em.selectMesh(hovered);
    }
    const targets = em.getTargets();
    if (!targets.length) { this.app.showToast('🔒 Forme verrouillée : déverrouille-la d\'abord'); return; }

    this.state = {
      mode,
      targets,
      items: [],
      pivot: new THREE.Vector3(),
      single: targets.length === 1,
      axis: null,
      local: false,
      plane: false,
      numeric: '',
      free: false,
      origin: targets.map(m => ({ m, pos: m.position.clone(), quat: m.quaternion.clone(), scale: m.scale.clone() })),
      mouse0: { x: this.mouse.x, y: this.mouse.y },
      accum: 0,
      prevAngle: 0,
      ref: null,
      lastGood: null
    };
    this.rebase();
    this.hud.classList.remove('hidden');
    this.app.overlayCanvas.classList.add('key-transforming');
    this.update();
  }

  // Fixe l'état actuel comme point de départ (au début, ou quand on change de mode en cours de route)
  rebase() {
    const st = this.state;
    st.items = st.targets.map(m => ({ m, pos: m.position.clone(), quat: m.quaternion.clone(), scale: m.scale.clone() }));
    st.pivot = st.single ? this.em.getPivotWorld(st.targets[0]) : this.em.unionBox(st.targets).getCenter(new THREE.Vector3());
    st.mouse0 = { x: this.mouse.x, y: this.mouse.y };
    st.accum = 0;
    st.numeric = '';
    st.lastGood = null;
    const p = this.screenOf(st.pivot);
    st.prevAngle = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);
    this.refreshRef();
  }

  screenOf(world) {
    const p = world.clone().project(this.cam);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight };
  }

  rayAt(pt) {
    const ndc = new THREE.Vector2((pt.x / window.innerWidth) * 2 - 1, -(pt.y / window.innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.cam);
    return rc.ray;
  }

  axisVector() {
    const st = this.state;
    if (!st.axis) return null;
    const v = new THREE.Vector3(st.axis === 'x' ? 1 : 0, st.axis === 'y' ? 1 : 0, st.axis === 'z' ? 1 : 0);
    if (st.local && st.items.length) v.applyQuaternion(st.items[st.items.length - 1].quat);
    return v.normalize();
  }

  camForward() { return this.cam.getWorldDirection(new THREE.Vector3()); }

  // Position de référence de la souris (au départ) selon la contrainte en cours
  refreshRef() {
    const st = this.state;
    if (st.mode !== 'move') { st.ref = null; return; }
    st.ref = this.moveSample(st.mouse0);
  }

  // Point de la contrainte atteint par la souris : t le long d'un axe, ou point du plan
  moveSample(pt) {
    const st = this.state;
    const ray = this.rayAt(pt);
    const a = this.axisVector();
    if (a && !st.plane) {
      const w0 = st.pivot.clone().sub(ray.origin);
      const d = ray.direction;
      const b = a.dot(d);
      const den = 1 - b * b;
      if (den < 1e-4) return null; // l'axe pointe vers la caméra : impossible de le lire à l'écran
      return { t: (b * d.dot(w0) - a.dot(w0)) / den };
    }
    const normal = a && st.plane ? a : this.camForward().negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, st.pivot);
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    return hit ? { hit } : null;
  }

  // ------------------------------------------------------------------ touches pendant le geste
  modalKey(e) {
    e.preventDefault();
    e.stopPropagation();
    this.lastCtrl = !!e.ctrlKey;
    if (e.ctrlKey || e.metaKey) { this.update(); return; }
    const st = this.state;
    const k = e.key;
    const low = k.toLowerCase();

    if (k === 'Escape') { this.cancel(); return; }
    if (k === 'Enter' || k === ' ') { this.confirm(); return; }

    if (low === 'x' || low === 'y' || low === 'z') {
      if (e.repeat) return;
      if (st.axis === low && !st.plane && e.shiftKey === false) {
        // X, puis X encore = axe propre à la forme, puis libre
        if (!st.local) st.local = true; else { st.axis = null; st.local = false; }
      } else {
        st.axis = low;
        st.local = false;
        st.plane = e.shiftKey;
      }
      st.numeric = '';
      this.refreshRef();
      this.update();
      return;
    }

    if (low === 'g' || low === 'r' || low === 's') {
      if (e.repeat) return;
      const mode = { g: 'move', r: 'rotate', s: 'scale' }[low];
      if (mode === 'rotate' && st.mode === 'rotate') {
        st.free = !st.free; // R encore : rotation libre (trackball)
        if (st.free) { st.axis = null; st.local = false; st.plane = false; }
      } else {
        st.mode = mode;
        st.free = false;
        st.axis = null; st.local = false; st.plane = false;
      }
      this.rebase();
      this.update();
      return;
    }

    // saisie numérique
    if (/^[0-9]$/.test(k) || k === '.' || k === ',') {
      st.numeric += (k === ',' ? '.' : k);
      this.update();
      return;
    }
    if (k === '-') { st.numeric = st.numeric.startsWith('-') ? st.numeric.slice(1) : '-' + st.numeric; this.update(); return; }
    if (k === 'Backspace') { st.numeric = st.numeric.slice(0, -1); this.update(); }
  }

  // ------------------------------------------------------------------ calcul
  numericValue() {
    const v = parseFloat(this.state.numeric);
    return Number.isFinite(v) ? v : null;
  }

  update() {
    const st = this.state;
    if (!st) return;
    const snap = this.lastCtrl;
    let label = '';

    if (st.mode === 'move') label = this.applyMove(snap);
    else if (st.mode === 'rotate') label = this.applyRotate(snap);
    else label = this.applyScale();

    this.em.liftAboveBed(st.targets);
    this.em.syncTransformVisuals(false);
    this.renderHud(label);
  }

  setCtrl(e) { this.lastCtrl = !!(e && e.ctrlKey); }

  applyMove() {
    const st = this.state;
    const a = this.axisVector();
    let delta = new THREE.Vector3();
    const typed = this.numericValue();

    if (typed !== null) {
      const dir = a || new THREE.Vector3(1, 0, 0);
      delta = dir.multiplyScalar(typed);
    } else if (st.ref) {
      const now = this.moveSample(this.mouse);
      if (now) {
        if (st.ref.t !== undefined && now.t !== undefined) {
          let d = now.t - st.ref.t;
          if (this.lastCtrl) d = Math.round(d / 5) * 5;
          delta = a.clone().multiplyScalar(d);
        } else if (st.ref.hit && now.hit) {
          delta = now.hit.clone().sub(st.ref.hit);
        }
      }
    }

    // reste sur le plateau
    const center = st.pivot.clone().add(delta);
    if (!this.app.isInsideBed(new THREE.Vector3(center.x, 0, center.z), 0) && st.lastGood) delta = st.lastGood.clone();
    else st.lastGood = delta.clone();

    st.items.forEach(it => { it.m.position.copy(it.pos).add(delta); });
    const parts = [`X ${delta.x.toFixed(1)}`, `Y ${delta.y.toFixed(1)}`, `Z ${delta.z.toFixed(1)}`];
    return `${this.axisText()} · ${st.axis && !st.plane ? `${a.dot(delta).toFixed(1)} mm` : parts.join('  ')}`;
  }

  applyRotate() {
    const st = this.state;
    const typed = this.numericValue();
    let q = new THREE.Quaternion();
    let deg = 0;

    if (st.free && typed === null) {
      // Rotation libre : la souris tourne la forme comme une boule (axes de l'écran)
      const dx = this.mouse.x - st.mouse0.x;
      const dy = this.mouse.y - st.mouse0.y;
      const camQ = this.cam.quaternion;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camQ);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
      q = new THREE.Quaternion().setFromAxisAngle(up, dx * 0.012)
        .multiply(new THREE.Quaternion().setFromAxisAngle(right, dy * 0.012));
      deg = Math.hypot(dx, dy) * 0.012 * 180 / Math.PI;
    } else {
      const fwd = this.camForward();
      const a = this.axisVector() || fwd;
      let angle;
      if (typed !== null) {
        angle = typed * Math.PI / 180;
      } else {
        const p = this.screenOf(st.pivot);
        const now = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);
        let d = now - st.prevAngle;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        st.accum += d;
        st.prevAngle = now;
        // le sens suit la souris sur l'écran, quelle que soit la face de l'axe vue par la caméra
        angle = st.accum * (a.dot(fwd) >= 0 ? 1 : -1);
        if (this.lastCtrl) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
      }
      q = new THREE.Quaternion().setFromAxisAngle(a, angle);
      deg = angle * 180 / Math.PI;
    }

    st.items.forEach(it => {
      const rel = it.pos.clone().sub(st.pivot).applyQuaternion(q);
      it.m.position.copy(st.pivot).add(rel);
      it.m.quaternion.copy(q).multiply(it.quat);
    });
    const what = st.free && typed === null ? 'libre' : (st.axis ? this.axisText() : 'vue');
    return `Rotation ${what} · ${deg.toFixed(0)}°`;
  }

  applyScale() {
    const st = this.state;
    const typed = this.numericValue();
    let factor;
    if (typed !== null) factor = typed;
    else {
      const p = this.screenOf(st.pivot);
      const d0 = Math.max(Math.hypot(st.mouse0.x - p.x, st.mouse0.y - p.y), 14);
      factor = Math.hypot(this.mouse.x - p.x, this.mouse.y - p.y) / d0;
    }
    factor = Math.max(0.05, factor);

    const axisOnly = st.axis && st.single; // un axe précis : une seule forme, sur son propre repère
    st.items.forEach(it => {
      const m = it.m;
      const s = it.scale.clone();
      if (axisOnly) {
        if (st.plane) { ['x', 'y', 'z'].forEach(c => { if (c !== st.axis) s[c] *= factor; }); }
        else s[st.axis] *= factor;
        const pl = st.pivot.clone().sub(it.pos).applyQuaternion(it.quat.clone().invert()).divide(it.scale);
        m.scale.copy(s);
        m.quaternion.copy(it.quat);
        m.position.copy(st.pivot).sub(pl.multiply(s).applyQuaternion(it.quat));
      } else {
        m.scale.copy(s).multiplyScalar(factor);
        m.position.copy(st.pivot).add(it.pos.clone().sub(st.pivot).multiplyScalar(factor));
      }
    });
    const where = axisOnly ? ` ${this.axisText()}` : '';
    return `Taille${where} · ×${factor.toFixed(2)}`;
  }

  axisText() {
    const st = this.state;
    if (!st.axis) return 'libre';
    const names = { x: 'X gauche/droite', y: 'Y haut/bas', z: 'Z avant/arrière' };
    return `${st.plane ? 'plan sans ' : 'axe '}${names[st.axis]}${st.local ? ' (de la forme)' : ''}`;
  }

  renderHud(label) {
    const st = this.state;
    const names = { move: '✋ Déplacer', rotate: '🔄 Tourner', scale: '↔️ Agrandir' };
    const typed = st.numeric ? ` <b class="kh-num">${st.numeric}</b>` : '';
    const keys = st.mode === 'rotate'
      ? 'R = libre/vue · X Y Z = axe'
      : 'X Y Z = axe (Maj : plan)';
    this.hud.innerHTML = `<span class="kh-main">${names[st.mode]} · ${label}${typed}</span>` +
      `<span class="kh-keys">${keys} · chiffres = valeur · Ctrl = accroche · Entrée/clic = OK · Échap = annuler</span>`;
  }

  // ------------------------------------------------------------------ fin
  close() {
    this.state = null;
    this.hud.classList.add('hidden');
    this.app.overlayCanvas.classList.remove('key-transforming');
  }

  confirm() {
    const st = this.state;
    if (!st) return;
    this.close();
    this.em.syncTransformVisuals(true);
    this.em.commitChange();
    this.app.updateBaseIfActive();
  }

  cancel() {
    const st = this.state;
    if (!st) return;
    // retour au tout début du geste (pas seulement à la dernière étape)
    st.origin.forEach(it => {
      it.m.position.copy(it.pos);
      it.m.quaternion.copy(it.quat);
      it.m.scale.copy(it.scale);
    });
    this.close();
    this.em.syncTransformVisuals(false);
    this.app.showToast('↩️ Annulé');
  }
}

window.KeyTransform = KeyTransform;
