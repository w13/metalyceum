// Elevator state machine: folding doors, ride sequence, and 2nd floor reveal

import {
  MAIN_BUILDING_ELEVATOR_FRONT_Z,
  MAIN_BUILDING_ELEVATOR_GROUND_Y,
  MAIN_BUILDING_ELEVATOR_INTERIOR_BACK_Z,
  MAIN_BUILDING_ELEVATOR_INTERIOR_FRONT_Z,
  MAIN_BUILDING_ELEVATOR_INTERIOR_HALF_WIDTH,
  MAIN_BUILDING_ELEVATOR_PROXIMITY_DIST_SQ,
  MAIN_BUILDING_MEZZANINE_Y,
  MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
} from '../config.js';
import { state } from '../state.js';

const DOOR_SWING_ANGLE = Math.PI / 2.2; // ~82° — open enough to walk through
const RIDE_DURATION = 1.8; // seconds for ascent
const CABIN_LIGHT_INTENSITY = 1.15;
const CABIN_GLOW_INTENSITY = 1.35;
const CABIN_LIGHT_FADE_RATE = 7.5;

let doorProgress = 0; // 0=closed, 1=open
let doorTarget = 0; // target doorProgress
let rideProgress = 0; // 0..1 during ride
let rideStartY = 0;
let rideEndY = MAIN_BUILDING_MEZZANINE_Y;
let wasNear = false;
let phase = 'idle'; // idle | opening | open | waiting | closing | riding | arrival
let floorNum = 'L';
let panel = null;
let floorDisplay = null;
let cabinLightLevel = 0;
state.elevator.isRiding = false;

function animateDoors(openRatio) {
  // Fold/swing each door pivot: 0=closed (0°), 1=open (~82°)
  const angle = openRatio * DOOR_SWING_ANGLE;
  const pivots = state.elevator.doorPivots;
  if (!pivots) return;
  pivots.forEach((pivot) => {
    const side = pivot.userData._side || 1;
    pivot.rotation.y = -side * angle;
  });
}

function isPlayerInsideElevator() {
  return (
    Math.abs(state.localPlayer.x) <
      MAIN_BUILDING_ELEVATOR_INTERIOR_HALF_WIDTH &&
    state.localPlayer.z > MAIN_BUILDING_ELEVATOR_INTERIOR_BACK_Z &&
    state.localPlayer.z < MAIN_BUILDING_ELEVATOR_INTERIOR_FRONT_Z
  );
}

function startRide(targetY, floor) {
  if (phase !== 'waiting' || !state.localPlayer) return;
  rideStartY = state.localPlayer.y;
  rideEndY = targetY;
  rideProgress = 0;
  floorNum = floor;
  if (floorDisplay) floorDisplay.textContent = floor;
  phase = 'closing';
  doorTarget = 0;
  state.elevator.rideProgress = 0;
  // Disable the door collider, enable the door blocker
  if (state.elevator.doorCollider) state.elevator.doorCollider.visible = false;
}

function updateCabinLight(dt, isInsideElevator) {
  const shouldBeOn =
    isInsideElevator ||
    phase === 'closing' ||
    phase === 'riding' ||
    phase === 'arrival';
  const target = shouldBeOn ? 1 : 0;
  cabinLightLevel +=
    (target - cabinLightLevel) * Math.min(1, CABIN_LIGHT_FADE_RATE * dt);

  const light = state.elevator.cabinLight;
  const glowMat = state.elevator.cabinGlowMat;
  if (!light && !glowMat) return;

  const transitionAmount = Math.abs(target - cabinLightLevel);
  const flicker =
    transitionAmount > 0.03
      ? 0.72 + Math.random() * 0.28 + Math.sin(performance.now() * 0.045) * 0.08
      : 1;
  const litLevel = Math.max(0, cabinLightLevel * flicker);

  if (light) {
    light.intensity = CABIN_LIGHT_INTENSITY * litLevel;
  }
  if (glowMat) {
    glowMat.emissiveIntensity = 0.15 + CABIN_GLOW_INTENSITY * litLevel;
  }
}

export function initElevatorUI() {
  panel = document.getElementById('elevator-panel');
  floorDisplay = document.getElementById('elevator-floor-num');
  const upBtn = document.getElementById('elevator-up-btn');
  const downBtn = document.getElementById('elevator-down-btn');
  if (!panel || !floorDisplay || !upBtn || !downBtn) return;

  upBtn.addEventListener('click', () => {
    startRide(MAIN_BUILDING_MEZZANINE_Y, '2');
  });
  downBtn.addEventListener('click', () => {
    startRide(MAIN_BUILDING_ELEVATOR_GROUND_Y, 'L');
  });

  // ── Per-frame tick ─────────────────────────────────────────────────────
  state.elevator.tick = (dt) => {
    const insideElevator = !!state.localPlayer && isPlayerInsideElevator();
    updateCabinLight(dt, insideElevator);

    // ── Door animation ────────────────────────────────────────────────────
    if (doorTarget !== doorProgress) {
      const speed = doorTarget > doorProgress ? 3.5 : 4.5;
      const diff = doorTarget - doorProgress;
      doorProgress += diff * Math.min(1, speed * dt);
      if (Math.abs(diff) < 0.002) doorProgress = doorTarget;
      animateDoors(doorProgress);
    }

    // Door collider blocks only when idle with closed doors, not during a ride
    if (state.elevator.doorCollider) {
      state.elevator.doorCollider.visible = phase === 'idle';
    }

    // ── Ride state machine ────────────────────────────────────────────────
    if (phase === 'closing') {
      // Wait for doors to close fully
      if (doorProgress < 0.005) {
        phase = 'riding';
        rideProgress = 0;
        state.elevator.rideProgress = 0;
      }
    } else if (phase === 'riding') {
      rideProgress += dt / RIDE_DURATION;
      state.elevator.isRiding = true;
      const t = Math.min(rideProgress, 1);
      // Smooth ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const currentY = rideStartY + (rideEndY - rideStartY) * ease;

      // Move the car
      const car = state.elevator.car;
      if (car) car.position.y = currentY;

      // Move the player with the car
      if (state.localPlayer) {
        state.localPlayer.y = currentY;
        if (state.localPlayer.mesh) {
          state.localPlayer.mesh.position.y = currentY;
        }
      }

      // Set ride progress for 2nd floor fade (used in engine.js)
      // Going up: 0→1, going down: 1→0
      state.elevator.rideProgress = rideEndY > rideStartY ? ease : 1 - ease;

      if (t >= 1) {
        phase = 'arrival';
        state.elevator.isRiding = false;
        state.elevator.rideProgress = 0;
        doorTarget = 1; // start opening doors
        // Snap player to final position
        if (state.localPlayer) {
          state.localPlayer.y = rideEndY;
          if (state.localPlayer.mesh) {
            state.localPlayer.mesh.position.y = rideEndY;
          }
        }
        // Force room re-detection on 2nd floor
        if (rideEndY >= MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y) {
          state.localPlayer.currentRoom = -1;
        }
      }
    } else if (phase === 'arrival') {
      if (doorProgress > 0.995) {
        phase = 'open';
        state.elevator.rideProgress = 0;
        // Re-enable the door collider for the new floor level
        const dc = state.elevator.doorCollider;
        if (dc) {
          dc.position.y = rideEndY;
          dc.visible = false;
        }
      }
    }

    // ── Proximity + idle door logic ───────────────────────────────────────
    if (
      phase === 'idle' ||
      phase === 'opening' ||
      phase === 'open' ||
      phase === 'waiting'
    ) {
      if (!state.localPlayer) return;

      const dx = state.localPlayer.x;
      const dz = state.localPlayer.z - MAIN_BUILDING_ELEVATOR_FRONT_Z;
      const near = dx * dx + dz * dz < MAIN_BUILDING_ELEVATOR_PROXIMITY_DIST_SQ;

      if (near && !wasNear) {
        // Player approaching — open doors, show panel
        wasNear = true;
        doorTarget = 1;
        if (panel) {
          panel.classList.add('elevator-visible');
          panel.setAttribute('aria-hidden', 'false');
        }
        floorNum =
          state.localPlayer.y >= MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y
            ? '2'
            : 'L';
        if (floorDisplay) floorDisplay.textContent = floorNum;
        phase = 'opening';
      } else if (!near && wasNear) {
        // Player leaving — close doors, hide panel
        wasNear = false;
        doorTarget = 0;
        if (panel) {
          panel.classList.remove('elevator-visible');
          panel.setAttribute('aria-hidden', 'true');
        }
        phase = 'idle';
      } else if (
        near &&
        wasNear &&
        phase === 'opening' &&
        doorProgress > 0.995
      ) {
        // Doors fully open — ready for player to walk in
        phase = 'open';
      } else if (near && wasNear && phase === 'open') {
        // Player is near with doors open — check if they're inside the car
        if (insideElevator) {
          phase = 'waiting';
          // Show only the relevant button based on current floor
          const onGround =
            state.localPlayer.y < MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y;
          upBtn.style.display = onGround ? '' : 'none';
          downBtn.style.display = onGround ? 'none' : '';
          if (onGround) upBtn.classList.add('elevator-active');
          else downBtn.classList.add('elevator-active');
        }
      } else if (phase === 'waiting') {
        // Check if player left the car
        if (!insideElevator) {
          phase = 'open';
          upBtn.classList.remove('elevator-active');
          downBtn.classList.remove('elevator-active');
          upBtn.style.display = '';
          downBtn.style.display = '';
        }
      }
    }
  };
}
