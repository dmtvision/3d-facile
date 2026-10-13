/**
 * Kidi3D - Contrôleur de Caméra V4
 * Correction du sens de Pan gauche/droite et option d'inversion
 */

class KidCameraController {
  constructor(camera, target = new THREE.Vector3(0, 45, 0)) {
    this.camera = camera;
    this.target = target;
    
    this.distance = 380;
    this.zoomStep = 1; // augmente avec la taille du plateau
    this.minDistance = 70;
    this.maxDistance = 800;

    this.theta = 0;
    this.phi = Math.PI / 2.05;

    this.targetTheta = 0;
    this.targetPhi = Math.PI / 2.05;
    this.targetDistance = 380;

    this.isAutoRotating = false;
    this.autoRotateSpeed = 0.008;

    this.isOrbiting = false;
    this.isPanning = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Option sens de Pan (corrigé par défaut)
    this.invertPanX = localStorage.getItem('kidi3d_invert_pan_x') === 'true';

    this.updateCameraPosition();
  }

  tiltUp() {
    this.targetPhi = Math.max(0.1, this.targetPhi - 0.2);
    this.isAutoRotating = false;
  }

  tiltDown() {
    this.targetPhi = Math.min(Math.PI / 2.02, this.targetPhi + 0.2);
    this.isAutoRotating = false;
  }

  rotateLeft() {
    this.rotateDelta(30);
  }

  rotateRight() {
    this.rotateDelta(-30);
  }

  zoomIn() {
    this.targetDistance = Math.max(this.minDistance, this.targetDistance - 40 * this.zoomStep);
  }

  zoomOut() {
    this.targetDistance = Math.min(this.maxDistance, this.targetDistance + 40 * this.zoomStep);
  }

  onWheel(deltaY) {
    const zoomFactor = deltaY * 0.22 * this.zoomStep;
    this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetDistance + zoomFactor));
  }

  // Clic droit : pivoter autour de la scène. Clic milieu : déplacer la vue.
  onPointerDown(e) {
    if (e.button === 2) {
      this.isOrbiting = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return true;
    }
    if (e.button === 1) {
      this.isPanning = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return true;
    }
    return false;
  }

  onPointerMove(e) {
    if (this.isOrbiting) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      this.targetTheta += dx * 0.01;
      this.targetPhi = Math.max(0.1, Math.min(Math.PI / 2.02, this.targetPhi - dy * 0.01));
      return true;
    }

    if (this.isPanning) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      const panSpeed = 0.28 * (this.distance / 290);
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
      const up = this.camera.up.clone().normalize();

      // Sens de Pan gauche/droite : glisser la souris déplace la scène sous la main (comportement naturel)
      const dirFactor = this.invertPanX ? -1 : 1;
      this.target.addScaledVector(right, -dx * panSpeed * dirFactor);
      this.target.addScaledVector(up, dy * panSpeed);
      this.target.y = Math.max(0, this.target.y);
      return true;
    }

    return false;
  }

  onPointerUp() {
    this.isOrbiting = false;
    this.isPanning = false;
  }

  setTurntableAngle(degrees) {
    this.targetTheta = (degrees * Math.PI) / 180;
    this.isAutoRotating = false;
  }

  rotateDelta(degrees) {
    this.targetTheta += (degrees * Math.PI) / 180;
    this.isAutoRotating = false;
  }

  setView(viewName) {
    this.isAutoRotating = false;
    switch (viewName) {
      case 'front':
        this.targetTheta = 0;
        this.targetPhi = Math.PI / 2.05;
        this.target.set(0, 45, 0);
        break;
      case 'side':
        this.targetTheta = Math.PI / 2;
        this.targetPhi = Math.PI / 2.05;
        this.target.set(0, 45, 0);
        break;
      case 'top':
        this.targetPhi = 0.08;
        break;
    }
  }

  toggleAutoRotate() {
    this.isAutoRotating = !this.isAutoRotating;
    return this.isAutoRotating;
  }

  update() {
    if (this.isAutoRotating) {
      this.targetTheta += this.autoRotateSpeed;
    }

    this.theta += (this.targetTheta - this.theta) * 0.12;
    this.phi += (this.targetPhi - this.phi) * 0.12;
    this.distance += (this.targetDistance - this.distance) * 0.12;

    this.updateCameraPosition();
  }

  updateCameraPosition() {
    const sinPhi = Math.sin(this.phi);
    const x = this.target.x + this.distance * sinPhi * Math.sin(this.theta);
    const y = this.target.y + this.distance * Math.cos(this.phi);
    const z = this.target.z + this.distance * sinPhi * Math.cos(this.theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  getCurrentDegreeAngle() {
    let deg = ((this.theta * 180) / Math.PI) % 360;
    if (deg < 0) deg += 360;
    return Math.round(deg);
  }
}

window.KidCameraController = KidCameraController;
