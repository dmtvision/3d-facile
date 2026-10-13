/**
 * Kidi3D - Moteur de Scène Three.js V3
 * Scène claire avec vue de face droite par défaut pour travailler facilement debout
 */

class SceneManager {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.gridHelper = null;
    this.bedMesh = null;
    this.bedGroup = null;
    this.drawPlane = null;
    this.modelGroup = null;
    this.bedSize = 256;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Caméra de FACE droite par défaut (vue frontale claire)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
    this.camera.position.set(0, 45, 290);
    this.camera.lookAt(0, 45, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.container.appendChild(this.renderer.domElement);

    this.setupLighting();

    this.bedGroup = new THREE.Group();
    this.scene.add(this.bedGroup);
    this.updatePrintBed(this.bedSize);

    this.modelGroup = new THREE.Group();
    this.scene.add(this.modelGroup);

    this.drawPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    window.addEventListener('resize', () => this.onResize());
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd8dc, 0.75);
    hemiLight.position.set(0, 200, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    this.dirLight = dirLight;
    dirLight.position.set(100, 200, 150);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 600;
    const d = 160;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0xbbf7d0, 0.35);
    rimLight.position.set(-150, 80, -100);
    this.scene.add(rimLight);
  }

  updatePrintBed(sizeMm = 180, showGrid = true, cellMm = 10) {
    this.bedSize = sizeMm;

    // Lumière, ombres et profondeur de vue suivent la taille du plateau
    if (this.dirLight) {
      const k = Math.max(1, sizeMm / 256);
      const d = Math.max(160, sizeMm * 0.75);
      this.dirLight.position.set(100 * k, 200 * k, 150 * k);
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.camera.far = 600 * k;
      this.dirLight.shadow.camera.updateProjectionMatrix();
    }
    this.camera.far = Math.max(2000, sizeMm * 10);
    this.camera.updateProjectionMatrix();

    while (this.bedGroup.children.length > 0) {
      this.bedGroup.remove(this.bedGroup.children[0]);
    }

    if (!showGrid) return;

    // Plaque de lit biseautée
    const bedGeo = new THREE.BoxGeometry(sizeMm, 3, sizeMm);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.85,
      metalness: 0.05
    });
    this.bedMesh = new THREE.Mesh(bedGeo, bedMat);
    this.bedMesh.position.y = -1.5;
    this.bedMesh.receiveShadow = true;
    this.bedGroup.add(this.bedMesh);

    // Grille millimétrée
    const divisions = Math.max(1, Math.floor(sizeMm / cellMm)); // une case = 10 mm imprimés
    this.gridHelper = new THREE.GridHelper(sizeMm, divisions, 0x38bdf8, 0x94a3b8);
    this.gridHelper.position.y = 0.1;
    this.bedGroup.add(this.gridHelper);

    // Repère du plateau
    const ringGeo = new THREE.RingGeometry(sizeMm * 0.48, sizeMm * 0.50, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    this.bedGroup.add(ring);
  }

  onResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

window.SceneManager = SceneManager;
