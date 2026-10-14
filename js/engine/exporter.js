/**
 * Kidi3D - Moteur d'Export 3D & Sauvegarde de Projets
 * Fichiers STL binaires stricts 100% étanches et Auto-Fit NON-DESTRUCTIF au plateau.
 * Supporte le mode Haute Définition Lisse et le mode Topologie Épurée (Blender Subdivision/Remesh).
 */

class Exporter3D {
  /**
   * Calcule les dimensions totales de la création en millimètres
   */
  static getModelDimensions(meshes) {
    meshes = this.solids(meshes);
    if (!meshes || meshes.length === 0) {
      return { width: 0, depth: 0, height: 0, count: 0 };
    }

    const bbox = new THREE.Box3();
   meshes.forEach(m => {
  if (m && m.visible && m.parent !== null) {
    m.updateWorldMatrix(true, true);
    bbox.expandByObject(m);
  }
});

    if (bbox.isEmpty()) {
      return { width: 0, depth: 0, height: 0, count: 0 };
    }

    const size = new THREE.Vector3();
    bbox.getSize(size);

    return {
      width: Math.round(size.x),
      depth: Math.round(size.z),
      height: Math.round(size.y),
      count: meshes.length,
      min: bbox.min,
      max: bbox.max
    };
  }

  /**
   * Calcule la transformation de centrage et mise à l'échelle virtuelle pour l'export,
   * SANS AUCUNE MODIFICATION des objets réels de la scène 3D.
   */
  static getExportTransform(meshes, autoFit = true, bedSize = 180, maxHeight = null, userScale = 1, truncate = false) {
    meshes = this.solids(meshes);
    maxHeight = maxHeight || bedSize;
    if (!meshes || meshes.length === 0) {
      return { scale: 1.0, cx: 0, cz: 0, minY: 0, autoFit: false };
    }

    const bbox = new THREE.Box3();
 meshes.forEach(m => {
  if (m && m.visible && m.parent !== null) {
    m.updateWorldMatrix(true, true);
    bbox.expandByObject(m);
  }
});

    if (bbox.isEmpty()) {
      return { scale: 1.0, cx: 0, cz: 0, minY: 0, autoFit: false };
    }

    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    // Coupe à la table : la partie sous y = 0 est supprimée, le bas du modèle est donc à y = 0
    const minY = truncate ? Math.max(0, bbox.min.y) : bbox.min.y;
    if (truncate) size.y = bbox.max.y - minY;

    // userScale : échelle d'impression (ex. 0,5 si l'espace de création est 2 fois plus grand que le plateau réel)
    let scale = userScale;
    if (autoFit) {
      const maxAllowedDim = bedSize * 0.90; // Marge de sécurité 10%
      const maxAllowedH = maxHeight * 0.90;

      const scaleX = maxAllowedDim / Math.max(1, size.x * userScale);
      const scaleZ = maxAllowedDim / Math.max(1, size.z * userScale);
      const scaleY = maxAllowedH / Math.max(1, size.y * userScale);

      scale = userScale * Math.min(1.0, scaleX, scaleZ, scaleY);
    }

    return {
      scale,
      cx: center.x,
      cz: center.z,
      minY,
      autoFit: autoFit || userScale !== 1
    };
  }

  /**
   * Extrait les géométries d'un maillage en appliquant optionnellement
   * une régénération optimisée selon la qualité choisie (smooth ou subdiv/lowpoly).
   */
  static getGeometriesForExport(mesh, quality = 'smooth') {
    const list = [];
    const isSmooth = (quality === 'smooth');

    // 1. Tubes
    if (mesh.userData && mesh.userData.type === 'tube' && mesh.userData.points && window.MeshGenerator) {
      const pts = mesh.userData.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      const rad = mesh.userData.radius || 6;
      const tubeGeo = MeshGenerator.createTubeGeometry(pts, rad, {
        highPoly: isSmooth,
        radialSegments: isSmooth ? 24 : 12,
        radii: mesh.userData.pointRadii || null
      });

      if (tubeGeo) {
        list.push({
          geometry: tubeGeo,
          matrixWorld: mesh.matrixWorld,
          isTemporary: true
        });
        return list;
      }
    }

    // 2. Ballons (Allégement des côtés & biseaux propres)
    if (mesh.userData && mesh.userData.type === 'balloon' && mesh.userData.points && window.MeshGenerator) {
      const pts = mesh.userData.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      const thick = mesh.userData.thickness || 18;
      const blobData = MeshGenerator.createInflatedBlobGeometry(pts, null, thick, {
        quality: quality,
        basisU: mesh.userData.basisU,
        basisV: mesh.userData.basisV,
        basisNormal: mesh.userData.basisNormal,
        bevelRatio: mesh.userData.bevelRatio,
        smoothIterations: mesh.userData.smoothIterations,
        contourSegments: isSmooth ? 42 : 28,
        bevelSegments: isSmooth ? 3 : 2
      });

      if (blobData && blobData.geometry) {
        blobData.geometry.applyMatrix4(MeshGenerator.getBlobWorldMatrix(blobData));
        list.push({
          geometry: blobData.geometry,
          matrixWorld: mesh.matrixWorld,
          isTemporary: true
        });
        return list;
      }
    }

    // 3. Piliers (Haut et bas biseautés)
    if (mesh.userData && mesh.userData.type === 'pillar' && mesh.userData.points && window.MeshGenerator) {
      const pts = mesh.userData.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
      const profile = mesh.userData.profile || 'square';
      const rad = mesh.userData.radius || 8;
      const pillarData = MeshGenerator.createArchitecturalPillarGeometry(pts, profile, rad, { quality });

      if (pillarData && pillarData.geometry) {
        list.push({
          geometry: pillarData.geometry,
          matrixWorld: mesh.matrixWorld,
          isTemporary: true
        });
        return list;
      }
    }

    // 4. Autres maillages (tampons, formes 3D, socle, etc.)
    mesh.traverse(child => {
      if (child.isMesh && child.geometry) {
        let exportGeo = child.geometry;
        let isTemp = false;

        if (isSmooth) {
          exportGeo = child.geometry.clone();
          exportGeo.computeVertexNormals();
          isTemp = true;
        }

        list.push({
          geometry: exportGeo,
          matrixWorld: child.matrixWorld,
          isTemporary: isTemp
        });
      }
    });

    return list;
  }

  /**
   * Exporte tous les maillages combinés au format STL Binaire (rapide, compact, universel)
   * sans altérer la scène vivante.
   */
  // ------------------------------------------------------------------ coupe à la table d'impression
  /** Vrai si la géométrie (une fois placée) descend sous le plan de la table (y = 0). */
  static dipsBelowTable(geo, matrixWorld) {
    if (!geo.boundingBox) geo.computeBoundingBox();
    return geo.boundingBox.clone().applyMatrix4(matrixWorld).min.y < -1e-3;
  }

  /** Triangles d'une géométrie en coordonnées monde, orientés vers l'extérieur même si l'objet est retourné. */
  static worldTriangles(geo, matrixWorld) {
    const flip = matrixWorld.determinant() < 0;
    const pos = geo.attributes.position;
    const index = geo.index;
    const count = index ? index.count : pos.count;
    const out = [];
    for (let i = 0; i < count; i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      const a = new THREE.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(matrixWorld);
      const c = new THREE.Vector3().fromBufferAttribute(pos, ic).applyMatrix4(matrixWorld);
      out.push(flip ? [a, c, b] : [a, b, c]);
    }
    return out;
  }

  /**
   * Coupe une forme au niveau de la table (plan y = 0) : tout ce qui est dessous disparaît,
   * et la coupe est refermée par un fond plat pour que le modèle reste étanche (2-manifold).
   * 1) chaque triangle à cheval sur le plan est recoupé ; 2) les arêtes de coupe sont chaînées en contours ;
   * 3) chaque contour (avec ses trous éventuels) est rempli par des triangles tournés vers le bas.
   */
  static truncateAtTable(tris, planeY = 0) {
    const eps = 1e-6;
    const out = [];
    const cuts = []; // arêtes de coupe [début, fin], dans le sens du triangle conservé
    const near = (p, q) => Math.abs(p.x - q.x) < eps && Math.abs(p.y - q.y) < eps && Math.abs(p.z - q.z) < eps;

    tris.forEach(tri => {
      const ins = tri.map(v => v.y >= planeY - eps);
      if (ins[0] && ins[1] && ins[2]) { out.push(tri); return; }
      if (!ins[0] && !ins[1] && !ins[2]) return;

      let poly = [];
      let exitPt = null;
      let enterPt = null;
      for (let i = 0; i < 3; i++) {
        const p = tri[i];
        const q = tri[(i + 1) % 3];
        const pIn = ins[i];
        const qIn = ins[(i + 1) % 3];
        if (pIn) poly.push(p);
        if (pIn !== qIn) {
          const t = (planeY - p.y) / (q.y - p.y);
          const hit = new THREE.Vector3(p.x + (q.x - p.x) * t, planeY, p.z + (q.z - p.z) * t);
          poly.push(hit);
          if (pIn) exitPt = hit; else enterPt = hit;
        }
      }

      // points confondus (sommet posé exactement sur le plan) : on les fusionne
      poly = poly.filter((p, i) => !near(p, poly[(i + 1) % poly.length]));
      for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]);

      if (exitPt && enterPt && !near(exitPt, enterPt)) cuts.push([exitPt, enterPt]);
    });

    // --- contours de la coupe
    const key = p => Math.round(p.x * 1000) + '_' + Math.round(p.z * 1000);
    const byStart = new Map();
    cuts.forEach(c => {
      const k = key(c[0]);
      if (!byStart.has(k)) byStart.set(k, []);
      byStart.get(k).push(c);
    });
    const used = new Set();
    const loops = [];
    cuts.forEach(first => {
      if (used.has(first)) return;
      const pts = [first[0]];
      let cur = first;
      used.add(cur);
      let closed = false;
      for (let guard = 0; guard < cuts.length + 2; guard++) {
        if (key(cur[1]) === key(first[0])) { closed = true; break; }
        pts.push(cur[1]);
        const nextList = byStart.get(key(cur[1])) || [];
        const next = nextList.find(c => !used.has(c));
        if (!next) break;
        used.add(next);
        cur = next;
      }
      if (closed && pts.length >= 3) loops.push(pts.reverse()); // le fond est parcouru dans le sens opposé à la coupe
    });
    if (!loops.length) return out;

    // --- contours extérieurs et trous : même sens = extérieur, sens opposé = trou
    const area = pts => {
      let a = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        a += p.x * q.z - q.x * p.z;
      }
      return a / 2;
    };
    const areas = loops.map(area);
    const big = areas.reduce((m, a) => (Math.abs(a) > Math.abs(m) ? a : m), 0);
    const inside = (pt, poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        if (((poly[i].z > pt.z) !== (poly[j].z > pt.z)) &&
            (pt.x < (poly[j].x - poly[i].x) * (pt.z - poly[i].z) / (poly[j].z - poly[i].z) + poly[i].x)) c = !c;
      }
      return c;
    };

    const outers = [];
    const holes = [];
    loops.forEach((l, i) => ((areas[i] * big > 0) ? outers : holes).push({ pts: l, area: Math.abs(areas[i]), holes: [] }));
    holes.forEach(h => {
      const parent = outers
        .filter(o => inside(h.pts[0], o.pts))
        .sort((a, b) => a.area - b.area)[0];
      if (parent) parent.holes.push(h); else outers.push(h); // trou sans parent : traité comme un contour
    });

    // --- fond plat : triangulation de chaque contour (avec ses trous), face tournée vers le bas
    outers.forEach(o => {
      const contour = o.pts.map(p => new THREE.Vector2(p.x, p.z));
      const holeLists = o.holes.map(h => h.pts.map(p => new THREE.Vector2(p.x, p.z)));
      const all = o.pts.concat(...o.holes.map(h => h.pts));
      const faces = THREE.ShapeUtils.triangulateShape(contour, holeLists);
      faces.forEach(f => {
        let a = new THREE.Vector3(all[f[0]].x, planeY, all[f[0]].z);
        let b = new THREE.Vector3(all[f[1]].x, planeY, all[f[1]].z);
        let c = new THREE.Vector3(all[f[2]].x, planeY, all[f[2]].z);
        const ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z); // composante Y de (b-a) x (c-a)
        if (ny > 0) { const t = b; b = c; c = t; }
        out.push([a, b, c]);
      });
    });
    return out;
  }

  // ------------------------------------------------------------------ formes « trou » (booléen : soustraction)
  static isCutter(m) { return !!(m && m.userData && m.userData.cutter); }

  /** Les formes qui restent dans le modèle (les trous ne s'impriment pas). */
  static solids(meshes) { return (meshes || []).filter(m => !this.isCutter(m)); }

  /** Triangles monde de toutes les formes « trou » visibles. */
  static collectCutters(meshes, quality) {
    const out = [];
    (meshes || []).forEach(m => {
      if (!this.isCutter(m) || !m.visible) return;
      m.updateWorldMatrix(true, true);
      this.getGeometriesForExport(m, quality).forEach(item => {
        const tris = this.worldTriangles(item.geometry, item.matrixWorld);
        if (item.isTemporary) item.geometry.dispose();
        if (tris.length) out.push({ tris, box: CSGLib.boxOf(tris) });
      });
    });
    return out;
  }

  /** Triangles monde de la pièce une fois creusée, ou null si aucun trou ne la touche. */
  static carveItem(geo, matrixWorld) {
    if (!this._cutters || !this._cutters.length || !window.CSGLib) return null;
    let tris = this.worldTriangles(geo, matrixWorld);
    const box = CSGLib.boxOf(tris);
    const hits = this._cutters.filter(c => c.box.intersectsBox(box));
    if (!hits.length) return null;
    hits.forEach(c => { tris = CSGLib.subtract(tris, c.tris); });
    return tris;
  }

  static exportSTLBinary(meshes, filename = 'Export3D.stl', autoFit = true, bedSize = 180, quality = 'smooth', userScale = 1, truncate = false) {
    this._cutters = this.collectCutters(meshes, quality);
    try {
      return this._exportSTLBinary(this.solids(meshes), filename, autoFit, bedSize, quality, userScale, truncate);
    } finally {
      this._cutters = null;
    }
  }

  static exportOBJ(meshes, filename = 'Export3D.obj', autoFit = true, bedSize = 180, quality = 'smooth', userScale = 1, truncate = false) {
    this._cutters = this.collectCutters(meshes, quality);
    try {
      return this._exportOBJ(this.solids(meshes), filename, autoFit, bedSize, quality, userScale, truncate);
    } finally {
      this._cutters = null;
    }
  }

  static _exportSTLBinary(meshes, filename = 'Export3D.stl', autoFit = true, bedSize = 180, quality = 'smooth', userScale = 1, truncate = false) {
    if (!meshes || meshes.length === 0) return false;

    // Calcul de la transformation virtuelle d'exportation
    const transform = this.getExportTransform(meshes, autoFit, bedSize, null, userScale, truncate);

    const triangles = [];
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vC = new THREE.Vector3();
    const cb = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const normal = new THREE.Vector3();

    const applyTransform = (v) => {
      if (transform.autoFit) {
        v.x = (v.x - transform.cx) * transform.scale;
        v.y = (v.y - transform.minY) * transform.scale;
        v.z = (v.z - transform.cz) * transform.scale;
      }
    };

    meshes.forEach(mesh => {
      if (!mesh.visible) return;

      mesh.updateWorldMatrix(true, false);
      const subGeos = this.getGeometriesForExport(mesh, quality);

      subGeos.forEach(item => {
        const geo = item.geometry;
        const subMat = item.matrixWorld;
        const flip = subMat.determinant() < 0; // Objet avec échelle négative (ex: miroir)

        // Pièce qui descend sous la table : on la coupe au niveau de la table et on referme le fond
        const carved = this.carveItem(geo, subMat);
        if (carved || (truncate && this.dipsBelowTable(geo, subMat))) {
          let worldTris = carved || this.worldTriangles(geo, subMat);
          if (truncate) worldTris = this.truncateAtTable(worldTris);
          worldTris.forEach(tri => {
            vA.copy(tri[0]); vB.copy(tri[1]); vC.copy(tri[2]);
            applyTransform(vA);
            applyTransform(vB);
            applyTransform(vC);
            cb.subVectors(vC, vB);
            ab.subVectors(vA, vB);
            normal.crossVectors(cb, ab);
            if (normal.lengthSq() > 1e-10) {
              normal.normalize();
              triangles.push({ normal: normal.clone(), a: vA.clone(), b: vB.clone(), c: vC.clone() });
            }
          });
          if (item.isTemporary) geo.dispose();
          return;
        }
        const pos = geo.attributes.position;
        const index = geo.index;

        if (index) {
          for (let i = 0; i < index.count; i += 3) {
            const iA = index.getX(i);
            const iB = index.getX(i + 1);
            const iC = index.getX(i + 2);

            vA.fromBufferAttribute(pos, iA).applyMatrix4(subMat);
            vB.fromBufferAttribute(pos, iB).applyMatrix4(subMat);
            vC.fromBufferAttribute(pos, iC).applyMatrix4(subMat);

            applyTransform(vA);
            applyTransform(vB);
            applyTransform(vC);

            if (flip) {
              const t = vB.clone();
              vB.copy(vC);
              vC.copy(t);
            }

            cb.subVectors(vC, vB);
            ab.subVectors(vA, vB);
            normal.crossVectors(cb, ab);

            // Filtrer les micro-triangles dégénérés de surface nulle
            const areaSq = normal.lengthSq();
            if (areaSq > 1e-10) {
              normal.normalize();
              triangles.push({
                normal: normal.clone(),
                a: vA.clone(),
                b: vB.clone(),
                c: vC.clone()
              });
            }
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            vA.fromBufferAttribute(pos, i).applyMatrix4(subMat);
            vB.fromBufferAttribute(pos, i + 1).applyMatrix4(subMat);
            vC.fromBufferAttribute(pos, i + 2).applyMatrix4(subMat);

            applyTransform(vA);
            applyTransform(vB);
            applyTransform(vC);

            if (flip) {
              const t = vB.clone();
              vB.copy(vC);
              vC.copy(t);
            }

            cb.subVectors(vC, vB);
            ab.subVectors(vA, vB);
            normal.crossVectors(cb, ab);

            const areaSq = normal.lengthSq();
            if (areaSq > 1e-10) {
              normal.normalize();
              triangles.push({
                normal: normal.clone(),
                a: vA.clone(),
                b: vB.clone(),
                c: vC.clone()
              });
            }
          }
        }

        // Nettoyer les géométries temporaires générées pour l'export
        if (item.isTemporary) {
          geo.dispose();
        }
      });
    });

    if (triangles.length === 0) return false;

    // Buffer binaire STL
    const bufferLength = 84 + triangles.length * 50;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const dataView = new DataView(arrayBuffer);

    const headerStr = '100% 2-Manifold 3D Print Model';
    for (let i = 0; i < 80; i++) {
      dataView.setUint8(i, i < headerStr.length ? headerStr.charCodeAt(i) : 0);
    }

    dataView.setUint32(80, triangles.length, true);

    let offset = 84;
    triangles.forEach(tri => {
      dataView.setFloat32(offset, tri.normal.x, true); offset += 4;
      dataView.setFloat32(offset, tri.normal.y, true); offset += 4;
      dataView.setFloat32(offset, tri.normal.z, true); offset += 4;

      dataView.setFloat32(offset, tri.a.x, true); offset += 4;
      dataView.setFloat32(offset, tri.a.y, true); offset += 4;
      dataView.setFloat32(offset, tri.a.z, true); offset += 4;

      dataView.setFloat32(offset, tri.b.x, true); offset += 4;
      dataView.setFloat32(offset, tri.b.y, true); offset += 4;
      dataView.setFloat32(offset, tri.b.z, true); offset += 4;

      dataView.setFloat32(offset, tri.c.x, true); offset += 4;
      dataView.setFloat32(offset, tri.c.y, true); offset += 4;
      dataView.setFloat32(offset, tri.c.z, true); offset += 4;

      dataView.setUint16(offset, 0, true); offset += 2;
    });

    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
    this.triggerDownload(blob, filename);
    return true;
  }

  /**
   * Exporte au format OBJ avec topologie propre
   */
  static _exportOBJ(meshes, filename = 'Export3D.obj', autoFit = true, bedSize = 180, quality = 'smooth', userScale = 1, truncate = false) {
    if (!meshes || meshes.length === 0) return false;

    const transform = this.getExportTransform(meshes, autoFit, bedSize, null, userScale, truncate);

    let objContent = '# 3D Exported Wavefront OBJ\n';
    let vertexOffset = 1;

    meshes.forEach((mesh, meshIdx) => {
      if (!mesh.visible) return;

      mesh.updateWorldMatrix(true, false);
      const subGeos = this.getGeometriesForExport(mesh, quality);

      subGeos.forEach((item, subIdx) => {
        objContent += `g Object_${meshIdx}_${subIdx}\n`;
        const geo = item.geometry;
        const mat = item.matrixWorld;
        const flip = mat.determinant() < 0;

        // Pièce qui descend sous la table : coupée au niveau de la table, fond refermé (sommets partagés)
        const carved = this.carveItem(geo, mat);
        if (carved || (truncate && this.dipsBelowTable(geo, mat))) {
          let tris = carved || this.worldTriangles(geo, mat);
          if (truncate) tris = this.truncateAtTable(tris);
          const keyToIdx = new Map();
          const vtx = new THREE.Vector3();
          let faces = '';
          const idxOf = (p) => {
            const k = p.x.toFixed(4) + ',' + p.y.toFixed(4) + ',' + p.z.toFixed(4);
            if (!keyToIdx.has(k)) {
              vtx.copy(p);
              if (transform.autoFit) {
                vtx.x = (vtx.x - transform.cx) * transform.scale;
                vtx.y = (vtx.y - transform.minY) * transform.scale;
                vtx.z = (vtx.z - transform.cz) * transform.scale;
              }
              objContent += `v ${vtx.x.toFixed(4)} ${vtx.y.toFixed(4)} ${vtx.z.toFixed(4)}\n`;
              keyToIdx.set(k, vertexOffset + keyToIdx.size);
            }
            return keyToIdx.get(k);
          };
          tris.forEach(t => {
            const a = idxOf(t[0]);
            const b = idxOf(t[1]);
            const c = idxOf(t[2]);
            faces += `f ${a} ${b} ${c}\n`;
          });
          objContent += faces;
          vertexOffset += keyToIdx.size;
          if (item.isTemporary) geo.dispose();
          return;
        }
        const pos = geo.attributes.position;
        const index = geo.index;

        const v = new THREE.Vector3();

        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(mat);
          if (transform.autoFit) {
            v.x = (v.x - transform.cx) * transform.scale;
            v.y = (v.y - transform.minY) * transform.scale;
            v.z = (v.z - transform.cz) * transform.scale;
          }
          objContent += `v ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}\n`;
        }

        if (index) {
          const isSubdiv = (quality === 'subdiv' || quality === 'lowpoly');
          if (isSubdiv) {
            let i = 0;
            while (i < index.count) {
              if (i + 5 < index.count) {
                const iA1 = index.getX(i);
                const iB1 = index.getX(i + 1);
                const iC1 = index.getX(i + 2);

                const iA2 = index.getX(i + 3);
                const iB2 = index.getX(i + 4);
                const iC2 = index.getX(i + 5);

                // Détection de quad Three.js (Lathe / Tube / Extrude) :
                // Triangle 1 : (vA, vA_next, vB)
                // Triangle 2 : (vA_next, vB_next, vB)
                if (iB1 === iA2 && iC1 === iC2) {
                  const q1 = vertexOffset + iA1;
                  const q2 = vertexOffset + iB1;
                  const q3 = vertexOffset + iB2;
                  const q4 = vertexOffset + iC1;
                  if (flip) {
                    objContent += `f ${q1} ${q4} ${q3} ${q2}\n`;
                  } else {
                    objContent += `f ${q1} ${q2} ${q3} ${q4}\n`;
                  }
                  i += 6;
                  continue;
                }
              }

              // Triangle standard
              const i1 = vertexOffset + index.getX(i);
              const i2 = vertexOffset + index.getX(i + 1);
              const i3 = vertexOffset + index.getX(i + 2);
              if (flip) {
                objContent += `f ${i1} ${i3} ${i2}\n`;
              } else {
                objContent += `f ${i1} ${i2} ${i3}\n`;
              }
              i += 3;
            }
          } else {
            for (let i = 0; i < index.count; i += 3) {
              const i1 = vertexOffset + index.getX(i);
              const i2 = vertexOffset + index.getX(i + 1);
              const i3 = vertexOffset + index.getX(i + 2);
              if (flip) {
                objContent += `f ${i1} ${i3} ${i2}\n`;
              } else {
                objContent += `f ${i1} ${i2} ${i3}\n`;
              }
            }
          }
        } else {
          for (let i = 0; i < pos.count; i += 3) {
            const i1 = vertexOffset + i;
            const i2 = vertexOffset + i + 1;
            const i3 = vertexOffset + i + 2;
            if (flip) {
              objContent += `f ${i1} ${i3} ${i2}\n`;
            } else {
              objContent += `f ${i1} ${i2} ${i3}\n`;
            }
          }
        }

        vertexOffset += pos.count;

        if (item.isTemporary) {
          geo.dispose();
        }
      });
    });

    const blob = new Blob([objContent], { type: 'text/plain' });
    this.triggerDownload(blob, filename);
    return true;
  }

  /**
   * Sauvegarde le projet au format JSON `.kid3d`
   */
  static exportProjectJSON(meshes, filename = 'Dessin3D.kid3d') {
    const projectData = {
      app: 'Kidi3D',
      version: '2.0',
      timestamp: Date.now(),
      elements: meshes.map(m => ({
        ...m.userData,
        position: { x: m.position.x, y: m.position.y, z: m.position.z },
        scale: { x: m.scale.x, y: m.scale.y, z: m.scale.z },
        rotation: { x: m.rotation.x, y: m.rotation.y, z: m.rotation.z }
      }))
    };

    const jsonStr = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.triggerDownload(blob, filename);
  }

  static triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

window.Exporter3D = Exporter3D;
