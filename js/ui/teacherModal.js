/**
 * 3D-Facile - Contrôleur de l'Espace Enseignant
 * Paramètres pédagogiques, sécurité d'impression 3D et bridage adapté à l'âge
 */

/**
 * Empreinte SHA-256 (hexadécimal) d'un texte ASCII — sert à ne jamais enregistrer le code enseignant en clair.
 * Implémentation autonome (fonctionne aussi hors HTTPS, où l'API crypto du navigateur est indisponible).
 */
function sha256Hex(ascii) {
  const rightRotate = (v, a) => (v >>> a) | (v << (32 - a));
  const maxWord = 2 ** 32;
  const words = [];
  const bitLength = ascii.length * 8;
  let hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return null; // caractères ASCII uniquement
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (bitLength / maxWord) | 0;
  words[words.length] = bitLength;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i]
        + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  let result = '';
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

class TeacherController {
  constructor(app) {
    this.app = app;
    this.usePin = safeStorage.getItem('kidi3d_use_pin') === 'true'; // Décoché par défaut
    // Le code enseignant n'est jamais enregistré en clair : seulement son empreinte.
    let pinHash = safeStorage.getItem('kidi3d_teacher_pin_hash');
    const legacyPin = safeStorage.getItem('kidi3d_teacher_pin'); // anciennes versions : code en clair
    if (!pinHash && legacyPin) {
      pinHash = TeacherController.hashPin(legacyPin);
      safeStorage.setItem('kidi3d_teacher_pin_hash', pinHash);
    }
    safeStorage.removeItem('kidi3d_teacher_pin');
    // Anciens réglages verrouillés sans code personnalisé : l'ancien code par défaut reste valable jusqu'à son changement
    if (!pinHash && this.usePin) pinHash = TeacherController.hashPin('1234');
    this.pinHash = pinHash;

    // Réglages par défaut
    this.settings = {
      bedSize: parseInt(safeStorage.getItem('kidi3d_bed_size') || '256', 10),
      minThickness: parseInt(safeStorage.getItem('kidi3d_min_thickness') || '5', 10),
      autoBase: safeStorage.getItem('kidi3d_auto_base') === 'true', // Désactivé par défaut !
      showGrid: safeStorage.getItem('kidi3d_show_grid') !== 'false',
      toolBalloon: safeStorage.getItem('kidi3d_tool_balloon') !== 'false',
      toolPillar: safeStorage.getItem('kidi3d_tool_pillar') !== 'false',
      toolShapes: safeStorage.getItem('kidi3d_tool_shapes') !== 'false',
      toolStamps: safeStorage.getItem('kidi3d_tool_stamps') !== 'false',
      toolEdit: safeStorage.getItem('kidi3d_tool_edit') !== 'false',
      soundEnabled: safeStorage.getItem('kidi3d_sound') === 'true', // son coupé par défaut
      uiScale: safeStorage.getItem('kidi3d_ui_scale') || 'auto',
      workScale: parseFloat(safeStorage.getItem('kidi3d_work_scale') || '1') || 1,
      truncateBed: safeStorage.getItem('kidi3d_truncate_bed') !== 'false', // activé par défaut
      booleanPreview: safeStorage.getItem('kidi3d_bool_preview') !== 'false' // aperçu des trous en direct, activé par défaut
    };

    this.bindEvents();
    this.applySettingsToApp();
  }

  bindEvents() {
    const btnOpen = document.getElementById('btn-teacher-open');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => this.openModal());
    }

    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.getAttribute('data-close');
        if (modalId) {
          document.getElementById(modalId).classList.add('hidden');
        }
      });
    });

    const btnVerify = document.getElementById('btn-verify-pin');
    const pinInput = document.getElementById('teacher-pin-input');
    if (btnVerify && pinInput) {
      const checkPin = () => {
        if (this.pinHash && TeacherController.hashPin(pinInput.value.trim()) === this.pinHash) {
          this.showTeacherContent();
          pinInput.value = '';
          pinInput.style.borderColor = '';
        } else {
          pinInput.style.borderColor = '#ef4444';
          pinInput.value = '';
          this.app.showToast('Code incorrect.');
        }
      };

      btnVerify.addEventListener('click', checkPin);
      pinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkPin();
      });
    }

    const tabBtns = document.querySelectorAll('.teacher-tabs .tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.teacher-view .tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetTab = btn.getAttribute('data-tab');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });

    const btnSave = document.getElementById('btn-save-teacher-settings');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveSettings());
    }
  }

  static hashPin(pin) {
    return sha256Hex('3d-facile:' + String(pin));
  }

  openModal() {
    const modal = document.getElementById('modal-teacher');
    modal.classList.remove('hidden');

    if (!this.usePin) {
      this.showTeacherContent();
    } else {
      document.getElementById('teacher-lock-screen').classList.remove('hidden');
      document.getElementById('teacher-content').classList.add('hidden');
      const pinInput = document.getElementById('teacher-pin-input');
      pinInput.value = '';
      setTimeout(() => pinInput.focus(), 100);
    }
  }

  showTeacherContent() {
    document.getElementById('teacher-lock-screen').classList.add('hidden');
    document.getElementById('teacher-content').classList.remove('hidden');

    document.getElementById('setting-bed-size').value = this.settings.bedSize;
    document.getElementById('setting-min-thickness').value = this.settings.minThickness;
    document.getElementById('setting-auto-base').checked = this.settings.autoBase;
    document.getElementById('setting-show-grid').checked = this.settings.showGrid;
    document.getElementById('setting-invert-pan').checked = safeStorage.getItem('kidi3d_invert_pan_x') === 'true';
    document.getElementById('toggle-tool-balloon').checked = this.settings.toolBalloon;
    document.getElementById('toggle-tool-pillar').checked = this.settings.toolPillar;
    const toggleShapes = document.getElementById('toggle-tool-shapes');
    if (toggleShapes) toggleShapes.checked = this.settings.toolShapes;
    document.getElementById('toggle-tool-stamps').checked = this.settings.toolStamps;
    document.getElementById('toggle-tool-edit').checked = this.settings.toolEdit;
    document.getElementById('toggle-sound-effects').checked = this.settings.soundEnabled;
    document.getElementById('setting-enable-pin').checked = this.usePin;
    const uiScaleSel = document.getElementById('setting-ui-scale');
    if (uiScaleSel) uiScaleSel.value = this.settings.uiScale;
    const workSel = document.getElementById('setting-work-scale');
    if (workSel) workSel.value = String(this.settings.workScale);
    const truncEl = document.getElementById('setting-truncate-bed');
    if (truncEl) truncEl.checked = this.settings.truncateBed;
    const boolEl = document.getElementById('setting-boolean-preview');
    if (boolEl) boolEl.checked = this.settings.booleanPreview;
  }

  saveSettings() {
    const bedSize = parseInt(document.getElementById('setting-bed-size').value, 10);
    const minThickness = parseInt(document.getElementById('setting-min-thickness').value, 10);
    const autoBase = document.getElementById('setting-auto-base').checked;
    const showGrid = document.getElementById('setting-show-grid').checked;
    const invertPan = document.getElementById('setting-invert-pan').checked;
    const toolBalloon = document.getElementById('toggle-tool-balloon').checked;
    const toolPillar = document.getElementById('toggle-tool-pillar').checked;
    const toggleShapes = document.getElementById('toggle-tool-shapes');
    const toolShapes = toggleShapes ? toggleShapes.checked : true;
    const toolStamps = document.getElementById('toggle-tool-stamps').checked;
    const toolEdit = document.getElementById('toggle-tool-edit').checked;
    const soundEnabled = document.getElementById('toggle-sound-effects').checked;
    const usePin = document.getElementById('setting-enable-pin').checked;
    const uiScaleSel = document.getElementById('setting-ui-scale');
    const uiScale = uiScaleSel ? uiScaleSel.value : 'auto';
    const workSel = document.getElementById('setting-work-scale');
    const workScale = workSel ? (parseFloat(workSel.value) || 1) : 1;
    const truncEl = document.getElementById('setting-truncate-bed');
    const truncateBed = truncEl ? truncEl.checked : true;
    const boolEl = document.getElementById('setting-boolean-preview');
    const booleanPreview = boolEl ? boolEl.checked : true;

    // Code enseignant : 4 à 6 chiffres, obligatoire pour activer le verrouillage
    const newPinEl = document.getElementById('setting-new-pin');
    const newPin = newPinEl.value.trim();
    if (newPin && !/^[0-9]{4,6}$/.test(newPin)) {
      this.app.showToast('Le code doit comporter 4 à 6 chiffres.');
      newPinEl.focus();
      return;
    }
    if (usePin && !newPin && !this.pinHash) {
      this.app.showToast("Choisis un code de 4 à 6 chiffres pour verrouiller l'accès.");
      newPinEl.focus();
      return;
    }
    if (newPin) {
      this.pinHash = TeacherController.hashPin(newPin);
      safeStorage.setItem('kidi3d_teacher_pin_hash', this.pinHash);
      newPinEl.value = '';
    }

    this.usePin = usePin;
    safeStorage.setItem('kidi3d_use_pin', usePin);
    safeStorage.setItem('kidi3d_invert_pan_x', invertPan);
    if (this.app.cameraController) {
      this.app.cameraController.invertPanX = invertPan;
    }

    this.settings = {
      bedSize,
      minThickness,
      autoBase,
      showGrid,
      toolBalloon,
      toolPillar,
      toolShapes,
      toolStamps,
      toolEdit,
      soundEnabled,
      uiScale,
      workScale,
      truncateBed,
      booleanPreview
    };

    safeStorage.setItem('kidi3d_bed_size', bedSize);
    safeStorage.setItem('kidi3d_min_thickness', minThickness);
    safeStorage.setItem('kidi3d_auto_base', autoBase);
    safeStorage.setItem('kidi3d_show_grid', showGrid);
    safeStorage.setItem('kidi3d_tool_balloon', toolBalloon);
    safeStorage.setItem('kidi3d_tool_pillar', toolPillar);
    safeStorage.setItem('kidi3d_tool_shapes', toolShapes);
    safeStorage.setItem('kidi3d_tool_stamps', toolStamps);
    safeStorage.setItem('kidi3d_tool_edit', toolEdit);
    safeStorage.setItem('kidi3d_sound', soundEnabled);
    safeStorage.setItem('kidi3d_ui_scale', uiScale);
    safeStorage.setItem('kidi3d_work_scale', workScale);
    safeStorage.setItem('kidi3d_truncate_bed', truncateBed);
    safeStorage.setItem('kidi3d_bool_preview', booleanPreview);

    this.applySettingsToApp();
    document.getElementById('modal-teacher').classList.add('hidden');
    this.app.showToast('✅ Réglages enregistrés !');
    if (window.soundFx) window.soundFx.playSuccess();
  }

  applySettingsToApp() {
    if (this.app.booleanPreview) this.app.booleanPreview.setEnabled(this.settings.booleanPreview);
    if (this.app.sceneManager) {
      const ws = this.settings.workScale || 1;
      this.app.sceneManager.updatePrintBed(this.settings.bedSize * ws, this.settings.showGrid, 10 * ws);
      if (typeof this.app.onWorkspaceChanged === 'function') this.app.onWorkspaceChanged(this.settings);
    }

    const balloonBtn = document.getElementById('tool-balloon');
    if (balloonBtn) balloonBtn.style.display = this.settings.toolBalloon ? 'flex' : 'none';

    const pillarBtn = document.getElementById('tool-pillar');
    if (pillarBtn) pillarBtn.style.display = this.settings.toolPillar ? 'flex' : 'none';

    const shapesBtn = document.getElementById('tool-shapes');
    if (shapesBtn) shapesBtn.style.display = this.settings.toolShapes ? 'flex' : 'none';

    const stampBtn = document.getElementById('tool-stamps');
    if (stampBtn) stampBtn.style.display = this.settings.toolStamps ? 'flex' : 'none';

    const editBtn = document.getElementById('tool-edit');
    if (editBtn) editBtn.style.display = this.settings.toolEdit ? 'flex' : 'none';

    if (window.soundFx) {
      window.soundFx.enabled = this.settings.soundEnabled;
    }
    const soundIcon = document.getElementById('sound-icon');
    if (soundIcon) soundIcon.innerText = this.settings.soundEnabled ? '🔊' : '🔇';

    // Le minimum de sécurité change la plage utile du curseur « Taille »
    if (typeof this.app.syncThicknessUI === 'function') this.app.syncThicknessUI();

    // Taille de l'interface
    if (typeof this.app.applyUIScale === 'function') this.app.applyUIScale();
  }
}

window.TeacherController = TeacherController;
