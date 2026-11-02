/**
 * Import de modèles 3D (STL binaire / ASCII, OBJ) pour les modifier dans l'atelier.
 * Le modèle est remis à l'endroit, centré, mis à la bonne taille et posé sur le plateau dans un espace libre ;
 * il devient une forme comme les autres (déplacer, tourner, agrandir, colorier, copier, trou…).
 *
 * La géométrie est gardée une seule fois dans un registre (this.geos) ; les formes n'y font référence que par un
 * identifiant, ce qui garde l'annulation et la sauvegarde légères. Elle est aussi mémorisée dans le navigateur
 * (si elle n'est pas trop lourde) et incluse dans les fichiers projet .kid3d.
 */
class ModelImporter {
  constructor(app) {
    this.app = app;
    this.geos = new Map(); // id -> { positions: Float32Array, indices: Uint32Array, size: [x, y, z] }
    this.MAX_TRIANGLES = 400000;
    this.bindUI();
  }

  // ------------------------------------------------------------------ interface
  bindUI() {
    const btn = document.getElementById('btn-import-model');
    const input = document.getElementById('input-import-model');
    if (btn && input) {
      btn.addEventListener('click', () => input.click());
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.value = '';
        if (file) this.importFile(file);
      });
    }
    // Glisser-déposer d'un fichier sur la fenêtre
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      e.preventDefault();
      if (/\.(stl|obj)$/i.test(file.name)) this.importFile(file);
      else if (/\.kid3d$/i.test(file.name)) this.app.showToast('📂 Pour ouvrir un projet : Imprimer → Ouvrir un projet');
      else this.app.showToast('📥 Je sais importer les fichiers .stl et .obj');
    });
  }

  // ------------------------------------------------------------------ lecture des fichiers
  async importFile(file) {
    const app = this.app;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext !== 'stl' && ext !== 'obj') { app.showToast('📥 Je sais importer les fichiers .stl et .obj'); return; }
    app.showToast(`📥 Import de « ${file.name} »…`);
    await new Promise(r => setTimeout(r, 30)); // laisse le message s'afficher avant le calcul

    try {
      const buffer = await file.arrayBuffer();
      let tris, zUp;
      if (ext === 'stl') {
        tris = ModelImporter.parseSTL(buffer);
        zUp = true; // les STL ont Z vers le haut
      } else {
        const text = new TextDecoder('utf-8').decode(buffer);
        tris = ModelImporter.parseOBJ(text);
        zUp = /3D Exported Wavefront/.test(text.slice(0, 200)); // nos propres exports ont Z vers le haut ; les autres OBJ ont Y vers le haut
      }
      const count = tris.length / 9;
      if (!count) { app.showToast("📥 Ce fichier ne contient pas de forme 3D que je sais lire."); return; }
      if (count > this.MAX_TRIANGLES) {
        app.showToast(`📥 Ce modèle est trop détaillé (${Math.round(count / 1000)} 000 triangles). Simplifie-le puis réessaie.`);
        return;
      }

      const rec = ModelImporter.weld(tris, zUp);
      if (!rec) { app.showToast('📥 Modèle vide ou invalide.'); return; }
      const id = 'imp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      this.register(id, rec);

      const name = file.name.replace(/\.[^.]+$/, '');
      const mesh = this.createMesh(id, { name, color: app.currentColor });
      this.autoPlace(mesh, rec);
      app.addMeshToScene(mesh);

      // On passe en mode « Bouger » avec le modèle sélectionné : les options de modification s'affichent
      const editBtn = document.querySelector('.magic-tool-btn[data-tool="edit"]');
      if (app.currentTool !== 'edit' && editBtn) editBtn.click();
      app.editManager.selectMesh(mesh);
      app.saveStateForUndo();
      app.autoSave();
      if (window.soundFx) window.soundFx.playSuccess && window.soundFx.playSuccess();
      app.showToast(`✅ « ${name} » importé et posé sur le plateau (${Math.round(count)} triangles). Mal orienté ? Utilise « Basculer 90° ».`);
    } catch (err) {
      console.warn('Import impossible', err);
      app.showToast("📥 Je n'arrive pas à lire ce fichier.");
    }
  }

  static parseSTL(buffer) {
    const dv = new DataView(buffer);
    if (buffer.byteLength >= 84) {
      const n = dv.getUint32(80, true);
      if (84 + n * 50 === buffer.byteLength) {
        const out = new Float32Array(n * 9);
        for (let i = 0; i < n; i++) {
          const o = 84 + i * 50 + 12; // on saute la normale
          for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(o + k * 4, true);
        }
        return out;
      }
    }
    // STL texte
    const text = new TextDecoder('utf-8').decode(buffer);
    const re = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;
    const list = [];
    let m;
    while ((m = re.exec(text))) list.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    const usable = list.length - (list.length % 9);
    return Float32Array.from(list.slice(0, usable));
  }

  static parseOBJ(text) {
    const verts = [];
    const out = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.charCodeAt(0) === 118 /* v */ && line.charCodeAt(1) === 32) {
        const p = line.trim().split(/\s+/);
        verts.push(parseFloat(p[1]), parseFloat(p[2]), parseFloat(p[3]));
      } else if (line.charCodeAt(0) === 102 /* f */ && line.charCodeAt(1) === 32) {
        const p = line.trim().split(/\s+/).slice(1);
        const idx = p.map(tok => {
          let i = parseInt(tok.split('/')[0], 10);
          if (i < 0) i = verts.length / 3 + i + 1; // indices négatifs : relatifs à la fin
          return i - 1;
        });
        for (let k = 1; k + 1 < idx.length; k++) { // polygones : en éventail
          for (const j of [idx[0], idx[k], idx[k + 1]]) {
            out.push(verts[j * 3], verts[j * 3 + 1], verts[j * 3 + 2]);
          }
        }
      }
    }
    return Float32Array.from(out.filter(v => v !== undefined));
  }

  // Soude les sommets, remet le modèle à l'endroit (Z vers le haut -> Y vers le haut) et le centre sur l'origine
  static weld(tris, zUp) {
    const n = tris.length / 3;
    // rotation d'axes
    const pts = new Float32Array(tris.length);
    for (let i = 0; i < n; i++) {
      const x = tris[i * 3], y = tris[i * 3 + 1], z = tris[i * 3 + 2];
      if (zUp) { pts[i * 3] = x; pts[i * 3 + 1] = z; pts[i * 3 + 2] = -y; }
      else { pts[i * 3] = x; pts[i * 3 + 1] = y; pts[i * 3 + 2] = z; }
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const v = pts[i * 3 + c];
        if (!Number.isFinite(v)) return null;
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
    }
    const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const diag = Math.hypot(size[0], size[1], size[2]);
    if (!(diag > 0)) return null;
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const q = diag * 1e-6;

    const map = new Map();
    const positions = [];
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const x = pts[i * 3] - center[0], y = pts[i * 3 + 1] - center[1], z = pts[i * 3 + 2] - center[2];
      const key = Math.round(x / q) + ',' + Math.round(y / q) + ',' + Math.round(z / q);
      let id = map.get(key);
      if (id === undefined) { id = positions.length / 3; map.set(key, id); positions.push(x, y, z); }
      idx[i] = id;
    }
    const keep = [];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      if (a !== b && b !== c && a !== c) keep.push(a, b, c);
    }
    if (!keep.length) return null;
    return { positions: Float32Array.from(positions), indices: Uint32Array.from(keep), size };
  }

  // ------------------------------------------------------------------ registre & persistance
  register(id, rec) {
    this.geos.set(id, rec);
    try {
      localStorage.setItem('kidi3d_geo_' + id, JSON.stringify(ModelImporter.encode(rec)));
    } catch (e) {
      if (!this.warnedQuota) {
        this.warnedQuota = true;
        this.app.showToast('💾 Ce modèle est trop lourd pour la sauvegarde automatique : pense à « Sauvegarder .kid3d ».');
      }
    }
  }

  static toBase64(typed) {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  static fromBase64(b64, Type) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Type(bytes.buffer);
  }

  static encode(rec) {
    return { p: ModelImporter.toBase64(rec.positions), i: ModelImporter.toBase64(rec.indices), size: rec.size };
  }

  static decode(obj) {
    return { positions: ModelImporter.fromBase64(obj.p, Float32Array), indices: ModelImporter.fromBase64(obj.i, Uint32Array), size: obj.size };
  }

  /** Données d'un modèle pour les fichiers projet. */
  exportRecord(id) {
    const rec = this.geos.get(id);
    return rec ? ModelImporter.encode(rec) : null;
  }

  /** Retrouve la géométrie d'un modèle : registre, fichier projet (el.geometry) ou mémoire du navigateur. */
  resolve(el) {
    if (this.geos.has(el.geoId)) return this.geos.get(el.geoId);
    let rec = null;
    try {
      if (el.geometry) rec = ModelImporter.decode(el.geometry);
      else {
        const saved = localStorage.getItem('kidi3d_geo_' + el.geoId);
        if (saved) rec = ModelImporter.decode(JSON.parse(saved));
      }
    } catch (e) { rec = null; }
    if (rec) this.geos.set(el.geoId, rec);
    return rec;
  }

  forget() {
    // « Tout effacer » : on libère aussi la mémoire du navigateur
    this.geos.clear();
    try {
      Object.keys(localStorage).filter(k => k.startsWith('kidi3d_geo_')).forEach(k => localStorage.removeItem(k));
    } catch (e) { /* sans importance */ }
  }

  // ------------------------------------------------------------------ forme
  createMesh(id, { name = 'Modèle', color = 0x9fb3c8 } = {}) {
    const rec = this.geos.get(id);
    const sm = CSGLib.creaseNormals(rec.positions, rec.indices, 40); // lisse les courbes, garde les arêtes vives
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(sm.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(sm.normals, 3));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'imported', geoId: id, name, color, size: 12 };
    return mesh;
  }

  /** Recrée une forme importée à partir d'une sauvegarde (annulation, rechargement, projet). */
  createFromRecord(el) {
    const rec = this.resolve(el);
    if (!rec) {
      this.app.showToast(`📥 Le modèle « ${el.name || 'importé'} » est introuvable (rouvre le fichier STL / OBJ).`);
      return null;
    }
    const mesh = this.createMesh(el.geoId, { name: el.name, color: el.color != null ? el.color : 0x9fb3c8 });
    if (el.fitScale != null) mesh.userData.fitScale = el.fitScale;
    return mesh;
  }

  // Taille et place automatiques : ~45 % du plateau, centré sur la table, dans un espace libre
  autoPlace(mesh, rec) {
    const app = this.app;
    const bed = app.sceneManager.bedSize || 256;
    const maxDim = Math.max(rec.size[0], rec.size[1], rec.size[2]);
    const s = (bed * 0.45) / maxDim;
    mesh.scale.setScalar(s);
    mesh.userData.fitScale = s;
    const halfW = rec.size[0] * s / 2, halfD = rec.size[2] * s / 2, halfH = rec.size[1] * s / 2;

    // Rectangles déjà occupés sur la table
    const taken = app.userMeshes.map(m => {
      m.updateWorldMatrix(true, true);
      return new THREE.Box3().setFromObject(m);
    }).filter(b => !b.isEmpty());
    const free = (x, z) => taken.every(b => x + halfW < b.min.x || x - halfW > b.max.x || z + halfD < b.min.z || z - halfD > b.max.z);
    const limitX = Math.max(0, bed / 2 - halfW - 2), limitZ = Math.max(0, bed / 2 - halfD - 2);

    let best = { x: 0, z: 0 };
    if (!free(0, 0)) {
      const step = Math.max(10, bed / 16);
      let found = false;
      for (let r = step; r <= bed && !found; r += step) {
        const n = Math.max(8, Math.round((2 * Math.PI * r) / step));
        for (let k = 0; k < n && !found; k++) {
          const a = (k / n) * Math.PI * 2;
          const x = Math.max(-limitX, Math.min(limitX, Math.cos(a) * r));
          const z = Math.max(-limitZ, Math.min(limitZ, Math.sin(a) * r));
          if (free(x, z)) { best = { x, z }; found = true; }
        }
      }
    }
    mesh.position.set(best.x, halfH, best.z);
  }
}

window.ModelImporter = ModelImporter;
