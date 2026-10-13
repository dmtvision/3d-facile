/**
 * Kidi3D - Contrôleur de l'Espace Enseignant
 * Paramètres pédagogiques, sécurité d'impression 3D et bridage adapté à l'âge
 */

class TeacherController {
  constructor(app) {
    this.app = app;
    this.usePin = localStorage.getItem('kidi3d_use_pin') === 'true'; // Décoché par défaut
    this.pin = localStorage.getItem('kidi3d_teacher_pin') || '1234';

    // Réglages par défaut
    this.settings = {
      bedSize: parseInt(localStorage.getItem('kidi3d_bed_size') || '256', 10),
      minThickness: parseInt(localStorage.getItem('kidi3d_min_thickness') || '5', 10),
      autoBase: localStorage.getItem('kidi3d_auto_base') === 'true', // Désactivé par défaut !
      showGrid: localStorage.getItem('kidi3d_show_grid') !== 'false',
      toolBalloon: localStorage.getItem('kidi3d_tool_balloon') !== 'false',
      toolPillar: localStorage.getItem('kidi3d_tool_pillar') !== 'false',
      toolShapes: localStorage.getItem('kidi3d_tool_shapes') !== 'false',
      toolStamps: localStorage.getItem('kidi3d_tool_stamps') !== 'false',
      toolEdit: localStorage.getItem('kidi3d_tool_edit') !== 'false',
      soundEnabled: localStorage.getItem('kidi3d_sound') !== 'false',
      uiScale: localStorage.getItem('kidi3d_ui_scale') || 'auto',
      workScale: parseFloat(localStorage.getItem('kidi3d_work_scale') || '1') || 1,
      truncateBed: localStorage.getItem('kidi3d_truncate_bed') !== 'false' // activé par défaut
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
        if (pinInput.value === this.pin) {
          this.showTeacherContent();
          pinInput.value = '';
        } else {
          pinInput.style.borderColor = '#ef4444';
          pinInput.value = '';
          this.app.showToast('Code PIN incorrect (Code par défaut: 1234)');
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
    document.getElementById('setting-invert-pan').checked = localStorage.getItem('kidi3d_invert_pan_x') === 'true';
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

    const newPin = document.getElementById('setting-new-pin').value.trim();
    if (newPin.length >= 4) {
      this.pin = newPin;
      localStorage.setItem('kidi3d_teacher_pin', newPin);
    }

    this.usePin = usePin;
    localStorage.setItem('kidi3d_use_pin', usePin);
    localStorage.setItem('kidi3d_invert_pan_x', invertPan);
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
      truncateBed
    };

    localStorage.setItem('kidi3d_bed_size', bedSize);
    localStorage.setItem('kidi3d_min_thickness', minThickness);
    localStorage.setItem('kidi3d_auto_base', autoBase);
    localStorage.setItem('kidi3d_show_grid', showGrid);
    localStorage.setItem('kidi3d_tool_balloon', toolBalloon);
    localStorage.setItem('kidi3d_tool_pillar', toolPillar);
    localStorage.setItem('kidi3d_tool_shapes', toolShapes);
    localStorage.setItem('kidi3d_tool_stamps', toolStamps);
    localStorage.setItem('kidi3d_tool_edit', toolEdit);
    localStorage.setItem('kidi3d_sound', soundEnabled);
    localStorage.setItem('kidi3d_ui_scale', uiScale);
    localStorage.setItem('kidi3d_work_scale', workScale);
    localStorage.setItem('kidi3d_truncate_bed', truncateBed);

    this.applySettingsToApp();
    document.getElementById('modal-teacher').classList.add('hidden');
    this.app.showToast('✅ Réglages enregistrés !');
    if (window.soundFx) window.soundFx.playSuccess();
  }

  applySettingsToApp() {
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

    // Le minimum de sécurité change la plage utile du curseur « Taille »
    if (typeof this.app.syncThicknessUI === 'function') this.app.syncThicknessUI();

    // Taille de l'interface
    if (typeof this.app.applyUIScale === 'function') this.app.applyUIScale();
  }
}

window.TeacherController = TeacherController;
