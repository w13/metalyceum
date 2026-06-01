// World Editor and Placeable Assets for Metalyceum
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { state } from './state.js';
import { MAP_SIZE, WORLD_ASSET_CATALOG } from './config.js';
import { getTerrainHeight, getRoomIdForPosition } from './physics.js';
import { rebuildAssetColliders } from './physics-engine.js';
import { closeModal, openModal, registerModal } from './modals.js';
import { closeRoomEventModal } from './room-panel.js';

export function transformControlsMode(mode) {
  if (mode === 'rotate') return 'rotate';
  if (mode === 'scale') return 'scale';
  return 'translate';
}

function makePlacedAssetId() {
  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneAssetDef(asset) {
  return {
    id: asset.id,
    type: asset.type,
    x: Number(asset.x) || 0,
    y: Number(asset.y) || 0,
    z: Number(asset.z) || 0,
    rotationY: Number(asset.rotationY) || 0,
    scale: Number(asset.scale) || 1,
    roomId: Number.isInteger(asset.roomId) ? asset.roomId : -1
  };
}

export function createPlacedAssetModel(type) {
  const group = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: '#6b4f3b', roughness: 0.86 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.78, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#52525b', roughness: 0.9, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 0.15, roughness: 0.55 });

  if (type === 'tree') {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.3, 6), woodMat);
    trunk.position.y = 1.15;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.05, 2.1, 7), leafMat);
    top.position.y = 2.8;
    const top2 = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.55, 7), leafMat);
    top2.position.y = 3.8;
    group.add(trunk, top, top2);
  } else if (type === 'boulder') {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), stoneMat);
    rock.scale.set(1.25, 0.72, 0.95);
    rock.position.y = 0.45;
    group.add(rock);
  } else if (type === 'flower') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 5), new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.85 }));
    stem.position.y = 0.28;
    const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: '#f43f5e', roughness: 0.75, flatShading: true }));
    bloom.position.y = 0.62;
    group.add(stem, bloom);
  } else if (type === 'grass_tuft') {
    const grassMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.9, flatShading: true });
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.48, 3), grassMat);
      blade.position.y = 0.24;
      blade.rotation.z = (i - 2) * 0.16;
      blade.rotation.y = i * 1.25;
      group.add(blade);
    }
  } else if (type === 'lantern') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 6), darkMat);
    pole.position.y = 1.1;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.55), darkMat);
    housing.position.y = 2.35;
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.42, 0.35), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
    glow.position.y = 2.35;
    group.add(pole, housing, glow, new THREE.PointLight('#38bdf8', 0.45, 7, 2));
  } else if (type === 'banner') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), darkMat);
    pole.position.y = 1.6;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.8), accentMat);
    cloth.position.set(0.65, 2.45, 0);
    cloth.rotation.y = Math.PI / 2;
    group.add(pole, cloth);
  } else if (type === 'bench') {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.16, 0.7), woodMat);
    seat.position.y = 0.55;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.65, 0.12), woodMat);
    back.position.set(0, 0.95, -0.33);
    group.add(seat, back);
    [-1.1, 1.1].forEach((x) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 5), darkMat);
      leg.position.set(x, 0.25, 0);
      group.add(leg);
    });
  } else if (type === 'plant') {
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.65, 7), stoneMat);
    planter.position.y = 0.32;
    group.add(planter);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 5), leafMat);
      leaf.position.set(Math.cos(i * 1.25) * 0.12, 1.05, Math.sin(i * 1.25) * 0.12);
      leaf.rotation.z = (i - 2) * 0.12;
      group.add(leaf);
    }
  } else if (type === 'desk') {
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.1), woodMat);
    top.position.y = 0.85;
    group.add(top);
    [-0.95, 0.95].forEach((x) => {
      [-0.38, 0.38].forEach((z) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.8, 5), darkMat);
        leg.position.set(x, 0.4, z);
        group.add(leg);
      });
    });
  } else if (type === 'podium') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.1, 0.9), woodMat);
    base.position.y = 0.55;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.82), woodMat);
    top.position.set(0, 1.2, 0.08);
    top.rotation.x = -Math.PI / 10;
    group.add(base, top);
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return group;
}

export function disposeObjectTree(root) {
  root.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose());
      } else if (child.material) {
        child.material.dispose();
      }
    }
  });
}

export function clearPlacedAssets() {
  if (!state.placedAssetGroup) return;
  for (const entry of state.placedAssets.values()) {
    state.placedAssetGroup.remove(entry.group);
    disposeObjectTree(entry.group);
  }
  state.placedAssets.clear();
  state.editorSelectableObjects.length = 0;
  state.PLACED_ASSET_COLLIDERS.length = 0;
  if (state.editor.transformControls) {
    state.editor.transformControls.detach();
    state.editor.transformControls.visible = false;
  }
}

export function renderPlacedAssets(assetDefs, options = {}) {
  clearPlacedAssets();
  if (!state.placedAssetGroup) return;
  const applyColliders = options.applyColliders !== false;

  assetDefs.forEach((rawAsset) => {
    const asset = cloneAssetDef(rawAsset);
    if (!WORLD_ASSET_CATALOG[asset.type]) return;
    const group = createPlacedAssetModel(asset.type);
    group.position.set(asset.x, asset.y, asset.z);
    group.rotation.y = asset.rotationY;
    group.scale.setScalar(asset.scale);
    group.userData.assetId = asset.id;
    group.userData.assetType = asset.type;

    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.assetId = asset.id;
        state.editorSelectableObjects.push(child);
      }
    });

    state.placedAssetGroup.add(group);
    state.placedAssets.set(asset.id, { group, asset });

    const catalog = WORLD_ASSET_CATALOG[asset.type];
    if (applyColliders && catalog.collidable) {
      const half = catalog.footprint * asset.scale;
      state.PLACED_ASSET_COLLIDERS.push({
        assetId: asset.id,
        minX: asset.x - half,
        maxX: asset.x + half,
        minZ: asset.z - half,
        maxZ: asset.z + half
      });
    }
  });

  if (state.editor.selectedId && state.placedAssets.has(state.editor.selectedId)) {
    attachEditorTransform(state.editor.selectedId);
  } else {
    selectEditorAsset(null);
  }
}

export function serializePlacedAssetsFromMap() {
  return Array.from(state.placedAssets.values()).map(({ asset }) => cloneAssetDef(asset));
}

function getAssetIdFromObject(object) {
  let current = object;
  while (current) {
    if (current.userData && current.userData.assetId) return current.userData.assetId;
    current = current.parent;
  }
  return null;
}

export function setEditorDirty(dirty) {
  state.editor.dirty = dirty;
  const saveBtn = document.getElementById('editor-save-btn');
  if (saveBtn) saveBtn.disabled = !dirty;
  updateEditorStatus();
}

export function updateEditorStatus(message) {
  const status = document.getElementById('editor-status-text');
  if (!status) return;
  if (message) {
    status.textContent = message;
  } else if (state.editor.placingType) {
    status.textContent = `Click the world to place ${WORLD_ASSET_CATALOG[state.editor.placingType].label}.`;
  } else if (state.editor.dirty) {
    status.textContent = 'Unsaved world changes.';
  } else {
    status.textContent = 'Select an asset to place or edit.';
  }
}

export function updateEditorPalette() {
  document.querySelectorAll('.editor-asset-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.assetType === state.editor.placingType);
  });
}

export function updateEditorInspector() {
  const inspector = document.getElementById('editor-inspector');
  const label = document.getElementById('editor-selection-label');
  if (!inspector || !label) return;
  const entry = state.editor.selectedId ? state.placedAssets.get(state.editor.selectedId) : null;
  inspector.classList.toggle('editor-inspector-empty', !entry);

  if (!entry) {
    label.textContent = 'No asset selected.';
    return;
  }

  const asset = entry.asset;
  const catalog = WORLD_ASSET_CATALOG[asset.type];
  label.textContent = catalog ? catalog.label : asset.type;
  document.getElementById('editor-pos-x').value = asset.x.toFixed(1);
  document.getElementById('editor-pos-y').value = asset.y.toFixed(1);
  document.getElementById('editor-pos-z').value = asset.z.toFixed(1);
  document.getElementById('editor-rot-y').value = String(Math.round(THREE.MathUtils.radToDeg(asset.rotationY)));
  document.getElementById('editor-scale').value = asset.scale.toFixed(2);
  const room = state.ROOMS[asset.roomId];
  document.getElementById('editor-room-label').textContent = `Scope: ${room ? room.name : 'Outdoor'}`;
}

export function attachEditorTransform(assetId) {
  if (!state.editor.transformControls) return;
  const entry = state.placedAssets.get(assetId);
  if (!entry) {
    state.editor.transformControls.detach();
    state.editor.transformControls.visible = false;
    return;
  }
  state.editor.transformControls.attach(entry.group);
  state.editor.transformControls.setMode(transformControlsMode(state.editor.mode));
  state.editor.transformControls.visible = state.editor.enabled;
}

export function selectEditorAsset(assetId) {
  state.editor.selectedId = assetId;
  attachEditorTransform(assetId);
  updateEditorInspector();
}

export function syncSelectedAssetFromObject() {
  if (!state.editor.selectedId) return;
  const entry = state.placedAssets.get(state.editor.selectedId);
  if (!entry) return;
  const roomId = getRoomIdForPosition(entry.group.position.x, entry.group.position.z);
  entry.asset.x = Number(entry.group.position.x.toFixed(3));
  entry.asset.y = Number((roomId === -1 ? getTerrainHeight(entry.group.position.x, entry.group.position.z) : 0).toFixed(3));
  entry.asset.z = Number(entry.group.position.z.toFixed(3));
  entry.asset.roomId = roomId;
  entry.asset.rotationY = Number(entry.group.rotation.y.toFixed(5));
  entry.asset.scale = Number(THREE.MathUtils.clamp(entry.group.scale.x, 0.25, 3).toFixed(3));
  entry.group.position.y = entry.asset.y;
  entry.group.scale.setScalar(entry.asset.scale);
  setEditorDirty(true);
  updateEditorInspector();
}

export function placeEditorAsset(type, point) {
  const catalog = WORLD_ASSET_CATALOG[type];
  if (!catalog) return;
  const asset = {
    id: makePlacedAssetId(),
    type,
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3)),
    z: Number(point.z.toFixed(3)),
    rotationY: 0,
    scale: catalog.defaultScale,
    roomId: point.roomId
  };
  const nextAssets = serializePlacedAssetsFromMap().concat(asset);
  renderPlacedAssets(nextAssets, { applyColliders: false });
  selectEditorAsset(asset.id);
  setEditorDirty(true);
}

export function getSurfacePointFromPointer(event) {
  if (!state.camera || !state.renderer) return null;
  const rect = state.renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  
  // Create a raycaster locally or reuse one
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, state.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, point)) return null;
  const roomId = getRoomIdForPosition(point.x, point.z);
  const y = roomId === -1 ? getTerrainHeight(point.x, point.z) : 0;
  return { x: point.x, y, z: point.z, roomId };
}

export function handleEditorCanvasClick(event) {
  if (!state.editor.enabled || state.editor.transformDragging) return false;

  if (state.editor.placingType) {
    const point = getSurfacePointFromPointer(event);
    if (point) {
      placeEditorAsset(state.editor.placingType, point);
      return true;
    }
  }

  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, state.camera);
  const intersects = raycaster.intersectObjects(state.editorSelectableObjects, true);
  selectEditorAsset(intersects.length > 0 ? getAssetIdFromObject(intersects[0].object) : null);
  return true;
}

export function setEditorEnabled(enabled) {
  state.editor.enabled = enabled;
  state.editor.placingType = null;
  const panel = document.getElementById('world-editor-panel');
  if (panel) {
    panel.classList.toggle('active', enabled);
    panel.setAttribute('aria-hidden', enabled ? 'false' : 'true');
  }
  updateEditorPalette();
  updateEditorStatus();
  if (enabled) {
    const roomPanel = state.roomPanelEl || document.getElementById('room-panel');
    if (roomPanel) roomPanel.classList.remove('room-panel-visible');
    closeRoomEventModal({ restoreFocus: false });
    closeModal('editor-auth-modal', { restoreFocus: false });
    state.editor.draftAssets = state.publishedWorldAssets.map(cloneAssetDef);
    renderPlacedAssets(state.editor.draftAssets, { applyColliders: false });
  } else {
    selectEditorAsset(null);
    setEditorDirty(false);
    renderPlacedAssets(state.publishedWorldAssets, { applyColliders: true });
  }
}

export function applyPublishedWorldAssets(assetDefs) {
  state.publishedWorldAssets = Array.isArray(assetDefs) ? assetDefs.map(cloneAssetDef) : [];
  if (state.editor.enabled && state.editor.dirty) {
    updateEditorStatus('Published layout changed. Save or cancel your draft.');
    return;
  }
  renderPlacedAssets(state.publishedWorldAssets, { applyColliders: !state.editor.enabled });
  rebuildAssetColliders(); // sync Cannon asset bodies with updated PLACED_ASSET_COLLIDERS
}

export function saveWorldAssets() {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN || !state.editor.authed) {
    updateEditorStatus('Editor is not connected.');
    return;
  }
  state.socket.send(JSON.stringify({
    type: 'world_assets_save',
    assets: serializePlacedAssetsFromMap()
  }));
  setEditorDirty(false);
  updateEditorStatus('Saving world layout...');
}

export function cancelWorldAssetDraft() {
  state.editor.placingType = null;
  updateEditorPalette();
  setEditorDirty(false);
  renderPlacedAssets(state.publishedWorldAssets, { applyColliders: false });
  updateEditorStatus('Draft discarded.');
}

export function duplicateSelectedAsset() {
  if (!state.editor.selectedId) return;
  const entry = state.placedAssets.get(state.editor.selectedId);
  if (!entry) return;
  const copy = cloneAssetDef(entry.asset);
  copy.id = makePlacedAssetId();
  copy.x = Number((copy.x + 1).toFixed(3));
  copy.z = Number((copy.z + 1).toFixed(3));
  copy.y = copy.roomId === -1 ? Number(getTerrainHeight(copy.x, copy.z).toFixed(3)) : 0;
  const nextAssets = serializePlacedAssetsFromMap().concat(copy);
  renderPlacedAssets(nextAssets, { applyColliders: false });
  selectEditorAsset(copy.id);
  setEditorDirty(true);
}

export function deleteSelectedAsset() {
  if (!state.editor.selectedId) return;
  const nextAssets = serializePlacedAssetsFromMap().filter((asset) => asset.id !== state.editor.selectedId);
  renderPlacedAssets(nextAssets, { applyColliders: false });
  selectEditorAsset(null);
  setEditorDirty(true);
}

export function applyInspectorValues() {
  if (!state.editor.selectedId) return;
  const entry = state.placedAssets.get(state.editor.selectedId);
  if (!entry) return;
  const x = Number.parseFloat(document.getElementById('editor-pos-x').value);
  const y = Number.parseFloat(document.getElementById('editor-pos-y').value);
  const z = Number.parseFloat(document.getElementById('editor-pos-z').value);
  const rot = Number.parseFloat(document.getElementById('editor-rot-y').value);
  const scale = Number.parseFloat(document.getElementById('editor-scale').value);
  if (![x, y, z, rot, scale].every(Number.isFinite)) return;
  const editorLimit = MAP_SIZE / 2 - 10;
  entry.asset.x = THREE.MathUtils.clamp(x, -editorLimit, editorLimit);
  entry.asset.z = THREE.MathUtils.clamp(z, -editorLimit, editorLimit);
  entry.asset.roomId = getRoomIdForPosition(entry.asset.x, entry.asset.z);
  entry.asset.y = entry.asset.roomId === -1 ? THREE.MathUtils.clamp(y, -10, 40) : 0;
  entry.asset.rotationY = THREE.MathUtils.degToRad(rot);
  entry.asset.scale = THREE.MathUtils.clamp(scale, 0.25, 3);
  entry.group.position.set(entry.asset.x, entry.asset.y, entry.asset.z);
  entry.group.rotation.y = entry.asset.rotationY;
  entry.group.scale.setScalar(entry.asset.scale);
  setEditorDirty(true);
  updateEditorInspector();
}

export function initEditorUiHandlers() {
  registerModal({
    id: 'editor-auth-modal',
    root: '#editor-auth-panel',
    surface: '#editor-auth-panel',
    openClass: 'active',
    closeSelectors: ['#close-editor-auth-btn', '#cancel-editor-auth-btn'],
    initialFocusSelector: '#editor-token-input',
    ignoreElements: ['#editor-toggle-btn']
  });

  const palette = document.getElementById('editor-asset-palette');
  if (palette) {
    palette.innerHTML = '';
    Object.entries(WORLD_ASSET_CATALOG).forEach(([type, config]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'editor-asset-btn';
      btn.dataset.assetType = type;
      btn.textContent = config.label;
      btn.addEventListener('click', () => {
        if (!state.editor.enabled) return;
        state.editor.placingType = state.editor.placingType === type ? null : type;
        updateEditorPalette();
        updateEditorStatus();
      });
      palette.appendChild(btn);
    });
  }

  const toggleBtn = document.getElementById('editor-toggle-btn');
  const authPanel = document.getElementById('editor-auth-panel');
  const authForm = document.getElementById('editor-auth-panel');
  const authInput = document.getElementById('editor-token-input');
  const authStatus = document.getElementById('editor-auth-status');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (state.editor.authed) {
        setEditorEnabled(!state.editor.enabled);
      } else if (authPanel) {
        if (authPanel.classList.contains('active')) {
          closeModal('editor-auth-modal');
        } else {
          openModal('editor-auth-modal');
          if (authInput) authInput.select();
        }
      }
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
        if (authStatus) authStatus.textContent = 'Connect to Metalyceum before unlocking the editor.';
        return;
      }
      state.socket.send(JSON.stringify({
        type: 'editor_auth',
        token: authInput ? authInput.value : ''
      }));
      if (authStatus) authStatus.textContent = 'Checking token...';
    });
  }

  const exitBtn = document.getElementById('editor-exit-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => setEditorEnabled(false));
  }

  document.querySelectorAll('.editor-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editor.mode = btn.dataset.editorMode || 'move';
      document.querySelectorAll('.editor-mode-btn').forEach((modeBtn) => {
        modeBtn.classList.toggle('active', modeBtn === btn);
      });
      if (state.editor.transformControls) {
        state.editor.transformControls.setMode(transformControlsMode(state.editor.mode));
      }
    });
  });

  ['editor-pos-x', 'editor-pos-y', 'editor-pos-z', 'editor-rot-y', 'editor-scale'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', applyInspectorValues);
    }
  });

  const duplicateBtn = document.getElementById('editor-duplicate-btn');
  if (duplicateBtn) duplicateBtn.addEventListener('click', duplicateSelectedAsset);

  const deleteBtn = document.getElementById('editor-delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', deleteSelectedAsset);

  const cancelBtn = document.getElementById('editor-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelWorldAssetDraft);

  const saveBtn = document.getElementById('editor-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveWorldAssets);
}

export function initTransformControls() {
  if (!state.camera || !state.renderer || !state.scene) return;
  if (state.editor.transformControls) return;

  const controls = new TransformControls(state.camera, state.renderer.domElement);
  controls.setMode(transformControlsMode(state.editor.mode));
  controls.visible = false;
  controls.addEventListener('dragging-changed', (event) => {
    state.editor.transformDragging = Boolean(event.value);
    if (state.controls) state.controls.enabled = !event.value;
  });
  controls.addEventListener('change', () => {
    if (state.editor.selectedId) syncSelectedAssetFromObject();
  });
  state.scene.add(controls);
  state.editor.transformControls = controls;
}

