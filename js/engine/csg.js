/**
 * Soustraction booléenne de maillages (arbres BSP, d'après csg.js de Evan Wallace, licence MIT).
 * Travaille sur des triangles en coordonnées monde : tableaux de 3 THREE.Vector3.
 * Utilisé à l'export pour « creuser » les formes avec les objets marqués comme trous.
 */
const CSGLib = (() => {
  const EPS = 1e-5;

  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

  class Plane {
    constructor(n, w) { this.n = n; this.w = w; }
    static fromPoints(a, b, c) {
      const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
      const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 1e-12) return null;
      nx /= len; ny /= len; nz /= len;
      return new Plane({ x: nx, y: ny, z: nz }, nx * a.x + ny * a.y + nz * a.z);
    }
    flip() { this.n = { x: -this.n.x, y: -this.n.y, z: -this.n.z }; this.w = -this.w; }

    // Range le polygone dans l'une des 4 listes selon sa position par rapport au plan
    splitPolygon(poly, coplanarFront, coplanarBack, front, back) {
      const COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3;
      let polyType = 0;
      const types = [];
      for (const v of poly.vertices) {
        const t = dot(this.n, v) - this.w;
        const type = (t < -EPS) ? BACK : (t > EPS) ? FRONT : COPLANAR;
        polyType |= type;
        types.push(type);
      }
      switch (polyType) {
        case COPLANAR:
          (dot(this.n, poly.plane.n) > 0 ? coplanarFront : coplanarBack).push(poly);
          break;
        case FRONT: front.push(poly); break;
        case BACK: back.push(poly); break;
        case SPANNING: {
          const f = [], b = [];
          const n = poly.vertices.length;
          for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const ti = types[i], tj = types[j];
            const vi = poly.vertices[i], vj = poly.vertices[j];
            if (ti !== BACK) f.push(vi);
            if (ti !== FRONT) b.push(vi);
            if ((ti | tj) === SPANNING) {
              const t = (this.w - dot(this.n, vi)) / dot(this.n, { x: vj.x - vi.x, y: vj.y - vi.y, z: vj.z - vi.z });
              const v = { x: vi.x + (vj.x - vi.x) * t, y: vi.y + (vj.y - vi.y) * t, z: vi.z + (vj.z - vi.z) * t };
              f.push(v); b.push(v);
            }
          }
          if (f.length >= 3) front.push(new Polygon(f, poly.plane));
          if (b.length >= 3) back.push(new Polygon(b, poly.plane));
          break;
        }
      }
    }
  }

  class Polygon {
    constructor(vertices, plane) {
      this.vertices = vertices;
      this.plane = plane || Plane.fromPoints(vertices[0], vertices[1], vertices[2]);
    }
    flip() {
      this.vertices.reverse();
      this.plane = new Plane({ x: this.plane.n.x, y: this.plane.n.y, z: this.plane.n.z }, this.plane.w);
      this.plane.flip();
    }
  }

  class Node {
    constructor(polygons) {
      this.plane = null; this.front = null; this.back = null; this.polygons = [];
      if (polygons && polygons.length) this.build(polygons);
    }
    invert() {
      const stack = [this];
      while (stack.length) {
        const node = stack.pop();
        node.polygons.forEach(p => p.flip());
        if (node.plane) node.plane.flip();
        const t = node.front; node.front = node.back; node.back = t;
        if (node.front) stack.push(node.front);
        if (node.back) stack.push(node.back);
      }
    }
    clipPolygons(polygons) {
      if (!this.plane) return polygons.slice();
      let front = [], back = [];
      for (const p of polygons) this.plane.splitPolygon(p, front, back, front, back);
      front = this.front ? this.front.clipPolygons(front) : front;
      back = this.back ? this.back.clipPolygons(back) : [];
      return front.concat(back);
    }
    clipTo(bsp) {
      const stack = [this];
      while (stack.length) {
        const node = stack.pop();
        node.polygons = bsp.clipPolygons(node.polygons);
        if (node.front) stack.push(node.front);
        if (node.back) stack.push(node.back);
      }
    }
    allPolygons() {
      let out = [];
      const stack = [this];
      while (stack.length) {
        const node = stack.pop();
        out = out.concat(node.polygons);
        if (node.front) stack.push(node.front);
        if (node.back) stack.push(node.back);
      }
      return out;
    }
    build(polygons) {
      const stack = [[this, polygons]];
      while (stack.length) {
        const [node, polys] = stack.pop();
        if (!polys.length) continue;
        if (!node.plane) node.plane = new Plane({ ...polys[0].plane.n }, polys[0].plane.w);
        const front = [], back = [];
        for (const p of polys) node.plane.splitPolygon(p, node.polygons, node.polygons, front, back);
        if (front.length) { if (!node.front) node.front = new Node(); stack.push([node.front, front]); }
        if (back.length) { if (!node.back) node.back = new Node(); stack.push([node.back, back]); }
      }
    }
  }

  // Mélange déterministe : garde les arbres peu profonds (évite les très longues chaînes)
  function shuffled(list) {
    const a = list.slice();
    let seed = 1234567;
    for (let i = a.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function toPolygons(tris) {
    const out = [];
    tris.forEach(t => {
      const plane = Plane.fromPoints(t[0], t[1], t[2]);
      if (plane) out.push(new Polygon([t[0], t[1], t[2]], plane));
    });
    return out;
  }

  function areaSq(a, b, c) {
    const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
    const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
    const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
    return x * x + y * y + z * z;
  }

  function toTriangles(polys) {
    const out = [];
    polys.forEach(p => {
      const v = p.vertices;
      for (let i = 1; i + 1 < v.length; i++) {
        out.push([
          new THREE.Vector3(v[0].x, v[0].y, v[0].z),
          new THREE.Vector3(v[i].x, v[i].y, v[i].z),
          new THREE.Vector3(v[i + 1].x, v[i + 1].y, v[i + 1].z)
        ]);
      }
    });
    return out;
  }

  /**
   * Répare le résultat de la découpe pour obtenir une surface étanche :
   * 1) soude les sommets quasi confondus, 2) coupe chaque arête aux sommets qui la touchent (jonctions en T).
   */
  function repair(tris) {
    const Q = 1000; // précision de soudure : 0,001 mm
    const canon = new Map();
    const weld = (v) => {
      const k = Math.round(v.x * Q) + ',' + Math.round(v.y * Q) + ',' + Math.round(v.z * Q);
      let c = canon.get(k);
      if (!c) { c = v.clone(); canon.set(k, c); }
      return c;
    };
    let T = tris.map(t => [weld(t[0]), weld(t[1]), weld(t[2])])
      .filter(t => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2]);

    // grille spatiale des sommets
    const verts = Array.from(canon.values());
    if (!verts.length) return T;
    const box = new THREE.Box3().setFromPoints(verts);
    const size = box.getSize(new THREE.Vector3());
    const cell = Math.max(size.x, size.y, size.z, 1) / 24;
    const cellOf = (x, min) => Math.floor((x - min) / cell);
    const grid = new Map();
    verts.forEach(v => {
      const k = cellOf(v.x, box.min.x) + '_' + cellOf(v.y, box.min.y) + '_' + cellOf(v.z, box.min.z);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(v);
    });

    const onEdge = (a, b) => {
      const found = [];
      const lo = new THREE.Vector3(Math.min(a.x, b.x) - 0.01, Math.min(a.y, b.y) - 0.01, Math.min(a.z, b.z) - 0.01);
      const hi = new THREE.Vector3(Math.max(a.x, b.x) + 0.01, Math.max(a.y, b.y) + 0.01, Math.max(a.z, b.z) + 0.01);
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const len2 = dx * dx + dy * dy + dz * dz;
      if (len2 < 1e-12) return found;
      for (let ix = cellOf(lo.x, box.min.x); ix <= cellOf(hi.x, box.min.x); ix++) {
        for (let iy = cellOf(lo.y, box.min.y); iy <= cellOf(hi.y, box.min.y); iy++) {
          for (let iz = cellOf(lo.z, box.min.z); iz <= cellOf(hi.z, box.min.z); iz++) {
            const list = grid.get(ix + '_' + iy + '_' + iz);
            if (!list) continue;
            for (const p of list) {
              if (p === a || p === b) continue;
              const t = ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / len2;
              if (t <= 1e-4 || t >= 1 - 1e-4) continue;
              const ex = a.x + dx * t - p.x, ey = a.y + dy * t - p.y, ez = a.z + dz * t - p.z;
              if (ex * ex + ey * ey + ez * ez < 4e-6) found.push({ p, t });
            }
          }
        }
      }
      found.sort((u, v) => u.t - v.t);
      return found.map(f => f.p);
    };

    const out = [];
    T.forEach(t => {
      const ring = [];
      let extra = 0;
      for (let i = 0; i < 3; i++) {
        const a = t[i], b = t[(i + 1) % 3];
        ring.push(a);
        const mid = onEdge(a, b);
        extra += mid.length;
        mid.forEach(m => ring.push(m));
      }
      if (!extra) { out.push(t); return; }
      // éventail depuis le centre : aucun triangle dégénéré, les arêtes coupées restent identiques côté voisin
      const c = new THREE.Vector3();
      t.forEach(v => c.add(v));
      c.multiplyScalar(1 / 3);
      for (let i = 0; i < ring.length; i++) out.push([c, ring[i], ring[(i + 1) % ring.length]]);
    });
    return out;
  }

  /**
   * A moins B : les deux sont des listes de triangles (surfaces fermées, normales vers l'extérieur).
   * Seuls les triangles de A proches de B passent par l'arbre BSP (rapide, peu de fragments) ;
   * le reste de A est conservé tel quel puis recousu par la réparation.
   */
  function subtract(trisA, trisB, raw) {
    if (!raw && wasm) {
      try {
        const res = manifoldSubtract(trisA, trisB);
        if (res) return res;
      } catch (e) {
        console.warn('Manifold indisponible pour cette forme, découpe de secours', e);
      }
    }
    const boxB = boxOf(trisB);
    const ext = boxB.getSize(new THREE.Vector3());
    boxB.expandByScalar(Math.max(2, Math.max(ext.x, ext.y, ext.z) * 0.25));
    const near = [], far = [];
    const tb = new THREE.Box3();
    trisA.forEach(t => {
      tb.makeEmpty();
      t.forEach(v => tb.expandByPoint(v));
      (tb.intersectsBox(boxB) ? near : far).push(t);
    });
    if (!near.length) return trisA;

    const a = new Node(shuffled(toPolygons(near)));
    const b = new Node(shuffled(toPolygons(trisB)));
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert();
    b.clipTo(a);
    b.invert();
    a.build(b.allPolygons());
    a.invert();
    const res = far.concat(toTriangles(a.allPolygons()));
    return raw ? res : repair(res);
  }

  // ------------------------------------------------------------------ moteur robuste (manifold-3d, WASM)
  // Chargé en avance dès qu'un trou existe ; si pas prêt ou si une forme n'est pas étanche, on utilise le BSP ci-dessus.
  const MANIFOLD_URL = 'https://cdn.jsdelivr.net/npm/manifold-3d@3.0.1/';
  let wasm = null;
  let loading = null;

  function preload() {
    if (wasm || loading) return loading;
    loading = import(MANIFOLD_URL + 'manifold.js')
      .then(mod => mod.default({ locateFile: f => MANIFOLD_URL + f }))
      .then(w => { w.setup(); wasm = w; })
      .catch(e => { console.warn('manifold-3d non chargé (découpe de secours utilisée)', e); loading = null; });
    return loading;
  }

  function toManifold(tris) {
    const Q = 1000;
    const index = new Map();
    const verts = [];
    const idx = [];
    const id = v => {
      const k = Math.round(v.x * Q) + ',' + Math.round(v.y * Q) + ',' + Math.round(v.z * Q);
      let i = index.get(k);
      if (i === undefined) { i = verts.length / 3; index.set(k, i); verts.push(v.x, v.y, v.z); }
      return i;
    };
    tris.forEach(t => {
      const a = id(t[0]), b = id(t[1]), c = id(t[2]);
      if (a !== b && b !== c && a !== c) idx.push(a, b, c);
    });
    const mesh = new wasm.Mesh({ numProp: 3, vertProperties: new Float32Array(verts), triVerts: new Uint32Array(idx) });
    mesh.merge();
    return new wasm.Manifold(mesh); // lève une erreur si la forme n'est pas étanche
  }

  function manifoldSubtract(trisA, trisB) {
    let a = null, b = null, r = null;
    try {
      a = toManifold(trisA);
      b = toManifold(trisB);
      r = a.subtract(b);
      const m = r.getMesh();
      const np = m.numProp, vp = m.vertProperties, tv = m.triVerts;
      const out = [];
      const vec = i => new THREE.Vector3(vp[i * np], vp[i * np + 1], vp[i * np + 2]);
      for (let i = 0; i < tv.length; i += 3) out.push([vec(tv[i]), vec(tv[i + 1]), vec(tv[i + 2])]);
      return out;
    } finally {
      [a, b, r].forEach(o => { if (o && o.delete) o.delete(); });
    }
  }

  /**
   * Pour l'aperçu : A moins plusieurs trous, résultat indexé (sommets partagés, ombrage lisse).
   * Renvoie null si le moteur n'est pas prêt ou si une forme n'est pas étanche.
   */
  function carveIndexed(trisA, cutterList) {
    if (!wasm) return null;
    const made = [];
    try {
      let cur = toManifold(trisA);
      made.push(cur);
      cutterList.forEach(c => {
        const b = toManifold(c);
        made.push(b);
        const r = cur.subtract(b);
        made.push(r);
        cur = r;
      });
      const m = cur.getMesh();
      const np = m.numProp;
      const n = m.vertProperties.length / np;
      const positions = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        positions[i * 3] = m.vertProperties[i * np];
        positions[i * 3 + 1] = m.vertProperties[i * np + 1];
        positions[i * 3 + 2] = m.vertProperties[i * np + 2];
      }
      return { positions, indices: new Uint32Array(m.triVerts) };
    } catch (e) {
      return null;
    } finally {
      made.forEach(o => { if (o && o.delete) o.delete(); });
    }
  }

  /**
   * Normales « à angle de pli » : une arête dont les deux faces forment moins de `creaseDeg` degrés est lissée
   * (surfaces courbes), au-delà elle reste vive (bord d'un trou, coins d'un cube). Pondération par l'angle au sommet.
   * Renvoie des sommets non partagés { positions, normals } prêts pour un BufferGeometry sans index.
   */
  function creaseNormals(pos, idx, creaseDeg) {
    const T = idx.length / 3;
    const fn = new Float32Array(T * 3);
    const ok = new Uint8Array(T);
    const ang = new Float32Array(T * 3); // angle de chaque coin
    const P = i => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const len = a => Math.hypot(a[0], a[1], a[2]);
    for (let t = 0; t < T; t++) {
      const a = P(idx[t * 3]), b = P(idx[t * 3 + 1]), c = P(idx[t * 3 + 2]);
      const e1 = sub(b, a), e2 = sub(c, a);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const l = len(n);
      if (l < 1e-9) continue;
      ok[t] = 1;
      fn[t * 3] = n[0] / l; fn[t * 3 + 1] = n[1] / l; fn[t * 3 + 2] = n[2] / l;
      const corner = (p, q, r) => {
        const u = sub(q, p), v = sub(r, p);
        const d = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (len(u) * len(v) || 1);
        return Math.acos(Math.max(-1, Math.min(1, d)));
      };
      ang[t * 3] = corner(a, b, c);
      ang[t * 3 + 1] = corner(b, c, a);
      ang[t * 3 + 2] = corner(c, a, b);
    }
    // triangles incidents par sommet
    const nv = pos.length / 3;
    const start = new Uint32Array(nv + 1);
    for (let i = 0; i < idx.length; i++) start[idx[i] + 1]++;
    for (let i = 0; i < nv; i++) start[i + 1] += start[i];
    const fill = start.slice(0, nv);
    const inc = new Uint32Array(idx.length);
    for (let i = 0; i < idx.length; i++) inc[fill[idx[i]]++] = i; // i = coin (triangle*3 + k)

    const cosC = Math.cos(creaseDeg * Math.PI / 180);
    let count = 0;
    for (let t = 0; t < T; t++) if (ok[t]) count++;
    const positions = new Float32Array(count * 9);
    const normals = new Float32Array(count * 9);
    let o = 0;
    for (let t = 0; t < T; t++) {
      if (!ok[t]) continue;
      for (let k = 0; k < 3; k++) {
        const v = idx[t * 3 + k];
        let nx = 0, ny = 0, nz = 0;
        for (let j = start[v]; j < start[v + 1]; j++) {
          const corner = inc[j];
          const u = (corner / 3) | 0;
          if (!ok[u]) continue;
          const d = fn[t * 3] * fn[u * 3] + fn[t * 3 + 1] * fn[u * 3 + 1] + fn[t * 3 + 2] * fn[u * 3 + 2];
          if (u !== t && d < cosC) continue;
          const w = ang[corner];
          nx += fn[u * 3] * w; ny += fn[u * 3 + 1] * w; nz += fn[u * 3 + 2] * w;
        }
        let l = Math.hypot(nx, ny, nz);
        if (l < 1e-9) { nx = fn[t * 3]; ny = fn[t * 3 + 1]; nz = fn[t * 3 + 2]; l = 1; }
        positions[o] = pos[v * 3]; positions[o + 1] = pos[v * 3 + 1]; positions[o + 2] = pos[v * 3 + 2];
        normals[o] = nx / l; normals[o + 1] = ny / l; normals[o + 2] = nz / l;
        o += 3;
      }
    }
    return { positions, normals };
  }

  function boxOf(tris) {
    const box = new THREE.Box3();
    tris.forEach(t => t.forEach(v => box.expandByPoint(v)));
    return box;
  }

  return { subtract, carveIndexed, creaseNormals, boxOf, preload, isReady: () => !!wasm };
})();

window.CSGLib = CSGLib;
