/**
 * Kidi3D - Générateur de Maillages 3D 100% MANIFOLD V4
 * Tous les tampons complets (Œil simple, Deux yeux, Oreille, Nez, Ailes, Étoile, Chapeau, Roue, etc.)
 * Biseaux systématiques et orientation perpendiculaire stricte
 */

class MeshGenerator {
  // Enfoncement (mm) d'une forme posée sur une autre : assure un recouvrement pour l'impression 3D
  static get SURFACE_SINK() { return 1.5; }

  /**
   * Boîte avec biseau doux sur tous les angles saillants (100% Manifold)
   */
  static createBeveledBoxGeometry(width, height, depth, bevel = 1.5) {
    const b = Math.min(bevel, width * 0.2, height * 0.2, depth * 0.2);
    const shape = new THREE.Shape();
    const w2 = width / 2;
    const h2 = height / 2;

    shape.moveTo(-w2 + b, -h2);
    shape.lineTo(w2 - b, -h2);
    shape.quadraticCurveTo(w2, -h2, w2, -h2 + b);
    shape.lineTo(w2, h2 - b);
    shape.quadraticCurveTo(w2, h2, w2 - b, h2);
    shape.lineTo(-w2 + b, h2);
    shape.quadraticCurveTo(-w2, h2, -w2, h2 - b);
    shape.lineTo(-w2, -h2 + b);
    shape.quadraticCurveTo(-w2, -h2, -w2 + b, -h2);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth - b * 2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: b,
      bevelThickness: b
    });
    geo.center();
    return geo;
  }

  /**
   * Cylindre avec biseaux arrondis sur les arêtes supérieure et inférieure.
   * 100% Manifold, étanche et prêt pour subdivision sans arête à 90°.
   */
  static createBeveledCylinderGeometry(radius, height, bevel = null, radialSegments = 24) {
    const r = Math.max(0.5, radius);
    const h = Math.max(1.0, height);
    const b = bevel !== null ? bevel : Math.min(r * 0.22, h * 0.15, 2.5);
    const safeB = Math.max(0.08, Math.min(b, r * 0.45, h * 0.45));

    const profile = [];
    profile.push(new THREE.Vector2(0, 0));
    profile.push(new THREE.Vector2(r - safeB, 0));

    const bevelSteps = radialSegments >= 20 ? 3 : 2;
    for (let i = 1; i <= bevelSteps; i++) {
      const angle = (i / bevelSteps) * (Math.PI / 2);
      const px = (r - safeB) + safeB * Math.sin(angle);
      const py = safeB - safeB * Math.cos(angle);
      profile.push(new THREE.Vector2(px, py));
    }

    if (h > safeB * 2 + 0.05) {
      profile.push(new THREE.Vector2(r, h - safeB));
    }

    for (let i = 1; i <= bevelSteps; i++) {
      const angle = (i / bevelSteps) * (Math.PI / 2);
      const px = r - safeB * (1 - Math.cos(angle));
      const py = (h - safeB) + safeB * Math.sin(angle);
      profile.push(new THREE.Vector2(px, py));
    }

    profile.push(new THREE.Vector2(r - safeB, h));
    profile.push(new THREE.Vector2(0, h));

    const geo = new THREE.LatheGeometry(profile, radialSegments);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Cône avec base biseautée et pointe arrondie (Apex dôme).
   * Élimine l'apex infiniment pointu et l'arête circulaire tranchante de base.
   */
  static createBeveledConeGeometry(radius, height, bevel = null, radialSegments = 24) {
    const r = Math.max(0.5, radius);
    const h = Math.max(1.0, height);
    const bBase = bevel !== null ? bevel : Math.min(r * 0.2, h * 0.15, 2.0);
    const safeB = Math.max(0.08, Math.min(bBase, r * 0.4, h * 0.35));
    const tipRadius = Math.max(0.2, Math.min(r * 0.15, 1.2));

    const profile = [];
    profile.push(new THREE.Vector2(0, 0));
    profile.push(new THREE.Vector2(r - safeB, 0));

    const bevelSteps = radialSegments >= 20 ? 3 : 2;
    for (let i = 1; i <= bevelSteps; i++) {
      const angle = (i / bevelSteps) * (Math.PI / 2);
      const px = (r - safeB) + safeB * Math.sin(angle);
      const py = safeB - safeB * Math.cos(angle);
      profile.push(new THREE.Vector2(px, py));
    }

    const tipY = h - tipRadius;
    profile.push(new THREE.Vector2(tipRadius, tipY));

    for (let i = 1; i <= bevelSteps; i++) {
      const angle = (i / bevelSteps) * (Math.PI / 2);
      const px = tipRadius * Math.cos(angle);
      const py = tipY + tipRadius * Math.sin(angle);
      profile.push(new THREE.Vector2(px, py));
    }

    profile.push(new THREE.Vector2(0, h));

    const geo = new THREE.LatheGeometry(profile, radialSegments);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * Rééchantillonnage régulier d'un contour 2D fermé par longueur d'arc constante.
   * Élimine les micro-triangles et les densités parasites sur les côtés des ballons.
   */
  static resampleClosedPolygon2D(points2D, targetCount = 32) {
    if (!points2D || points2D.length < 3) return points2D;

    const pts = points2D.map(p => new THREE.Vector2(p.x, p.y));
    if (pts[0].distanceTo(pts[pts.length - 1]) > 0.001) {
      pts.push(pts[0].clone());
    }

    const cumLengths = [0];
    let totalLen = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      totalLen += pts[i].distanceTo(pts[i + 1]);
      cumLengths.push(totalLen);
    }

    if (totalLen < 1e-4) return points2D;

    const resampled = [];
    const step = totalLen / targetCount;

    for (let k = 0; k < targetCount; k++) {
      const targetDist = k * step;
      let segIdx = 0;
      while (segIdx < cumLengths.length - 1 && cumLengths[segIdx + 1] < targetDist) {
        segIdx++;
      }

      const p0 = pts[segIdx];
      const p1 = pts[segIdx + 1] || pts[segIdx];
      const d0 = cumLengths[segIdx];
      const d1 = cumLengths[segIdx + 1] || totalLen;
      const segLen = d1 - d0;
      const t = segLen > 1e-5 ? (targetDist - d0) / segLen : 0;

      resampled.push(new THREE.Vector2(
        p0.x + (p1.x - p0.x) * t,
        p0.y + (p1.y - p0.y) * t
      ));
    }

    return resampled;
  }

  /**
   * Tube boudin 3D rigoureusement 2-MANIFOLD fermé à topologie régulière (Subdivision-Ready)
   * Utilise le Parallel Transport (Rotation Minimizing Frames) pour éliminer tout vrillage,
   * et un échantillonnage régulier par longueur d'arc pour des quads réguliers.
   */
  static createTubeGeometry(points3D, radius = 6, options = {}) {
    if (!points3D || points3D.length < 2) return null;

    const radialSegments = options.radialSegments || 16;
    const isHighPoly = options.highPoly || false;
    const capRings = isHighPoly ? 5 : 3;

    // Filtrer les points consécutifs trop rapprochés
    const cleaned = [points3D[0]];
    for (let i = 1; i < points3D.length; i++) {
      if (points3D[i].distanceTo(cleaned[cleaned.length - 1]) > 0.8) {
        cleaned.push(points3D[i]);
      }
    }

    if (cleaned.length < 2) {
      // Point quasi-unique : générer une sphère parfaite 100% manifold
      return new THREE.SphereGeometry(radius, radialSegments, Math.max(8, Math.round(radialSegments * 0.75)));
    }

    // Courbe Catmull-Rom centripète (évite les boucles internes dans les virages)
    const curve = new THREE.CatmullRomCurve3(cleaned, false, 'centripetal');
    const totalLength = curve.getLength();

    // Si la courbe est microscopique, faire une sphère
    if (totalLength < radius * 0.4) {
      return new THREE.SphereGeometry(radius, radialSegments, Math.max(8, Math.round(radialSegments * 0.75)));
    }

    // Échantillonnage régulier par longueur d'arc constante pour une topologie propre
    // Distance entre anneaux équivalente au rayon pour des quads carrés prêts pour subdivision
    const targetSegmentLength = isHighPoly ? Math.max(radius * 0.35, 2.5) : Math.max(radius * 0.65, 4.0);
    const bodySegments = Math.max(6, Math.round(totalLength / targetSegmentLength));

    // Points équidistants le long de la longueur d'arc
    const spinePoints = curve.getSpacedPoints(bodySegments);

    // Calcul des tangentes unitaires le long de la colonne vertébrale
    const tangentes = [];
    for (let i = 0; i <= bodySegments; i++) {
      if (i === 0) {
        tangentes.push(new THREE.Vector3().subVectors(spinePoints[1], spinePoints[0]).normalize());
      } else if (i === bodySegments) {
        tangentes.push(new THREE.Vector3().subVectors(spinePoints[bodySegments], spinePoints[bodySegments - 1]).normalize());
      } else {
        tangentes.push(new THREE.Vector3().subVectors(spinePoints[i + 1], spinePoints[i - 1]).normalize());
      }
    }

    // Parallel Transport Frames (Bishop / Rotation Minimizing Frames)
    // Garantit 0 torsion et 0 inversion (anti-twist absolu)
    const normals = [];
    const binormals = [];

    // Repère initial
    const t0 = tangentes[0];
    const up = Math.abs(t0.y) < 0.88 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const n0 = new THREE.Vector3().crossVectors(t0, up).normalize();
    const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
    normals.push(n0);
    binormals.push(b0);

    // Propagation le long de la courbe (Double Reflection Method de Wang et al.)
    for (let i = 0; i < bodySegments; i++) {
      const p_i = spinePoints[i];
      const p_next = spinePoints[i + 1];
      const t_i = tangentes[i];
      const t_next = tangentes[i + 1];
      const n_i = normals[i];

      const v1 = new THREE.Vector3().subVectors(p_next, p_i);
      const c1 = v1.dot(v1);

      if (c1 < 1e-8) {
        normals.push(n_i.clone());
        binormals.push(new THREE.Vector3().crossVectors(t_next, n_i).normalize());
        continue;
      }

      // Réflexion 1
      const n_L = n_i.clone().addScaledVector(v1, - (2 / c1) * v1.dot(n_i));
      const t_L = t_i.clone().addScaledVector(v1, - (2 / c1) * v1.dot(t_i));

      // Réflexion 2
      const v2 = new THREE.Vector3().subVectors(t_next, t_L);
      const c2 = v2.dot(v2);

      let n_next;
      if (c2 < 1e-8) {
        n_next = n_L;
      } else {
        n_next = n_L.clone().addScaledVector(v2, - (2 / c2) * v2.dot(n_L));
      }

      n_next.normalize();
      const b_next = new THREE.Vector3().crossVectors(t_next, n_next).normalize();

      normals.push(n_next);
      binormals.push(b_next);
    }

    const positions = [];
    const indices = [];
    const ringVertexIndices = [];

    // Helper pour générer un anneau circulaire
    const addRing = (center, normal, binormal, ringRadius) => {
      const ring = [];
      for (let j = 0; j < radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const vx = center.x + ringRadius * (normal.x * cosT + binormal.x * sinT);
        const vy = center.y + ringRadius * (normal.y * cosT + binormal.y * sinT);
        const vz = center.z + ringRadius * (normal.z * cosT + binormal.z * sinT);
        const idx = positions.length / 3;
        positions.push(vx, vy, vz);
        ring.push(idx);
      }
      ringVertexIndices.push(ring);
      return ring;
    };

    // 1. PÔLE DE DÉPART (Sommet unique de la calotte hémisphérique de début)
    const pStart = spinePoints[0];
    const tStart = tangentes[0];
    const nStart = normals[0];
    const bStart = binormals[0];
    const poleStartPos = pStart.clone().addScaledVector(tStart, -radius);
    const poleStartIdx = positions.length / 3;
    positions.push(poleStartPos.x, poleStartPos.y, poleStartPos.z);

    // Anneaux de la calotte de départ (du pôle vers la base du tube)
    for (let c = 1; c < capRings; c++) {
      const phi = (c / capRings) * (Math.PI / 2); // De 0+ vers PI/2-
      const rRing = radius * Math.sin(phi);
      const hOffset = -radius * Math.cos(phi);
      const cCenter = pStart.clone().addScaledVector(tStart, hOffset);
      addRing(cCenter, nStart, bStart, rRing);
    }

// Rayon constant par défaut ou interpolé si fourni sous forme de tableau
    const radii = options.radii && options.radii.length === points3D.length ? options.radii : null;

    // 2. CORPS DU TUBE (Anneaux réguliers le long de la courbe)
    for (let i = 0; i <= bodySegments; i++) {
      let rCurrent = radius;
      if (radii) {
        const t = i / bodySegments;
        const rawIdx = t * (radii.length - 1);
        const idx0 = Math.floor(rawIdx);
        const idx1 = Math.min(radii.length - 1, idx0 + 1);
        const frac = rawIdx - idx0;
        rCurrent = radii[idx0] * (1 - frac) + radii[idx1] * frac;
      }
      addRing(spinePoints[i], normals[i], binormals[i], rCurrent);
    }

    // 3. CALOTTE DE FIN (De la fin du tube vers le pôle de fin)
    const pEnd = spinePoints[bodySegments];
    const tEnd = tangentes[bodySegments];
    const nEnd = normals[bodySegments];
    const bEnd = binormals[bodySegments];

    for (let c = capRings - 1; c >= 1; c--) {
      const phi = (c / capRings) * (Math.PI / 2);
      const rRing = radius * Math.sin(phi);
      const hOffset = radius * Math.cos(phi);
      const cCenter = pEnd.clone().addScaledVector(tEnd, hOffset);
      addRing(cCenter, nEnd, bEnd, rRing);
    }

    // PÔLE DE FIN (Sommet unique de fin)
    const poleEndPos = pEnd.clone().addScaledVector(tEnd, radius);
    const poleEndIdx = positions.length / 3;
    positions.push(poleEndPos.x, poleEndPos.y, poleEndPos.z);

    // 4. TRIANGULATION RIGOUREUSEMENT 2-MANIFOLD (WINDING STRICT EXTÉRIEUR)
    // Éventail au pôle de départ
    const firstRing = ringVertexIndices[0];
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      // Winding CCW extérieur : pole -> nextJ -> j
      indices.push(poleStartIdx, firstRing[nextJ], firstRing[j]);
    }

    // Quads entre tous les anneaux consécutifs
    for (let r = 0; r < ringVertexIndices.length - 1; r++) {
      const ringA = ringVertexIndices[r];
      const ringB = ringVertexIndices[r + 1];
      for (let j = 0; j < radialSegments; j++) {
        const nextJ = (j + 1) % radialSegments;
        const vA = ringA[j];
        const vA_next = ringA[nextJ];
        const vB = ringB[j];
        const vB_next = ringB[nextJ];

        // Découpage régulier de quad en 2 triangles :
        // Triangle 1 : vA -> vA_next -> vB
        // Triangle 2 : vA_next -> vB_next -> vB
        indices.push(vA, vA_next, vB);
        indices.push(vA_next, vB_next, vB);
      }
    }

    // Éventail au pôle de fin
    const lastRing = ringVertexIndices[ringVertexIndices.length - 1];
    for (let j = 0; j < radialSegments; j++) {
      const nextJ = (j + 1) % radialSegments;
      // Winding CCW extérieur : poleEnd -> j -> nextJ
      indices.push(poleEndIdx, lastRing[j], lastRing[nextJ]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  /**
   * Tube boudin 3D rigoureusement 2-MANIFOLD fermé
   */
  static createTubeMesh(points3D, radius = 6, hexColor = 0xff4757, options = {}) {
    const geometry = this.createTubeGeometry(points3D, radius, options);
    if (!geometry) return null;

    const material = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.35,
      metalness: 0.05
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      type: 'tube',
      color: hexColor,
      points: points3D.map(p => ({ x: p.x, y: p.y, z: p.z })),
      radius: radius
    };
    if (options.radii && options.radii.length === points3D.length) {
      mesh.userData.pointRadii = options.radii.slice();
    }

    return mesh;
  }

  /**
   * Ballon Gonflé : Forme 2D lissée extrudée biseautée (100% Manifold)
   * Rééchantillonnage régulier du contour pour alléger les côtés et éliminer les micro-triangles.
   */
  static createInflatedBlobGeometry(points3D, camera = null, maxThickness = 18, options = {}) {
    if (!points3D || points3D.length < 3) return null;

    const center = new THREE.Vector3();
    points3D.forEach(p => center.add(p));
    center.divideScalar(points3D.length);

    let u, v, normal;
    if (options.basisU && options.basisV && options.basisNormal) {
      u = new THREE.Vector3(options.basisU.x, options.basisU.y, options.basisU.z);
      v = new THREE.Vector3(options.basisV.x, options.basisV.y, options.basisV.z);
      normal = new THREE.Vector3(options.basisNormal.x, options.basisNormal.y, options.basisNormal.z);
    } else {
      normal = new THREE.Vector3();
      if (camera) {
        camera.getWorldDirection(normal).negate();
      } else {
        normal.set(0, 0, 1);
      }
      u = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
      if (u.lengthSq() < 0.001) u.set(1, 0, 0).cross(normal).normalize();
      v = new THREE.Vector3().cross(normal, u).normalize();
    }

    const raw2D = points3D.map(p => {
      const rel = p.clone().sub(center);
      return new THREE.Vector2(rel.dot(u), rel.dot(v));
    });

    // smoothPoints2D renvoie des objets {x, y} simples : on les convertit en vrais Vector2
    const smoothed2D = CurveProcessor.smoothPoints2D(raw2D, options.smoothIterations || 3).map(p => new THREE.Vector2(p.x, p.y));
    if (smoothed2D.length < 3) return null;

    const isSmooth = (options.quality === 'smooth');
    const targetPoints = options.contourSegments || (isSmooth ? 42 : 28);
    const regular2D = this.resampleClosedPolygon2D(smoothed2D, targetPoints);
    if (regular2D.length < 3) return null;

    const shape = new THREE.Shape();
    shape.moveTo(regular2D[0].x, regular2D[0].y);
    for (let i = 1; i < regular2D.length; i++) {
      shape.lineTo(regular2D[i].x, regular2D[i].y);
    }
    shape.closePath();

    const depth = Math.max(14, maxThickness);
    // Arrondi des bords : part de l'épaisseur (de 5 % à 45 %). Par défaut : l'ancien réglage.
    const ratio = options.bevelRatio != null
      ? Math.min(0.45, Math.max(0.05, options.bevelRatio))
      : Math.min(3.5, depth * 0.25) / depth;
    const bevel = depth * ratio;
    // Le contour ne grossit pas quand l'arrondi augmente : la forme garde la taille dessinée
    const bevelOffset = bevel > 3.5 ? -(bevel - 3.5) : 0;
    const bevelSegs = options.bevelSegments || (ratio > 0.3 ? 6 : (isSmooth ? 3 : 2));

    const extrudeSettings = {
      depth: depth - bevel * 2,
      bevelEnabled: true,
      bevelSegments: bevelSegs,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelOffset
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Seule la profondeur est centrée : le contour garde sa position par rapport au centre du tracé
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    geometry.translate(0, 0, -(bb.max.z + bb.min.z) / 2);
    geometry.computeVertexNormals();

    return { geometry, center, u, v, normal, depth };
  }

  /**
   * Matrice qui place la géométrie d'un ballon (repère du tracé) directement dans le monde.
   * Les ballons ont ainsi, comme les tubes, une transformation identité et des points en coordonnées monde.
   */
  static getBlobWorldMatrix(blobData) {
    const m = new THREE.Matrix4().makeBasis(blobData.u, blobData.v, blobData.normal);
    m.setPosition(blobData.center);
    return m;
  }

  static createInflatedBlob(points3D, camera, maxThickness = 18, hexColor = 0xffa502, options = {}) {
    const blobData = this.createInflatedBlobGeometry(points3D, camera, maxThickness, {
      quality: 'subdiv',
      basisU: options.basisU,
      basisV: options.basisV,
      basisNormal: options.basisNormal,
      bevelRatio: options.bevelRatio,
      smoothIterations: options.smoothIterations
    });
    if (!blobData) return null;

    blobData.geometry.applyMatrix4(this.getBlobWorldMatrix(blobData));
    blobData.geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.35,
      metalness: 0.05
    });

    const mesh = new THREE.Mesh(blobData.geometry, material);

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      type: 'balloon',
      frame: 'world',
      color: hexColor,
      points: points3D.map(p => ({ x: p.x, y: p.y, z: p.z })),
      thickness: maxThickness,
      bevelRatio: options.bevelRatio != null ? options.bevelRatio : undefined,
      smoothIterations: options.smoothIterations || undefined,
      basisU: { x: blobData.u.x, y: blobData.u.y, z: blobData.u.z },
      basisV: { x: blobData.v.x, y: blobData.v.y, z: blobData.v.z },
      basisNormal: { x: blobData.normal.x, y: blobData.normal.y, z: blobData.normal.z }
    };

    return mesh;
  }

  /**
   * Piliers droits verticaux avec bases et sommets biseautés (100% Manifold, subdivision-ready)
   */
  static createArchitecturalPillarGeometry(points3D, shapeProfile = 'square', radius = 8, options = {}) {
    if (!points3D || points3D.length < 2) return null;

    let minY = Infinity;
    let maxY = -Infinity;
    let avgX = 0;
    let avgZ = 0;

    points3D.forEach(p => {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      avgX += p.x;
      avgZ += p.z;
    });

    avgX /= points3D.length;
    avgZ /= points3D.length;

    if (minY < 20) minY = 0;
    const height = Math.max(15, maxY - minY);
    const centerY = minY + height / 2;

    const isSmooth = (options.quality === 'smooth');
    const radialSegs = options.radialSegments || (isSmooth ? 28 : 16);
    const bevel = Math.min(1.8, radius * 0.22, height * 0.12);
    let geometry;

    switch (shapeProfile) {
      case 'square': {
        geometry = this.createBeveledBoxGeometry(radius * 2, height, radius * 2, bevel);
        break;
      }
      case 'hexagon': {
        geometry = this.createBeveledCylinderGeometry(radius, height, bevel, 6);
        geometry.translate(0, -height / 2, 0); // centrer en Y pour cohérence
        break;
      }
      case 'wall': {
        geometry = this.createBeveledBoxGeometry(radius * 3.5, height, radius * 1.2, bevel);
        break;
      }
      case 'fluted': {
        geometry = this.createBeveledCylinderGeometry(radius, height, bevel, Math.max(18, radialSegs));
        geometry.translate(0, -height / 2, 0);
        break;
      }
      default: {
        geometry = this.createBeveledCylinderGeometry(radius, height, bevel, radialSegs);
        geometry.translate(0, -height / 2, 0);
        break;
      }
    }

    return { geometry, center: new THREE.Vector3(avgX, centerY, avgZ), height };
  }

  static createArchitecturalPillar(points3D, shapeProfile = 'square', radius = 8, hexColor = 0x747d8c) {
    const pillarData = this.createArchitecturalPillarGeometry(points3D, shapeProfile, radius, { quality: 'subdiv' });
    if (!pillarData) return null;

    const material = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.5,
      metalness: 0.1
    });

    const mesh = new THREE.Mesh(pillarData.geometry, material);
    mesh.position.copy(pillarData.center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
      type: 'pillar',
      profile: shapeProfile,
      color: hexColor,
      points: points3D.map(p => ({ x: p.x, y: p.y, z: p.z })),
      radius: radius
    };

    return mesh;
  }

  /**
   * Retourne la couleur par défaut appropriée pour un type de tampon
   */
  static getDefaultColorForStamp(stampType, fallbackColor = 0xff4757) {
    switch (stampType) {
      case 'heart': return 0xff4757; // Rouge Fraise
      case 'crown': return 0xf1c40f; // Or Royal
      case 'star': return 0xf1c40f;  // Or Étoile
      case 'wings': return 0xdbeafe; // Bleu nuage
      case 'ear': return 0xffb8b8;   // Rose Chair
      case 'nose': return 0xff4757;  // Rouge Nez
      case 'cone_hat': return 0x9b59b6; // Violet
      case 'wheel': return 0x2f3542; // Noir Pneu
      case 'foot': return 0x34495e;  // Chaussure
      case 'hand': return 0xffa502;  // Orange
      case 'mouth': return 0xe11d48; // Rouge bouche
      case 'horns': return 0xf8d9a0; // Beige chaud
      case 'flower': return 0xff6b81; // Pétales roses
      case 'antenna': return 0xef4444; // Boule rouge
      case 'bow': return 0xec4899;   // Nœud rose
      case 'tail': return 0xffa502;  // Queue orange
      case 'cube': return 0x2ed573;  // Vert
      case 'sphere': return 0xec4899; // Rose
      case 'cylinder': return 0x06b6d4; // Cyan
      case 'cone': return 0xef4444;   // Rouge
      case 'torus': return 0xff6b81; // Rose Donut
      case 'pyramid': return 0xf59e0b; // Ambre Doré
      default: return fallbackColor;
    }
  }

  /**
   * Tampons & Formes 3D : le haut (+Y) est aligné avec la normale de surface par défaut.
   * La rotation au clic prolongé permet d'incliner l'objet jusqu'à l'axe opposé à la normale (-N)
   * ainsi que de tourner autour de son axe (yaw).
   */
  /** Œil : globe blanc à moitié enfoncé, iris de la couleur choisie, pupille et petit reflet. */
  static _buildEye(r, irisColor) {
    const g = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12 }));

    const irisGeo = new THREE.SphereGeometry(r * 0.52, 20, 14);
    irisGeo.scale(1, 0.38, 1);
    const iris = new THREE.Mesh(irisGeo, new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.2 }));
    iris.position.y = r * 0.9;

    const pupilGeo = new THREE.SphereGeometry(r * 0.27, 16, 12);
    pupilGeo.scale(1, 0.45, 1);
    const pupil = new THREE.Mesh(pupilGeo, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 }));
    pupil.position.y = r * 1.0;

    const shine = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05 }));
    shine.position.set(-r * 0.14, r * 1.05, r * 0.14);

    g.add(white, iris, pupil, shine);
    return g;
  }

  /** Termine un tampon composé de plusieurs pièces : ombres, orientation sur la surface, données. */
  static _finishStamp(group, stampType, size, color, hitPoint, hitNormal, rotationData, sink) {
    group.traverse(c => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });
    this.orientMeshOnSurface(group, hitPoint, hitNormal, rotationData, sink);
    group.userData = { type: 'stamp', stampType, isGroup: true, size, color };
    return group;
  }

  static createStampMesh(stampType, hitPoint, hitNormal, size = 12, hexColor = null, rotationData = null, sink = 0) {
    let geometry;
    let customMat = null;
    const finalColor = hexColor || this.getDefaultColorForStamp(stampType);

    switch (stampType) {
      // 1. Œil Unique : globe blanc, iris (de la couleur choisie), pupille et reflet
      case 'eye_single': {
        const g = new THREE.Group();
        g.add(this._buildEye(size * 0.5, finalColor));
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 2. Paire d'Yeux Cartoon
      case 'eyes_cartoon': {
        const g = new THREE.Group();
        const left = this._buildEye(size * 0.45, finalColor);
        left.position.x = -size * 0.42;
        const right = this._buildEye(size * 0.45, finalColor);
        right.position.x = size * 0.42;
        g.add(left, right);
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 3. Oreille : ellipsoïde arrondi avec un creux plus foncé à l'intérieur
      case 'ear': {
        const g = new THREE.Group();
        const outerGeo = new THREE.SphereGeometry(1, 24, 18);
        outerGeo.scale(size * 0.42, size * 0.62, size * 0.22);
        const outer = new THREE.Mesh(outerGeo, new THREE.MeshStandardMaterial({ color: 0xffb8b8, roughness: 0.35 }));
        outer.position.y = size * 0.4;
        const innerGeo = new THREE.SphereGeometry(1, 20, 14);
        innerGeo.scale(size * 0.25, size * 0.4, size * 0.1);
        const inner = new THREE.Mesh(innerGeo, new THREE.MeshStandardMaterial({ color: 0xe8788f, roughness: 0.4 }));
        inner.position.set(0, size * 0.45, size * 0.15);
        g.add(outer, inner);
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 4. Nez Cartoon
      case 'nose': {
        geometry = new THREE.SphereGeometry(size * 0.5, 16, 16);
        geometry.scale(1, 1.15, 0.85);
        geometry.translate(0, size * 0.45, 0);
        customMat = new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.2 });
        break;
      }

      // 5. Ailes
      case 'wings': {
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.bezierCurveTo(size * 0.5, size * 0.9, size * 1.5, size * 0.6, size * 1.8, size * 0.1);
        wingShape.bezierCurveTo(size * 1.3, -size * 0.5, size * 0.5, -size * 0.3, 0, 0);
        geometry = new THREE.ExtrudeGeometry(wingShape, {
          depth: size * 0.25,
          bevelEnabled: true,
          bevelSegments: 2,
          bevelSize: 0.6,
          bevelThickness: 0.6
        });
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        geometry.translate(0, -bb.min.y - size * 0.1, -(bb.max.z + bb.min.z) / 2);
        customMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.35 });
        break;
      }

      // 6. Étoile
      case 'star': {
        const starShape = new THREE.Shape();
        const points = 5;
        const outer = size * 0.7;
        const inner = size * 0.35;
        for (let i = 0; i < points * 2; i++) {
          const r = (i % 2 === 0) ? outer : inner;
          const a = (i / points) * Math.PI - Math.PI / 2;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (i === 0) starShape.moveTo(x, y);
          else starShape.lineTo(x, y);
        }
        starShape.closePath();
        geometry = new THREE.ExtrudeGeometry(starShape, {
          depth: size * 0.35,
          bevelEnabled: true,
          bevelSegments: 2,
          bevelSize: 0.8,
          bevelThickness: 0.8
        });
        geometry.rotateX(-Math.PI / 2);
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        geometry.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y - size * 0.12, -(bb.max.z + bb.min.z) / 2);
        customMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.2, metalness: 0.2 });
        break;
      }

      // 7. Chapeau de Sorcier (Pointe arrondie et bord biseauté)
      case 'cone_hat': {
        const hatGroup = new THREE.Group();
        const rimThickness = size * 0.12;
        const rimGeo = this.createBeveledCylinderGeometry(size * 0.85, rimThickness, size * 0.035, 24);
        const coneGeo = this.createBeveledConeGeometry(size * 0.5, size * 1.3, size * 0.06, 20);
        coneGeo.translate(0, rimThickness * 0.7 - size * 0.1, 0);
        rimGeo.translate(0, -size * 0.1, 0); // chapeau enfoncé dans la surface

        const hatMat = new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.3 });
        const cone = new THREE.Mesh(coneGeo, hatMat);
        const rim = new THREE.Mesh(rimGeo, hatMat);

        hatGroup.add(rim, cone);
        this.orientMeshOnSurface(hatGroup, hitPoint, hitNormal, rotationData, sink);
        hatGroup.userData = { type: 'stamp', stampType, isGroup: true, size, color: finalColor };
        return hatGroup;
      }

      // 8. Roue (Jante et pneus biseautés)
      case 'wheel': {
        const wRadius = size * 0.65;
        const wThickness = size * 0.4;
        geometry = this.createBeveledCylinderGeometry(wRadius, wThickness, Math.min(wRadius * 0.15, wThickness * 0.2), 24);
        geometry.rotateZ(Math.PI / 2);
        geometry.translate(0, wRadius, 0);
        customMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.4 });
        break;
      }

      // 9. Cœur
      case 'heart': {
        const heartShape = new THREE.Shape();
        const s = size * 0.05;
        heartShape.moveTo(0, s * 5);
        heartShape.bezierCurveTo(s * 5, s * 10, s * 10, s * 7, s * 10, s * 3);
        heartShape.bezierCurveTo(s * 10, -s * 2, s * 5, -s * 6, 0, -s * 10);
        heartShape.bezierCurveTo(-s * 5, -s * 6, -s * 10, -s * 2, -s * 10, s * 3);
        heartShape.bezierCurveTo(-s * 10, s * 7, -s * 5, s * 10, 0, s * 5);

        geometry = new THREE.ExtrudeGeometry(heartShape, {
          depth: size * 0.4,
          bevelEnabled: true,
          bevelSegments: 3,
          steps: 1,
          bevelSize: size * 0.12,
          bevelThickness: size * 0.12
        });
        geometry.rotateX(-Math.PI / 2);
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        geometry.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y - size * 0.12, -(bb.max.z + bb.min.z) / 2);
        customMat = new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.25 });
        break;
      }

      // 10. Couronne (pointes vers le haut +Y) avec trois pierres, légèrement enfoncée dans la surface
      case 'crown': {
        const embed = size * 0.14;
        const crownShape = new THREE.Shape();
        const cr = size * 0.6;
        const pts = 5;
        crownShape.moveTo(-cr, 0);
        crownShape.lineTo(cr, 0);
        crownShape.lineTo(cr, size * 0.25);
        for (let i = pts; i >= 0; i--) {
          const x = -cr + (i / pts) * (cr * 2);
          const y = (i % 2 === 0) ? size * 0.9 : size * 0.35;
          crownShape.lineTo(x, y);
        }
        crownShape.closePath();

        const crownGeo = new THREE.ExtrudeGeometry(crownShape, {
          depth: size * 0.4,
          bevelEnabled: true,
          bevelSegments: 2,
          bevelSize: 0.8,
          bevelThickness: 0.8
        });
        crownGeo.computeBoundingBox();
        const bb = crownGeo.boundingBox;
        crownGeo.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y - embed, -(bb.max.z + bb.min.z) / 2);

        const g = new THREE.Group();
        g.add(new THREE.Mesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.3, metalness: 0.15 })));

        const gemColors = [0xef4444, 0x3b82f6, 0x22c55e];
        [0, 2, 4].forEach((i, k) => {
          const gem = new THREE.Mesh(
            new THREE.SphereGeometry(size * 0.085, 14, 10),
            new THREE.MeshStandardMaterial({ color: gemColors[k], roughness: 0.2 })
          );
          gem.position.set(-cr + (i / pts) * (cr * 2), size * 0.9 - size * 0.02 - bb.min.y - embed, 0);
          g.add(gem);
        });
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 11. Main : paume enfoncée dans la surface, quatre doigts arrondis et un pouce
      case 'hand': {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: finalColor, roughness: 0.35 });

        const palmGeo = this.createBeveledBoxGeometry(size * 0.8, size * 0.8, size * 0.35, 1.2);
        palmGeo.translate(0, size * 0.28, 0); // de -0,12 à +0,68 : la base est sous la surface
        g.add(new THREE.Mesh(palmGeo, mat));

        const fRadius = size * 0.12;
        const fHeight = size * 0.46;
        [-1.5, -0.5, 0.5, 1.5].forEach((k, idx) => {
          const h = fHeight * (idx === 1 || idx === 2 ? 1.12 : 0.95); // doigts du milieu un peu plus longs
          const finger = new THREE.Mesh(this.createBeveledCylinderGeometry(fRadius, h, fRadius * 0.4, 12), mat);
          finger.position.set(k * size * 0.22, size * 0.6, 0);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(fRadius * 0.98, 12, 9), mat);
          tip.position.set(k * size * 0.22, size * 0.6 + h, 0);
          g.add(finger, tip);
        });

        const thumbLen = size * 0.36;
        const tilt = Math.PI / 3.2;
        const thumb = new THREE.Mesh(this.createBeveledCylinderGeometry(fRadius * 1.1, thumbLen, fRadius * 0.4, 12), mat);
        thumb.position.set(-size * 0.4, size * 0.2, 0);
        thumb.rotation.z = tilt;
        const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(fRadius * 1.08, 12, 9), mat);
        thumbTip.position.set(-size * 0.4 - Math.sin(tilt) * thumbLen, size * 0.2 + Math.cos(tilt) * thumbLen, 0);
        g.add(thumb, thumbTip);
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 12. Chaussure : semelle claire à moitié enfoncée, dessus coloré et bout arrondi
      case 'foot': {
        const g = new THREE.Group();
        const sole = new THREE.Mesh(
          this.createBeveledBoxGeometry(size * 0.62, size * 0.2, size * 1.15, 1.0),
          new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 })
        );
        sole.position.set(0, 0, size * 0.2);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.4 });
        const body = new THREE.Mesh(this.createBeveledBoxGeometry(size * 0.56, size * 0.46, size * 0.55, 1.2), bodyMat);
        body.position.set(0, size * 0.2, -size * 0.02);
        const toeGeo = new THREE.SphereGeometry(1, 16, 12);
        toeGeo.scale(size * 0.28, size * 0.25, size * 0.33);
        const toe = new THREE.Mesh(toeGeo, bodyMat);
        toe.position.set(0, size * 0.14, size * 0.5);
        g.add(sole, body, toe);
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 13. Bouche souriante : un seul tube courbe fermé aux deux bouts, à moitié enfoncé
      case 'mouth': {
        const arc = [];
        const r = size * 0.55;
        for (let i = 0; i <= 14; i++) {
          const a = Math.PI * 0.1 + (i / 14) * Math.PI * 0.8;
          arc.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r * 0.7 - r * 0.35));
        }
        const tubeGeo = this.createTubeGeometry(arc, size * 0.085, { radialSegments: 12 });
        const g = new THREE.Group();
        g.add(new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.35 })));
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 14. Cornes : deux cônes arrondis inclinés, chacun prolongé sous la surface par un pied
      case 'horns': {
        const g = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0xf8d9a0, roughness: 0.35 });
        const r = size * 0.2;
        const root = size * 0.32;
        [-1, 1].forEach(side => {
          const horn = new THREE.Group();
          const foot = new THREE.Mesh(this.createBeveledCylinderGeometry(r, root + size * 0.03, size * 0.02, 16), mat);
          foot.position.y = -root; // le pied s'enfonce dans la surface : plus de jour sous la corne
          const cone = new THREE.Mesh(this.createBeveledConeGeometry(r, size * 0.85, size * 0.05, 16), mat);
          horn.add(foot, cone);
          horn.position.set(side * size * 0.38, 0, 0);
          horn.rotation.z = -side * 0.35;
          g.add(horn);
        });
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 15. Fleur : cœur jaune, six pétales aplatis et un pied sous les pétales
      case 'flower': {
        const g = new THREE.Group();
        const petalMat = new THREE.MeshStandardMaterial({ color: finalColor, roughness: 0.35 });
        const foot = new THREE.Mesh(this.createBeveledCylinderGeometry(size * 0.3, size * 0.4, size * 0.03, 18), petalMat);
        foot.position.y = -size * 0.28;
        g.add(foot);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const geo = new THREE.SphereGeometry(1, 14, 10);
          geo.scale(size * 0.2, size * 0.1, size * 0.2);
          const petal = new THREE.Mesh(geo, petalMat);
          petal.position.set(Math.cos(a) * size * 0.34, size * 0.06, Math.sin(a) * size * 0.34);
          g.add(petal);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.35 }));
        heart.position.y = size * 0.1;
        g.add(heart);
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 16. Antenne : tige fine qui s'enfonce dans la surface et boule colorée
      case 'antenna': {
        const g = new THREE.Group();
        const stick = new THREE.Mesh(
          this.createBeveledCylinderGeometry(size * 0.06, size * 1.05, size * 0.02, 12),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 })
        );
        stick.position.y = -size * 0.25;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(size * 0.18, 16, 12), new THREE.MeshStandardMaterial({ color: finalColor, roughness: 0.3 }));
        ball.position.y = size * 0.9;
        g.add(stick, ball);
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // 17. Nœud papillon : UN SEUL maillage fermé (forme extrudée aux bords arrondis), posé à plat
      case 'bow': {
        const k = size * 0.1;      // demi-largeur du centre
        const n = size * 0.1;      // demi-hauteur du centre
        const W = size * 0.62;     // demi-largeur totale
        const H = size * 0.3;      // demi-hauteur au bout des ailes
        const bulge = size * 0.12; // arrondi du bout des ailes
        const bowShape = new THREE.Shape();
        bowShape.moveTo(-k, n);
        bowShape.lineTo(-W, H);
        bowShape.quadraticCurveTo(-W - bulge, 0, -W, -H);
        bowShape.lineTo(-k, -n);
        bowShape.lineTo(k, -n);
        bowShape.lineTo(W, -H);
        bowShape.quadraticCurveTo(W + bulge, 0, W, H);
        bowShape.lineTo(k, n);
        bowShape.closePath();

        geometry = new THREE.ExtrudeGeometry(bowShape, {
          depth: size * 0.14,
          bevelEnabled: true,
          bevelSegments: 3,
          bevelSize: size * 0.05,
          bevelThickness: size * 0.06,
          curveSegments: 10
        });
        geometry.rotateX(-Math.PI / 2); // à plat sur la surface, l'épaisseur vers le haut
        geometry.computeBoundingBox();
        const bb = geometry.boundingBox;
        geometry.translate(-(bb.max.x + bb.min.x) / 2, -bb.min.y - size * 0.1, -(bb.max.z + bb.min.z) / 2);
        customMat = new THREE.MeshStandardMaterial({ color: finalColor, roughness: 0.35 });
        break;
      }

      // 18. Queue : un seul tube qui s'affine en crochet, démarré sous la surface
      case 'tail': {
        const path = [new THREE.Vector3(0, -size * 0.25, 0), new THREE.Vector3(0, -size * 0.1, 0)];
        const radii = [size * 0.16, size * 0.16];
        const turn = size * 0.36;                 // rayon du crochet
        const steps = 12;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const a = t * Math.PI * 0.85;
          path.push(new THREE.Vector3(turn * (1 - Math.cos(a)), turn * Math.sin(a) + size * 0.04, 0));
          radii.push(size * (0.16 - 0.09 * t));   // de plus en plus fine vers le bout
        }
        const tubeGeo = this.createTubeGeometry(path, size * 0.16, { radii, radialSegments: 12 });
        const g = new THREE.Group();
        g.add(new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({ color: finalColor, roughness: 0.35 })));
        return this._finishStamp(g, stampType, size, finalColor, hitPoint, hitNormal, rotationData, sink);
      }

      // Formes géométriques 3D dédiées (Le haut +Y pointe vers l'extérieur de la surface)
      case 'cube': {
        geometry = this.createBeveledBoxGeometry(size * 0.9, size * 0.9, size * 0.9, 1.2);
        geometry.translate(0, (size * 0.9) / 2, 0); // Base sur la surface (Y=0)
        break;
      }
      case 'sphere': {
        geometry = new THREE.SphereGeometry(size * 0.55, 20, 20);
        geometry.translate(0, size * 0.55, 0); // Base tangente à la surface
        break;
      }
      case 'cylinder': {
        const r = size * 0.45;
        const h = size * 1.1;
        geometry = this.createBeveledCylinderGeometry(r, h, Math.min(r * 0.25, 2.0), 24);
        break;
      }
      case 'cone': {
        const r = size * 0.55;
        const h = size * 1.2;
        geometry = this.createBeveledConeGeometry(r, h, Math.min(r * 0.2, 2.0), 24);
        break;
      }
      case 'pyramid': {
        const r = size * 0.65;
        const h = size * 1.2;
        geometry = this.createBeveledConeGeometry(r, h, Math.min(r * 0.2, 2.0), 4);
        geometry.rotateY(Math.PI / 4);
        break;
      }
      case 'torus': {
        geometry = new THREE.TorusGeometry(size * 0.55, size * 0.22, 16, 24);
        geometry.rotateX(Math.PI / 2);
        geometry.translate(0, size * 0.22, 0); // Pose plat sur la surface
        break;
      }
      default: {
        geometry = new THREE.SphereGeometry(size * 0.55, 18, 18);
        geometry.translate(0, size * 0.55, 0);
        break;
      }
    }

    const material = customMat || new THREE.MeshStandardMaterial({
      color: finalColor,
      roughness: 0.35
    });

    const mesh = new THREE.Mesh(geometry, material);
    this.orientMeshOnSurface(mesh, hitPoint, hitNormal, rotationData, sink);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type: 'stamp', stampType, color: finalColor, size };
    return mesh;
  }

  /**
   * Oriente un objet de sorte que son haut (+Y) soit aligné avec la normale de surface.
   * Si une rotation est fournie :
   * - rotationData sous forme d'objet { pitch, tiltAxis, yaw } permet d'incliner l'objet
   *   depuis l'axe de la normale (0°) jusqu'à l'axe opposé à la normale (-N, 180°),
   *   ainsi que de tourner autour de son propre axe (yaw).
   * - rotationData sous forme de nombre (radians) tourne autour de la normale.
   */
  static orientMeshOnSurface(mesh, hitPoint, hitNormal, rotationData = null, sink = 0) {
    const normal = hitNormal.clone().normalize();
    // `sink` : l'objet s'enfonce de quelques mm dans la surface pour que les pièces fusionnent à l'impression
    mesh.position.copy(hitPoint).addScaledVector(normal, -sink);

    const up = new THREE.Vector3(0, 1, 0);
    const baseQuat = new THREE.Quaternion().setFromUnitVectors(up, normal);
    mesh.quaternion.copy(baseQuat);

    if (!rotationData) return;

    if (typeof rotationData === 'number') {
      mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), rotationData);
    } else if (typeof rotationData === 'object') {
      const { pitch, tiltAxis, yaw } = rotationData;

      // 1. Inclinaison vers l'axe opposé à la normale (-N) autour de tiltAxis
      if (pitch && pitch > 0.001 && tiltAxis) {
        const invQuat = mesh.quaternion.clone().invert();
        const localTiltAxis = tiltAxis.clone().applyQuaternion(invQuat).normalize();
        mesh.rotateOnAxis(localTiltAxis, pitch);
      }

      // 2. Rotation autour de son propre axe
      if (yaw && typeof yaw === 'number') {
        mesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), yaw);
      }
    }
  }

  /**
   * Normale d'une face touchée, exprimée dans le monde (et non dans le repère local de l'objet)
   */
  static getWorldNormal(hit) {
    if (!hit || !hit.face) return new THREE.Vector3(0, 1, 0);
    const nm = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    return hit.face.normal.clone().applyMatrix3(nm).normalize();
  }

  static createPrintBase(allMeshes, padding = 15, thickness = 3.5) {
    if (!allMeshes || allMeshes.length === 0) return null;

    const bbox = new THREE.Box3();
    allMeshes.forEach(m => bbox.expandByObject(m));

    const width = Math.max(30, (bbox.max.x - bbox.min.x) + padding * 2);
    const depth = Math.max(30, (bbox.max.z - bbox.min.z) + padding * 2);
    const centerX = (bbox.min.x + bbox.max.x) / 2;
    const centerZ = (bbox.min.z + bbox.max.z) / 2;

    const radius = Math.max(width, depth) / 2;
    const geo = new THREE.CylinderGeometry(radius - 1, radius, thickness, 32);
    geo.translate(centerX, thickness / 2, centerZ);

    const mat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.6
    });

    const baseMesh = new THREE.Mesh(geo, mat);
    baseMesh.userData = { type: 'base', isPrintRaft: true };
    baseMesh.receiveShadow = true;
    return baseMesh;
  }
}

window.MeshGenerator = MeshGenerator;
