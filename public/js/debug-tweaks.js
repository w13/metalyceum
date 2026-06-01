// Lil-gui Debug Tweaks for Metalyceum
// Live parameter sliders toggleable via the backtick (`) key.
import * as THREE from 'three';
import GUI from 'lil-gui';
import { state } from './state.js';
import {
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_DEFAULT_POLAR_ANGLE,
  CAMERA_FOLLOW_LERP,
  CAMERA_TARGET_DECAY,
  WORLD_CONFIG
} from './config.js';

let gui = null;
let guiVisible = false;

// ── Tweaked values (set from GUI, read by the engine) ───────────────────
export const tweaks = {
  // Terrain (getTerrainHeight)
  terrainHillAmp1: 2.2,
  terrainHillAmp2: 1.5,
  terrainFreq1: 0.1,
  terrainFreq2: 0.05,
  terrainBlendRate: 0.08,
  terrainFlatRadius: 52,

  // Player
  walkAcceleration: 55.0,
  maxSpeed: 9.5,
  drag: 8.5,
  jumpForce: 10.0,

  // Physics
  collisionRadius: 0.4,

  // Camera
  camDefaultDist: CAMERA_DEFAULT_DISTANCE,
  camDefaultPolar: CAMERA_DEFAULT_POLAR_ANGLE,
  camFollowLerp: CAMERA_FOLLOW_LERP,
  camTargetDecay: CAMERA_TARGET_DECAY,
  camMinPolar: 0.65,
  camMaxPolar: Math.PI / 2.1,

  // Lighting
  sunIntensity: 0.92,
  hemiIntensity: 0.78,
  fogDensity: 0.012,
  fogColor: WORLD_CONFIG.fogColor
};

// ── Apply knobs that touch scene objects (called once per frame when changed) ──
let needsApply = true;

export function markTweaksDirty() { needsApply = true; }

export function applyTweaks() {
  if (!needsApply) return;
  needsApply = false;

  if (state.scene) {
    state.scene.fog = new THREE.FogExp2(tweaks.fogColor, tweaks.fogDensity);
  }
  if (state.sceneSunLight) {
    state.sceneSunLight.intensity = tweaks.sunIntensity;
  }
  if (state.sceneHemisphereLight) {
    state.sceneHemisphereLight.intensity = tweaks.hemiIntensity;
  }
  if (state.controls) {
    state.controls.minDistance = 3;
    state.controls.maxDistance = 35;
    state.controls.minPolarAngle = tweaks.camMinPolar;
    state.controls.maxPolarAngle = tweaks.camMaxPolar;
  }
}

// ── Build the GUI panel ─────────────────────────────────────────────────
export function initDebugTweaks() {
  if (gui) return;
  gui = new GUI({ 
    title: 'Debug Tweaks',
    width: 280,
    container: document.body
  });
  gui.domElement.style.position = 'absolute';
  gui.domElement.style.top = '60px';
  gui.domElement.style.right = '16px';
  gui.domElement.style.zIndex = '1100';
  gui.domElement.style.display = 'none'; // hidden until toggled

  // ── Terrain folder ──────────────────────────────────────────────────────
  const terrain = gui.addFolder('Terrain');
  terrain.add(tweaks, 'terrainHillAmp1', 0, 5, 0.1).name('Hill Amp 1').onChange(markTweaksDirty);
  terrain.add(tweaks, 'terrainHillAmp2', 0, 5, 0.1).name('Hill Amp 2').onChange(markTweaksDirty);
  terrain.add(tweaks, 'terrainFreq1', 0.01, 0.5, 0.01).name('Freq 1').onChange(markTweaksDirty);
  terrain.add(tweaks, 'terrainFreq2', 0.01, 0.5, 0.01).name('Freq 2').onChange(markTweaksDirty);
  terrain.add(tweaks, 'terrainBlendRate', 0.01, 0.5, 0.01).name('Blend Rate').onChange(markTweaksDirty);
  terrain.add(tweaks, 'terrainFlatRadius', 10, 100, 1).name('Flat Radius').onChange(markTweaksDirty);
  terrain.open();

  // ── Player folder ────────────────────────────────────────────────────────
  const player = gui.addFolder('Player');
  player.add(tweaks, 'walkAcceleration', 10, 120, 1).name('Acceleration');
  player.add(tweaks, 'maxSpeed', 2, 20, 0.5).name('Max Speed');
  player.add(tweaks, 'drag', 1, 20, 0.5).name('Drag');
  player.add(tweaks, 'jumpForce', 3, 25, 0.5).name('Jump Force');
  player.add(tweaks, 'collisionRadius', 0.1, 1.0, 0.05).name('Collision Radius');
  player.open();

  // ── Camera folder ───────────────────────────────────────────────────────
  const camera = gui.addFolder('Camera');
  camera.add(tweaks, 'camDefaultDist', 5, 40, 0.5).name('Default Distance');
  camera.add(tweaks, 'camDefaultPolar', 0.3, 1.5, 0.05).name('Default Polar');
  camera.add(tweaks, 'camFollowLerp', 0.00001, 0.1, 0.0001).name('Follow Lerp');
  camera.add(tweaks, 'camTargetDecay', 0.001, 0.5, 0.01).name('Target Decay');
  camera.add(tweaks, 'camMinPolar', 0.3, 1.5, 0.05).name('Min Polar');
  camera.add(tweaks, 'camMaxPolar', 0.3, 1.5, 0.05).name('Max Polar');
  camera.open();

  // ── Lighting folder ─────────────────────────────────────────────────────
  const lighting = gui.addFolder('Lighting');
  lighting.add(tweaks, 'sunIntensity', 0, 2, 0.05).name('Sun Intensity').onChange(markTweaksDirty);
  lighting.add(tweaks, 'hemiIntensity', 0, 2, 0.05).name('Hemi Intensity').onChange(markTweaksDirty);
  lighting.add(tweaks, 'fogDensity', 0, 0.05, 0.001).name('Fog Density').onChange(markTweaksDirty);
  lighting.addColor(tweaks, 'fogColor').name('Fog Color').onChange(markTweaksDirty);
  lighting.open();

  // Show if debug was already active
  if (state.DEBUG_STATE.enabled) {
    gui.domElement.style.display = '';
    guiVisible = true;
  }
}

// Polled each frame from the animation loop — syncs state and toggles visibility
export function syncTweaksToEngine() {
  if (!gui) return;
  if (state.DEBUG_STATE.enabled !== guiVisible) {
    guiVisible = state.DEBUG_STATE.enabled;
    gui.domElement.style.display = guiVisible ? '' : 'none';
    if (guiVisible) applyTweaks();
  }
  if (guiVisible) applyTweaks();
}
