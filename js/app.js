/**
 * Kidi3D - Application Principale V4
 * Maintien de la couleur active (pas de changement intempestif),
 * Couleurs thématiques pour tampons, rotation fluide au clic prolongé.
 */

class Kidi3DApp {
  constructor() {
    this.sceneManager = null;
    this.cameraController = null;
    this.orientationGizmo = null;
    this.teacherController = null;
    this.editManager = null;

    // Proportions (largeur / hauteur / profondeur) appliquées à la prochaine forme 3D posée
    this.placementScale = { x: 1, y: 1, z: 1 };
    this.placementScaleLocked = true;
    this.workScale = 1;        // échelle de l'espace de création (réglage enseignant)
    this.balloonOpts = { depth: null, bevelRatio: null, smooth: null }; // réglages du prochain ballon (null = automatique)
    this.lastBedScene = 0;

    // Outils & Couleurs : couleur active stable
    this.currentTool = 'tube';
    this.currentColor = 0xff4757;
    this.currentThickness = 20; // valeur du curseur « Taille » (mm)

    this.activeStamp = 'eye_single'; // Œil simple par défaut
    this.activePillarProfile = 'square';
    this.hasAutoBase = false;
    this.baseMesh = null;

    // Fantôme de pose (Ghost Preview) & Rotation au clic prolongé
    this.stampGhostMesh = null;
    this.isPlacingStamp = false;
    this.stampHitPoint = null;
    this.stampHitNormal = null;
    this.stampHitOnObject = false;
    this.selectionThicknessActive = false;
    this.savedDrawThickness = 20;
    this.stampRotation = 0;
    this.stampStartPointerX = 0;
    this.stampStartPointerY = 0;

    // Tracé en cours
    this.isDrawing = false;
    this.rawPoints = [];
    this.overlayCanvas = null;
    this.overlayCtx = null;

    // Historique Undo / Redo
    this.historyStack = [];
    this.redoStack = [];

    // Maillages créés
    this.userMeshes = [];

    // Miroir (symétrie gauche/droite) & gomme
    this.mirrorMode = false;
    this.mirrorGuide = null;
    this.hoverEraseMesh = null;

    // Gestes tactiles à deux doigts
    this.touchPts = new Map();
    this.touchGesture = null;
    this.touchSuppressed = false;

    this.init();
  }

  init() {
    this.sceneManager = new SceneManager('canvas-container');
    this.cameraController = new KidCameraController(this.sceneManager.camera);
    this.orientationGizmo = new OrientationGizmo(this.cameraController, 'gizmo-container');
    this.teacherController = new TeacherController(this);
    this.editManager = new EditModeManager(this);
    this.booleanPreview = new BooleanPreview(this);
    this.keyTransform = new KeyTransform(this);
    this.booleanPreview.setEnabled(this.teacherController.settings.booleanPreview !== false);

    this.setupDrawingOverlay();
    this.bindUI();
    this.loadAutoSave();
    this.applyUIScale();
    this.watchLayoutChanges();
    this.setupMoveAll();
    this.updateHistoryButtons();
    this.overlayCanvas.className = 'tool-tube';
    this.updateHintText();
    this.animate();

    this.showToast('Bienvenue dans ton atelier Kidi3D !');
  }

  setupDrawingOverlay() {
    this.overlayCanvas = document.getElementById('draw-overlay');
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    const resizeOverlay = () => {
      this.overlayCanvas.width = window.innerWidth;
      this.overlayCanvas.height = window.innerHeight;
    };

    resizeOverlay();
    window.addEventListener('resize', resizeOverlay);

    // Contrôles souris
    this.overlayCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraController.onWheel(e.deltaY);
    }, { passive: false });

    this.overlayCanvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.overlayCanvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.overlayCanvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
    this.overlayCanvas.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    this.overlayCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.overlayCanvas.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }); // pas de défilement automatique au clic milieu
  }

  // Tactile : deux doigts = pincer pour zoomer, glisser pour tourner la vue (un doigt reste pour dessiner)
  touchPair() {
    const pts = Array.from(this.touchPts.values());
    if (pts.length < 2) return null;
    return {
      dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
      mx: (pts[0].x + pts[1].x) / 2,
      my: (pts[0].y + pts[1].y) / 2
    };
  }

  beginTouchGesture() {
    // Le premier doigt a peut-être déjà commencé un trait ou un déplacement : on l'abandonne
    if (this.isDrawing) { this.isDrawing = false; this.rawPoints = []; this.clearOverlay(); }
    if (this.isPlacingStamp) { this.isPlacingStamp = false; if (this.stampGhostMesh) this.stampGhostMesh.visible = false; }
    if (this.currentTool === 'edit') this.editManager.handlePointerUp();
    this.touchGesture = this.touchPair();
    this.touchSuppressed = true;
  }

  handleTouchMove(e) {
    if (!this.touchPts.has(e.pointerId)) return false;
    this.touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!this.touchGesture) return this.touchSuppressed;
    const now = this.touchPair();
    if (!now) return true;
    const cam = this.cameraController;
    cam.targetDistance = Math.max(cam.minDistance, Math.min(cam.maxDistance, cam.targetDistance * (this.touchGesture.dist / now.dist)));
    cam.targetTheta += (now.mx - this.touchGesture.mx) * 0.01;
    cam.targetPhi = Math.max(0.1, Math.min(Math.PI / 2.02, cam.targetPhi - (now.my - this.touchGesture.my) * 0.01));
    this.touchGesture = now;
    return true;
  }

  onPointerDown(e) {
    // Si on clique dans la barre d'édition ou un slider HTML, on ne fait RIEN dans la scène 3D
    if (e.target && e.target.closest('#edit-action-bar')) {
      return;
    }

    if (e.pointerType === 'touch') {
      this.touchPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touchPts.size === 2) { this.beginTouchGesture(); return; }
      if (this.touchPts.size > 2 || this.touchSuppressed) return;
    }

    // Maj + glisser zoome, sauf en mode « Bouger » quand on vise une forme (Maj + clic = sélection multiple)
    const overShape = e.shiftKey && this.currentTool === 'edit' && !!this.getTopLevelMeshAt({ x: e.clientX, y: e.clientY });
    if (this.cameraController.onPointerDown(e, { shiftZoom: !overShape })) {
      this.overlayCanvas.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;
    this.overlayCanvas.setPointerCapture(e.pointerId);

    const pt = { x: e.clientX, y: e.clientY, shift: e.shiftKey };

    // Ctrl + clic sur une forme : on passe en mode « Bouger » et on la sélectionne, quel que soit l'outil
    if (e.ctrlKey && this.currentTool !== 'edit') {
      const target = this.getTopLevelMeshAt(pt);
      if (target) {
        const editBtn = document.querySelector('.magic-tool-btn[data-tool="edit"]');
        if (editBtn) editBtn.click();
        this.editManager.selectMesh(target, e.shiftKey);
      }
      return;
    }

    if (this.currentTool === 'edit') {
      this.editManager.handlePointerDown(pt);
      return;
    }

    if (this.currentTool === 'eraser') {
      this.handleEraser(pt);
      return;
    }

    if (this.currentTool === 'stamp' || this.currentTool === 'shape3d') {
      this.startStampPlacement(pt);
      return;
    }

    // Dessin
    this.isDrawing = true;
    this.rawPoints = [pt];
    this.clearOverlay();
    this.drawStrokeFeedback();
  }

  onPointerMove(e) {
    if (e.pointerType === 'touch' && this.handleTouchMove(e)) return;
    if (this.cameraController.onPointerMove(e)) {
      return;
    }

    const pt = { x: e.clientX, y: e.clientY };

    if (this.currentTool === 'edit') {
      this.editManager.handlePointerMove(pt);
      return;
    }

    if (this.currentTool === 'eraser') {
      this.setEraseHover(this.getTopLevelMeshAt(pt));
      return;
    }

    if (this.currentTool === 'stamp' || this.currentTool === 'shape3d') {
      if (this.isPlacingStamp) {
        // Clic prolongé + glisser : orientation et inclinaison 3D fluide
        const dx = e.clientX - this.stampStartPointerX;
        const dy = e.clientY - this.stampStartPointerY;
        const dist = Math.hypot(dx, dy);

        if (dist > 4) {
          const camera = this.sceneManager.camera;
          const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

          // Direction du déplacement souris dans l'espace 3D
          const worldDrag = new THREE.Vector3()
            .addScaledVector(camRight, dx)
            .addScaledVector(camUp, -dy); // -dy car Y écran pointe vers le bas

          const normal = this.stampHitNormal.clone().normalize();
          // Projection sur le plan tangent à la normale de surface
          const tangent = worldDrag.clone().sub(normal.clone().multiplyScalar(worldDrag.dot(normal)));

          const tiltAxis = new THREE.Vector3();
          if (tangent.lengthSq() > 0.0001) {
            tangent.normalize();
            // L'axe de basculement est orthogonal à la normale et à la direction du drag
            tiltAxis.crossVectors(normal, tangent).normalize();
          } else {
            tiltAxis.crossVectors(normal, new THREE.Vector3(0, 1, 0));
            if (tiltAxis.lengthSq() < 0.001) {
              tiltAxis.crossVectors(normal, new THREE.Vector3(1, 0, 0));
            }
            tiltAxis.normalize();
          }

          // La distance de drag permet d'incliner depuis 0° (normal) jusqu'à 180° (axe opposé à la normale -N)
          const maxDragDist = 120;
          const pitch = Math.min(Math.PI, Math.max(0, ((dist - 4) / maxDragDist) * Math.PI));
          const yaw = Math.atan2(dy, dx);

          this.stampRotation = {
            pitch,
            tiltAxis,
            yaw,
            dist
          };

          this.updateStampGhost(this.stampHitPoint, this.stampRotation, true);
        }
      } else {
        this.updateStampGhost(pt, null, false);
      }
      return;
    }

    if (!this.isDrawing) return;
    this.rawPoints.push(pt);
    this.drawStrokeFeedback();
  }

  onPointerUp(e) {
    if (this.overlayCanvas.hasPointerCapture(e.pointerId)) {
      this.overlayCanvas.releasePointerCapture(e.pointerId);
    }

    if (e.pointerType === 'touch') {
      const wasGesture = this.touchSuppressed;
      this.touchPts.delete(e.pointerId);
      if (this.touchPts.size < 2) this.touchGesture = null;
      if (this.touchPts.size === 0) this.touchSuppressed = false;
      if (wasGesture) return; // le doigt restant ne dessine pas après un geste à deux doigts
    }

    this.cameraController.onPointerUp();

    if (this.currentTool === 'edit') {
      this.editManager.handlePointerUp();
      return;
    }

    if ((this.currentTool === 'stamp' || this.currentTool === 'shape3d') && this.isPlacingStamp) {
      this.finalizeStampPlacement();
      return;
    }

    if (!this.isDrawing) return;
    this.isDrawing = false;

    this.finishDrawing();
    this.clearOverlay();
  }

  drawStrokeFeedback() {
    if (this.rawPoints.length < 2) return;

    this.clearOverlay();
    const ctx = this.overlayCtx;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Épaisseur proche du trait réel : 2 × rayon (mm) converti en pixels à la distance de la caméra
    const cam = this.sceneManager.camera;
    const pxPerMm = window.innerHeight / (2 * this.cameraController.distance * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    ctx.lineWidth = Math.max(4, 2 * this.getStrokeRadius() * pxPerMm);
    ctx.strokeStyle = `#${this.currentColor.toString(16).padStart(6, '0')}`;
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.moveTo(this.rawPoints[0].x, this.rawPoints[0].y);

    for (let i = 1; i < this.rawPoints.length; i++) {
      ctx.lineTo(this.rawPoints[i].x, this.rawPoints[i].y);
    }
    ctx.stroke();

    if (this.currentTool === 'balloon' && CurveProcessor.isClosedLoop(this.rawPoints)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();
    }

    ctx.restore();
  }

  clearOverlay() {
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  // =========================================================================
  // FANTÔME DE POSE & ROTATION AU CLIC PROLONGÉ
  // =========================================================================

  // Les proportions ne concernent que l'outil « Formes » (les tampons gardent leur forme d'origine)
  getPlacementScale() {
    if (this.currentTool !== 'shape3d') return { x: 1, y: 1, z: 1 };
    return this.placementScale;
  }

  applyPlacementScale(mesh) {
    if (!mesh) return;
    const s = this.getPlacementScale();
    mesh.scale.set(s.x, s.y, s.z);
  }

  // Copie complète d'un objet (géométrie partagée, matériaux et données indépendants)
  cloneUserMesh(src) {
    const wasCutter = !!src.userData.cutter;
    if (wasCutter) this.setCutterLook(src, false); // on copie la vraie matière, pas l'aperçu rouge
    const copy = src.clone(true);
    copy.traverse(c => {
      if (c.isMesh && c.material) c.material = c.material.clone();
    });
    copy.userData = JSON.parse(JSON.stringify(src.userData));
    if (wasCutter) {
      this.setCutterLook(src, true);
      this.setCutterLook(copy, true);
    }
    return copy;
  }

  // --- Peinture : la palette colorie directement les formes sélectionnées ---
  colorHexes(mesh) {
    const list = [];
    mesh.traverse(c => { if (c.isMesh && c.material && c.material.color) list.push(c.material.color.getHex()); });
    return list.join(',');
  }

  // Colorie une forme ; renvoie { mesh, changed } (un tampon est reconstruit : seules ses parties « colorables » changent)
  recolorMesh(mesh, hex) {
    const ud = mesh.userData;
    if (ud.type === 'stamp' && ud.isGroup) {
      const before = this.colorHexes(mesh);
      const fresh = MeshGenerator.createStampMesh(ud.stampType, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), ud.size || 12, hex);
      fresh.position.copy(mesh.position);
      fresh.quaternion.copy(mesh.quaternion);
      fresh.scale.copy(mesh.scale);
      if (ud.locked) fresh.userData.locked = true;
      if (this.colorHexes(fresh) !== before) {
        this.removeMeshFromScene(mesh);
        this.addMeshToScene(fresh);
        return { mesh: fresh, changed: true };
      }
      // Ce tampon ignore la couleur choisie : on colorie sa partie principale (le reste garde ses couleurs)
      return { mesh, changed: this.tintStamp(mesh, hex) };
    }
    let changed = false;
    mesh.traverse(c => {
      if (!c.isMesh || !c.material || !c.material.color) return;
      if (c.material.color.getHex() !== hex) changed = true;
      c.material = c.material.clone(); // le matériau peut être partagé avec d'autres formes
      c.material.color.setHex(hex);
    });
    ud.color = hex;
    return { mesh, changed };
  }

  // Colorie la plus grosse pièce d'un tampon (et celles de même couleur) ; mémorisé dans userData.tint
  tintStamp(mesh, hex) {
    let main = null, best = -1;
    const size = new THREE.Vector3();
    mesh.traverse(c => {
      if (!c.isMesh || !c.geometry || !c.material || !c.material.color) return;
      if (!c.geometry.boundingBox) c.geometry.computeBoundingBox();
      c.geometry.boundingBox.getSize(size);
      const vol = size.x * size.y * size.z * Math.abs(c.scale.x * c.scale.y * c.scale.z);
      if (vol > best) { best = vol; main = c; }
    });
    if (!main) return false;
    const base = main.material.color.getHex();
    let changed = false;
    mesh.traverse(c => {
      if (!c.isMesh || !c.material || !c.material.color || c.material.color.getHex() !== base) return;
      if (base !== hex) changed = true;
      c.material = c.material.clone();
      c.material.color.setHex(hex);
    });
    mesh.userData.tint = hex;
    return changed;
  }

  applyColorToSelection(hex) {
    const em = this.editManager;
    if (!em.selection.length) return false;
    const targets = em.getTargets();
    const paintable = targets.filter(m => !m.userData.cutter);
    if (!paintable.length) {
      this.showToast(em.selection.every(m => m.userData.cutter)
        ? "🕳️ Un trou n'a pas de couleur : il est rouge pour le repérer."
        : '🔒 Forme verrouillée : déverrouille-la pour la colorier.');
      return false;
    }
    const results = paintable.map(m => this.recolorMesh(m, hex));
    const kept = em.selection.filter(m => !paintable.includes(m));
    em.setSelection(kept.concat(results.map(r => r.mesh)));
    if (results.some(r => r.changed)) {
      this.saveStateForUndo();
      this.autoSave();
      if (window.soundFx) window.soundFx.playPop();
      this.showToast(paintable.length > 1 ? '🎨 Formes coloriées !' : '🎨 Coloriée !');
    } else {
      this.showToast('🎨 Déjà de cette couleur !');
    }
    return true;
  }

  // Quand on sélectionne une forme, la palette montre sa couleur (si c'est une couleur de la palette)
  syncPaletteToSelection() {
    const em = this.editManager;
    if (em.selection.length !== 1) return;
    const color = em.selectedMesh && em.selectedMesh.userData.color;
    if (typeof color !== 'number') return;
    const hex = '#' + color.toString(16).padStart(6, '0');
    const swatch = document.querySelector(`.color-swatch[data-color="${hex}"]`);
    if (!swatch) return;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    this.currentColor = color;
  }

  // --- Formes « trou » : elles ne s'impriment pas, elles creusent les autres formes à l'export ---
  setCutterLook(mesh, on) {
    mesh.traverse(c => {
      if (!c.isMesh || !c.material) return;
      if (on && !c.__solidMat) {
        c.__solidMat = c.material;
        c.material = new THREE.MeshStandardMaterial({
          color: 0xef4444, roughness: 0.6, transparent: true, opacity: 0.45, depthWrite: false,
          // le fantôme coïncide avec la paroi creusée : on le tire un peu vers la caméra pour éviter le scintillement
          polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -30
        });
        c.renderOrder = 10;
      } else if (!on && c.__solidMat) {
        c.material.dispose();
        c.renderOrder = 0;
        c.material = c.__solidMat;
        c.__solidMat = null;
      }
    });
  }

  setCutter(mesh, on) {
    if (on) { mesh.userData.cutter = true; if (window.CSGLib) CSGLib.preload(); } else delete mesh.userData.cutter;
    this.setCutterLook(mesh, on);
    this.updateBaseIfActive();
  }

  updateStampGhost(targetPtOrCoords, rotation = null, isDirectPoint = false) {
    let point, normal, sink = 0;

    if (isDirectPoint && this.stampHitPoint) {
      point = this.stampHitPoint;
      normal = this.stampHitNormal;
      sink = this.stampHitOnObject ? this.getSink() : 0;
    } else {
      const hit = this.raycastScene(targetPtOrCoords);
      if (!hit) {
        if (this.stampGhostMesh) this.stampGhostMesh.visible = false;
        return;
      }
      point = hit.point;
      normal = hit.normal;
      sink = hit.onObject ? this.getSink() : 0;
    }

    if (!this.stampGhostMesh || this.stampGhostMesh.userData.stampType !== this.activeStamp) {
      this.createStampGhost();
    }

    if (this.stampGhostMesh) {
      this.stampGhostMesh.visible = true;
      MeshGenerator.orientMeshOnSurface(this.stampGhostMesh, point, normal, rotation, sink);
    }
  }

  createStampGhost() {
    if (this.stampGhostMesh) {
      this.sceneManager.scene.remove(this.stampGhostMesh);
      this.stampGhostMesh = null;
    }

    const ghostColor = MeshGenerator.getDefaultColorForStamp(this.activeStamp, this.currentColor);
    const ghost = MeshGenerator.createStampMesh(
      this.activeStamp,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1, 0),
      this.currentThickness * 0.8,
      ghostColor
    );

    if (!ghost) return;

    this.applyPlacementScale(ghost);
    ghost.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.55;
      }
    });

    // Par défaut l'aperçu est posé au centre du plateau : on voit tout de suite l'effet des réglages
    ghost.visible = true;
    ghost.userData.isGhost = true;
    ghost.userData.stampType = this.activeStamp;
    this.sceneManager.scene.add(ghost);
    this.stampGhostMesh = ghost;
  }

  // Recrée l'aperçu en gardant sa position et son orientation (changement de taille ou de couleur)
  refreshStampGhost() {
    if (this.currentTool !== 'stamp' && this.currentTool !== 'shape3d') return;

    const prev = this.stampGhostMesh;
    const prevPos = prev ? prev.position.clone() : null;
    const prevQuat = prev ? prev.quaternion.clone() : null;
    const wasVisible = prev ? prev.visible : true;

    this.createStampGhost();

    if (this.stampGhostMesh && prevPos) {
      this.stampGhostMesh.position.copy(prevPos);
      this.stampGhostMesh.quaternion.copy(prevQuat);
      this.stampGhostMesh.visible = wasVisible;
    }
  }

  removeStampGhost() {
    if (this.stampGhostMesh) {
      this.sceneManager.scene.remove(this.stampGhostMesh);
      this.stampGhostMesh = null;
    }
  }

  startStampPlacement(pt) {
    const hit = this.raycastScene(pt);
    if (!hit) return;

    if (!this.isInsideBed(hit.point)) {
      this.showToast('⚠️ Reste sur le plateau pour poser ton objet !');
      return;
    }

    this.isPlacingStamp = true;
    this.stampHitPoint = hit.point;
    this.stampHitNormal = hit.normal;
    this.stampHitOnObject = hit.onObject;
    this.stampStartPointerX = pt.x;
    this.stampStartPointerY = pt.y;
    this.stampRotation = null;
    this.updateStampGhost(this.stampHitPoint, null, true);
  }

  finalizeStampPlacement() {
    this.isPlacingStamp = false;

    const point = this.stampHitPoint;
    const normal = this.stampHitNormal;
    const rotation = this.stampRotation;
    const sink = this.stampHitOnObject ? this.getSink() : 0;

    this.stampHitPoint = null;
    this.stampHitNormal = null;
    this.stampRotation = null;

    if (!point || !normal) return;

    const stampColor = MeshGenerator.getDefaultColorForStamp(this.activeStamp, this.currentColor);
    const stampMesh = MeshGenerator.createStampMesh(
      this.activeStamp, point, normal, this.currentThickness * 0.8, stampColor, rotation, sink
    );
    if (!stampMesh) return;

    this.applyPlacementScale(stampMesh);
    this.addMeshToScene(stampMesh);

    // Miroir : symétrie exacte par rapport au plan x = 0
    // (position inversée, orientation conjuguée, axe X local retourné)
    if (this.mirrorMode) {
      const twin = this.cloneUserMesh(stampMesh);
      const q = stampMesh.quaternion;
      twin.position.set(-stampMesh.position.x, stampMesh.position.y, stampMesh.position.z);
      twin.quaternion.set(q.x, -q.y, -q.z, q.w);
      twin.scale.x *= -1;
      this.addMeshToScene(twin);
    }

    this.saveStateForUndo();
    this.autoSave();
    if (window.soundFx) window.soundFx.playStamp();
    const label = this.currentTool === 'shape3d' ? 'Forme 3D posée' : 'Tampon collé';
    this.showToast(`✨ ${label} !`);
  }

  raycastScene(pt) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ndc = new THREE.Vector2((pt.x / w) * 2 - 1, -(pt.y / h) * 2 + 1);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.sceneManager.camera);

    const hits = raycaster.intersectObjects(this.userMeshes, true);
    if (hits.length > 0) {
      return {
        point: hits[0].point,
        onObject: true,
        normal: MeshGenerator.getWorldNormal(hits[0])
      };
    }

    const bedPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(bedPlane, target)) {
      return {
        point: target,
        onObject: false,
        normal: new THREE.Vector3(0, 1, 0)
      };
    }

    return null;
  }

  isInsideBed(point, margin = 4) {
    const bedRadius = (this.sceneManager.bedSize / 2) - margin;
    return (point.x * point.x + point.z * point.z) <= (bedRadius * bedRadius);
  }

  // =========================================================================
  // DESSIN 3D (Couleur active conservée sans changement intempestif)
  // =========================================================================
  finishDrawing() {
    if (this.rawPoints.length < 3) return;

    const filtered = CurveProcessor.filterPoints(this.rawPoints, 10);
    const smoothed = CurveProcessor.smoothPoints2D(filtered, 3);
    if (smoothed.length < 2) return;

    const w = this.overlayCanvas.width;
    const h = this.overlayCanvas.height;

    const camDir = new THREE.Vector3();
    this.sceneManager.camera.getWorldDirection(camDir).negate();
    const defaultPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(0, 45, 0));

    const points3D = CurveProcessor.unprojectPoints(
      smoothed,
      this.sceneManager.camera,
      this.sceneManager.scene,
      this.userMeshes,
      defaultPlane,
      w,
      h,
      {
        bedRadius: this.sceneManager.bedSize / 2,
        contentCenter: this.userMeshes.length ? this.getContentCenter() : null
      }
    );

    if (points3D.length < 2) return;

    // Bloque le tracé si des points sortent du socle
    const isOut = points3D.some(p => !this.isInsideBed(p));
    if (isOut) {
      this.showToast('⚠️ Ton dessin dépasse du socle !');
      return;
    }

    const radius = this.getStrokeRadius();

    const buildMesh = (pts) => {
      if (this.currentTool === 'balloon') {
        return MeshGenerator.createInflatedBlob(pts, this.sceneManager.camera, this.getBalloonDepth(), this.currentColor, {
          bevelRatio: this.balloonOpts.bevelRatio != null ? this.balloonOpts.bevelRatio : undefined,
          smoothIterations: this.balloonOpts.smooth || undefined
        });
      }
      if (this.currentTool === 'pillar') {
        return MeshGenerator.createArchitecturalPillar(pts, this.activePillarProfile, radius * 1.1, this.currentColor);
      }
      return MeshGenerator.createTubeMesh(pts, radius, this.currentColor);
    };

    const newMesh = buildMesh(points3D);
    if (window.soundFx) {
      if (this.currentTool === 'balloon') window.soundFx.playMagic();
      else window.soundFx.playPop();
    }

    if (newMesh) {
      this.addMeshToScene(newMesh);

      // Miroir : copie symétrique de l'autre côté (plan x = 0)
      if (this.mirrorMode) {
        const mirroredPts = points3D.map(p => new THREE.Vector3(-p.x, p.y, p.z));
        const twin = buildMesh(mirroredPts);
        if (twin) this.addMeshToScene(twin);
      }

      this.saveStateForUndo();
      this.autoSave();
      // On garde la même couleur active ! Pas de changement forcé !
      this.updateHintText();
    }
  }

  // --- Réglages du ballon avant de le dessiner ---
  // Épaisseur : automatique (suit le curseur « Taille ») tant que l'enfant ne la règle pas lui-même
  getBalloonDepth() {
    return this.balloonOpts.depth != null ? this.balloonOpts.depth : this.getStrokeRadius() * 2.2;
  }

  syncBalloonPanel() {
    const dock = document.getElementById('balloon-options-dock');
    if (!dock) return;
    const depth = Math.round(Math.max(14, this.getBalloonDepth()));
    const ratio = this.balloonOpts.bevelRatio != null ? this.balloonOpts.bevelRatio : Math.min(3.5, depth * 0.25) / depth;
    const round = Math.round(Math.min(100, Math.max(0, ((ratio - 0.05) / 0.40) * 100)));
    const smooth = this.balloonOpts.smooth || 3;

    const set = (id, lbl, value, text, max) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (max) el.max = max;
      el.value = value;
      el.style.setProperty('--fill', `${((value - el.min) / (el.max - el.min)) * 100}%`);
      document.getElementById(lbl).innerText = text;
    };
    set('draw-balloon-depth', 'lbl-draw-balloon-depth', depth, `${depth} mm`, Math.round(60 * this.workScale));
    set('draw-balloon-round', 'lbl-draw-balloon-round', round, `${round} %`);
    set('draw-balloon-smooth', 'lbl-draw-balloon-smooth', smooth, `${smooth}`);
  }

  // Rayon (mm) d'un trait / ballon / pilier : proportionnel au curseur « Taille »,
  // jamais en dessous du minimum de sécurité réglé par l'enseignant.
  // Centre de tout ce qui est déjà dessiné (sert à choisir la profondeur d'un trait dans le vide)
  getContentCenter() {
    const box = new THREE.Box3();
    this.userMeshes.forEach(m => { m.updateWorldMatrix(true, true); box.expandByObject(m); });
    return box.isEmpty() ? new THREE.Vector3(0, 40, 0) : box.getCenter(new THREE.Vector3());
  }

  getStrokeRadius(thickness = this.currentThickness) {
    // L'épaisseur minimale est une épaisseur IMPRIMÉE : dans un espace de création agrandi elle est multipliée
    const minR = (this.teacherController ? this.teacherController.settings.minThickness : 5) * this.workScale;
    return Math.max(minR, Math.round(thickness * 0.4));
  }

  // Enfoncement d'une forme posée sur une autre (1,5 mm imprimés)
  getSink() {
    return MeshGenerator.SURFACE_SINK * this.workScale;
  }

  // Appelé quand le plateau ou l'échelle de création change (réglages enseignant)
  onWorkspaceChanged(settings) {
    const ws = settings.workScale || 1;
    this.workScale = ws;
    const bedScene = settings.bedSize * ws;

    // Caméra : portée et pas de zoom proportionnels à la taille du plateau
    if (this.cameraController) {
      const cc = this.cameraController;
      cc.maxDistance = Math.max(800, bedScene * 3.2);
      cc.zoomStep = Math.max(1, bedScene / 256);
      if (this.lastBedScene !== bedScene) {
        cc.targetDistance = Math.min(cc.maxDistance, Math.max(380, bedScene * 1.5));
        this.lastBedScene = bedScene;
      }
    }

    // Le plan du miroir est recréé à la bonne taille
    if (this.mirrorGuide) {
      this.sceneManager.scene.remove(this.mirrorGuide);
      this.mirrorGuide = null;
      if (this.mirrorMode) this.toggleMirrorGuide(true);
    }
  }

  // Plus petite valeur du curseur qui change encore quelque chose (sous cette valeur, le minimum s'applique)
  getMinThickness() {
    const minR = (this.teacherController ? this.teacherController.settings.minThickness : 5) * this.workScale;
    return Math.max(6, Math.ceil(minR / 0.4));
  }

  // Met à jour la valeur, le libellé et l'aperçu du curseur « Taille »
  syncThicknessUI() {
    const input = document.getElementById('input-global-thickness');
    const label = document.getElementById('label-global-thickness');
    const preview = document.getElementById('thickness-preview');
    const min = this.getMinThickness();
    if (input) input.max = Math.round(45 * this.workScale); // la plage suit l'échelle de l'espace de création
    const max = input ? parseInt(input.max, 10) : 45;

    this.currentThickness = Math.min(max, Math.max(min, this.currentThickness));

    if (input) {
      input.min = min;
      input.value = this.currentThickness;
      const pct = ((this.currentThickness - min) / Math.max(1, max - min)) * 100;
      input.style.setProperty('--fill', `${pct}%`);
    }
    if (label) label.innerText = `${this.currentThickness} mm`;
    if (typeof this.syncBalloonPanel === 'function') this.syncBalloonPanel();
   if (preview) {
      const scale = 0.4 + ((this.currentThickness - min) / Math.max(1, max - min)) * 1.3;
      preview.style.transform = `scale(${scale})`;
    }
    const btnMin = document.getElementById('btn-thickness-min');
    const btnMax = document.getElementById('btn-thickness-max');
    if (btnMin) btnMin.dataset.size = min;
    if (btnMax) btnMax.dataset.size = max;
  }

  // --- Curseur « Taille » du bas : il reflète l'objet sélectionné, puis retrouve la taille de dessin ---
  beginSelectionThickness() {
    if (!this.selectionThicknessActive) {
      this.savedDrawThickness = this.currentThickness;
      this.selectionThicknessActive = true;
    }
  }

  // Affiche la taille d'un objet sélectionné ; renvoie la valeur réellement affichée (dans la plage du curseur)
  showSelectionThickness(value) {
    const input = document.getElementById('input-global-thickness');
    const min = this.getMinThickness();
    const max = input ? parseInt(input.max, 10) : 45;
    this.currentThickness = Math.min(max, Math.max(min, Math.round(value)));
    this.syncThicknessUI();
    return this.currentThickness;
  }

  endSelectionThickness() {
    if (!this.selectionThicknessActive) return;
    this.selectionThicknessActive = false;
    this.currentThickness = this.savedDrawThickness;
    this.syncThicknessUI();
  }

  // --- Taille de l'interface (réglage enseignant) et ajustement des popups à l'écran ---
  static get PANEL_IDS() { return ['stamps-drawer', 'geo-shapes-dock', 'pillar-profiles-dock', 'balloon-options-dock', 'edit-action-bar']; }

  // Mode « petit écran » (smartphone, petite fenêtre) : posé en classes sur <html>, le CSS fait le reste
  updateLayoutMode() {
    const w = window.innerWidth, h = window.innerHeight;
    const compact = w <= 820 || h <= 560;
    const landscape = compact && w > h && h <= 560;
    const root = document.documentElement;
    root.classList.toggle('compact', compact);
    root.classList.toggle('compact-landscape', landscape);
    return { compact, landscape };
  }

  getUIScale() {
    const setting = this.teacherController ? this.teacherController.settings.uiScale : 'auto';
    if (setting && setting !== 'auto') return parseFloat(setting) || 1;
    const w = window.innerWidth, h = window.innerHeight;
    const root = document.documentElement;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    if (root.classList.contains('compact-landscape')) return clamp(Math.min(w / 760, h / 420), 0.8, 1.2);
    if (root.classList.contains('compact')) return clamp(w / 390, 0.85, 1.25);
    // Automatique : suit la taille de la fenêtre (référence 1200 × 760)
    return clamp(Math.min(w / 1200, h / 760), 0.6, 1.25);
  }

  applyUIScale() {
    this.updateLayoutMode();
    document.documentElement.style.setProperty('--ui-scale', this.getUIScale().toFixed(3));
    Kidi3DApp.PANEL_IDS.forEach(id => this.fitPanelToScreen(document.getElementById(id)));
    this.updatePanelOpenState();
    this.updateViewOffset();
    this.fitModals();
  }

  // Un popup n'est jamais coupé ni défilant : s'il est trop haut pour l'espace libre
  // (entre la barre du haut et le dock d'outils), il est réduit proportionnellement.
  fitPanelToScreen(el) {
    if (!el || el.classList.contains('hidden')) return;
    if (document.documentElement.classList.contains('compact')) { this.fitPanelCompact(el); return; }
    el.style.removeProperty('--pz');
    const MIN_ZOOM = 0.5;
    const dock = document.getElementById('tools-dock');
    let zoom = this.getUIScale();

    el.style.zoom = zoom;
    el.style.maxHeight = 'none';
    el.style.overflowY = 'visible';

    for (let i = 0; i < 3; i++) {
      const rect = el.getBoundingClientRect();
      const bottomLimit = (dock ? dock.getBoundingClientRect().top : window.innerHeight) - 8;
      const available = bottomLimit - rect.top;
      if (rect.height <= available + 0.5) return;
      if (zoom <= MIN_ZOOM) break;
      zoom = Math.max(MIN_ZOOM, zoom * (available / rect.height));
      el.style.zoom = zoom;
    }

    // Écran vraiment minuscule : dernier recours, défilement
    const rect = el.getBoundingClientRect();
    const bottomLimit = (dock ? dock.getBoundingClientRect().top : window.innerHeight) - 8;
    if (rect.height > bottomLimit - rect.top + 0.5) {
      el.style.maxHeight = `${Math.max(120, (bottomLimit - rect.top) / zoom)}px`;
      el.style.overflowY = 'auto';
    }
  }

  // Petit écran : portrait = volet pleine largeur posé au-dessus du dock ; paysage = volet à droite.
  // Le CSS lit --pz (zoom du volet) et --sb (distance au bas) ; ici on réduit le volet pour qu'il tienne entièrement.
  fitPanelCompact(el) {
    const landscape = document.documentElement.classList.contains('compact-landscape');
    const dock = document.getElementById('tools-dock');
    const dockTop = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    const topLimit = landscape ? 54 : 58;
    const bottomEdge = landscape ? window.innerHeight - 6 : dockTop - 6;
    // Le volet ne prend jamais plus de la moitié de l'écran en portrait (sinon la forme disparaît)
    const available = landscape ? bottomEdge - topLimit : Math.min(bottomEdge - topLimit, Math.round(window.innerHeight * 0.5));
    const MIN_ZOOM = 0.5;
    let zoom = this.getUIScale();
    const apply = (z) => { el.style.zoom = z; el.style.setProperty('--pz', z); };

    el.style.setProperty('--sb', `${Math.max(0, window.innerHeight - bottomEdge)}px`);
    el.style.maxHeight = 'none';
    el.style.overflowY = 'visible';
    apply(zoom);

    for (let i = 0; i < 4; i++) {
      const rect = el.getBoundingClientRect();
      if (rect.height <= available + 0.5 || zoom <= MIN_ZOOM) break;
      zoom = Math.max(MIN_ZOOM, zoom * (available / rect.height));
      apply(zoom);
    }
    if (el.getBoundingClientRect().height > available + 0.5) {
      el.style.maxHeight = `${Math.max(120, available / zoom)}px`;
      el.style.overflowY = 'auto';
    }
  }

  // Quand un volet est ouvert en paysage, le dock du bas lui laisse la place (variable --panel-w)
  updatePanelOpenState() {
    const root = document.documentElement;
    let width = 0;
    let open = false;
    Kidi3DApp.PANEL_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.classList.contains('hidden')) return;
      open = true;
      width = Math.max(width, el.getBoundingClientRect().width);
    });
    root.classList.toggle('panel-open', open);
    root.style.setProperty('--panel-w', `${Math.round(width)}px`);
  }

  // Petit écran : la scène est centrée dans la zone libre (entre la barre du haut, le dock et le volet ouvert),
  // pour que la forme ne passe jamais derrière un panneau.
  updateViewOffset() {
    const cam = this.sceneManager && this.sceneManager.camera;
    if (!cam) return;
    const w = window.innerWidth, h = window.innerHeight;
    const root = document.documentElement;
    if (!root.classList.contains('compact')) {
      if (cam.view && cam.view.enabled) { cam.clearViewOffset(); }
      return;
    }
    let left = 0, right = w, top = 52, bottom = h;
    const dock = document.getElementById('tools-dock');
    if (dock) bottom = Math.min(bottom, dock.getBoundingClientRect().top - 4);
    Kidi3DApp.PANEL_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.classList.contains('hidden')) return;
      const r = el.getBoundingClientRect();
      if (root.classList.contains('compact-landscape')) right = Math.min(right, r.left - 4);
      else bottom = Math.min(bottom, r.top - 4);
    });
    const dx = w / 2 - (left + right) / 2;
    const dy = h / 2 - (top + bottom) / 2;
    cam.setViewOffset(w, h, Math.round(dx), Math.round(dy), w, h);
  }

  // Les fenêtres (export, réglages) se réduisent pour tenir dans l'écran ; défilement seulement en dernier recours
  fitModals() {
    document.querySelectorAll('.modal-overlay:not(.hidden) .modal-card').forEach(card => {
      const maxH = window.innerHeight * 0.94 - 16;
      card.style.zoom = 1;
      card.style.maxHeight = 'none';
      const natural = card.getBoundingClientRect().height;
      let z = 1;
      if (natural > maxH) z = Math.max(0.6, maxH / natural);
      card.style.zoom = z;
      card.style.maxHeight = `${maxH / z}px`;
    });
  }

  // --- Déplacer toute la sculpture sur le plateau (flèches, glisser, centrer) ---
  setupMoveAll() {
    const em = this.editManager;
    const all = () => this.userMeshes.slice();
    const refresh = () => { if (em.selection.length) em.syncTransformVisuals(false); };
    const finish = () => {
      this.updateBaseIfActive();
      this.saveStateForUndo();
      this.autoSave();
      refresh();
    };
    const empty = () => {
      if (this.userMeshes.length) return false;
      this.showToast("🧱 Rien à déplacer pour l'instant");
      return true;
    };

    // Flèches : un pas à chaque appui, répété si on garde le doigt / la souris appuyé
    let timer = null, moved = false;
    const stop = () => {
      clearTimeout(timer); clearInterval(timer); timer = null;
      if (moved) { moved = false; finish(); }
    };
    document.querySelectorAll('#move-all .ma-btn[data-r]').forEach(btn => {
      const r = parseFloat(btn.dataset.r), b = parseFloat(btn.dataset.b);
      const step = () => { em.viewMove(all(), r, 0, b, 8 * this.workScale); moved = true; refresh(); };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (empty()) return;
        step();
        timer = setTimeout(() => { timer = setInterval(step, 90); }, 350);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
    });

    document.getElementById('btn-all-center').addEventListener('click', () => {
      if (empty()) return;
      const t = all();
      const c = em.unionBox(t).getCenter(new THREE.Vector3());
      em.moveSelection(t, -c.x, 0, -c.z);
      finish();
      this.showToast('◎ Sculpture centrée sur le plateau');
    });

    // Poignée ✥ : glisser pour déplacer toute la sculpture dans le plan du plateau
    const drag = document.getElementById('btn-all-drag');
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let last = null;
    const hitAt = (e) => em.getRaycaster({ x: e.clientX, y: e.clientY }).ray.intersectPlane(ground, new THREE.Vector3());
    drag.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (empty()) return;
      try { drag.setPointerCapture(e.pointerId); } catch (err) { /* pas de capture possible : on continue */ }
      last = hitAt(e);
    });
    drag.addEventListener('pointermove', (e) => {
      if (!last) return;
      const p = hitAt(e);
      if (!p) return;
      em.moveSelection(all(), p.x - last.x, 0, p.z - last.z);
      last = p;
      moved = true;
      refresh();
    });
    const endDrag = () => { if (!last) return; last = null; if (moved) { moved = false; finish(); } };
    ['pointerup', 'pointercancel'].forEach(ev => drag.addEventListener(ev, endDrag));
  }

  // Surveille l'ouverture / fermeture des volets et des fenêtres pour les ajuster tout de suite
  watchLayoutChanges() {
    let pending = false;
    const schedule = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; this.applyUIScale(); });
    };
    const obs = new MutationObserver(schedule);
    const watch = (el) => { if (el) obs.observe(el, { attributes: true, attributeFilter: ['class'] }); };
    Kidi3DApp.PANEL_IDS.forEach(id => watch(document.getElementById(id)));
    document.querySelectorAll('.modal-overlay').forEach(watch);
    window.addEventListener('orientationchange', () => setTimeout(schedule, 200));

    // Bouton rond qui ouvre / ferme le panneau de caméra (petits écrans)
    const camBtn = document.getElementById('btn-cam-toggle');
    const camDock = document.getElementById('camera-dock');
    if (camBtn && camDock) {
      camBtn.addEventListener('click', () => {
        const open = camDock.classList.toggle('open');
        camBtn.classList.toggle('on', open);
        camBtn.setAttribute('aria-pressed', String(open));
      });
    }
  }

  handleEraser(pt) {
    const targetMesh = this.getTopLevelMeshAt(pt);
    if (!targetMesh) return;

    if (targetMesh.userData.locked) {
      this.showToast("🔒 Cette forme est verrouillée : déverrouille-la avec « Bouger » pour l'effacer.");
      return;
    }

    this.setEraseHover(null);
    this.removeMeshFromScene(targetMesh);
    this.saveStateForUndo();
    this.autoSave();
    if (window.soundFx) window.soundFx.playDelete();
    this.showToast('🧽 Forme effacée !');
  }

  addMeshToScene(mesh) {
    if (mesh.userData.cutter) { this.setCutterLook(mesh, true); if (window.CSGLib) CSGLib.preload(); }
    this.sceneManager.modelGroup.add(mesh);
    this.userMeshes.push(mesh);
    this.updateBaseIfActive();
  }

  removeMeshFromScene(mesh) {
    this.sceneManager.modelGroup.remove(mesh);
    const idx = this.userMeshes.indexOf(mesh);
    if (idx !== -1) {
      this.userMeshes.splice(idx, 1);
    }
    this.updateBaseIfActive();
  }

  clearAll(confirmPrompt = true) {
    if (confirmPrompt && this.userMeshes.length > 0) {
      if (!confirm('Veux-tu vraiment tout effacer pour recommencer à zéro ?')) {
        return;
      }
    }

    this.editManager.deselect();
    this.removeStampGhost();

    while (this.userMeshes.length > 0) {
      const m = this.userMeshes.pop();
      this.sceneManager.modelGroup.remove(m);
    }

    if (this.baseMesh) {
      this.sceneManager.modelGroup.remove(this.baseMesh);
      this.baseMesh = null;
    }

    this.historyStack = [];
    this.redoStack = [];
    this.updateHistoryButtons();
    localStorage.removeItem('kidi3d_autosave');
    this.showToast('Nouvelle feuille magique toute propre !');
    if (window.soundFx) window.soundFx.playPop();
  }

  updateBaseIfActive() {
    if (!this.hasAutoBase) {
      if (this.baseMesh) {
        this.sceneManager.modelGroup.remove(this.baseMesh);
        this.baseMesh = null;
      }
      return;
    }

    if (this.baseMesh) {
      this.sceneManager.modelGroup.remove(this.baseMesh);
      this.baseMesh = null;
    }

    const solids = this.userMeshes.filter(m => !m.userData.cutter); // un trou n'est pas imprimé : pas de socle pour lui
    if (solids.length > 0) {
      this.baseMesh = MeshGenerator.createPrintBase(solids, 15 * this.workScale, 3.5 * this.workScale);
      if (this.baseMesh) {
        this.sceneManager.modelGroup.add(this.baseMesh);
      }
    }
  }

  saveStateForUndo() {
    const snapshot = this.userMeshes.map(m => ({
      ...m.userData,
      position: { x: m.position.x, y: m.position.y, z: m.position.z },
      scale: { x: m.scale.x, y: m.scale.y, z: m.scale.z },
      rotation: { x: m.rotation.x, y: m.rotation.y, z: m.rotation.z }
    }));
    this.historyStack.push(JSON.stringify(snapshot));
    this.redoStack = [];
    this.updateHistoryButtons();
  }

  updateHistoryButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = this.userMeshes.length === 0 && this.historyStack.length <= 1;
    if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
  }

  // Surbrillance rouge de la forme visée par la gomme
  setEraseHover(mesh) {
    if (mesh && mesh.userData.locked) mesh = null; // une forme verrouillée ne devient pas rouge
    if (this.hoverEraseMesh === mesh) return;
    const setEmissive = (m, hex) => m && m.traverse(c => {
      const mat = c.isMesh && (this.booleanPreview ? this.booleanPreview.matOf(c) : c.material);
      if (mat && mat.emissive) mat.emissive.setHex(hex);
    });
    setEmissive(this.hoverEraseMesh, 0x000000);
    this.hoverEraseMesh = mesh;
    setEmissive(mesh, 0xaa0000);
  }

  getTopLevelMeshAt(pt) {
    const ndc = new THREE.Vector2((pt.x / window.innerWidth) * 2 - 1, -(pt.y / window.innerHeight) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.sceneManager.camera);
    const hits = raycaster.intersectObjects(this.userMeshes, true);
    if (hits.length === 0) return null;
    let target = hits[0].object;
    while (target.parent && target.parent !== this.sceneManager.modelGroup) target = target.parent;
    return target;
  }

  undo() {
    if (this.historyStack.length <= 1) {
      this.clearAll(false);
      return;
    }

    const currentState = this.historyStack.pop();
    this.redoStack.push(currentState);

    const prevState = this.historyStack[this.historyStack.length - 1];
    this.restoreFromJSON(JSON.parse(prevState));
    this.updateHistoryButtons();
    if (window.soundFx) window.soundFx.playPop();
    this.showToast("↩️ C'est annulé !");
  }

  redo() {
    if (this.redoStack.length === 0) return;

    const nextState = this.redoStack.pop();
    this.historyStack.push(nextState);
    this.restoreFromJSON(JSON.parse(nextState));
    this.updateHistoryButtons();
    if (window.soundFx) window.soundFx.playPop();
  }

  restoreFromJSON(elements) {
    this.editManager.deselect();
    this.removeStampGhost();

    while (this.userMeshes.length > 0) {
      const m = this.userMeshes.pop();
      this.sceneManager.modelGroup.remove(m);
    }

    elements.forEach(el => {
      let mesh = null;
      if (el.type === 'tube') {
        const pts = el.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        mesh = MeshGenerator.createTubeMesh(pts, el.radius || 6, el.color || 0xff4757, { radii: el.pointRadii || null });
      } else if (el.type === 'pillar') {
        const pts = el.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        mesh = MeshGenerator.createArchitecturalPillar(pts, el.profile || 'square', el.radius || 8, el.color || 0x747d8c);
      } else if (el.type === 'balloon') {
        const pts = el.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        mesh = MeshGenerator.createInflatedBlob(pts, this.sceneManager.camera, el.thickness || 18, el.color || 0xffa502, {
          basisU: el.basisU,
          basisV: el.basisV,
          basisNormal: el.basisNormal,
          bevelRatio: el.bevelRatio,
          smoothIterations: el.smoothIterations
        });
      } else if (el.type === 'stamp') {
        const hitPos = el.position ? new THREE.Vector3(el.position.x, el.position.y, el.position.z) : new THREE.Vector3(0, 0, 0);
        mesh = MeshGenerator.createStampMesh(el.stampType, hitPos, new THREE.Vector3(0, 0, 1), el.size || 12, el.color || null);
      }

      if (mesh) {
        // Anciennes sauvegardes de ballons : la forme était placée par position/rotation, elle est
        // désormais directement construite à sa place dans le monde.
        const legacyBalloon = el.type === 'balloon' && el.frame !== 'world';
        if (!legacyBalloon) {
          if (el.position) mesh.position.set(el.position.x, el.position.y, el.position.z);
          if (el.rotation) mesh.rotation.set(el.rotation.x, el.rotation.y, el.rotation.z);
        }
        if (el.scale) mesh.scale.set(el.scale.x, el.scale.y, el.scale.z);
        if (el.locked) mesh.userData.locked = true;
        if (el.cutter) mesh.userData.cutter = true;
        if (el.tint != null && mesh.userData.isGroup) this.tintStamp(mesh, el.tint);
        this.addMeshToScene(mesh);
      }
    });

    this.updateBaseIfActive();
  }

  autoSave() {
    const data = this.userMeshes.map(m => ({
      ...m.userData,
      position: { x: m.position.x, y: m.position.y, z: m.position.z },
      scale: { x: m.scale.x, y: m.scale.y, z: m.scale.z },
      rotation: { x: m.rotation.x, y: m.rotation.y, z: m.rotation.z }
    }));
    localStorage.setItem('kidi3d_autosave', JSON.stringify(data));
  }

  loadAutoSave() {
    const saved = localStorage.getItem('kidi3d_autosave');
    if (saved) {
      try {
        const elements = JSON.parse(saved);
        if (elements && elements.length > 0) {
          this.restoreFromJSON(elements);
          this.saveStateForUndo();
        }
      } catch (e) {
        console.warn('Erreur chargement auto-save', e);
      }
    }
  }

  bindUI() {
    // 1. Outils
    const toolBtns = document.querySelectorAll('.magic-tool-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.currentTool = btn.getAttribute('data-tool');
        this.overlayCanvas.className = `tool-${this.currentTool}`;
        this.setEraseHover(null);

        const stampsDrawer = document.getElementById('stamps-drawer');
        const geoDock = document.getElementById('geo-shapes-dock');
        const pillarDock = document.getElementById('pillar-profiles-dock');
        const balloonDock = document.getElementById('balloon-options-dock');
        if (balloonDock) {
          balloonDock.classList.toggle('hidden', this.currentTool !== 'balloon');
          if (this.currentTool === 'balloon') this.syncBalloonPanel();
        }

        if (this.currentTool === 'stamp') {
          stampsDrawer.classList.remove('hidden');
          // Si l'outil tampon est sélectionné mais que l'élément actif est une forme géométrique, basculer sur un tampon par défaut
          if (['cube', 'sphere', 'cylinder', 'cone', 'torus', 'pyramid'].includes(this.activeStamp)) {
            this.activeStamp = 'eye_single';
          }
          this.createStampGhost();
        } else {
          stampsDrawer.classList.add('hidden');
        }

        if (this.currentTool === 'shape3d') {
          if (geoDock) geoDock.classList.remove('hidden');
          // Si l'outil formes 3D est sélectionné, s'assurer qu'une forme géométrique est active
          if (!['cube', 'sphere', 'cylinder', 'cone', 'torus', 'pyramid'].includes(this.activeStamp)) {
            this.activeStamp = 'cube';
          }
          this.createStampGhost();
        } else {
          if (geoDock) geoDock.classList.add('hidden');
        }

        if (this.currentTool !== 'stamp' && this.currentTool !== 'shape3d') {
          this.removeStampGhost();
        }

        if (this.currentTool === 'pillar') {
          pillarDock.classList.remove('hidden');
        } else {
          pillarDock.classList.add('hidden');
        }

        if (this.currentTool !== 'edit') {
          this.editManager.deselect();
        }

        this.updateHintText();
        this.applyUIScale();
        if (window.soundFx) window.soundFx.playPop();
      });
    });

    // Retour visuel à chaque clic : le bouton « rebondit » et émet une onde, pour être sûr d'avoir cliqué
    document.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('button, .upload-label, .quality-card, summary');
      if (!btn || btn.disabled) return;
      btn.classList.remove('btn-clicked');
      void btn.offsetWidth; // relance l'animation même sur un clic rapide
      btn.classList.add('btn-clicked');
      clearTimeout(btn._clickTimer);
      btn._clickTimer = setTimeout(() => btn.classList.remove('btn-clicked'), 480);
    }, true);

    window.addEventListener('resize', () => this.applyUIScale());
    document.querySelectorAll('.stamp-tab').forEach(t => t.addEventListener('click', () => this.applyUIScale()));
    document.addEventListener('toggle', () => this.applyUIScale(), true);

    // 1b. Miroir : dessine un côté, l'autre se fait tout seul
    const btnMirror = document.getElementById('btn-mirror');
    btnMirror.addEventListener('click', () => {
      this.mirrorMode = !this.mirrorMode;
      btnMirror.classList.toggle('on', this.mirrorMode);
      btnMirror.setAttribute('aria-pressed', String(this.mirrorMode));
      document.getElementById('mirror-state').innerText = this.mirrorMode ? 'oui' : 'non';
      this.toggleMirrorGuide(this.mirrorMode);
      this.showToast(this.mirrorMode ? "🪞 Miroir activé : dessine d'un côté, ça se copie de l'autre !" : 'Miroir désactivé');
      if (window.soundFx) window.soundFx.playPop();
    });

    // Raccourcis clavier (Ctrl+Z / Ctrl+Y)
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
    });

    // 1c. Options du ballon (panneau de droite pendant le dessin)
    const balloonSlider = (id, apply) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', (e) => { apply(parseFloat(e.target.value)); this.syncBalloonPanel(); });
    };
    balloonSlider('draw-balloon-depth', v => { this.balloonOpts.depth = v; });
    balloonSlider('draw-balloon-round', v => { this.balloonOpts.bevelRatio = 0.05 + (v / 100) * 0.40; });
    balloonSlider('draw-balloon-smooth', v => { this.balloonOpts.smooth = v; });
    const balloonReset = document.getElementById('btn-draw-balloon-reset');
    if (balloonReset) balloonReset.addEventListener('click', () => {
      this.balloonOpts = { depth: null, bevelRatio: null, smooth: null };
      this.syncBalloonPanel();
    });
    const balloonClose = document.getElementById('btn-close-balloon');
    if (balloonClose) balloonClose.addEventListener('click', () => {
      document.getElementById('balloon-options-dock').classList.add('hidden');
    });

    // 2. Profils Pilier
    const btnClosePillar = document.getElementById('btn-close-pillar');
    if (btnClosePillar) {
      btnClosePillar.addEventListener('click', () => {
        document.getElementById('pillar-profiles-dock').classList.add('hidden');
      });
    }

    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activePillarProfile = e.currentTarget.getAttribute('data-profile');
        const profName = e.currentTarget.querySelector('.item-name')?.innerText || this.activePillarProfile;
        this.showToast(`Profil pilier : ${profName}`);
        if (window.soundFx) window.soundFx.playPop();
      });
    });

    // 2b. Formes Géométriques 3D Dédiées
    const btnCloseGeo = document.getElementById('btn-close-geo');
    if (btnCloseGeo) {
      btnCloseGeo.addEventListener('click', () => {
        const geoDock = document.getElementById('geo-shapes-dock');
        if (geoDock) geoDock.classList.add('hidden');
      });
    }

    document.querySelectorAll('.geo-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.geo-item').forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeStamp = e.currentTarget.getAttribute('data-stamp');
        this.createStampGhost();
        const shapeName = e.currentTarget.querySelector('.item-name')?.innerText || this.activeStamp;
        this.showToast(`Forme 3D : ${shapeName}`);
        if (window.soundFx) window.soundFx.playPop();
      });
    });

    // 3. Catégories & Tampons
    document.getElementById('btn-close-stamps').addEventListener('click', () => {
      document.getElementById('stamps-drawer').classList.add('hidden');
    });

    document.querySelectorAll('.stamp-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.stamp-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.stamp-group-pane').forEach(p => p.classList.remove('active'));

        e.currentTarget.classList.add('active');
        const targetCat = e.currentTarget.getAttribute('data-stamp-cat');
        const pane = document.getElementById(targetCat);
        if (pane) pane.classList.add('active');
      });
    });

    document.querySelectorAll('.stamp-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.stamp-item').forEach(i => i.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeStamp = e.currentTarget.getAttribute('data-stamp');
        this.createStampGhost();
        const stampName = e.currentTarget.querySelector('.item-name')?.innerText || this.activeStamp;
        // Petit écran : le tiroir se referme pour laisser voir le dessin (on le rouvre en touchant « Tampon »)
        const inDrawer = e.currentTarget.closest('#stamps-drawer');
        const compact = document.documentElement.classList.contains('compact');
        if (inDrawer && compact) {
          inDrawer.classList.add('hidden');
          this.showToast(`Tampon : ${stampName} — touche ton dessin pour le poser`);
        } else {
          this.showToast(`Tampon : ${stampName}`);
        }
        if (window.soundFx) window.soundFx.playPop();
      });
    });

    // 4. Taille (curseur unique + petits/gros points aux extrémités)
    const inputGlobalThick = document.getElementById('input-global-thickness');

    const updateThickness = (val) => {
      this.currentThickness = val;
      this.syncThicknessUI();

      // En mode « Bouger », le curseur règle la taille de l'objet sélectionné (courbe ou non)
      if (this.currentTool === 'edit' && this.editManager.selectedMesh) {
        this.editManager.applyThickness(this.currentThickness);
      } else {
        this.refreshStampGhost();
      }
    };

    if (inputGlobalThick) {
      inputGlobalThick.addEventListener('input', (e) => updateThickness(parseInt(e.target.value, 10)));
      inputGlobalThick.addEventListener('change', () => {
        if (this.currentTool === 'edit' && this.editManager.selectedMesh) {
          this.saveStateForUndo();
          this.autoSave();
        }
      });
    }

    document.querySelectorAll('.thickness-end').forEach(btn => {
      btn.addEventListener('click', (e) => {
        updateThickness(parseInt(e.currentTarget.dataset.size, 10));
        if (window.soundFx) window.soundFx.playPop();
      });
    });
    this.syncThicknessUI();

    // 4b. Proportions 3D (largeur / hauteur / profondeur) de la prochaine forme posée
    const axes = ['x', 'y', 'z'];
    const lockBtn = document.getElementById('btn-toggle-placement-lock');

    const renderPlacementScaleUI = () => {
      axes.forEach(a => {
        const s = document.getElementById(`scale-place-${a}`);
        const l = document.getElementById(`lbl-scale-place-${a}`);
        const v = this.placementScale[a];
        if (s) {
          s.value = v;
          s.style.setProperty('--fill', `${((v - s.min) / (s.max - s.min)) * 100}%`);
        }
        if (l) l.innerText = `×${v.toFixed(1)}`;
      });
      const isDefault = axes.every(a => Math.abs(this.placementScale[a] - 1) < 0.001);
      const resetBtn = document.getElementById('btn-reset-placement-scale');
      if (resetBtn) resetBtn.classList.toggle('is-default', isDefault);
      if (this.stampGhostMesh) this.applyPlacementScale(this.stampGhostMesh);
    };

    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        this.placementScaleLocked = !this.placementScaleLocked;
        lockBtn.classList.toggle('on', this.placementScaleLocked);
        lockBtn.setAttribute('aria-pressed', String(this.placementScaleLocked));
        lockBtn.querySelector('.lock-text').innerText = this.placementScaleLocked ? 'Liés' : 'Libres';
        lockBtn.querySelector('.lock-ico').innerText = this.placementScaleLocked ? '🔗' : '🔓';
        if (window.soundFx) window.soundFx.playPop();
      });
    }

    const resetPlacementBtn = document.getElementById('btn-reset-placement-scale');
    if (resetPlacementBtn) {
      resetPlacementBtn.addEventListener('click', () => {
        axes.forEach(a => { this.placementScale[a] = 1; });
        renderPlacementScaleUI();
        this.showToast('↺ Proportions remises à 1:1');
        if (window.soundFx) window.soundFx.playPop();
      });
    }

    axes.forEach(axis => {
      const slider = document.getElementById(`scale-place-${axis}`);
      if (!slider) return;
      slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (this.placementScaleLocked) {
          // Axes liés : on garde le rapport entre les trois axes (on multiplie tout du même facteur).
          // Le facteur est borné pour qu'aucun axe ne sorte de la plage des curseurs.
          const min = parseFloat(slider.min), max = parseFloat(slider.max);
          let factor = val / (this.placementScale[axis] || 1);
          axes.forEach(a => {
            factor = Math.min(factor, max / this.placementScale[a]);
            factor = Math.max(factor, min / this.placementScale[a]);
          });
          axes.forEach(a => { this.placementScale[a] = this.placementScale[a] * factor; });
        } else {
          this.placementScale[axis] = val;
        }
        renderPlacementScaleUI();
      });
    });
    renderPlacementScaleUI();

    // 4c. Couleurs
    document.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const hex = e.currentTarget.getAttribute('data-color');
        this.currentColor = parseInt(hex.replace('#', '0x'), 16);

        // Actualiser la couleur de l'aperçu pour formes et tampons
        this.refreshStampGhost();

        // En mode « Bouger », la couleur choisie peint toute la sélection
        if (this.currentTool === 'edit' && this.editManager.selection.length) {
          this.applyColorToSelection(this.currentColor);
        }
      });
    });

    // 5. D-Pad Ergonomique
    document.getElementById('btn-cam-up').addEventListener('click', () => {
      this.cameraController.tiltUp();
      if (window.soundFx) window.soundFx.playSwoosh();
    });

    document.getElementById('btn-cam-down').addEventListener('click', () => {
      this.cameraController.tiltDown();
      if (window.soundFx) window.soundFx.playSwoosh();
    });

    document.getElementById('btn-cam-left').addEventListener('click', () => {
      this.cameraController.rotateLeft();
      if (window.soundFx) window.soundFx.playSwoosh();
    });

    document.getElementById('btn-cam-right').addEventListener('click', () => {
      this.cameraController.rotateRight();
      if (window.soundFx) window.soundFx.playSwoosh();
    });

    document.getElementById('btn-zoom-in').addEventListener('click', () => {
      this.cameraController.zoomIn();
      if (window.soundFx) window.soundFx.playPop();
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
      this.cameraController.zoomOut();
      if (window.soundFx) window.soundFx.playPop();
    });

    document.querySelectorAll('.cam-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.cam-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const view = e.currentTarget.getAttribute('data-view');
        this.cameraController.setView(view);
        if (window.soundFx) window.soundFx.playSwoosh();
      });
    });

    // 6. Bulle d'Aide
    const hintBubble = document.getElementById('kid-hint');
    const btnToggleHint = document.getElementById('btn-toggle-hint');

    hintBubble.addEventListener('click', () => {
      hintBubble.classList.add('hidden');
    });

    btnToggleHint.addEventListener('click', () => {
      hintBubble.classList.toggle('hidden');
      if (window.soundFx) window.soundFx.playPop();
    });

    // 7. Actions Barre Supérieure
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.redo());
    document.getElementById('btn-clear').addEventListener('click', () => this.clearAll(true));

    const btnSound = document.getElementById('btn-sound-toggle');
    btnSound.addEventListener('click', () => {
      const active = window.soundFx.toggle();
      document.getElementById('sound-icon').innerText = active ? '🔊' : '🔇';
      this.showToast(active ? 'Sons activés' : 'Mode silencieux');
    });

    // 8. Modale Export 3D
    document.getElementById('btn-print-modal').addEventListener('click', () => this.openExportModal());

    document.getElementById('btn-download-stl').addEventListener('click', () => {
      const exportList = [...this.userMeshes];
      if (this.baseMesh) exportList.push(this.baseMesh);
      else if (this.teacherController.settings.autoBase) {
        const tempBase = MeshGenerator.createPrintBase(this.userMeshes.filter(m => !m.userData.cutter), 15 * this.workScale, 3.5 * this.workScale);
        if (tempBase) exportList.push(tempBase);
      }

      const autoFit = true; // le modèle est toujours ajusté et centré sur le plateau
      const bedSize = this.teacherController.settings.bedSize || 180;
      const qualityEl = document.querySelector('input[name="export-quality"]:checked');
      const quality = qualityEl ? qualityEl.value : 'smooth';

      const success = Exporter3D.exportSTLBinary(exportList, 'Export3D.stl', autoFit, bedSize, quality, 1 / this.workScale, this.teacherController.settings.truncateBed);
      if (success) {
        this.showToast('🚀 Fichier STL téléchargé !');
        if (window.soundFx) window.soundFx.playSuccess();
      } else {
        this.showToast('Dessine d\'abord quelque chose avant d\'imprimer !');
      }
    });

    document.getElementById('btn-download-obj').addEventListener('click', () => {
      const exportList = [...this.userMeshes];
      if (this.baseMesh) exportList.push(this.baseMesh);
      const qualityEl = document.querySelector('input[name="export-quality"]:checked');
      const quality = qualityEl ? qualityEl.value : 'smooth';
      Exporter3D.exportOBJ(exportList, 'Export3D.obj', true, this.teacherController.settings.bedSize || 180, quality, 1 / this.workScale, this.teacherController.settings.truncateBed);
      this.showToast('🎨 Fichier OBJ téléchargé avec succès !');
    });

    document.querySelectorAll('input[name="export-quality"]').forEach(r => {
      r.addEventListener('change', () => {
        document.querySelectorAll('.quality-card').forEach(c => c.classList.remove('active'));
        if (r.checked && r.closest('.quality-card')) {
          r.closest('.quality-card').classList.add('active');
        }
      });
    });

    document.getElementById('btn-save-project').addEventListener('click', () => {
      Exporter3D.exportProjectJSON(this.userMeshes, 'mon-projet-kidi3d.kid3d');
      this.showToast('💾 Projet sauvegardé !');
    });

    document.getElementById('input-load-project').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const project = JSON.parse(event.target.result);
          if (project.elements) {
            this.restoreFromJSON(project.elements);
            this.saveStateForUndo();
            document.getElementById('modal-export').classList.add('hidden');
            this.showToast('🎉 Projet ouvert avec succès !');
            if (window.soundFx) window.soundFx.playSuccess();
          }
        } catch (err) {
          this.showToast('Fichier projet non reconnu.');
        }
      };
      reader.readAsText(file);
    });
  }

  // Plan translucide au centre (x = 0) pour montrer où est le miroir
  toggleMirrorGuide(visible) {
    if (visible && !this.mirrorGuide) {
      const bed = this.sceneManager.bedSize || 180;
      const geo = new THREE.PlaneGeometry(bed, Math.round(bed * 0.78));
      const mat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false
      });
      this.mirrorGuide = new THREE.Mesh(geo, mat);
      this.mirrorGuide.rotation.y = Math.PI / 2;
      this.mirrorGuide.position.y = Math.round((this.sceneManager.bedSize || 180) * 0.39);
      this.sceneManager.scene.add(this.mirrorGuide);
    }
    if (this.mirrorGuide) this.mirrorGuide.visible = visible;
  }

  updateHintText() {
    const hint = document.getElementById('hint-text');
    if (!hint) return;

    const texts = {
      tube: '✏️ Dessine une ligne avec la souris : elle devient un tube 3D !',
      balloon: '🎈 Dessine une forme fermée (reviens à ton point de départ) : elle se gonfle en ballon !',
      pillar: '🏛️ Trace un trait de bas en haut : ça fait un pilier bien droit.',
      stamp: "⭐ Choisis un tampon, puis clique sur ton dessin. Reste appuyé et glisse pour l'orienter !",
      shape3d: '🔷 Choisis une forme, règle ses proportions, puis clique pour la poser.',
      edit: "✋ Touche une forme : bouge-la, agrandis-la, tourne-la, ou choisis une couleur pour la peindre !",
      eraser: '🧽 Touche une forme pour la faire disparaître (elle devient rouge avant).'
    };
    hint.innerText = texts[this.currentTool] || '';
  }

  openExportModal() {
    const modal = document.getElementById('modal-export');
    modal.classList.remove('hidden');

    const dims = Exporter3D.getModelDimensions(this.userMeshes);
    const bedSize = this.teacherController.settings.bedSize || 180;
    // Dimensions réellement imprimées : échelle d'impression et ajustement au plateau compris
    const trunc = this.teacherController.settings.truncateBed;
    const k = dims.count ? Exporter3D.getExportTransform(this.userMeshes, true, bedSize, null, 1 / this.workScale, trunc).scale : 1;
    // hauteur imprimée : la partie sous la table est coupée
    if (dims.count && trunc) dims.height = Math.round(dims.max.y - Math.max(0, dims.min.y));
    document.getElementById('stat-elements-count').innerText = dims.count;
    document.getElementById('stat-size-estimate').innerText =
      `${Math.round(dims.width * k)} × ${Math.round(dims.depth * k)} × ${Math.round(dims.height * k)} mm`;

    const note = document.getElementById('export-scale-note');
    if (note) {
      const printRatio = this.workScale * (k > 0 ? (1 / this.workScale) / k : 1);
      const shrink = Math.round(printRatio * 10) / 10;
      note.classList.toggle('hidden', shrink <= 1);
      note.textContent = `📏 Ton dessin est imprimé ${shrink === Math.round(shrink) ? shrink : String(shrink).replace('.', ',')} fois plus petit pour tenir sur le plateau.`;
    }

    if (window.soundFx) window.soundFx.playPop();
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => container.removeChild(toast), 300);
    }, 2500);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    this.cameraController.update();
    this.editManager.update();
    if (this.orientationGizmo) {
      this.orientationGizmo.update(this.sceneManager.camera);
    }
    this.sceneManager.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.kidiApp = new Kidi3DApp();
});
