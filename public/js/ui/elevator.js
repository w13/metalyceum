// 1920s-style elevator control panel with animated doors and car ascent/descent
import { state } from '../state.js';

const ELEVATOR_Z = -36;
const PROXIMITY_SQ = 16;

let doorAnimTarget = 0;   // 0 = closed, 1 = open, -1 = no animation
let doorAnimProgress = 0; // 0..1
let wasNear = false;
let animating = false;
let rideProgress = 0;
let rideStartY = 0;
let rideEndY = 0;
let rideTargetX = 0;
let rideTargetZ = 0;
let rideFloor = 'L';
let ridePhase = 'idle'; // idle | closing | riding | opening

export function initElevatorUI() {
  const panel = document.getElementById('elevator-panel');
  const floorDisplay = document.getElementById('elevator-floor-display');
  const upBtn = document.getElementById('elevator-up-btn');
  const downBtn = document.getElementById('elevator-down-btn');
  if (!panel || !floorDisplay || !upBtn || !downBtn) return;

  function setDoors(openRatio) {
    const panels = state._elevatorDoorPanels;
    if (!panels) return;
    const slide = openRatio * 0.5;
    panels.forEach((p) => {
      const side = p.userData._side || 1;
      p.position.z = -34.58 + side * slide;
    });
  }

  function startRide(targetX, targetY, targetZ, floor) {
    if (animating || !state.localPlayer) return;
    animating = true;
    rideStartY = state.localPlayer.y;
    rideEndY = targetY;
    rideTargetX = targetX;
    rideTargetZ = targetZ;
    rideFloor = floor;
    rideProgress = 0;
    ridePhase = 'closing';
    doorAnimTarget = 0;
    doorAnimProgress = 1; // start from open
    floorDisplay.textContent = floor;
  }

  upBtn.addEventListener('click', () => startRide(0, 7.5, -30, '2'));
  downBtn.addEventListener('click', () => startRide(0, 0.1, -34, 'L'));

  // Called from main animation loop every frame
  state._elevatorTick = (dt) => {
    // ── Door animation ──
    if (doorAnimTarget >= 0) {
      const speed = doorAnimTarget > doorAnimProgress ? 4 : 5;
      doorAnimProgress += (doorAnimTarget - doorAnimProgress) * Math.min(1, speed * dt);
      if (Math.abs(doorAnimTarget - doorAnimProgress) < 0.001) doorAnimProgress = doorAnimTarget;
      setDoors(doorAnimProgress);
    }

    // ── Ride state machine ──
    if (ridePhase === 'closing') {
      if (doorAnimProgress < 0.01) {
        ridePhase = 'riding';
        rideProgress = 0;
      }
    } else if (ridePhase === 'riding') {
      rideProgress += dt * 1.2; // ~0.83s ride
      const t = Math.min(rideProgress, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const currentY = rideStartY + (rideEndY - rideStartY) * ease;
      const car = state._elevatorCar;
      if (car) car.position.y = currentY;
      if (state.localPlayer && state.localPlayer.mesh) {
        state.localPlayer.mesh.position.y = currentY + 0.1;
        state.localPlayer.y = currentY + 0.1;
      }
      if (t >= 1) {
        ridePhase = 'opening';
        doorAnimTarget = 1;
        // Snap final position
        if (state.localPlayer) {
          state.localPlayer.x = rideTargetX;
          state.localPlayer.z = rideTargetZ;
          if (state.localPlayer.mesh) {
            state.localPlayer.mesh.position.x = rideTargetX;
            state.localPlayer.mesh.position.z = rideTargetZ;
          }
        }
      }
    } else if (ridePhase === 'opening') {
      if (doorAnimProgress > 0.99) {
        ridePhase = 'idle';
        animating = false;
      }
    }

    // ── Proximity check ──
    if (!animating && state.localPlayer) {
      const dz = state.localPlayer.z - ELEVATOR_Z;
      const dx = state.localPlayer.x;
      const near = dx * dx + dz * dz < PROXIMITY_SQ;
      if (near && !wasNear) {
        panel.classList.add('elevator-visible');
        panel.setAttribute('aria-hidden', 'false');
        wasNear = true;
        doorAnimTarget = 1;
        floorDisplay.textContent = state.localPlayer.y > 5 ? '2' : 'L';
      } else if (!near && wasNear) {
        panel.classList.remove('elevator-visible');
        panel.setAttribute('aria-hidden', 'true');
        wasNear = false;
        doorAnimTarget = 0;
      }
    }
  };
}
