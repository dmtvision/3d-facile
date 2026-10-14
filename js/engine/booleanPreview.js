/**
 * Aperçu en direct des formes « trou » (booléen).
 * Quand la scène est au repos, les formes touchées par un trou sont remplacées à l'écran par leur version
 * creusée (calculée avec manifold-3d). Dès qu'on touche à quelque chose, on revient aux formes d'origine,
 * puis on recalcule après un court instant : aucun calcul pendant les gestes, donc aucune gêne.
 * Seules les pièces qui touchent un trou sont recalculées, une par image.
 */
class BooleanPreview {
  constructor(app) {
    this.app = app;
    this.enabled = true;
    this.group = new THREE.Group();
    this.group.name = 'boolean-preview';
    app.sceneManager.scene.add(this.group);
    this.hiddenMat = new THREE.MeshBasicMaterial({ visible: false });

    this.swapped = [];      // { child, mat } : matériaux d'origine mis de côté
    this.sig = '';
    this.dirty = false;
    this.changedAt = 0;
    this.pointerDown = false;
    this.job = 0;           // change à chaque annulation : stoppe les calculs en cours
    this.warned = false;

    // Tout geste d'édition (clic, glisser) rend tout de suite les formes d'origine ; la navigation caméra n'y touche pas
    window.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      const isNav = e.button !== 0 || e.altKey || (e.shiftKey && e.target && e.target.id === 'draw-overlay');
      if (!isNav && this.isShown()) { this.clear(); this.markDirty(); }
    }, true);
    const up = () => { this.pointerDown = false; this.markDirty(); };
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);

    setInterval(() => this.tick(), 120);
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (!this.enabled) this.clear();
    else { this.sig = ''; this.markDirty(); }
  }

  isShown() { return this.swapped.length > 0 || this.group.children.length > 0; }
  markDirty() { this.dirty = true; this.changedAt = performance.now(); }

  /** Rend les formes d'origine et retire l'aperçu. */
  clear() {
    this.job++;
    this.swapped.forEach(s => { s.child.material = s.mat; if (s.pmat) s.pmat.dispose(); });
    this.swapped = [];
    while (this.group.children.length) {
      const m = this.group.children.pop();
      if (m.userData.ownGeometry && m.geometry) m.geometry.dispose();
    }
  }

  signature() {
    const f = v => Math.round(v * 1000);
    const parts = [];
    this.app.userMeshes.forEach(m => {
      let s = m.uuid + (m.userData.cutter ? 'C' : 'S') + (m.visible ? '' : 'h') +
        f(m.position.x) + ',' + f(m.position.y) + ',' + f(m.position.z) + ',' +
        f(m.quaternion.x) + ',' + f(m.quaternion.y) + ',' + f(m.quaternion.z) + ',' + f(m.quaternion.w) + ',' +
        f(m.scale.x) + ',' + f(m.scale.y) + ',' + f(m.scale.z);
      m.traverse(c => {
        if (!c.isMesh) return;
        s += '|' + (c.geometry ? c.geometry.uuid : '');
        const mat = this.matOf(c);
        if (mat && mat.color) s += mat.color.getHex();
      });
      parts.push(s);
    });
    return parts.join(';');
  }

  matOf(c) {
    const s = this.swapped.find(x => x.child === c);
    return s ? (s.pmat || s.mat) : c.material; // pendant l'aperçu : le matériau affiché
  }

  tick() {
    if (!this.enabled || !window.CSGLib) return;
    const meshes = this.app.userMeshes;
    const hasCutter = meshes.some(m => m.userData.cutter);
    if (!hasCutter) {
      if (this.isShown()) this.clear();
      this.sig = '';
      return;
    }
    if (!CSGLib.isReady()) { CSGLib.preload(); return; }

    const sig = this.signature();
    if (sig !== this.sig) {
      this.sig = sig;
      if (this.isShown()) this.clear();
      this.markDirty();
      return;
    }
    if (this.dirty && !this.pointerDown && !this.isShown() && performance.now() - this.changedAt > 250) {
      this.dirty = false;
      this.rebuild();
    }
  }

  worldTris(child) {
    child.updateWorldMatrix(true, false);
    return Exporter3D.worldTriangles(child.geometry, child.matrixWorld);
  }

  rebuild() {
    const meshes = this.app.userMeshes.filter(m => m.visible);
    const cutters = [];
    meshes.filter(m => m.userData.cutter).forEach(m => {
      m.updateWorldMatrix(true, true);
      m.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        const tris = this.worldTris(c);
        if (tris.length) cutters.push({ tris, box: CSGLib.boxOf(tris) });
      });
    });
    if (!cutters.length) return;

    // Pièces touchées par un trou
    const jobs = [];
    let touchedCount = 0;
    meshes.filter(m => !m.userData.cutter).forEach(m => {
      m.updateWorldMatrix(true, true);
      const kids = [];
      let touched = false;
      m.traverse(c => {
        if (!c.isMesh || !c.geometry) return;
        if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
        const box = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
        const hits = cutters.filter(k => k.box.intersectsBox(box));
        if (hits.length) touched = true;
        kids.push({ child: c, hits });
      });
      if (touched) touchedCount++;
      jobs.push(kids);
    });
    // toutes les formes passent par l'aperçu (celles que rien ne touche sont simplement recopiées) :
    // ainsi l'ordre de profondeur entre formes qui se superposent reste cohérent
    if (!touchedCount) return;
    if (touchedCount > 24) {
      if (!this.warned) { this.warned = true; this.app.showToast('🕳️ Trop de formes touchées : l\'aperçu du trou est désactivé (l\'export reste correct).'); }
      return;
    }

    const token = ++this.job;
    let order = 0;
    const step = () => {
      if (token !== this.job) return; // la scène a changé entre-temps
      const kids = jobs.shift();
      if (!kids) return;
      this.applyJob(kids, order++);
      if (jobs.length) setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  // Remplace toutes les pièces d'une forme (même celles que le trou ne touche pas, pour ne rien perdre à l'écran)
  applyJob(kids, order) {
    const built = [];
    for (const { child, hits } of kids) {
      let mesh = null;
      if (hits.length) {
        const tris = this.worldTris(child);
        if (tris.length > 60000) return;
        const res = CSGLib.carveIndexed(tris, hits.map(h => h.tris));
        if (!res) return; // forme non étanche ou moteur absent : on garde la forme d'origine
        const geo = new THREE.BufferGeometry();
        const sm = CSGLib.creaseNormals(res.positions, res.indices, 40); // lisse les courbes, garde les arêtes vives
        geo.setAttribute('position', new THREE.BufferAttribute(sm.positions, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(sm.normals, 3));
        mesh = new THREE.Mesh(geo, child.material);
        mesh.userData.ownGeometry = true;
        mesh.matrixAutoUpdate = false;
      } else {
        mesh = new THREE.Mesh(child.geometry, child.material);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(child.matrixWorld);
        mesh.matrixWorldNeedsUpdate = true;
      }
      mesh.castShadow = child.castShadow;
      mesh.receiveShadow = child.receiveShadow;
      built.push({ child, mesh });
    }
    // Chaque forme reçoit un léger décalage de profondeur qui lui est propre : deux surfaces confondues
    // (parois d'un même trou, faces qui se touchent) ont alors un ordre fixe au lieu de scintiller.
    const k = Math.min(order, 20);
    built.forEach(({ child, mesh }) => {
      const pmat = child.material.clone();
      pmat.polygonOffset = true;
      pmat.polygonOffsetFactor = 0;   // pas de terme de pente : il déformerait les surfaces vues de biais
      pmat.polygonOffsetUnits = -1 * k;
      mesh.material = pmat;
      this.group.add(mesh);
      this.swapped.push({ child, mat: child.material, pmat });
      child.material = this.hiddenMat;
    });
  }
}

window.BooleanPreview = BooleanPreview;
