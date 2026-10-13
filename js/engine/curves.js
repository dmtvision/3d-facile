/**
 * Kidi3D - Moteur de Traitement des Courbes & Détection Gestuelle
 * Lissage adapté aux enfants (anti-tremblement) et projection 2D -> 3D sans étirement axial
 */

class CurveProcessor {
  /**
   * Échantillonne et filtre les points pour éviter la surabondance de sommets
   */
  static filterPoints(points2D, minDistance = 8) {
    if (points2D.length < 2) return points2D;

    const filtered = [points2D[0]];
    let lastPt = points2D[0];

    for (let i = 1; i < points2D.length; i++) {
      const pt = points2D[i];
      const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
      if (dist >= minDistance) {
        filtered.push(pt);
        lastPt = pt;
      }
    }

    const finalPt = points2D[points2D.length - 1];
    if (filtered[filtered.length - 1] !== finalPt) {
      filtered.push(finalPt);
    }

    return filtered;
  }

  /**
   * Lissage par algorithme de Chaikin pour adoucir le trait des enfants
   */
  static smoothPoints2D(points, iterations = 3) {
    if (points.length <= 2) return points;

    let current = [...points];

    for (let it = 0; it < iterations; it++) {
      const smoothed = [];
      smoothed.push(current[0]);

      for (let i = 0; i < current.length - 1; i++) {
        const p0 = current[i];
        const p1 = current[i + 1];

        const q = {
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y
        };
        const r = {
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y
        };

        smoothed.push(q);
        smoothed.push(r);
      }

      smoothed.push(current[current.length - 1]);
      current = smoothed;
    }

    return current;
  }

  /**
   * Détecte si un contour est fermé (boucle fermée pour faire un ballon gonflé)
   */
  static isClosedLoop(points2D, maxClosingDistance = 55) {
    if (points2D.length < 6) return false;

    const first = points2D[0];
    const last = points2D[points2D.length - 1];
    const dist = Math.hypot(last.x - first.x, last.y - first.y);

    let totalLength = 0;
    for (let i = 0; i < points2D.length - 1; i++) {
      totalLength += Math.hypot(points2D[i + 1].x - points2D[i].x, points2D[i + 1].y - points2D[i].y);
    }

    return (dist <= maxClosingDistance || dist < totalLength * 0.22) && totalLength > 70;
  }

  /**
   * Projette une liste de points 2D d'écran dans l'espace 3D.
   * FIX CRITIQUE : Ancre le plan de dessin au premier point (touchant un objet ou plan médian)
   * et projette TOUS les points suivants sur ce MÊME plan de dessin pour éviter tout étirement
   * disproportionné dans l'axe de la caméra !
   */
  static unprojectPoints(points2D, camera, scene, existingMeshes, defaultPlane, screenWidth, screenHeight, options = {}) {
    if (!points2D || points2D.length === 0) return [];

    const raycaster = new THREE.Raycaster();
    const points3D = [];

    // Direction normale de vue vers la caméra
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir).negate();

    // 1. Choisir la profondeur du trait à partir du premier point : « là où je pointe ».
    //    Ordre de priorité : une forme touchée > une forme proche à l'écran > le plateau > le centre de la scène.
    const start = points2D[0];
    const ndcStart = new THREE.Vector2((start.x / screenWidth) * 2 - 1, -(start.y / screenHeight) * 2 + 1);
    raycaster.setFromCamera(ndcStart, camera);

    let anchorPoint = null;
    const initialHits = raycaster.intersectObjects(existingMeshes, true);

    if (initialHits.length > 0) {
      // Ancrage à la surface de l'objet cliqué
      anchorPoint = initialHits[0].point;
    }

    // Une forme proche du doigt (à moins de ~60 px de son contour à l'écran) : le trait se place à sa profondeur,
    // pour qu'une corne, un bras ou une antenne dessinés à côté d'une forme y restent bien attachés
    if (!anchorPoint && existingMeshes.length) {
      const margin = options.snapMargin != null ? options.snapMargin : 60;
      let best = null;
      existingMeshes.forEach(m => {
        const box = new THREE.Box3().setFromObject(m);
        if (box.isEmpty()) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const v = new THREE.Vector3(x, y, z).project(camera);
              const sx = (v.x * 0.5 + 0.5) * screenWidth;
              const sy = (-v.y * 0.5 + 0.5) * screenHeight;
              minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
              minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
            }
          }
        }
        const dx = Math.max(minX - start.x, 0, start.x - maxX);
        const dy = Math.max(minY - start.y, 0, start.y - maxY);
        const d = Math.hypot(dx, dy);
        if (d <= margin && (!best || d < best.d)) best = { d, center: box.getCenter(new THREE.Vector3()) };
      });
      if (best) anchorPoint = best.center;
    }

    // Le doigt pointe le plateau : le trait démarre au sol, à cet endroit précis
    if (!anchorPoint && options.bedRadius) {
      const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const g = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(ground, g) && g.x * g.x + g.z * g.z <= options.bedRadius * options.bedRadius) {
        anchorPoint = g;
      }
    }

    // Sinon : plan passant par le centre de la création (ou de la scène si elle est vide)
    if (!anchorPoint) {
      anchorPoint = options.contentCenter ? options.contentCenter.clone() : new THREE.Vector3(0, 40, 0);
    }
    const drawingPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, anchorPoint);

    // 2. Projeter TOUS les points sur ce plan cohérent
    for (let i = 0; i < points2D.length; i++) {
      const p2 = points2D[i];
      const ndc = new THREE.Vector2(
        (p2.x / screenWidth) * 2 - 1,
        -(p2.y / screenHeight) * 2 + 1
      );

      raycaster.setFromCamera(ndc, camera);

      const targetPt = new THREE.Vector3();
      const intersected = raycaster.ray.intersectPlane(drawingPlane, targetPt);

      if (intersected) {
        points3D.push(targetPt);
      } else {
        const fallbackPt = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera);
        points3D.push(fallbackPt);
      }
    }

    return points3D;
  }
}

window.CurveProcessor = CurveProcessor;
