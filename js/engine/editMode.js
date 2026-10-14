/**
 * Kidi3D - Mode Édition V5.1
 * - Position du widget stable (ne bouge plus pendant qu'on règle l'épaisseur)
 * - Slider d'épaisseur fluide avec throttle de géométrie
 * - Drag d'objets avec magnétisme/alignement automatique sur les surfaces (raycast + normale)
 * - Restauration complète des icônes et boutons V4
 */

class EditModeManager {
  constructor(app) {
    this.app = app;
    this.selectedMesh = null;
    this.controlHandles = [];
    this.draggedHandle = null;
    this.isDraggingHandle = false;

    // Déplacement direct d'objet avec collage de surface
    this.isDraggingMesh = false;
    this.meshGhost = null;

    // Ligne de courbe en transparence
    this.curveLineMesh = null;

    // Verrou pour empêcher le popup de bouger pendant qu'on clique dedans
    this.isInteractingWithUI = false;

    // Sélection : plusieurs formes possibles (touche Maj). `selectedMesh` reste la forme « principale ».
    this.selection = [];
    this.halos = [];
    this.lockBadges = [];
    this.groupBase = null;

    this.editBarElement = null;
    this.activeHandle = null;

    // Déplacement d'un objet : plan de glissement et décalage entre le doigt et l'objet
    this.dragPlane = null;
    this.dragOffset = new THREE.Vector3();

    // Proportions de l'objet sélectionné
    this.scaleLocked = true;

    // Taille de référence pour le curseur « Taille » du bas (objets non courbes)
    this.sizeBase = null;

    // Les déformations sont recalculées une fois par image (fluidité)
    this.pendingRegen = false;

    this.createEditUI();

    // Repères visuels (largeur / hauteur / taille / rotation) autour des objets non courbes
    this.handles = window.TransformHandles ? new TransformHandles(this) : null;
  }

	setupHandleThicknessUI() {
    const container = document.getElementById('edit-handle-thickness-container');
    if (!container || !this.activeHandle || !this.selectedMesh) return;

    container.style.display = 'block';
    const ptIdx = this.activeHandle.userData.pointIndex;
    const data = this.selectedMesh.userData;
    const val = (data.pointRadii && data.pointRadii[ptIdx]) ? data.pointRadii[ptIdx] : (data.radius || 6);

    const slider = document.getElementById('input-edit-handle-thickness');
    slider.value = val;
    document.getElementById('label-handle-thickness-val').innerText = `${Math.round(val)} mm`;
  }
	
  createEditUI() {
    let bar = document.getElementById('edit-action-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'edit-action-bar';
      bar.className = 'edit-floating-bar hidden';
     bar.innerHTML = `
        <div class="edit-widget-card">
          <div class="edit-head">
            <span id="edit-selection-label" class="edit-selection-label">&#9995; 1 forme</span>
            <span class="edit-shift-tip" title="Maintiens la touche Maj et clique sur d'autres formes pour les sélectionner ensemble">Maj + clic = plusieurs formes</span>
          </div>

          <div class="edit-row-options">
            <button id="btn-edit-delete" class="edit-action-pill danger" title="Jeter la forme">&#128465;&#65039; Jeter</button>
            <button id="btn-edit-deselect" class="edit-action-pill success" title="Terminé">&#10004;&#65039; Fini !</button>
          </div>

          <div id="edit-locked-banner" class="edit-locked-banner">&#128274; Forme verrouillée : elle ne peut plus bouger.</div>

          <div class="edit-body">
          <div class="edit-col">
          <div class="edit-controls">
            <div class="edit-caption">&#128205; Déplacer</div>
            <div class="edit-dpad-section">
              <button id="btn-edit-tilt-x" class="edit-cross-btn edit-tilt-x ax-x" title="Basculer vers l'avant (Maj + clic : vers l'arrière)"><span class="tilt-ico">&#8635;</span><span class="tilt-txt">Basculer</span></button>
              <button id="btn-edit-move-up" class="edit-cross-btn edit-up ax-y" title="Monter">&uarr;</button>
              <button id="btn-edit-move-back" class="edit-cross-btn edit-back ax-z" title="Reculer (vers le fond)">&#8599;</button>
              <button id="btn-edit-move-left" class="edit-cross-btn edit-left ax-x" title="Déplacer à gauche">&larr;</button>
              <div class="edit-cross-center">&#9995;</div>
              <button id="btn-edit-move-right" class="edit-cross-btn edit-right ax-x" title="Déplacer à droite">&rarr;</button>
              <button id="btn-edit-move-front" class="edit-cross-btn edit-front ax-z" title="Avancer (vers toi)">&#8601;</button>
              <button id="btn-edit-move-down" class="edit-cross-btn edit-down ax-y" title="Descendre">&darr;</button>
              <button id="btn-edit-tilt-z" class="edit-cross-btn edit-tilt-z ax-z" title="Pencher vers la droite (Maj + clic : vers la gauche)"><span class="tilt-ico">&#8635;</span><span class="tilt-txt">Pencher</span></button>
            </div>
            <div class="edit-axis-legend">
              <span class="lg lg-x">&harr; Gauche / droite</span>
              <span class="lg lg-y">&varr; Haut / bas</span>
              <span class="lg lg-z">&#8599;&#8601; Avant / arrière</span>
              <span class="lg lg-t">&#8635; Basculer / pencher</span>
            </div>

          </div>
          <button id="btn-edit-lock" class="edit-lock-btn" type="button" title="Verrouiller la forme pour ne plus la déplacer par erreur">
            <span class="lock-ico">&#128274;</span><span class="lock-label">Verrouiller</span>
          </button>
          <button id="btn-edit-cutter" class="edit-lock-btn edit-cutter-btn" type="button" title="Cette forme devient un trou : elle retire de la matière aux autres formes qu'elle traverse (visible à l'impression)">
            <span class="lock-ico">&#128371;&#65039;</span><span class="lock-label">Creuser les autres formes</span>
          </button>
          <div id="edit-cutter-hint" class="edit-cutter-hint">Cette forme est un trou : elle ne sera pas imprimée mais creusera les formes qu'elle traverse.</div>
          </div>
          <div class="edit-col">
          <div class="edit-controls">
            <!-- Section Épaisseur dédiée aux courbes -->
            <div id="edit-thickness-container" class="edit-thickness-section" style="display: none; padding: 6px 0;">
              <div style="font-size: 13px; font-weight: bold; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span>&#128207; Épaisseur</span>
                <span id="label-thickness-val" style="color: #0369a1;">18 mm</span>
              </div>
              <input type="range" id="input-edit-thickness" min="4" max="40" step="1" value="18" style="width: 100%; cursor: pointer;">
            </div>

            <!-- Section Épaisseur d'une seule poignée -->
            <div id="edit-handle-thickness-container" class="edit-thickness-section" style="display: none; padding: 8px 0 4px 0; border-top: 1px dashed #cbd5e1; margin-top: 8px;">
              <div style="font-size: 13px; font-weight: bold; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <span style="display: inline-flex; align-items: center; gap: 6px;">&#128309; &Eacute;paisseur du point</span>
                <span id="label-handle-thickness-val" style="color: #0369a1; font-variant-numeric: tabular-nums; white-space: nowrap; font-weight: 800;">18 mm</span>
              </div>
              <input type="range" id="input-edit-handle-thickness" min="2" max="50" step="1" value="18" style="width: 100%; cursor: pointer;">
            </div>

            <!-- Options du ballon -->
            <div id="edit-balloon-options" class="edit-balloon-box" style="display: none;">
              <div class="edit-caption">&#127880; Mon ballon</div>
              <div class="opt-row"><span class="opt-name">Épaisseur</span><span id="lbl-balloon-depth" class="opt-val">20 mm</span>
                <input type="range" id="edit-balloon-depth" min="14" max="60" step="1" value="20" aria-label="Épaisseur du ballon"></div>
              <div class="opt-row"><span class="opt-name">Bords arrondis</span><span id="lbl-balloon-round" class="opt-val">30 %</span>
                <input type="range" id="edit-balloon-round" min="0" max="100" step="1" value="30" aria-label="Bords arrondis"></div>
              <div class="opt-row"><span class="opt-name">Contour lisse</span><span id="lbl-balloon-smooth" class="opt-val">3</span>
                <input type="range" id="edit-balloon-smooth" min="1" max="5" step="1" value="3" aria-label="Contour lisse"></div>
              <button id="btn-balloon-reset" class="reset-1-1" type="button" title="Revenir aux réglages d'origine du ballon">&#8634; Réglages d'origine</button>
            </div>

            <!-- Proportions de l'objet sélectionné -->
            <details id="edit-scale-box" class="proportions-box">
              <summary>&#128208; Proportions</summary>
              <div class="proportions-head">
                <button id="btn-edit-scale-lock" class="lock-toggle on" type="button" aria-pressed="true" title="Lier ou délier les 3 axes">
                  <span class="lock-ico">&#128279;</span><span class="lock-text">Liés</span>
                </button>
                <button id="btn-edit-scale-reset" class="reset-1-1 is-default" type="button" title="Remettre la taille d'origine (1:1)">&#8634; Reset 1:1</button>
              </div>
              <div class="scale-row"><span class="axis-tag axis-x">Largeur</span><input type="range" id="edit-scale-x" min="0.2" max="3" step="0.05" value="1"><span id="lbl-edit-scale-x" class="scale-val">&times;1.0</span></div>
              <div class="scale-row"><span class="axis-tag axis-y">Hauteur</span><input type="range" id="edit-scale-y" min="0.2" max="3" step="0.05" value="1"><span id="lbl-edit-scale-y" class="scale-val">&times;1.0</span></div>
              <div class="scale-row"><span class="axis-tag axis-z">Profondeur</span><input type="range" id="edit-scale-z" min="0.2" max="3" step="0.05" value="1"><span id="lbl-edit-scale-z" class="scale-val">&times;1.0</span></div>
            </details>

            <div class="edit-caption">&#128260; Tourner, taille, copie</div>
            <div class="edit-row-actions">
              <button id="btn-edit-rot-left" class="edit-sub-btn" title="Tourner vers la gauche"><span class="e-ico">&#8634;</span>Tourner</button>
              <button id="btn-edit-rot-right" class="edit-sub-btn" title="Tourner vers la droite"><span class="e-ico">&#8635;</span>Tourner</button>
              <button id="btn-edit-scale-up" class="edit-sub-btn" title="Agrandir"><span class="e-ico">&#10133;</span>Agrandir</button>
              <button id="btn-edit-scale-down" class="edit-sub-btn" title="Rétrécir"><span class="e-ico">&#10134;</span>Réduire</button>
              <button id="btn-edit-copy" class="edit-sub-btn" title="Faire une copie"><span class="e-ico">&#128111;</span>Copier</button>
              <button id="btn-edit-flip" class="edit-sub-btn" title="Retourner de gauche à droite"><span class="e-ico">&#8596;&#65039;</span>Retourner</button>
            </div>
          </div>
          </div>
          </div>
        </div>
      `;
      document.body.appendChild(bar);
    }
    this.editBarElement = bar;

    // Empêcher la caméra ou le raycast d'intercepter les clics faits sur la carte
    this.editBarElement.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.isInteractingWithUI = true;
    });

    window.addEventListener('pointerup', () => {
      this.isInteractingWithUI = false;
    });

    // Slider d'épaisseur
   // Slider d'épaisseur stabilisé
    const thickSlider = document.getElementById('input-edit-thickness');
    
    thickSlider.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.isInteractingWithUI = true;
    });

    thickSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      if (!this.selectedMesh || !this.selectedMesh.userData) return;
      
      const val = parseFloat(e.target.value);
      document.getElementById('label-thickness-val').innerText = `${val} mm`;

      if (this.selectedMesh.userData.type === 'tube') {
        const d = this.selectedMesh.userData;
        const ratio = val / (d.radius || val);
        d.radius = val;
        if (d.pointRadii) d.pointRadii = d.pointRadii.map(r => Math.max(2, r * ratio));
      } else if (this.selectedMesh.userData.type === 'balloon') {
        this.selectedMesh.userData.thickness = val;
      }

      this.regenerateSelectedMesh();
      // On ne recalcule PAS le popup ici pour éviter qu'il saute !
      this.updateHalo();
    });

    thickSlider.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.isInteractingWithUI = false;
      this.app.saveStateForUndo();
      this.app.autoSave();
    });
	  
	  // Slider d'épaisseur d'une seule poignée (Point local)
    const handleSlider = document.getElementById('input-edit-handle-thickness');

    handleSlider.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.isInteractingWithUI = true;
    });

    handleSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      if (!this.selectedMesh || !this.selectedMesh.userData || !this.activeHandle) return;

      const val = parseFloat(e.target.value);
      document.getElementById('label-handle-thickness-val').innerText = `${val} mm`;

      const ptIdx = this.activeHandle.userData.pointIndex;
      const data = this.selectedMesh.userData;

      // Crée le tableau des rayons individuels s'il n'existe pas encore
      if (!data.pointRadii) {
        const baseR = data.radius || 6;
        data.pointRadii = new Array(data.points.length).fill(baseR);
      }

      // Atténuation douce jusqu'aux poignées voisines pour que la forme reste fluide
      const deltaR = val - data.pointRadii[ptIdx];
      const weights = this.getHandleWeights(ptIdx);
      for (let i = 0; i < data.points.length; i++) {
        if (weights[i] > 0) data.pointRadii[i] = Math.max(2, data.pointRadii[i] + deltaR * weights[i]);
      }

      this.regenerateSelectedMesh();
      this.updateHalo();
    });

    handleSlider.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      this.isInteractingWithUI = false;
      this.app.saveStateForUndo();
      this.app.autoSave();
    });
	  
    // Options du ballon : épaisseur, bords arrondis, contour lisse
    const balloonEdit = (id, apply) => {
      const slider = document.getElementById(id);
      slider.addEventListener('pointerdown', (e) => e.stopPropagation());
      slider.addEventListener('input', (e) => {
        e.stopPropagation();
        const m = this.selectedMesh;
        if (!m || m.userData.type !== 'balloon' || this.isLocked(m)) return;
        apply(m.userData, parseFloat(e.target.value));
        this.pendingRegen = true; // recalculé une fois par image
      });
      slider.addEventListener('change', () => this.commitChange());
    };
    balloonEdit('edit-balloon-depth', (d, v) => {
      d.thickness = v;
      document.getElementById('lbl-balloon-depth').innerText = `${v} mm`;
    });
    balloonEdit('edit-balloon-round', (d, v) => {
      d.bevelRatio = 0.05 + (v / 100) * 0.40;
      document.getElementById('lbl-balloon-round').innerText = `${Math.round(v)} %`;
    });
    balloonEdit('edit-balloon-smooth', (d, v) => {
      d.smoothIterations = v;
      document.getElementById('lbl-balloon-smooth').innerText = `${v}`;
    });
    document.getElementById('btn-balloon-reset').addEventListener('click', () => {
      const m = this.selectedMesh;
      if (!m || m.userData.type !== 'balloon' || this.isLocked(m)) return;
      delete m.userData.bevelRatio;
      delete m.userData.smoothIterations;
      this.regenerateSelectedMesh();
      this.updateHalo();
      this.setupThicknessUI();
      this.commitChange();
    });

    // Les actions s'appliquent aux formes non verrouillées de la sélection
    const act = (id, fn) => {
      document.getElementById(id).addEventListener('click', (ev) => {
        const targets = this.getTargets();
        if (!this.selection.length) return;
        if (!targets.length) { this.app.showToast('🔒 Forme verrouillée : déverrouille-la d\'abord.'); return; }
        fn(targets, ev);
        this.syncTransformVisuals();
        this.commitChange();
      });
    };

    // Les flèches suivent la vue : « droite » est à droite de l'écran, « reculer » vers le fond
    act('btn-edit-move-up', t => this.viewMove(t, 0, 1, 0));
    act('btn-edit-move-down', t => this.viewMove(t, 0, -1, 0));
    act('btn-edit-move-left', t => this.viewMove(t, -1, 0, 0));
    act('btn-edit-move-right', t => this.viewMove(t, 1, 0, 0));
    act('btn-edit-move-back', t => this.viewMove(t, 0, 0, 1));
    act('btn-edit-move-front', t => this.viewMove(t, 0, 0, -1));

    // Basculer / pencher : rotations autour des deux axes horizontaux de la vue (Maj + clic : sens inverse)
    act('btn-edit-tilt-x', (t, ev) => this.tiltSelection(t, 'x', ev && ev.shiftKey ? -1 : 1));
    act('btn-edit-tilt-z', (t, ev) => this.tiltSelection(t, 'z', ev && ev.shiftKey ? -1 : 1));

    act('btn-edit-rot-left', t => this.rotateSelection(t, Math.PI / 8));
    act('btn-edit-rot-right', t => this.rotateSelection(t, -Math.PI / 8));
    act('btn-edit-scale-up', t => this.scaleSelection(t, 1.15));
    act('btn-edit-scale-down', t => this.scaleSelection(t, 0.87));
    act('btn-edit-flip', t => t.forEach(m => this.transformAboutPivot(mm => { mm.scale.x *= -1; }, m)));

    document.getElementById('btn-edit-copy').addEventListener('click', () => {
      if (!this.selection.length) return;
      const copies = this.selection.map(src => {
        const copy = this.app.cloneUserMesh(src);
        delete copy.userData.locked; // la copie est libre, même si l'original est verrouillé
        copy.position.x += (this.app.isInsideBed(new THREE.Vector3(src.position.x + 24, 0, src.position.z)) ? 20 : -20);
        this.app.addMeshToScene(copy);
        return copy;
      });
      this.setSelection(copies);
      this.commitChange();
      if (window.soundFx) window.soundFx.playStamp();
      this.app.showToast(copies.length > 1 ? '👯 Copies faites !' : '👯 Copie faite !');
    });

    // Proportions (largeur / hauteur / profondeur) — une seule forme à la fois
    const axes = ['x', 'y', 'z'];
    axes.forEach(axis => {
      const slider = document.getElementById(`edit-scale-${axis}`);
      slider.addEventListener('input', (e) => {
        e.stopPropagation();
        if (!this.selectedMesh || this.isLocked(this.selectedMesh)) return;
        const val = parseFloat(e.target.value);
        this.transformAboutPivot(m => {
          const current = Math.abs(m.scale[axis]) || 1;
          if (this.scaleLocked) {
            // Axes liés : tous les axes sont multipliés du même facteur, le rapport entre eux est conservé
            m.scale.multiplyScalar(val / current);
          } else {
            m.scale[axis] = (m.scale[axis] < 0 ? -1 : 1) * val;
          }
        });
        this.syncTransformVisuals(false);
      });
      slider.addEventListener('change', () => this.commitChange());
    });

    const lockBtn = document.getElementById('btn-edit-scale-lock');
    lockBtn.addEventListener('click', () => {
      this.scaleLocked = !this.scaleLocked;
      lockBtn.classList.toggle('on', this.scaleLocked);
      lockBtn.setAttribute('aria-pressed', String(this.scaleLocked));
      lockBtn.querySelector('.lock-ico').innerText = this.scaleLocked ? '\u{1F517}' : '\u{1F513}';
      lockBtn.querySelector('.lock-text').innerText = this.scaleLocked ? 'Liés' : 'Libres';
    });

    document.getElementById('btn-edit-scale-reset').addEventListener('click', () => {
      if (!this.selectedMesh || this.isLocked(this.selectedMesh)) return;
      this.transformAboutPivot(m => m.scale.set(1, 1, 1));
      this.syncScaleSliders();
      this.syncTransformVisuals();
      this.commitChange();
      this.app.showToast('↺ Taille d\'origine (1:1)');
    });

    // Verrouiller / déverrouiller toute la sélection
    document.getElementById('btn-edit-lock').addEventListener('click', () => {
      if (!this.selection.length) return;
      const lock = !this.selection.every(m => m.userData.locked);
      this.selection.forEach(m => { if (lock) m.userData.locked = true; else delete m.userData.locked; });
      this.refreshSelectionUI();
      this.commitChange();
      if (window.soundFx) window.soundFx.playPop();
      this.app.showToast(lock ? '🔒 Verrouillé : cette forme ne bougera plus.' : '🔓 Déverrouillé.');
    });

    // Trou (booléen) : la forme retire de la matière aux autres à l'export
    document.getElementById('btn-edit-cutter').addEventListener('click', () => {
      if (!this.selection.length) return;
      const on = !this.selection.every(m => m.userData.cutter);
      this.selection.forEach(m => this.app.setCutter(m, on));
      this.refreshSelectionUI();
      this.commitChange();
      if (window.soundFx) window.soundFx.playPop();
      this.app.showToast(on
        ? '🕳️ Trou ! Cette forme creusera les autres (elle ne sera pas imprimée).'
        : '🧱 Forme pleine : elle sera imprimée.');
    });

    document.getElementById('btn-edit-delete').addEventListener('click', () => {
      const targets = this.getTargets();
      if (!this.selection.length) return;
      if (!targets.length) { this.app.showToast('🔒 Forme verrouillée : déverrouille-la d\'abord.'); return; }
      const skipped = this.selection.length - targets.length;
      targets.forEach(m => this.app.removeMeshFromScene(m));
      this.deselect();
      this.app.saveStateForUndo();
      this.app.autoSave();
      if (window.soundFx) window.soundFx.playDelete();
      this.app.showToast(skipped ? `Supprimé (${skipped} forme verrouillée conservée)` : 'Élément supprimé !');
    });

    document.getElementById('btn-edit-deselect').addEventListener('click', () => this.deselect());
  }

  // ---------------------------------------------------------------- sélection multiple & verrouillage
  isLocked(m) { return !!(m && m.userData && m.userData.locked); }

  // Formes de la sélection qui peuvent être modifiées
  getTargets() { return this.selection.filter(m => !this.isLocked(m)); }

  isMulti() { return this.selection.length > 1; }

  unionBox(meshes) {
    const box = new THREE.Box3();
    meshes.forEach(m => { m.updateWorldMatrix(true, true); box.expandByObject(m); });
    return box;
  }

  // Déplace d'un pas (8 mm) dans le repère de la vue : droite / haut / fond
  viewMove(targets, right, up, back) {
    const cam = this.app.sceneManager.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) {
      // Vue de dessus : « vers le fond » = vers le haut de l'écran
      fwd.set(0, 1, 0).applyQuaternion(cam.quaternion);
      fwd.y = 0;
    }
    fwd.normalize();
    const rightDir = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const step = 8;
    this.moveSelection(
      targets,
      (rightDir.x * right + fwd.x * back) * step,
      up * step,
      (rightDir.z * right + fwd.z * back) * step
    );
  }

  // Déplace des formes ; elles ne passent jamais sous le plateau ni hors de celui-ci
  moveSelection(targets, dx, dy, dz) {
    const box = this.unionBox(targets);
    dy = Math.max(dy, -box.min.y);
    const center = box.getCenter(new THREE.Vector3());
    if (!this.app.isInsideBed(new THREE.Vector3(center.x + dx, 0, center.z + dz), 0)) { dx = 0; dz = 0; }
    targets.forEach(m => { m.position.x += dx; m.position.y += dy; m.position.z += dz; });
  }

  liftAboveBed(targets) {
    const box = this.unionBox(targets);
    if (box.min.y < 0) targets.forEach(m => { m.position.y -= box.min.y; });
  }

  // Rotation de 22,5° autour d'un axe horizontal de la vue : 'x' = axe gauche-droite de l'écran (basculer),
  // 'z' = axe de profondeur (pencher). Une forme tourne autour de son centre, plusieurs autour de leur centre commun.
  tiltSelection(targets, which, sign = 1) {
    const cam = this.app.sceneManager.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) {
      fwd.set(0, 1, 0).applyQuaternion(cam.quaternion);
      fwd.y = 0;
    }
    fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const axis = which === 'x' ? right : fwd;
    const angle = sign * Math.PI / 8;
    // Une forme posée sur la table y reste posée après avoir basculé (elle ne flotte pas)
    const wasOnBed = this.unionBox(targets).min.y <= 0.5;
    const settle = () => {
      if (!wasOnBed) return;
      const dy = this.unionBox(targets).min.y;
      if (Math.abs(dy) > 1e-3) targets.forEach(m => { m.position.y -= dy; });
    };

    if (targets.length === 1) {
      this.transformAboutPivot(m => m.rotateOnWorldAxis(axis, angle), targets[0]);
      settle();
      return;
    }
    const pivot = this.unionBox(targets).getCenter(new THREE.Vector3());
    targets.forEach(m => {
      const rel = m.position.clone().sub(pivot).applyAxisAngle(axis, angle);
      m.position.copy(pivot).add(rel);
      m.rotateOnWorldAxis(axis, angle);
    });
    this.liftAboveBed(targets);
    settle();
  }

  // Rotation autour de l'axe vertical : une forme tourne sur elle-même, plusieurs tournent autour de leur centre commun
  rotateSelection(targets, angle) {
    if (targets.length === 1) {
      this.transformAboutPivot(m => {
        if (m.userData.type === 'stamp') m.rotateY(angle); // tourne autour de son propre « haut »
        else m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), angle);
      }, targets[0]);
      return;
    }
    const pivot = this.unionBox(targets).getCenter(new THREE.Vector3());
    const up = new THREE.Vector3(0, 1, 0);
    targets.forEach(m => {
      const rel = m.position.clone().sub(pivot).applyAxisAngle(up, angle);
      m.position.copy(pivot).add(rel);
      m.rotateOnWorldAxis(up, angle);
    });
    this.liftAboveBed(targets);
  }

  // Agrandissement / réduction : une forme autour de son centre, plusieurs autour de leur centre commun
  scaleSelection(targets, factor) {
    if (targets.length === 1) {
      this.transformAboutPivot(m => m.scale.multiplyScalar(factor), targets[0]);
      return;
    }
    const pivot = this.unionBox(targets).getCenter(new THREE.Vector3());
    targets.forEach(m => {
      const rel = m.position.clone().sub(pivot).multiplyScalar(factor); // à lire AVANT de modifier la position
      m.position.copy(pivot).add(rel);
      m.scale.multiplyScalar(factor);
    });
    this.liftAboveBed(targets);
  }

  // Sélectionne une forme (ou l'ajoute / la retire avec Maj)
  selectMesh(mesh, additive = false) {
    if (!additive) { this.setSelection([mesh]); return; }
    const next = this.selection.slice();
    const i = next.indexOf(mesh);
    if (i >= 0) next.splice(i, 1); else next.push(mesh);
    this.setSelection(next);
  }

  setSelection(list) {
    // 1. on défait l'ancienne sélection
    this.halos.forEach(h => this.app.sceneManager.scene.remove(h));
    this.halos = [];
    this.clearControlHandles();
    this.clearCurveLine();
    this.removeMeshGhost();
    const thickContainer = document.getElementById('edit-thickness-container');
    if (thickContainer) thickContainer.style.display = 'none';
    const handleThickContainer = document.getElementById('edit-handle-thickness-container');
    if (handleThickContainer) handleThickContainer.style.display = 'none';
    const balloonBoxOff = document.getElementById('edit-balloon-options');
    if (balloonBoxOff) balloonBoxOff.style.display = 'none';
    this.activeHandle = null;
    this.sizeBase = null;
    this.groupBase = null;
    this.pendingRegen = false;

    // 2. nouvelle sélection
    this.selection = list.slice();
    this.selectedMesh = this.selection[this.selection.length - 1] || null;

    if (!this.selectedMesh) {
      if (this.handles) this.handles.hide();
      if (this.editBarElement) this.editBarElement.classList.add('hidden');
      if (this.app.endSelectionThickness) this.app.endSelectionThickness();
      return;
    }

    // Cadre violet autour de chaque forme sélectionnée
    this.selection.forEach(m => {
      const halo = new THREE.BoxHelper(m, 0xa855f7);
      halo.material.linewidth = 3;
      this.app.sceneManager.scene.add(halo);
      this.halos.push(halo);
    });

    // Points de modelage des courbes : uniquement pour une seule forme, non verrouillée
    if (!this.isMulti() && !this.isLocked(this.selectedMesh)) {
      this.spawnControlHandles();
      this.spawnCurveLine();
      this.setupThicknessUI();
    }

    // Objet non courbe : le panneau « Proportions » est affiché d'emblée
    const box = document.getElementById('edit-scale-box');
    if (box) box.open = !this.isMulti() && !this.isCurve(this.selectedMesh);

    // Le curseur « Taille » du bas prend la valeur de la sélection
    this.app.beginSelectionThickness();
    this.refreshSizeSlider();
    this.syncScaleSliders();

    this.editBarElement.classList.remove('hidden');
    this.refreshSelectionUI();

    if (window.soundFx) window.soundFx.playPop();
  }

  // Libellés et états du popup (nombre de formes, verrouillage)
  refreshSelectionUI() {
    const bar = this.editBarElement;
    if (!bar || !this.selection.length) return;
    const n = this.selection.length;
    const locked = this.selection.filter(m => this.isLocked(m)).length;
    const allLocked = locked === n;

    bar.classList.toggle('is-multi', n > 1);
    bar.classList.toggle('is-locked', allLocked);
    bar.classList.toggle('is-curve', n === 1 && this.isCurve(this.selectedMesh));

    const label = document.getElementById('edit-selection-label');
    if (label) {
      label.textContent = n === 1
        ? (allLocked ? '\u{1F512} 1 forme verrouillée' : '\u270B 1 forme')
        : `\u270B ${n} formes${locked ? ` (dont ${locked} \u{1F512})` : ''}`;
    }
    const banner = document.getElementById('edit-locked-banner');
    if (banner) banner.style.display = allLocked ? 'block' : 'none';

    const lockBtn = document.getElementById('btn-edit-lock');
    if (lockBtn) {
      lockBtn.classList.toggle('is-unlock', allLocked);
      lockBtn.querySelector('.lock-ico').textContent = allLocked ? '\u{1F513}' : '\u{1F512}';
      lockBtn.querySelector('.lock-label').textContent = allLocked
        ? (n > 1 ? 'Déverrouiller les formes' : 'Déverrouiller')
        : (n > 1 ? 'Verrouiller les formes' : 'Verrouiller');
    }

    const allCutter = this.selection.every(m => m.userData.cutter);
    const cutBtn = document.getElementById('btn-edit-cutter');
    if (cutBtn) {
      cutBtn.classList.toggle('is-on', allCutter);
      cutBtn.querySelector('.lock-ico').textContent = allCutter ? '\u{1F9F1}' : '\u{1F573}\uFE0F';
      cutBtn.querySelector('.lock-label').textContent = allCutter
        ? (n > 1 ? 'Redevenir des formes pleines' : 'Redevenir une forme pleine')
        : (n > 1 ? 'Creuser avec ces formes' : 'Creuser les autres formes');
    }
    const cutHint = document.getElementById('edit-cutter-hint');
    if (cutHint) cutHint.style.display = allCutter ? 'block' : 'none';

    // Si la sélection devient verrouillée, les points de modelage disparaissent
    if (allLocked) {
      this.clearControlHandles();
      this.clearCurveLine();
      const tc = document.getElementById('edit-thickness-container');
      if (tc) tc.style.display = 'none';
      const hc = document.getElementById('edit-handle-thickness-container');
      if (hc) hc.style.display = 'none';
      const bb = document.getElementById('edit-balloon-options');
      if (bb) bb.style.display = 'none';
    } else if (n === 1 && !this.controlHandles.length) {
      this.spawnControlHandles();
      this.spawnCurveLine();
      this.setupThicknessUI();
    }

    this.updateWidgetScreenPosition();
  }

  deselect() {
    this.setSelection([]);
  }

  // Pastilles 🔒 au-dessus des formes verrouillées (outils Bouger et Gomme)
  updateLockBadges() {
    const show = this.app.currentTool === 'edit' || this.app.currentTool === 'eraser';
    const locked = show ? this.app.userMeshes.filter(m => this.isLocked(m)) : [];

    while (this.lockBadges.length < locked.length) {
      const b = document.createElement('div');
      b.className = 'lock-badge';
      b.textContent = '\u{1F512}';
      document.body.appendChild(b);
      this.lockBadges.push(b);
    }
    const cam = this.app.sceneManager.camera;
    this.lockBadges.forEach((b, i) => {
      const m = locked[i];
      if (!m) { b.style.display = 'none'; return; }
      const box = new THREE.Box3().setFromObject(m);
      const p = new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(cam);
      if (p.z > 1) { b.style.display = 'none'; return; }
      b.style.display = 'flex';
      b.style.left = `${(p.x * 0.5 + 0.5) * window.innerWidth}px`;
      b.style.top = `${(-p.y * 0.5 + 0.5) * window.innerHeight - 18}px`;
    });
  }

  // Enregistre l'état courant pour « Annuler » et la sauvegarde automatique
  commitChange() {
    this.app.saveStateForUndo();
    this.app.autoSave();
  }

  syncTransformVisuals(withSound = true) {
    if (this.selectedMesh) {
      // Force Three.js à recalculer immédiatement la position dans le monde
      this.selectedMesh.updateWorldMatrix(true, false);
    }
    this.updateHandlesPosition();
    this.updateCurveLine();
    this.updateHalo();
    this.syncScaleSliders();
    this.refreshSizeSlider();
    this.updateWidgetScreenPosition();
    if (withSound && window.soundFx) window.soundFx.playPop();
  }

  isCurve(mesh = this.selectedMesh) {
    const t = mesh && mesh.userData && mesh.userData.type;
    return t === 'tube' || t === 'balloon';
  }

  // Valeur du curseur « Taille » (mm) qui correspond à l'objet sélectionné
  getThicknessValue(m = this.selectedMesh) {
    if (!m) return this.app.currentThickness;
    const d = m.userData;
    const uniform = Math.cbrt(Math.abs(m.scale.x * m.scale.y * m.scale.z)) || 1;
    switch (d.type) {
      case 'tube': return (d.radius || 6) / 0.4;
      case 'balloon': return (d.thickness || 18) / 2.2 / 0.4;
      case 'pillar': return ((d.radius || 8) / 1.1 / 0.4) * uniform;
      default: return ((d.size || 12) / 0.8) * uniform; // tampons et formes 3D
    }
  }

  // Le curseur du bas affiche la taille de l'objet sélectionné
  refreshSizeSlider() {
    if (!this.selectedMesh) return;
    if (this.isMulti()) {
      const targets = this.getTargets();
      const avg = targets.length
        ? targets.reduce((sum, m) => sum + this.getThicknessValue(m), 0) / targets.length
        : this.app.currentThickness;
      const shown = this.app.showSelectionThickness(avg);
      this.groupBase = {
        value: shown,
        pivot: this.unionBox(targets).getCenter(new THREE.Vector3()),
        items: targets.map(m => ({ m, pos: m.position.clone(), scale: m.scale.clone() }))
      };
      return;
    }
    const shown = this.app.showSelectionThickness(this.getThicknessValue());
    if (!this.isCurve()) {
      this.sizeBase = { scale: this.selectedMesh.scale.clone(), value: shown };
    }
  }

  // Point fixe pendant une rotation / un agrandissement
  getPivotWorld(m = this.selectedMesh) {
    const type = m.userData.type;
    if (type === 'tube' || type === 'balloon') {
      const c = new THREE.Vector3();
      new THREE.Box3().setFromObject(m).getCenter(c);
      return c;
    }
    return m.position.clone(); // tampons, formes, piliers : l'origine est déjà au bon endroit
  }

  transformAboutPivot(applyFn, mesh = this.selectedMesh) {
    const m = mesh;
    if (!m) return;

    m.updateWorldMatrix(true, false);
    const pivotWorld = this.getPivotWorld(m);
    const pivotLocal = m.worldToLocal(pivotWorld.clone());

    applyFn(m);

    m.updateMatrix();
    m.updateWorldMatrix(true, false);
    m.position.add(pivotWorld.clone().sub(m.localToWorld(pivotLocal.clone())));

    // L'objet ne passe jamais sous le plateau
    m.updateWorldMatrix(true, false);
    const bb = new THREE.Box3().setFromObject(m);
    if (bb.min.y < 0) m.position.y -= bb.min.y;
    m.updateWorldMatrix(true, false);
  }

  // Affiche l'échelle réelle de l'objet dans les curseurs « Proportions »
  syncScaleSliders() {
    const m = this.selectedMesh;
    const reset = document.getElementById('btn-edit-scale-reset');
    if (!m) return;
    let isDefault = true;
    ['x', 'y', 'z'].forEach(a => {
      const v = Math.abs(m.scale[a]);
      const slider = document.getElementById(`edit-scale-${a}`);
      const label = document.getElementById(`lbl-edit-scale-${a}`);
      if (slider) {
        slider.value = Math.min(3, Math.max(0.2, v));
        slider.style.setProperty('--fill', `${((slider.value - 0.2) / 2.8) * 100}%`);
      }
      if (label) label.innerText = `\u00d7${v.toFixed(1)}`;
      if (Math.abs(v - 1) > 0.001 || m.scale[a] < 0) isDefault = false;
    });
    if (reset) reset.classList.toggle('is-default', isDefault);
  }

  // Taille imposée par le curseur « Taille » du bas (valeur du curseur, en mm)
  applyThickness(value) {
    const m = this.selectedMesh;
    if (!m || !m.userData) return;
    const data = m.userData;
    if (this.isLocked(m) && !this.isMulti()) return;

    // Plusieurs formes : agrandissement commun autour de leur centre
    if (this.isMulti()) {
      if (!this.groupBase) this.refreshSizeSlider();
      const gb = this.groupBase;
      if (!gb || !gb.items.length) return;
      const factor = value / gb.value;
      gb.items.forEach(it => {
        it.m.position.copy(gb.pivot).add(it.pos.clone().sub(gb.pivot).multiplyScalar(factor));
        it.m.scale.copy(it.scale).multiplyScalar(factor);
      });
      this.liftAboveBed(gb.items.map(it => it.m));
      this.updateHalo();
      return;
    }

    if (data.type === 'tube' || data.type === 'balloon') {
      const radius = this.app.getStrokeRadius(value);
      if (data.type === 'tube') {
        const ratio = radius / (data.radius || radius);
        data.radius = radius;
        if (data.pointRadii) data.pointRadii = data.pointRadii.map(r => Math.max(2, r * ratio));
      } else {
        data.thickness = radius * 2.2;
      }
      this.regenerateSelectedMesh();
      this.updateHalo();
      this.setupThicknessUI();
      return;
    }

    // Tampons, formes, piliers : agrandissement uniforme, les proportions réglées sont conservées
    if (!this.sizeBase) this.refreshSizeSlider();
    const factor = value / this.sizeBase.value;
    this.transformAboutPivot(mm => mm.scale.copy(this.sizeBase.scale).multiplyScalar(factor));
    this.syncScaleSliders();
    this.updateHalo();
  }

  handlePointerDown(pt) {
    if (this.isInteractingWithUI) return true;
    const raycaster = this.getRaycaster(pt);

    // 1. Clic sur une poignée de modelage (une seule courbe à la fois)
    const handleHits = raycaster.intersectObjects(this.controlHandles, false);
    if (handleHits.length > 0) {
      this.draggedHandle = handleHits[0].object;
      this.isDraggingHandle = true;

      // Met toutes les poignées en bleu sauf celle active qui passe en jaune vif
      this.controlHandles.forEach(h => {
        h.material.color.setHex(0x38bdf8);
        h.scale.set(1, 1, 1);
      });
      this.activeHandle = this.draggedHandle;
      this.activeHandle.material.color.setHex(0xfacc15); // Jaune vif
      this.activeHandle.scale.set(1.4, 1.4, 1.4);       // Grossit légèrement

      // Affiche le slider spécifique à ce point
      this.setupHandleThicknessUI();
      return true;
    }

    // 2. Clic sur un maillage
    const hits = raycaster.intersectObjects(this.app.userMeshes, true);
    if (hits.length > 0) {
      let target = hits[0].object;
      while (target.parent && target.parent !== this.app.sceneManager.modelGroup) {
        target = target.parent;
      }

      // Maj enfoncée : on ajoute la forme à la sélection (ou on la retire), sans rien déplacer
      if (pt.shift) {
        this.selectMesh(target, true);
        return true;
      }

      if (!(this.selection.length === 1 && this.selection[0] === target)) {
        this.selectMesh(target);
      }

      // Forme verrouillée : sélectionnée seulement pour pouvoir la déverrouiller
      if (this.isLocked(target)) return true;

      // Les courbes (traits, ballons) ne se déplacent pas à la souris : cela gênerait le placement.
      // On les modifie avec leurs poignées et on les déplace avec les flèches du panneau.
      const type = target.userData.type;
      if (type === 'tube' || type === 'balloon') return true;

      // Glisser direct : on garde le décalage entre le point saisi et l'objet (il ne « saute » pas)
      this.isDraggingMesh = true;
      this.dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        this.app.sceneManager.camera.getWorldDirection(new THREE.Vector3()).negate(),
        hits[0].point
      );
      this.dragOffset.copy(target.position).sub(hits[0].point);
      this.createMeshGhost(target);
      return true;
    }

    // Clic dans le vide : désélectionne, sauf avec Maj (on évite de tout perdre par erreur)
    if (pt.shift) return true;
    this.deselect();
    return false;
  }

  handlePointerMove(pt) {
    if (this.isInteractingWithUI) return;
    const raycaster = this.getRaycaster(pt);

    // A. Modelage de courbe
    if (this.isDraggingHandle && this.draggedHandle && this.selectedMesh) {
      const camDir = new THREE.Vector3();
      this.app.sceneManager.camera.getWorldDirection(camDir).negate();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, this.draggedHandle.position);

      const targetPos = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, targetPos)) {
        if (this.app.isInsideBed && !this.app.isInsideBed(targetPos)) return;

        const deltaWorld = new THREE.Vector3().subVectors(targetPos, this.draggedHandle.position);
        this.draggedHandle.position.copy(targetPos);

        // Déplacement exprimé dans le repère de l'objet (sans normaliser : la distance doit rester exacte)
        const invMat = new THREE.Matrix4().copy(this.selectedMesh.matrixWorld).invert();
        const localDelta = deltaWorld.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(invMat));

        const points = this.selectedMesh.userData.points;
        const targetIndex = this.draggedHandle.userData.pointIndex;
        const weights = this.getHandleWeights(targetIndex);

        for (let i = 0; i < points.length; i++) {
          const weight = weights[i];
          if (weight > 0) {
            points[i].x += localDelta.x * weight;
            points[i].y += localDelta.y * weight;
            points[i].z += localDelta.z * weight;
          }
        }

        this.updateHandlesPosition();
        this.updateCurveLine();
        this.pendingRegen = true; // la géométrie est recalculée une seule fois par image (voir update)
      }
      return;
    }

    // B. Déplacement d'un objet
    if (this.isDraggingMesh && this.selectedMesh) {
      const m = this.selectedMesh;

      if (m.userData.type === 'stamp') {
        // Tampons et formes : ils se collent sur la surface visée (sol ou autre objet)
        const otherMeshes = this.app.userMeshes.filter(o => o !== m);
        const hits = raycaster.intersectObjects(otherMeshes, true);

        let hitPoint = null;
        let hitNormal = null;
        let sink = 0;

        if (hits.length > 0) {
          hitPoint = hits[0].point;
          hitNormal = MeshGenerator.getWorldNormal(hits[0]);
          sink = this.app.getSink(); // posé sur un autre objet : on s'enfonce un peu pour bien fusionner
        } else {
          const groundTarget = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), groundTarget)) {
            hitPoint = groundTarget;
            hitNormal = new THREE.Vector3(0, 1, 0);
          }
        }

        if (hitPoint && this.app.isInsideBed(hitPoint)) {
          const keepScale = m.scale.clone();
          MeshGenerator.orientMeshOnSurface(m, hitPoint, hitNormal, null, sink);
          m.scale.copy(keepScale);
        } else {
          return;
        }
      } else {
        // Tubes, ballons, piliers : glissement libre dans le plan de la vue
        const target = new THREE.Vector3();
        if (!this.dragPlane || !raycaster.ray.intersectPlane(this.dragPlane, target)) return;
        target.add(this.dragOffset);

        const previous = m.position.clone();
        m.position.copy(target);
        m.updateWorldMatrix(true, false);

        const bb = new THREE.Box3().setFromObject(m);
        const center = bb.getCenter(new THREE.Vector3());
        if (bb.min.y < 0) {
          m.position.y -= bb.min.y;
          m.updateWorldMatrix(true, false);
        }
        if (!this.app.isInsideBed(center, 0)) {
          m.position.copy(previous);
          m.updateWorldMatrix(true, false);
          return;
        }
      }

      if (this.meshGhost) {
        this.meshGhost.position.copy(m.position);
        this.meshGhost.quaternion.copy(m.quaternion);
      }

      this.updateHandlesPosition();
      this.updateCurveLine();
      this.updateHalo();
    }
  }

  handlePointerUp() {
    this.flushRegeneration();
    if (this.isDraggingHandle) {
      this.isDraggingHandle = false;
  if (this.draggedHandle) {
        this.draggedHandle.material.color.setHex(0x38bdf8); // bleu
        this.draggedHandle = null;
      }
      this.updateWidgetScreenPosition();
      this.app.saveStateForUndo();
      this.app.autoSave();
      if (window.soundFx) window.soundFx.playPop();
    }

    if (this.isDraggingMesh) {
      this.isDraggingMesh = false;
      this.removeMeshGhost();
      this.updateWidgetScreenPosition();
      this.app.saveStateForUndo();
      this.app.autoSave();
      if (window.soundFx) window.soundFx.playPop();
    }
  }

  // --- VISUALISATION COURBE TRANSPARENTE ---
  spawnCurveLine() {
    this.clearCurveLine();
    if (!this.selectedMesh || !this.selectedMesh.userData.points) return;

    const points = this.selectedMesh.userData.points;
    if (points.length < 2) return;

    const worldPts = points.map(p => {
      const v = new THREE.Vector3(p.x, p.y, p.z);
      this.selectedMesh.localToWorld(v);
      return v;
    });

    const geometry = new THREE.BufferGeometry().setFromPoints(worldPts);
const material = new THREE.LineBasicMaterial({
      color: 0xffffff, // Ligne blanche éclatante pour trancher avec les boules bleues
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false // Évite que le tracé masque d'autres éléments transparents
    });

    this.curveLineMesh = new THREE.Line(geometry, material);
    this.curveLineMesh.renderOrder = 999; // 999 passe devant les boules qui sont à 998
    this.app.sceneManager.scene.add(this.curveLineMesh);
  }

updateCurveLine() {
    if (!this.curveLineMesh || !this.selectedMesh || !this.selectedMesh.userData.points) return;
    
    // Assure la bonne matrice avant de convertir les coordonnées locales en coordonnées monde
    this.selectedMesh.updateWorldMatrix(true, false);

    const points = this.selectedMesh.userData.points;
    const worldPts = points.map(p => {
      const v = new THREE.Vector3(p.x, p.y, p.z);
      this.selectedMesh.localToWorld(v);
      return v;
    });
    this.curveLineMesh.geometry.setFromPoints(worldPts);
  }

  clearCurveLine() {
    if (this.curveLineMesh) {
      this.curveLineMesh.geometry.dispose();
      this.curveLineMesh.material.dispose();
      this.app.sceneManager.scene.remove(this.curveLineMesh);
      this.curveLineMesh = null;
    }
  }

  // --- FANTÔME DE DRAG ---
  createMeshGhost(target) {
    this.removeMeshGhost();
    const ghost = target.clone();
    ghost.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
        c.material.transparent = true;
        c.material.opacity = 0.45;
        c.material.wireframe = true;
      }
    });
    this.meshGhost = ghost;
    this.app.sceneManager.scene.add(this.meshGhost);
  }

  removeMeshGhost() {
    if (this.meshGhost) {
      this.app.sceneManager.scene.remove(this.meshGhost);
      this.meshGhost = null;
    }
  }

setupThicknessUI() {
    const container = document.getElementById('edit-thickness-container');
    const handleContainer = document.getElementById('edit-handle-thickness-container');
    const balloonBox = document.getElementById('edit-balloon-options');

    // Ferme systématiquement le slider de poignée individuelle au départ
    if (handleContainer) handleContainer.style.display = 'none';
    if (balloonBox) balloonBox.style.display = 'none';
    this.activeHandle = null;

    if (!container || !this.selectedMesh) return;

    const data = this.selectedMesh.userData;
    if (data && data.type === 'tube') {
      container.style.display = 'block';
      const slider = document.getElementById('input-edit-thickness');
      const val = data.radius || 18;
      slider.value = val;
      document.getElementById('label-thickness-val').innerText = `${val} mm`;
    } else if (data && data.type === 'balloon' && balloonBox) {
      // Ballon : ses propres réglages (épaisseur, arrondi, lissage)
      container.style.display = 'none';
      balloonBox.style.display = 'block';

      const depth = Math.round(data.thickness || 18);
      const ratio = data.bevelRatio != null ? data.bevelRatio : Math.min(3.5, Math.max(14, depth) * 0.25) / Math.max(14, depth);
      const round = Math.round(Math.min(100, Math.max(0, ((ratio - 0.05) / 0.40) * 100)));
      const smooth = data.smoothIterations || 3;

      const set = (id, lbl, value, text) => {
        const el = document.getElementById(id);
        el.value = value;
        el.style.setProperty('--fill', `${((value - el.min) / (el.max - el.min)) * 100}%`);
        document.getElementById(lbl).innerText = text;
      };
      set('edit-balloon-depth', 'lbl-balloon-depth', depth, `${depth} mm`);
      set('edit-balloon-round', 'lbl-balloon-round', round, `${round} %`);
      set('edit-balloon-smooth', 'lbl-balloon-smooth', smooth, `${smooth}`);
    } else {
      // Pour les cubes, tampons, piliers normaux : tout est masqué
      container.style.display = 'none';
    }
  }

  /**
   * Choisit les points de contrôle d'une courbe selon sa complexité (de 3 à 6 au maximum).
   * Principe : on part des extrémités et on ajoute, un par un, le point le plus éloigné de la
   * forme simplifiée courante (algorithme de Douglas-Peucker), jusqu'à ce que la forme soit
   * bien décrite ou que le maximum soit atteint. Un trait droit garde peu de poignées,
   * un tracé sinueux en reçoit davantage, toujours placées sur ses vrais « virages ».
   */
  pickHandleIndices(points, closed) {
    const n = points.length;
    const MAX = 6;
    const MIN = closed ? 4 : 3;
    const pts = points.map(p => new THREE.Vector3(p.x, p.y, p.z));

    // Taille de la forme : l'écart toléré est proportionnel (≈ 5 % de sa plus grande dimension)
    const box = new THREE.Box3().setFromPoints(pts);
    const tolerance = 0.05 * Math.max(box.getSize(new THREE.Vector3()).length() * 0.6, 10);

    const distToSegment = (p, a, b) => {
      const ab = new THREE.Vector3().subVectors(b, a);
      const len2 = ab.lengthSq();
      const t = len2 > 1e-9 ? THREE.MathUtils.clamp(new THREE.Vector3().subVectors(p, a).dot(ab) / len2, 0, 1) : 0;
      return p.distanceTo(a.clone().addScaledVector(ab, t));
    };

    // Points de départ : les deux extrémités (trait) ou le point de départ + son opposé (contour fermé)
    let chosen;
    if (closed) {
      let far = 0, best = -1;
      for (let i = 1; i < n; i++) {
        const d = pts[i].distanceTo(pts[0]);
        if (d > best) { best = d; far = i; }
      }
      chosen = [0, far].sort((a, b) => a - b);
    } else {
      chosen = [0, n - 1];
    }

    // Point le plus éloigné de la forme simplifiée, dans chaque tronçon entre deux points retenus
    const worstPoint = () => {
      let result = null;
      const segCount = closed ? chosen.length : chosen.length - 1;
      for (let s = 0; s < segCount; s++) {
        const a = chosen[s];
        const b = chosen[(s + 1) % chosen.length];
        const end = b > a ? b : b + n; // un tronçon d'un contour fermé peut passer par la fin du tableau
        for (let k = a + 1; k < end; k++) {
          const i = k % n;
          const d = distToSegment(pts[i], pts[a], pts[b]);
          if (!result || d > result.dist) result = { index: i, dist: d };
        }
      }
      return result;
    };

    while (chosen.length < MAX) {
      const w = worstPoint();
      if (!w || w.dist < tolerance) break;
      chosen.push(w.index);
      chosen.sort((a, b) => a - b);
    }

    // Pas moins de MIN poignées : on coupe en deux le plus long tronçon
    while (chosen.length < MIN) {
      let bestGap = -1, at = 0;
      const segCount = closed ? chosen.length : chosen.length - 1;
      for (let s = 0; s < segCount; s++) {
        const a = chosen[s];
        const b = chosen[(s + 1) % chosen.length];
        const gap = b > a ? b - a : b + n - a;
        if (gap > bestGap) { bestGap = gap; at = Math.floor(a + gap / 2) % n; }
      }
      if (bestGap < 2) break;
      chosen.push(at);
      chosen.sort((a, b) => a - b);
    }

    return chosen;
  }

  spawnControlHandles() {
    this.clearControlHandles();
    if (!this.selectedMesh || !this.selectedMesh.userData.points) return;

    const type = this.selectedMesh.userData.type;
    if (type !== 'tube' && type !== 'balloon') return;

    const points = this.selectedMesh.userData.points;
    if (points.length < 2) return;

    const handleGeo = new THREE.SphereGeometry(4.5, 16, 16);
const handleMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8, // Bleu cyan
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });

    const indices = this.pickHandleIndices(points, type === 'balloon');

    for (const idx of indices) {
      const p = points[idx];
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.renderOrder = 998;

      const worldPos = new THREE.Vector3(p.x, p.y, p.z);
      this.selectedMesh.localToWorld(worldPos);
      handle.position.copy(worldPos);
      handle.userData = { isHandle: true, pointIndex: idx };

      this.app.sceneManager.scene.add(handle);
      this.controlHandles.push(handle);
    }
  }

  // Poids de déformation de chaque point quand on tire la poignée « targetIndex ».
  // Le poids vaut 1 sur la poignée et retombe en douceur jusqu'à 0 sur les poignées voisines :
  // toute la courbe est couverte, aucune zone ne reste « orpheline » sans poignée.
  // Les extrémités d'un trait restent fixes tant qu'on ne tire pas leur propre poignée ;
  // un ballon (contour fermé) boucle sur lui-même.
  getHandleWeights(targetIndex) {
    const points = this.selectedMesh.userData.points;
    const n = points.length;
    const closed = this.selectedMesh.userData.type === 'balloon';
    const idx = this.controlHandles.map(h => h.userData.pointIndex).sort((a, b) => a - b);
    const weights = new Array(n).fill(0);

    const pos = idx.indexOf(targetIndex);
    if (pos === -1) { weights[targetIndex] = 1; return weights; }

    // Distance (en nombre de points) jusqu'aux poignées voisines, de chaque côté
    let spanBefore, spanAfter;
    if (closed) {
      const prev = idx[(pos - 1 + idx.length) % idx.length];
      const next = idx[(pos + 1) % idx.length];
      spanBefore = ((targetIndex - prev) + n) % n || n;
      spanAfter = ((next - targetIndex) + n) % n || n;
    } else {
      spanBefore = pos > 0 ? targetIndex - idx[pos - 1] : 0;
      spanAfter = pos < idx.length - 1 ? idx[pos + 1] - targetIndex : 0;
    }

    for (let i = 0; i < n; i++) {
      let offset = i - targetIndex;
      if (closed) {
        if (offset > n / 2) offset -= n;
        else if (offset < -n / 2) offset += n;
      }
      const span = offset < 0 ? spanBefore : spanAfter;
      if (offset === 0) weights[i] = 1;
      else if (span > 0 && Math.abs(offset) < span) {
        const t = Math.abs(offset) / span;
        weights[i] = 1 - t * t * t * (t * (6 * t - 15) + 10); // « smootherstep » : transition très douce
      }
    }
    return weights;
  }

  updateHandlesPosition() {
    if (!this.selectedMesh || !this.selectedMesh.userData.points) return;
    const points = this.selectedMesh.userData.points;

    this.controlHandles.forEach(h => {
      const idx = h.userData.pointIndex;
      if (points[idx]) {
        const p = points[idx];
        const worldPos = new THREE.Vector3(p.x, p.y, p.z);
        this.selectedMesh.localToWorld(worldPos);
        h.position.copy(worldPos);
      }
    });
  }

  clearControlHandles() {
    this.controlHandles.forEach(h => {
      if (h.geometry) h.geometry.dispose();
      this.app.sceneManager.scene.remove(h);
    });
    this.controlHandles = [];
    this.draggedHandle = null;
    this.isDraggingHandle = false;
  }

  regenerateSelectedMesh() {
    if (!this.selectedMesh || !this.selectedMesh.userData.points) return;

    const data = this.selectedMesh.userData;
    const pts = data.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
    let newGeo = null;

    if (data.type === 'tube' && window.MeshGenerator) {
      newGeo = MeshGenerator.createTubeGeometry(pts, data.radius || 6, {
        radii: data.pointRadii || null
      });
    } else if (data.type === 'balloon' && window.MeshGenerator) {
      const blob = MeshGenerator.createInflatedBlobGeometry(pts, null, data.thickness || 18, {
        quality: 'smooth',
        basisU: data.basisU,
        basisV: data.basisV,
        basisNormal: data.basisNormal,
        bevelRatio: data.bevelRatio,
        smoothIterations: data.smoothIterations
      });
      if (blob) {
        blob.geometry.applyMatrix4(MeshGenerator.getBlobWorldMatrix(blob));
        newGeo = blob.geometry;
      }
    }

    if (newGeo) {
      this.selectedMesh.geometry.dispose();
      this.selectedMesh.geometry = newGeo;
      this.selectedMesh.geometry.computeVertexNormals();

      if (this.app.updateBaseIfActive) {
        this.app.updateBaseIfActive();
      }
    }
  }

  // La barre est fixée à droite par le CSS ; l'application l'ajuste à la taille de l'écran
  // (réduction proportionnelle plutôt que défilement) pour qu'elle soit toujours visible en entier.
  updateWidgetScreenPosition() {
    if (this.editBarElement && this.app.fitPanelToScreen) this.app.fitPanelToScreen(this.editBarElement);
  }

  updateHalo() {
    this.halos.forEach(h => h.update());
  }

  getRaycaster(pt) {
    const ndc = new THREE.Vector2((pt.x / window.innerWidth) * 2 - 1, -(pt.y / window.innerHeight) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.app.sceneManager.camera);
    return raycaster;
  }

  flushRegeneration() {
    if (!this.pendingRegen) return;
    this.pendingRegen = false;
    this.regenerateSelectedMesh();
    this.updateHalo();
  }

  update() {
    if (this.selectedMesh) {
      this.flushRegeneration();
      this.updateHalo();
    }
    if (this.handles) this.handles.update();
    this.updateLockBadges();
  }
}

window.EditModeManager = EditModeManager;