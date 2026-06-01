// Local player kinematics, physics fallback, and collision handling for Metalyceum
import * as THREE from 'three';
import { state } from '../state.js';
import {
  CAMERA_FOLLOW_LERP,
  CAMERA_HEADING_DECAY,
  CAMERA_TARGET_DECAY,
  CAMERA_TARGET_LOOK_AHEAD,
  CAMERA_TARGET_LOOK_HEIGHT,
  CAMERA_EXIT_WATCH_YAW,
  CAMERA_EXIT_WATCH_TARGET_BACK_OFFSET
} from '../config.js';
import { getTerrainHeight, checkCollision } from '../physics.js';
import { isCannonReady, getPlayerBodyRef, teleportPlayer } from '../physics-engine.js';
import { animateAvatarWalk } from '../characters.js';
import { frameIndependentLerp, frameIndependentAngleLerp } from '../math.js';
import {
  getCameraYaw,
  isExitCameraWatchActive,
  shouldAutoAlignCamera
} from './camera.js';

// Reusable scratch variables to cut allocations down to 0 per frame
const _oldPos = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _desiredCameraPos = new THREE.Vector3();
const _desiredCameraTarget = new THREE.Vector3();

const _FOOT_SPREAD = 0.3;
const _TERRAIN_FOLLOW_RATE = 15; // lerp rate for smooth Y follow (frame-independent)

function getFootAnchoredHeight(x, z) {
  const h = getTerrainHeight(x, z);
  const hL = getTerrainHeight(x - _FOOT_SPREAD, z);
  const hR = getTerrainHeight(x + _FOOT_SPREAD, z);
  const hF = getTerrainHeight(x, z + _FOOT_SPREAD * 0.6);
  const hB = getTerrainHeight(x, z - _FOOT_SPREAD * 0.6);
  return Math.max(h, hL, hR, hF, hB);
}

export function updateLocalPlayer(dt, now) {
  if (!state.isJoined || !state.localPlayer.mesh) return;
  if (state.editor.enabled) {
    state.localPlayer.isMoving = false;
    state.localPlayer.velocity.x = 0;
    state.localPlayer.velocity.z = 0;
    animateAvatarWalk(state.localPlayer, dt, now);
    return;
  }

  const oldPos = _oldPos.copy(state.localPlayer.mesh.position);

  const acceleration = 55.0;
  const maxSpeed = 9.5;
  const drag = 8.5;
  const gravity = 25.0;
  const jumpForce = 10.0;

  // Manual physics fallback
  const targetGroundY = getFootAnchoredHeight(state.localPlayer.x, state.localPlayer.z);

  if (!state.localPlayer.isGrounded) {
    state.localPlayer.velocity.y -= gravity * dt;
    state.localPlayer.y += state.localPlayer.velocity.y * dt;

    if (state.localPlayer.y <= targetGroundY) {
      state.localPlayer.y = targetGroundY;
      state.localPlayer.velocity.y = 0;
      state.localPlayer.isGrounded = true;
    }
  } else {
    state.localPlayer.y += (targetGroundY - state.localPlayer.y) *
      Math.min(1, _TERRAIN_FOLLOW_RATE * dt);

    if (state.keys.space) {
      state.localPlayer.velocity.y = jumpForce;
      state.localPlayer.isGrounded = false;
      state.keys.space = false;
    }
  }

  const moveDirection = _moveDir.set(0, 0, 0);
  if (state.keys.w) moveDirection.z -= 1;
  if (state.keys.s) moveDirection.z += 1;
  if (state.keys.a) moveDirection.x -= 1;
  if (state.keys.d) moveDirection.x += 1;
  moveDirection.normalize();

  state.localPlayer.velocity.x -= state.localPlayer.velocity.x * drag * dt;
  state.localPlayer.velocity.z -= state.localPlayer.velocity.z * drag * dt;

  if (moveDirection.lengthSq() > 0) {
    state.camera.getWorldDirection(_camDir);
    _camDir.y = 0;
    if (_camDir.lengthSq() > 0.0001) _camDir.normalize();
    _camRight.crossVectors(state.camera.up, _camDir).negate().normalize();

    const targetDir = _targetDir.set(0, 0, 0)
      .addScaledVector(_camDir, -moveDirection.z)
      .addScaledVector(_camRight, moveDirection.x)
      .normalize();

    state.localPlayer.velocity.x += targetDir.x * acceleration * dt;
    state.localPlayer.velocity.z += targetDir.z * acceleration * dt;
  }

  let speedXZ = Math.sqrt(state.localPlayer.velocity.x * state.localPlayer.velocity.x + state.localPlayer.velocity.z * state.localPlayer.velocity.z);
  if (speedXZ > maxSpeed) {
    state.localPlayer.velocity.x = (state.localPlayer.velocity.x / speedXZ) * maxSpeed;
    state.localPlayer.velocity.z = (state.localPlayer.velocity.z / speedXZ) * maxSpeed;
  }

  const stepX = state.localPlayer.velocity.x * dt;
  const stepZ = state.localPlayer.velocity.z * dt;

  if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
    let nextX = state.localPlayer.x + stepX;
    let nextZ = state.localPlayer.z + stepZ;

    if (!checkCollision(nextX, nextZ)) {
      state.localPlayer.x = nextX;
      state.localPlayer.z = nextZ;
    } else {
      if (!checkCollision(nextX, state.localPlayer.z)) {
        state.localPlayer.x = nextX;
        state.localPlayer.velocity.z = 0;
      }
      else if (!checkCollision(state.localPlayer.x, nextZ)) {
        state.localPlayer.z = nextZ;
        state.localPlayer.velocity.x = 0;
      } else {
        state.localPlayer.velocity.x = 0;
        state.localPlayer.velocity.z = 0;
      }
    }
  }

  // Sync velocity from Cannon body so avatar rotation and animations work
  if (isCannonReady()) {
    const bodyRef = getPlayerBodyRef();
    if (bodyRef) {
      state.localPlayer.velocity.x = bodyRef.velocity.x;
      state.localPlayer.velocity.z = bodyRef.velocity.z;
    }
  }

  // Collision safety net: revert XZ if we ended up inside a wall
  if (checkCollision(state.localPlayer.x, state.localPlayer.z)) {
    state.localPlayer.x = oldPos.x;
    state.localPlayer.z = oldPos.z;
    state.localPlayer.velocity.x = 0;
    state.localPlayer.velocity.z = 0;
    if (isCannonReady()) teleportPlayer(oldPos.x, oldPos.z);
  }

  speedXZ = Math.sqrt(
    state.localPlayer.velocity.x * state.localPlayer.velocity.x +
    state.localPlayer.velocity.z * state.localPlayer.velocity.z
  );

  if (speedXZ > 0.4) {
    const targetAngle = Math.atan2(state.localPlayer.velocity.x, state.localPlayer.velocity.z);
    let diff = targetAngle - state.localPlayer.ry;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    state.localPlayer.ry += diff * 15.0 * dt;
    state.localPlayer.isMoving = true;
  } else {
    state.localPlayer.isMoving = false;
  }

  state.localPlayer.mesh.position.set(state.localPlayer.x, state.localPlayer.y, state.localPlayer.z);
  state.localPlayer.mesh.rotation.y = state.localPlayer.ry;
  
  const delta = _delta.subVectors(state.localPlayer.mesh.position, oldPos);
  _desiredCameraPos.copy(state.camera.position).add(delta);
  state.camera.position.lerp(_desiredCameraPos, CAMERA_FOLLOW_LERP);

  const cameraYaw = getCameraYaw();
  if (isExitCameraWatchActive(now)) {
    state.cameraRig.followYaw = cameraYaw;
    state.cameraRig.desiredYaw = CAMERA_EXIT_WATCH_YAW;
  } else if (state.localPlayer.isMoving && !state.cameraRig.lastPlayerMoving) {
    state.cameraRig.movementStartedAt = now;
    state.cameraRig.followYaw = cameraYaw;
    state.cameraRig.desiredYaw = cameraYaw;
  } else if (!state.localPlayer.isMoving) {
    state.cameraRig.movementStartedAt = 0;
    state.cameraRig.followYaw = cameraYaw;
    state.cameraRig.desiredYaw = cameraYaw;
  } else if (shouldAutoAlignCamera(now)) {
    state.cameraRig.followYaw = cameraYaw;
    state.cameraRig.desiredYaw = frameIndependentAngleLerp(
      state.cameraRig.desiredYaw,
      state.localPlayer.ry + Math.PI,
      dt,
      CAMERA_HEADING_DECAY
    );
  } else {
    state.cameraRig.followYaw = cameraYaw;
    state.cameraRig.desiredYaw = cameraYaw;
  }
  state.cameraRig.lastPlayerMoving = state.localPlayer.isMoving;

  if (speedXZ > 0.18) {
    _targetDir.set(state.localPlayer.velocity.x, 0, state.localPlayer.velocity.z).normalize();
  } else {
    _targetDir.set(Math.sin(state.localPlayer.ry), 0, Math.cos(state.localPlayer.ry));
  }

  _desiredCameraTarget.set(
    state.localPlayer.mesh.position.x,
    state.localPlayer.mesh.position.y + CAMERA_TARGET_LOOK_HEIGHT,
    state.localPlayer.mesh.position.z
  );

  if (state.localPlayer.isMoving) {
    _desiredCameraTarget.addScaledVector(_targetDir, CAMERA_TARGET_LOOK_AHEAD);
  }

  const camLerpFactor = 1 - Math.pow(CAMERA_TARGET_DECAY, dt);
  state.controls.target.lerp(_desiredCameraTarget, camLerpFactor);

  animateAvatarWalk(state.localPlayer, dt, now);
}
