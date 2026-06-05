// Elevator state machine: folding doors, ride sequence, and 2nd floor reveal
import { state } from '../state.js';
import {
  MAIN_BUILDING_ELEVATOR_GROUND_Y,
  MAIN_BUILDING_MEZZANINE_Y,
  MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
  MAIN_BUILDING_ELEVATOR_FRONT_Z,
  MAIN_BUILDING_ELEVATOR_INTERIOR_HALF_WIDTH,
  MAIN_BUILDING_ELEVATOR_INTERIOR_BACK_Z,
  MAIN_BUILDING_ELEVATOR_INTERIOR_FRONT_Z,
  MAIN_BUILDING_ELEVATOR_PROXIMITY_DIST_SQ
} from '../config.js';

const DOOR_SWING_ANGLE = Math.PI / 2.2; // ~82° — open enough to walk through
const RIDE_DURATION = 1.8; // seconds for ascent

let doorProgress = 0;   // 0=closed, 1=open
let doorTarget = 0;     // target doorProgress
let rideProgress = 0;   // 0..1 during ride
let rideStartY = 0;
let rideEndY = MAIN_BUILDING_MEZZANINE_Y;
let wasNear = false;
let phase = 'idle';     // idle | opening | open | waiting | closing | riding | arrival
let floorNum = 'L';
let panel = null;
let floorDisplay = null;
state._elevatorIsRiding = false;

function animateDoors(openRatio) {
  // Fold/swing each door pivot: 0=closed (0°), 1=open (~82°)
  const angle = openRatio * DOOR_SWING_ANGLE;
  const pivots = state._elevatorDoorPivots;
  if (!pivots) return;
  pivots.forEach((pivot) => {
    const side = pivot.userData._side || 1;
    pivot.rotation.y = -side * angle;
  });
}

function isPlayerInsideElevator() {
  return Math.abs(state.localPlayer.x) < MAIN_BUILDING_ELEVATOR_INTERIOR_HALF_WIDTH
    && state.localPlayer.z > MAIN_BUILDING_ELEVATOR_INTERIOR_BACK_Z
    && state.localPlayer.z < MAIN_BUILDING_ELEVATOR_INTERIOR_FRONT_Z;
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
  state.elevatorRideProgress = 0;
  // Disable the door collider, enable the door blocker
  if (state._elevatorDoorCollider) state._elevatorDoorCollider.visible = false;
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
  state._elevatorTick = (dt) => {
    // ── Door animation ────────────────────────────────────────────────────
    if (doorTarget !== doorProgress) {
      const speed = doorTarget > doorProgress ? 3.5 : 4.5;
      const diff = doorTarget - doorProgress;
      doorProgress += diff * Math.min(1, speed * dt);
      if (Math.abs(diff) < 0.002) doorProgress = doorTarget;
      state._elevatorDoorOpen = doorProgress;
      animateDoors(doorProgress);
    }

    // Door collider blocks only when idle with closed doors, not during a ride
    if (state._elevatorDoorCollider) {
      state._elevatorDoorCollider.visible = phase === 'idle';
    }

    // ── Ride state machine ────────────────────────────────────────────────
    if (phase === 'closing') {
      // Wait for doors to close fully
      if (doorProgress < 0.005) {
        phase = 'riding';
        rideProgress = 0;
        state.elevatorRideProgress = 0;
      }
    } else if (phase === 'riding') {
      rideProgress += dt / RIDE_DURATION;
      state._elevatorIsRiding = true;
      const t = Math.min(rideProgress, 1);
      // Smooth ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const currentY = rideStartY + (rideEndY - rideStartY) * ease;

      // Move the car
      const car = state._elevatorCar;
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
      state.elevatorRideProgress = rideEndY > rideStartY ? ease : 1 - ease;

      if (t >= 1) {
        phase = 'arrival';
        state._elevatorIsRiding = false;
        state.elevatorRideProgress = 0;
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
        state.elevatorRideProgress = 0;
        // Re-enable the door collider for the new floor level
        const dc = state._elevatorDoorCollider;
        if (dc) {
          dc.position.y = rideEndY;
          dc.visible = false;
        }
      }
    }

    // ── Proximity + idle door logic ───────────────────────────────────────
    if (phase === 'idle' || phase === 'opening' || phase === 'open' || phase === 'waiting') {
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
        floorNum = state.localPlayer.y >= MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y ? '2' : 'L';
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
      } else if (near && wasNear && phase === 'opening' && doorProgress > 0.995) {
        // Doors fully open — ready for player to walk in
        phase = 'open';
      } else if (near && wasNear && phase === 'open') {
        // Player is near with doors open — check if they're inside the car
        const inside = isPlayerInsideElevator();
        if (inside) {
          phase = 'waiting';
          // Show only the relevant button based on current floor
          const onGround = state.localPlayer.y < MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y;
          upBtn.style.display = onGround ? '' : 'none';
          downBtn.style.display = onGround ? 'none' : '';
          if (onGround) upBtn.classList.add('elevator-active');
          else downBtn.classList.add('elevator-active');
        }
      } else if (phase === 'waiting') {
        // Check if player left the car
        const inside = isPlayerInsideElevator();
        if (!inside) {
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
