// Game Engine, Camera, Rendering Loop, and Physics Update Scheduler for Metalyceum
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state } from './state.js';
import {
  CAMERA_EXIT_WATCH_TARGET_BACK_OFFSET,
  CAMERA_TARGET_DECAY,
  CAMERA_TARGET_LOOK_HEIGHT,
  REMOTE_PLAYER_SMOOTHING,
  WORLD_CONFIG,
  ROOM_HEIGHT
} from './config.js';
import { getRoomIdForPosition, isLocalPlayerUnderRoof } from './physics.js';
import { initCannon } from './physics-engine.js';
import { loadHdriEnvironment } from './environment.js';
import {
  spawnNpcs,
  updateNpcs,
  refreshStaticSceneryVisibility
} from './scenery.js';
import { syncPosition } from './multiplayer.js';
import { updateDebugPanel } from './ui.js';
import {
  closeRoomEventModal,
  scheduleRoomPlayersListRefresh,
  scheduleActiveRoomMediaState,
  updateRoomPanelDetails,
  syncActiveRoomMediaState,
} from './room-panel.js';
import { updateRoomIndicatorAnimations } from './room-animation.js';
import { syncChatScopeWithLocation } from './chat.js';
import { buildMap } from './building.js';
import { renderMinimap } from './minimap.js';
import { animateAvatarWalk } from './characters.js';
import { initTransformControls } from './editor.js';
import { updateDevTools } from './dev-tools.js';

// Camera & Movement Sub-modules — orbitCamera imported once; no duplicate import below.
import {
  orbitCamera,
  isExitCameraWatchActive,
  startExitCameraWatch,
  updateCameraFollow
} from './engine/camera.js';
import { updateLocalPlayer } from './engine/movement.js';
import { updateJetpack } from './engine/jetpack.js';
import { updateTorches } from './lighting.js';

// Fade an array of Object3Ds toward a target opacity each frame.
// Transparent materials lerp; opaque materials switch at 0.5 threshold.
function fadeMeshArray(arr, target, dt) {
  for (let i = 0; i < arr.length; i++) {
    const m = arr[i];
    if (!m || !m.isObject3D) continue;
    if (m.material && m.material.transparent) {
      m.material.opacity = THREE.MathUtils.lerp(m.material.opacity, target, 8 * dt);
      m.material.needsUpdate = true;
      m.visible = m.material.opacity > 0.02;
    } else {
      m.visible = target > 0.5;
    }
  }
}

const _desiredCameraTarget = new THREE.Vector3();

// Lighting transition colors (outdoor → indoor)
const _hemiOutColor = new THREE.Color('#dcc878');
const _hemiInColor = new THREE.Color('#b89050');
const _hemiGndOut = new THREE.Color('#5a4030');
const _hemiGndIn = new THREE.Color('#3a2510');
const _ambOutColor = new THREE.Color('#f5d4a0');
const _ambInColor = new THREE.Color('#e8a040');

// Arrow-key camera angular velocity (RuneScape-style smooth orbit)
let _camVelTheta = 0;
let _camVelPhi = 0;
const _CAM_ACCEL = 5.5;  // rad/s² while key held
const _CAM_MAX   = 1.6;  // rad/s peak speed
const _CAM_DECAY = 7.0;  // exponential decay rate per second after key release

export function detectRoomEntry() {
  const activeRoomId = getRoomIdForPosition(state.localPlayer.x, state.localPlayer.z);

  if (activeRoomId !== state.localPlayer.currentRoom) {
    state.localPlayer.currentRoom = activeRoomId;

    // WebSocket message is just a buffer write — keep it synchronous
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ type: "room_change", room: activeRoomId }));
    }

    // Defer all DOM/media work off the render frame to avoid lag spikes on crossing
    const capturedRoomId = activeRoomId;
    setTimeout(() => {
      if (capturedRoomId !== state.localPlayer.currentRoom) return;

      syncChatScopeWithLocation();

      const panel = state.roomPanelEl;
      if (capturedRoomId === -1) {
        if (panel) {
          panel.classList.remove('room-panel-visible');
          panel.setAttribute('aria-hidden', 'true');
        }
        closeRoomEventModal({ restoreFocus: false });
        syncActiveRoomMediaState({ roomId: -1, stopOtherMedia: true, closeTheater: true });
      } else {
        updateRoomPanelDetails();
        if (panel) {
          panel.classList.add('room-panel-visible');
          panel.setAttribute('aria-hidden', 'false');
        }
        scheduleActiveRoomMediaState({ roomId: capturedRoomId, stopOtherMedia: true, closeTheater: true });
        scheduleRoomPlayersListRefresh();
      }
    }, 0);
  }
}

// Teleport observer to bypass circular updates
window.addEventListener('room-marker-teleport', () => {
  detectRoomEntry();
  syncPosition();
});

// Lazy syncTweaks import — non-blocking, survives missing module
let _syncTweaks = null;
function callSyncTweaks() {
  if (_syncTweaks === null) {
    _syncTweaks = false; // mark as "attempted"
    import('./debug-tweaks.js').then(m => {
      _syncTweaks = m.syncTweaksToEngine;
    }).catch(() => {
      _syncTweaks = undefined; // permanently disabled
    });
  }
  if (typeof _syncTweaks === 'function') _syncTweaks();
}

function updateRemotePlayer(p, dt, now) {
  const remoteLerpSpeed = 1 - Math.pow(REMOTE_PLAYER_SMOOTHING, dt);
  const disconnected = state.disconnectedPlayerIds.has(p.id);

  p.x = THREE.MathUtils.lerp(p.x, p.targetX, remoteLerpSpeed);
  p.y = THREE.MathUtils.lerp(p.y, p.targetY, remoteLerpSpeed);
  p.z = THREE.MathUtils.lerp(p.z, p.targetZ, remoteLerpSpeed);

  let diff = p.targetRy - p.ry;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  p.ry += diff * remoteLerpSpeed;

  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.ry;

  if (!disconnected) {
    animateAvatarWalk(p, dt, now);
    p.mesh.scale.setScalar(1);
  } else {
    // Disconnected: freeze in place, scale down, gray name tag
    p.mesh.scale.setScalar(0.85);
  }

  // Use distanceToSquared (no sqrt) for visibility culling
  const distSq = state.camera.position.distanceToSquared(p.mesh.position);
  p.mesh.visible = distSq < 9025; // 95²
  if (p.nameTag) {
    p.nameTag.visible = distSq < 1764; // 42²
    // Only update material color when disconnect state actually changes
    if (disconnected !== p._wasDisconnected && p.nameTag.material) {
      p.nameTag.material.color.setHex(disconnected ? 0x666666 : 0xffffff);
      p._wasDisconnected = disconnected;
    }
  }
}

export function animate() {
  callSyncTweaks();
  const _now = performance.now();
  const dt = Math.min((_now - state.lastTime) / 1000, 0.1);
  state.lastTime = _now;
  state.frameCount = (state.frameCount || 0) + 1;
  
  const camInputX = (state.cameraKeys.ArrowRight ? 1 : 0) - (state.cameraKeys.ArrowLeft ? 1 : 0);
  const camInputY = (state.cameraKeys.ArrowDown  ? 1 : 0) - (state.cameraKeys.ArrowUp   ? 1 : 0);
  if (camInputX !== 0) {
    _camVelTheta = Math.max(-_CAM_MAX, Math.min(_CAM_MAX, _camVelTheta + camInputX * _CAM_ACCEL * dt));
  } else {
    _camVelTheta *= (1 - Math.min(1, _CAM_DECAY * dt));
    if (Math.abs(_camVelTheta) < 0.001) _camVelTheta = 0;
  }
  if (camInputY !== 0) {
    _camVelPhi = Math.max(-_CAM_MAX, Math.min(_CAM_MAX, _camVelPhi + camInputY * _CAM_ACCEL * dt));
  } else {
    _camVelPhi *= (1 - Math.min(1, _CAM_DECAY * dt));
    if (Math.abs(_camVelPhi) < 0.001) _camVelPhi = 0;
  }
  if (_camVelTheta !== 0 || _camVelPhi !== 0) {
    orbitCamera(_camVelTheta * dt, _camVelPhi * dt);
  }
  
  updateTorches(_now);
  updateLocalPlayer(dt, _now);
  detectRoomEntry();
  syncPosition();

  updateNpcs(dt);
  updateJetpack(dt, _now);
  state.remotePlayers.forEach((p) => {
    updateRemotePlayer(p, dt, _now);
  });

  updateRoomIndicatorAnimations(_now);
  
  const isInside = isLocalPlayerUnderRoof();
  if (state.cameraRig.wasUnderRoof && !isInside) {
    startExitCameraWatch(_now);
  } else if (isInside) {
    state.cameraRig.exitWatchUntil = 0;
  }
  state.cameraRig.wasUnderRoof = isInside;

  if (isExitCameraWatchActive(_now) && state.localPlayer.mesh) {
    _desiredCameraTarget.set(
      state.localPlayer.mesh.position.x,
      state.localPlayer.mesh.position.y + CAMERA_TARGET_LOOK_HEIGHT,
      state.localPlayer.mesh.position.z - CAMERA_EXIT_WATCH_TARGET_BACK_OFFSET
    );
    const exitTargetLerp = 1 - Math.pow(CAMERA_TARGET_DECAY, dt);
    state.controls.target.lerp(_desiredCameraTarget, exitTargetLerp);
  }
  const targetOpacity = isInside ? 0.0 : 1.0;
  
  if (state.ceilingMat) {
    state.ceilingMat.opacity = THREE.MathUtils.lerp(state.ceilingMat.opacity, targetOpacity, 8 * dt);
    state.ceilingMesh.visible = state.ceilingMat.opacity > 0.02;
  }
  if (state.upperWallMat) {
    state.upperWallMat.opacity = THREE.MathUtils.lerp(state.upperWallMat.opacity, targetOpacity, 8 * dt);
  }
  
  // Upper floor fade target — follows elevator ride progress when active
  const _rp = state.elevatorRideProgress || 0;
  const _rideFade = _rp > 0 ? _rp : (isInside ? 0.0 : 1.0);

  // Skip fade loops when far from the building (saves ~140 mesh iterations per frame outdoors)
  const px = state.localPlayer && state.localPlayer.x;
  const pz = state.localPlayer && state.localPlayer.z;
  const nearBuilding = px !== undefined && Math.abs(px) < 45 && Math.abs(pz) < 55;

  if (nearBuilding) {
    // Upper walls — use shared material where present, otherwise fadeMeshArray
    state.upperWalls.forEach(w => {
      if (!w || !w.isObject3D) return;
      if (w.material === state.upperWallMat) {
        w.visible = state.upperWallMat.opacity > 0.02;
        return;
      }
      if (w.material && w.material.transparent) {
        try { w.material.opacity = THREE.MathUtils.lerp(w.material.opacity, _rideFade, 8 * dt); }
        catch(e) {}
        w.visible = w.material.opacity > 0.02;
      } else {
        w.visible = _rideFade > 0.5;
      }
    });

    fadeMeshArray(state.roofMeshes, _rideFade, dt);
  }

  // Second-floor elements: fade in during elevator ride, or based on floor level
  if (nearBuilding) {
    fadeMeshArray(state.upperFloor, _rideFade, dt);
  }

  // ── Smooth indoor/outdoor lighting transition (RuneScape-style) ─────
  const targetMix = isInside ? 1 : 0;
  state._indoorMix += (targetMix - state._indoorMix) * Math.min(1, 2.2 * dt);
  const mix = state._indoorMix;

  if (state.sceneSunLight) {
    state.sceneSunLight.intensity = THREE.MathUtils.lerp(3.2, 0.12, mix);
    if (state.localPlayer && state.localPlayer.mesh) {
      const px = state.localPlayer.x;
      const pz = state.localPlayer.z;
      state.sceneSunLight.position.set(38 + px, 22, 12 + pz);
      state.sceneSunLight.target.position.set(px, 0, pz);
      const d = 28;
      state.sceneSunLight.shadow.camera.left = px - d;
      state.sceneSunLight.shadow.camera.right = px + d;
      state.sceneSunLight.shadow.camera.top = pz - d;
      state.sceneSunLight.shadow.camera.bottom = pz + d;
      state.sceneSunLight.shadow.camera.updateProjectionMatrix();
    }
  }
  if (state.sceneHemisphereLight) {
    state.sceneHemisphereLight.intensity = THREE.MathUtils.lerp(0.12, 0.05, mix);
    state.sceneHemisphereLight.color.lerpColors(_hemiOutColor, _hemiInColor, mix);
    state.sceneHemisphereLight.groundColor.lerpColors(_hemiGndOut, _hemiGndIn, mix);
  }
  if (state.sceneIndoorLight) {
    state.sceneIndoorLight.intensity = THREE.MathUtils.lerp(0, 0.4, mix);
  }
  if (state.sceneAmbientLight) {
    state.sceneAmbientLight.intensity = THREE.MathUtils.lerp(0.045, 0.09, mix);
    state.sceneAmbientLight.color.lerpColors(_ambOutColor, _ambInColor, mix);
  }

  state.controls.update();
  updateCameraFollow(dt, _now);
  updateDebugPanel(_now);
  updateDevTools(_now);

  try {
    // ── Elevator door collider sync ───────────────────────────────────────
    if (state._elevatorDoorCollider) {
      const dc = state._elevatorDoorCollider;
      if (state._elevatorCar) {
        dc.position.y = state._elevatorCar.position.y;
      }
      // Sync the physics Box3 so WALLS collision follows the car.
      // When visible=false (doors open or riding), collapse the Box3 to zero
      // so the player can walk through.
      if (state._elevatorDoorBox) {
        if (dc.visible) {
          state._elevatorDoorBox.copy(new THREE.Box3().setFromObject(dc));
        } else {
          state._elevatorDoorBox.min.set(0, 0, 0);
          state._elevatorDoorBox.max.set(0, 0, 0);
        }
      }
    }

    state.renderer.render(state.scene, state.camera);
  } catch (err) {
    console.error("[Metalyceum] Render error:", err);
  }

  // Throttle to ~10 fps (every 6th frame at 60fps)
  if (state.frameCount % 6 === 0) {
    refreshStaticSceneryVisibility();
    renderMinimap();
  }
  if (state._elevatorTick) state._elevatorTick(dt);
}

// Log startup diagnostics
export function getEngineDiagnostics() {
  // Collect nearby visible objects for debugging misplaced geometry
  const px = state.localPlayer?.x ?? 0;
  const pz = state.localPlayer?.z ?? 0;
  const nearby = [];
  if (state.scene) {
    let idx = 0;
    state.scene.children.forEach((child) => {
      if (idx >= 10) return;
      const d = Math.sqrt(
        (child.position.x - px) ** 2 + (child.position.z - pz) ** 2
      );
      if (d < 50 && child.type === 'Mesh' && child.geometry) {
        const g = child.geometry;
        const params = g.parameters || {};
        const info = `${child.type} d=${d.toFixed(1)} ` +
          `pos=(${child.position.x.toFixed(1)},${child.position.y.toFixed(1)},${child.position.z.toFixed(1)}) ` +
          `geo=${g.type}` +
          (params.width ? ` ${params.width.toFixed(2)}x${params.height?.toFixed(2)}` : '') +
          (params.radiusTop ? ` r=${params.radiusTop?.toFixed(2)} h=${params.height?.toFixed(2)}` : '');
        nearby.push(info);
        idx++;
      }
    });
  }

  return {
    ts: Date.now(),
    fps: state.DEBUG_STATE.fps,
    camera: state.camera ? {
      px: state.camera.position.x.toFixed(2),
      py: state.camera.position.y.toFixed(2),
      pz: state.camera.position.z.toFixed(2)
    } : null,
    player: state.localPlayer ? {
      x: state.localPlayer.x.toFixed(2),
      y: state.localPlayer.y.toFixed(2),
      z: state.localPlayer.z.toFixed(2),
      room: state.localPlayer.currentRoom
    } : null,
    remotePlayers: state.remotePlayers.size,
    roomIndicators: state.ROOM_INDICATORS?.size ?? 0,
    staticScenery: state.STATIC_SCENERY?.length ?? 0,
    upperWalls: state.upperWalls?.length ?? 0,
    roofMeshes: state.roofMeshes?.length ?? 0,
    colliders: state.PLACED_ASSET_COLLIDERS?.length ?? 0,
    sceneObjects: state.scene?.children?.length ?? 0,
    nearby: nearby
  };
}

export function startAnimationLoop() {
  if (state.animationLoopRunning) return;
  state.animationLoopRunning = true;
  state.lastTime = performance.now();
  state.renderer.setAnimationLoop(animate);
}

export function stopAnimationLoop() {
  if (!state.animationLoopRunning) return;
  state.animationLoopRunning = false;
  state.renderer.setAnimationLoop(null);
}

export function onWindowResize() {
  if (!state.camera || !state.renderer) return;
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
}

export function initEngine() {
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color('#6b7a8a');
  state.scene.fog = new THREE.FogExp2('#b8a888', 0.0028);

  state.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 1000);

  state.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.3;

  state.localPlayer.velocity = new THREE.Vector3();
  state.localPlayer.displayVelocity = new THREE.Vector3();

  const container = document.getElementById('game-container');
  if (container) container.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.025;
  state.controls.screenSpacePanning = false;
  state.controls.minDistance = 2;
  state.controls.maxDistance = 64;
  state.controls.maxPolarAngle = Math.PI / 2 - 0.04;
  state.controls.minPolarAngle = 0.1;

  state.sceneAmbientLight = new THREE.AmbientLight('#f5d4a0', 0.045);
  state.scene.add(state.sceneAmbientLight);

  state.sceneHemisphereLight = new THREE.HemisphereLight('#dcc878', '#5a4030', 0.12);
  state.sceneHemisphereLight.position.set(0, 50, 0);
  state.scene.add(state.sceneHemisphereLight);

  state.sceneSunLight = new THREE.DirectionalLight('#f0c878', 3.2);
  state.sceneSunLight.position.set(38, 22, 12);
  state.sceneSunLight.castShadow = true;
  state.sceneSunLight.shadow.mapSize.width = 1024;
  state.sceneSunLight.shadow.mapSize.height = 1024;
  state.sceneSunLight.shadow.camera.near = 0.5;
  state.sceneSunLight.shadow.camera.far = 180;
  const d = 24;
  state.sceneSunLight.shadow.camera.left = -d;
  state.sceneSunLight.shadow.camera.right = d;
  state.sceneSunLight.shadow.camera.top = d;
  state.sceneSunLight.shadow.camera.bottom = -d;
  state.sceneSunLight.shadow.bias = -0.0008;
  state.sceneSunLight.shadow.normalBias = 0.02;
  state.scene.add(state.sceneSunLight);
  state.scene.add(state.sceneSunLight.target);

  // Warm fill light from the opposite side — prevents pure-black shadows
  const fillLight = new THREE.DirectionalLight('#d4a060', 0.10);
  fillLight.position.set(-28, 22, -14);
  state.scene.add(fillLight);

  // Warm indoor ambient light — activated when the player enters the building
  state.sceneIndoorLight = new THREE.PointLight('#fbd14b', 0, 60);
  state.sceneIndoorLight.position.set(0, 8, 0);
  state.scene.add(state.sceneIndoorLight);
  state._indoorMix = 0; // 0=fully outdoor, 1=fully indoor — smooth transition

  state.skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 16, 16),
    new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color('#5070a0') },
        bottomColor: { value: new THREE.Color('#d4b888') },
        offset: { value: 33 },
        exponent: { value: 0.6 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `
    })
  );
  state.scene.add(state.skyDome);
  
  buildMap();
  initCannon(); // async, non-blocking — fallback collision runs until CDN resolves
  refreshStaticSceneryVisibility();
  
  const event = new CustomEvent('room-marker-teleport');
  window.dispatchEvent(event);
  
  spawnNpcs();

  window.addEventListener('resize', onWindowResize);
  const loading = document.getElementById('loading-screen');
  if (loading) loading.classList.remove('active');
  
  setTimeout(() => loadHdriEnvironment(), 100);
  initTransformControls();

  window.__metalyceumDiagnostics = getEngineDiagnostics;
}

export {
  noteManualCameraInput,
  resetCameraFollow,
  orbitCamera,
  updateCameraFollow
} from './engine/camera.js';
export { updateLocalPlayer } from './engine/movement.js';
export { animateAvatarWalk } from './characters.js';
