// Local player kinematics, physics fallback, and collision handling for Metalyceum
import * as THREE from 'three';
import { state } from '../state.js';
import {
  MAP_SIZE,
  CAMERA_FOLLOW_LERP,
  CAMERA_HEADING_DECAY,
  CAMERA_TARGET_DECAY,
  CAMERA_TARGET_LOOK_AHEAD,
  CAMERA_TARGET_LOOK_HEIGHT,
  CAMERA_EXIT_WATCH_YAW,
  CAMERA_EXIT_WATCH_TARGET_BACK_OFFSET,
  FOOT_SPREAD,
  TERRAIN_FOLLOW_RATE,
  WATER_BOUNDS
} from '../config.js';
import { getTerrainHeight, checkCollision, getWaterSurfaceHeight } from '../physics.js';
import { isCannonReady, getPlayerBodyRef, teleportPlayer, syncBodyY, stepCannon } from '../physics-engine.js';
import { frameIndependentLerp, frameIndependentAngleLerp } from '../math.js';
import { animateAvatarWalk } from '../characters.js';
import { animateAvatarSwim } from '../animations.js';
import { toggleJetpackTakeoff, toggleJetpackLand, updateJetpack } from './jetpack.js';
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

// Cache for foot-anchored height — skips 4 redundant terrain samples when
// the player hasn't moved measurably (common during idle/chatting).
let _lastFootX = -99999, _lastFootZ = -99999;
let _cachedFootHeight = 0;
const _desiredCameraTarget = new THREE.Vector3();

const _FOOT_SPREAD = FOOT_SPREAD;
const _TERRAIN_FOLLOW_RATE = TERRAIN_FOLLOW_RATE;
const _WATER_BOUNDS = WATER_BOUNDS;

function getFootAnchoredHeight(x, z, precise = true) {
  if (!precise) return getTerrainHeight(x, z); // single sample for airborne/swimming
  // Cache: skip all 4 foot-spread calls when player hasn't moved measurably
  const dx = x - _lastFootX;
  const dz = z - _lastFootZ;
  if (dx * dx + dz * dz < 0.0001) return _cachedFootHeight;
  _lastFootX = x;
  _lastFootZ = z;
  const h = getTerrainHeight(x, z);
  const hL = getTerrainHeight(x - _FOOT_SPREAD, z);
  const hR = getTerrainHeight(x + _FOOT_SPREAD, z);
  const hF = getTerrainHeight(x, z + _FOOT_SPREAD * 0.6);
  const hB = getTerrainHeight(x, z - _FOOT_SPREAD * 0.6);
  _cachedFootHeight = Math.max(h, hL, hR, hF, hB);
  return _cachedFootHeight;
}

export function updateLocalPlayer(dt, now) {
  if (!state.isJoined || !state.localPlayer.mesh) return;
  if (state.editor.enabled) {
    state.localPlayer.isMoving = false;
    state.localPlayer.velocity.x = 0;
    state.localPlayer.velocity.z = 0;
    state.localPlayer.swimming ? animateAvatarSwim(state.localPlayer, dt, now) : animateAvatarWalk(state.localPlayer, dt, now, state.keys.shift);
    return;
  }

  // Lock XZ movement while riding the elevator — car + player Y are animated by elevator.js
  if (state.elevator.isRiding) {
    state.localPlayer.velocity.x = 0;
    state.localPlayer.velocity.z = 0;
    state.localPlayer.isMoving = false;
  }

  const oldPos = _oldPos.copy(state.localPlayer.mesh.position);

  const acceleration = 55.0;
  const maxSpeed = 9.5;
  const sprintSpeed = 9.5 * 5; // 5x normal speed
  const drag = 8.5;
  const gravity = 25.0;
  const jumpForce = 10.0;

  // Precision ground sampling: use single-sample when airborne or swimming (no edge-snapping needed)
  const needPreciseTerrain = !state.localPlayer.flying && !state.localPlayer.swimming
    && state.localPlayer.isGrounded;
  const targetGroundY = getFootAnchoredHeight(
    state.localPlayer.x, state.localPlayer.z, needPreciseTerrain
  );

  // ── Jetpack flight ───────────────────────────────────────────────────
  if (state.keys.t && state.localPlayer.isGrounded) {
    toggleJetpackTakeoff();
  }
  if (state.keys.y && state.localPlayer.flying) {
    toggleJetpackLand();
  }

  // Swimming check — quick XZ bounding-box pre-check skips the polyline scan when far from water
  const _lx = state.localPlayer.x;
  const _lz = state.localPlayer.z;
  const _nearWater = _lx >= _WATER_BOUNDS.minX && _lx <= _WATER_BOUNDS.maxX
                  && _lz >= _WATER_BOUNDS.minZ && _lz <= _WATER_BOUNDS.maxZ;
  const waterY = _nearWater ? getWaterSurfaceHeight(_lx, _lz) : null;
  const inWater = waterY !== null;
  state.localPlayer.swimming = inWater && state.localPlayer.y < waterY + 0.1; // swim at surface level

  if (state.localPlayer.flying) {
    // Flight mode — WASD moves you at high speed relative to camera,
    // Space=up, Shift=down. Arrow keys orbit camera normally (no conflict).
    const flySpeed = 22.0;
    const ascendSpeed = 12.0;
    const vDir = (state.keys.space ? 1 : 0) - (state.keys.shift ? 1 : 0);
    state.localPlayer.velocity.y += vDir * ascendSpeed * dt;
    state.localPlayer.velocity.y = Math.max(-ascendSpeed * 0.7, Math.min(ascendSpeed * 0.7, state.localPlayer.velocity.y));
    state.localPlayer.y += state.localPlayer.velocity.y * dt;

    const terrainY = getTerrainHeight(state.localPlayer.x, state.localPlayer.z);
    const maxAlt = terrainY + 30;
    if (state.localPlayer.y > maxAlt) {
      state.localPlayer.y = maxAlt;
      state.localPlayer.velocity.y = Math.min(state.localPlayer.velocity.y, 0);
    }

  } else if (!state.localPlayer.isGrounded) {
    // Free-fall or landing after pressing Y
    if (!state.localPlayer.flying) {
      state.localPlayer.velocity.y -= gravity * dt;
    }
    state.localPlayer.y += state.localPlayer.velocity.y * dt;

    if (!state.localPlayer.flying && state.localPlayer.velocity.y <= 0 && state.localPlayer.y <= targetGroundY) {
      state.localPlayer.y = targetGroundY;
      state.localPlayer.velocity.y = 0;
      state.localPlayer.isGrounded = true;
    }
  } else {
    // Swimming: float at chest-depth on water instead of walking on riverbed
    if (inWater && waterY !== null && targetGroundY < waterY + 0.3) {
      const floatY = waterY + 0.2; // waist-deep — float higher
      state.localPlayer.y += (floatY - state.localPlayer.y) * Math.min(1, 4 * dt);
      state.localPlayer.velocity.y = 0;
    } else {
      state.localPlayer.y += (targetGroundY - state.localPlayer.y) *
        Math.min(1, _TERRAIN_FOLLOW_RATE * dt);
    }
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

  const isSprinting = state.localPlayer.flying ? false : state.keys.shift;

  if (moveDirection.lengthSq() > 0) {
    state.camera.getWorldDirection(_camDir);
    _camDir.y = 0;
    if (_camDir.lengthSq() > 0.0001) _camDir.normalize();
    _camRight.crossVectors(state.camera.up, _camDir).negate().normalize();

    const targetDir = _targetDir.set(0, 0, 0)
      .addScaledVector(_camDir, -moveDirection.z)
      .addScaledVector(_camRight, moveDirection.x)
      .normalize();

    const accel = state.localPlayer.flying ? 180 : (isSprinting ? acceleration * 1.8 : acceleration);
    state.localPlayer.velocity.x += targetDir.x * accel * dt;
    state.localPlayer.velocity.z += targetDir.z * accel * dt;
  }

  const speedLimit = state.localPlayer.flying ? 22.0 : (isSprinting ? sprintSpeed : maxSpeed);
  let speedXZ = Math.sqrt(state.localPlayer.velocity.x * state.localPlayer.velocity.x + state.localPlayer.velocity.z * state.localPlayer.velocity.z);
  if (speedXZ > speedLimit) {
    state.localPlayer.velocity.x = (state.localPlayer.velocity.x / speedXZ) * speedLimit;
    state.localPlayer.velocity.z = (state.localPlayer.velocity.z / speedXZ) * speedLimit;
  }

  const body = isCannonReady() ? getPlayerBodyRef() : null;
  if (body) {
    // Cannon path: push control velocity to body, step, read XZ position back.
    // Control velocity (state.localPlayer.velocity) is never overwritten by Cannon —
    // post-collision velocity goes to displayVelocity for animation/rotation only.
    body.velocity.x = state.localPlayer.velocity.x;
    body.velocity.z = state.localPlayer.velocity.z;
    syncBodyY(state.localPlayer.y); // keeps body at correct height so wall colliders intersect
    stepCannon(dt);
    state.localPlayer.x = body.position.x;
    state.localPlayer.z = body.position.z;
    state.localPlayer.displayVelocity.x = body.velocity.x;
    state.localPlayer.displayVelocity.z = body.velocity.z;

    // Safety net: map boundary only. Cannon handles wall/asset contacts.
    // Any sphere-vs-wall check here fires on valid Cannon contacts and breaks sliding.
    const _mapLim = MAP_SIZE / 2 - 2;
    if (Math.abs(state.localPlayer.x) > _mapLim || Math.abs(state.localPlayer.z) > _mapLim) {
      state.localPlayer.x = oldPos.x;
      state.localPlayer.z = oldPos.z;
      state.localPlayer.velocity.x = 0;
      state.localPlayer.velocity.z = 0;
      teleportPlayer(oldPos.x, oldPos.z);
    }
  } else {
    // Fallback: axis-split manual collision (used until Cannon CDN loads, or on failure).
    const stepX = state.localPlayer.velocity.x * dt;
    const stepZ = state.localPlayer.velocity.z * dt;

    if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
      const nextX = state.localPlayer.x + stepX;
      const nextZ = state.localPlayer.z + stepZ;

      if (!checkCollision(nextX, nextZ)) {
        state.localPlayer.x = nextX;
        state.localPlayer.z = nextZ;
      } else {
        if (!checkCollision(nextX, state.localPlayer.z)) {
          state.localPlayer.x = nextX;
          state.localPlayer.velocity.z = 0;
        } else if (!checkCollision(state.localPlayer.x, nextZ)) {
          state.localPlayer.z = nextZ;
          state.localPlayer.velocity.x = 0;
        } else {
          state.localPlayer.velocity.x = 0;
          state.localPlayer.velocity.z = 0;
        }
      }
    }

    // Safety net (normal radius on fallback — no Cannon to fight)
    if (checkCollision(state.localPlayer.x, state.localPlayer.z)) {
      state.localPlayer.x = oldPos.x;
      state.localPlayer.z = oldPos.z;
      state.localPlayer.velocity.x = 0;
      state.localPlayer.velocity.z = 0;
    }

    // Populate displayVelocity so animation works during CDN load window and on failure
    state.localPlayer.displayVelocity.x = state.localPlayer.velocity.x;
    state.localPlayer.displayVelocity.z = state.localPlayer.velocity.z;
  }

  speedXZ = Math.sqrt(
    state.localPlayer.displayVelocity.x * state.localPlayer.displayVelocity.x +
    state.localPlayer.displayVelocity.z * state.localPlayer.displayVelocity.z
  );

  if (speedXZ > 0.4) {
    const targetAngle = Math.atan2(state.localPlayer.displayVelocity.x, state.localPlayer.displayVelocity.z);
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

  state.localPlayer.swimming ? animateAvatarSwim(state.localPlayer, dt, now) : animateAvatarWalk(state.localPlayer, dt, now, state.keys.shift);
}
