// Camera follow, auto-align, and orbital controls for Metalyceum
import * as THREE from 'three';
import { state } from '../state.js';
import {
  CAMERA_AUTO_ALIGN_DECAY,
  CAMERA_AUTO_ALIGN_DELAY_MS,
  CAMERA_AUTO_ALIGN_START_DELAY_MS,
  CAMERA_DEFAULT_DISTANCE,
  CAMERA_DEFAULT_POLAR_ANGLE,
  CAMERA_EXIT_WATCH_DISTANCE,
  CAMERA_EXIT_WATCH_DURATION_MS,
  CAMERA_EXIT_WATCH_POLAR_ANGLE,
  CAMERA_EXIT_WATCH_TARGET_BACK_OFFSET,
  CAMERA_EXIT_WATCH_YAW,
  CAMERA_HEADING_DECAY,
  CAMERA_TARGET_LOOK_HEIGHT
} from '../config.js';
import { frameIndependentLerp, frameIndependentAngleLerp } from '../math.js';
import { isLocalPlayerUnderRoof } from '../physics.js';

// Scratch variables to cut garbage collection overhead to 0 per frame
const _orbitOffset = new THREE.Vector3();
const _orbitSpherical = new THREE.Spherical();
const _desiredCameraTarget = new THREE.Vector3();
const _lockedCamDir = new THREE.Vector3();

export function getCameraYaw() {
  _orbitOffset.copy(state.camera.position).sub(state.controls.target);
  _orbitOffset.y = 0;
  if (_orbitOffset.lengthSq() < 0.0001) {
    return state.cameraRig.followYaw;
  }
  return Math.atan2(_orbitOffset.x, _orbitOffset.z);
}

export function shouldAutoAlignCamera(now = performance.now()) {
  return state.localPlayer.isMoving &&
    !state.cameraRig.manualControlActive &&
    now - state.cameraRig.lastManualInputAt >= CAMERA_AUTO_ALIGN_DELAY_MS &&
    now - state.cameraRig.movementStartedAt >= CAMERA_AUTO_ALIGN_START_DELAY_MS;
}

export function isExitCameraWatchActive(now = performance.now()) {
  return state.cameraRig.exitWatchUntil > now;
}

export function startExitCameraWatch(now = performance.now()) {
  state.cameraRig.exitWatchUntil = now + CAMERA_EXIT_WATCH_DURATION_MS;
  state.cameraRig.manualControlActive = false;
  state.cameraRig.lastManualInputAt = 0;
}

export function noteManualCameraInput() {
  if (!state.camera || !state.controls) return;
  state.cameraRig.lastManualInputAt = performance.now();
  state.cameraRig.followYaw = getCameraYaw();
  state.cameraRig.desiredYaw = state.cameraRig.followYaw;
  state.camera.getWorldDirection(_lockedCamDir);
  _lockedCamDir.y = 0;
  if (_lockedCamDir.lengthSq() > 0.0001) _lockedCamDir.normalize();
}

export function resetCameraFollow() {
  if (!state.camera || !state.controls) return;

  const playerY = state.localPlayer.mesh
    ? state.localPlayer.mesh.position.y
    : state.localPlayer.y;
  const target = _desiredCameraTarget.set(
    state.localPlayer.x,
    playerY + CAMERA_TARGET_LOOK_HEIGHT,
    state.localPlayer.z
  );

  state.controls.target.copy(target);
  state.cameraRig.followYaw = state.localPlayer.ry + Math.PI;
  state.cameraRig.desiredYaw = state.cameraRig.followYaw;
  state.cameraRig.lastManualInputAt = 0;
  state.cameraRig.manualControlActive = false;
  state.cameraRig.lastPlayerMoving = false;
  state.cameraRig.movementStartedAt = 0;
  state.cameraRig.wasUnderRoof = isLocalPlayerUnderRoof();
  state.cameraRig.exitWatchUntil = 0;

  _orbitSpherical.radius = CAMERA_DEFAULT_DISTANCE;
  _orbitSpherical.phi = CAMERA_DEFAULT_POLAR_ANGLE;
  _orbitSpherical.theta = state.cameraRig.followYaw;
  _orbitSpherical.makeSafe();

  _orbitOffset.setFromSpherical(_orbitSpherical);
  state.camera.position.copy(target).add(_orbitOffset);
  state.camera.lookAt(target);
  state.controls.update();
}

export function orbitCamera(deltaTheta, deltaPhi) {
  noteManualCameraInput();
  _orbitOffset.copy(state.camera.position).sub(state.controls.target);
  _orbitSpherical.setFromVector3(_orbitOffset);
  _orbitSpherical.theta += deltaTheta;
  _orbitSpherical.phi += deltaPhi;
  _orbitSpherical.phi = Math.max(
    state.controls.minPolarAngle,
    Math.min(state.controls.maxPolarAngle, _orbitSpherical.phi)
  );
  _orbitSpherical.makeSafe();
  _orbitOffset.setFromSpherical(_orbitSpherical);
  state.camera.position.copy(state.controls.target).add(_orbitOffset);
  state.camera.lookAt(state.controls.target);
}

export function updateCameraFollow(dt, now = performance.now()) {
  const exitCameraWatchActive = isExitCameraWatchActive(now);
  if (!state.localPlayer.mesh || (!exitCameraWatchActive && !shouldAutoAlignCamera(now))) return;

  _orbitOffset.copy(state.camera.position).sub(state.controls.target);
  _orbitSpherical.setFromVector3(_orbitOffset);
  _orbitSpherical.theta = frameIndependentAngleLerp(
    _orbitSpherical.theta,
    exitCameraWatchActive ? CAMERA_EXIT_WATCH_YAW : state.cameraRig.desiredYaw,
    dt,
    exitCameraWatchActive ? 0.08 : CAMERA_AUTO_ALIGN_DECAY
  );
  _orbitSpherical.radius = frameIndependentLerp(
    _orbitSpherical.radius,
    exitCameraWatchActive ? CAMERA_EXIT_WATCH_DISTANCE : CAMERA_DEFAULT_DISTANCE,
    dt,
    exitCameraWatchActive ? 0.08 : CAMERA_AUTO_ALIGN_DECAY
  );
  _orbitSpherical.phi = frameIndependentLerp(
    _orbitSpherical.phi,
    exitCameraWatchActive ? CAMERA_EXIT_WATCH_POLAR_ANGLE : CAMERA_DEFAULT_POLAR_ANGLE,
    dt,
    exitCameraWatchActive ? 0.08 : CAMERA_AUTO_ALIGN_DECAY
  );
  _orbitSpherical.phi = Math.max(
    state.controls.minPolarAngle,
    Math.min(state.controls.maxPolarAngle, _orbitSpherical.phi)
  );
  _orbitSpherical.makeSafe();
  _orbitOffset.setFromSpherical(_orbitSpherical);
  state.camera.position.copy(state.controls.target).add(_orbitOffset);
  state.camera.lookAt(state.controls.target);
}
