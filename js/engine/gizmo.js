/**
 * Kidi3D - Sphère d'Orientation 3D avec Maille Simple et Axes XYZ Haute Visibilité (Gizmo XYZ)
 * Affiche une boule 3D avec maille sphérique claire (méridiens et parallèles)
 * et axes XYZ bien visibles avec pastilles contrastées et grandes lettres.
 */

class OrientationGizmo {
  constructor(cameraController, containerId = 'gizmo-container') {
    this.cameraController = cameraController;
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 300);
    this.camera.position.set(0, 0, 120);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(140, 140);
    this.renderer.domElement.style.display = 'block';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.gizmoGroup = new THREE.Group();
    this.scene.add(this.gizmoGroup);

    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    this.buildGizmo();
    this.bindEvents();
  }

  buildGizmo() {
    const R = 14;

    // 1. Sphère centrale translucide douce
    const sphereGeo = new THREE.SphereGeometry(R * 0.98, 24, 24);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28
    });
    const centerSphere = new THREE.Mesh(sphereGeo, sphereMat);
    this.gizmoGroup.add(centerSphere);

    // 2. Maille simple aérée (Méridiens et Parallèles bien nets)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.85,
      linewidth: 2
    });

    const createRingGeometry = (radius, segments = 36) => {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
      }
      return new THREE.BufferGeometry().setFromPoints(pts);
    };

    // Équateur
    const equator = new THREE.Line(createRingGeometry(R), lineMat);
    this.gizmoGroup.add(equator);

    // Parallèles (Haut et Bas)
    const latAngle = Math.PI / 5; // 36 degrés
    const rLat = R * Math.cos(latAngle);
    const yLat = R * Math.sin(latAngle);

    const latNorth = new THREE.Line(createRingGeometry(rLat), lineMat);
    latNorth.position.y = yLat;
    this.gizmoGroup.add(latNorth);

    const latSouth = new THREE.Line(createRingGeometry(rLat), lineMat);
    latSouth.position.y = -yLat;
    this.gizmoGroup.add(latSouth);

    // 4 Grands cercles Méridiens passant par les pôles
    const meridianAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
    meridianAngles.forEach(angle => {
      const meridian = new THREE.Line(createRingGeometry(R), lineMat);
      meridian.rotation.z = Math.PI / 2;
      meridian.rotation.y = angle;
      this.gizmoGroup.add(meridian);
    });

    // 3. Axes XYZ épais et ultra-visibles
    const axisRadius = 1.6;
    const axisLen = 22;

    // Axe X - Rouge vif (Droite)
    const arrowX = new THREE.Mesh(
      new THREE.CylinderGeometry(axisRadius, axisRadius, axisLen, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3344 })
    );
    arrowX.rotation.z = -Math.PI / 2;
    arrowX.position.x = axisLen / 2;
    this.gizmoGroup.add(arrowX);

    // Axe Y - Vert vif (Haut)
    const arrowY = new THREE.Mesh(
      new THREE.CylinderGeometry(axisRadius, axisRadius, axisLen, 16),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    arrowY.position.y = axisLen / 2;
    this.gizmoGroup.add(arrowY);

    // Axe Z - Bleu roi (Face / Devant)
    const arrowZ = new THREE.Mesh(
      new THREE.CylinderGeometry(axisRadius, axisRadius, axisLen, 16),
      new THREE.MeshBasicMaterial({ color: 0x2563eb })
    );
    arrowZ.rotation.x = Math.PI / 2;
    arrowZ.position.z = axisLen / 2;
    this.gizmoGroup.add(arrowZ);

    // 4. Pastilles XYZ très contrastées et grandes
    const labelDist = axisLen + 5.0;
    this.createAxisLabel('X', 0xff3344, new THREE.Vector3(labelDist, 0, 0));
    this.createAxisLabel('Y', 0x10b981, new THREE.Vector3(0, labelDist, 0));
    this.createAxisLabel('Z', 0x2563eb, new THREE.Vector3(0, 0, labelDist));
  }

  createAxisLabel(text, colorHex, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Pastille circulaire avec fond coloré vif
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    ctx.fill();

    // Bordure blanche épaisse pour détacher la pastille
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Lettre de l'axe en gros caractère blanc avec ombre
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 70px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 67);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.renderOrder = 999; // toujours dessiné par-dessus axes et sphère
    sprite.position.copy(position);
    sprite.scale.set(13, 13, 1);
    this.gizmoGroup.add(sprite);
  }

  bindEvents() {
    const el = this.renderer.domElement;

    el.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;

      this.cameraController.rotateDelta(-dx * 1.5);
      this.cameraController.targetPhi = Math.max(0.1, Math.min(Math.PI / 2.02, this.cameraController.targetPhi - dy * 0.015));
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });
  }

  update(mainCamera) {
    if (!this.renderer || !this.gizmoGroup) return;
    this.gizmoGroup.quaternion.copy(mainCamera.quaternion).invert();
    this.renderer.render(this.scene, this.camera);
  }
}

window.OrientationGizmo = OrientationGizmo;
