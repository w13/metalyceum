// 1920s-style elevator control panel with animated doors and car ascent/descent
import { state } from '../state.js';

const ELEVATOR_Z = -36;
const PROXIMITY_SQ = 16;

export function initElevatorUI() {
  const panel = document.getElementById('elevator-panel');
  const floorDisplay = document.getElementById('elevator-floor-display');
  const upBtn = document.getElementById('elevator-up-btn');
  const downBtn = document.getElementById('elevator-down-btn');
  if (!panel || !floorDisplay || !upBtn || !downBtn) return;

  let wasNear = false;
  let animating = false;

  function setDoors(openRatio) {
    const panels = state._elevatorDoorPanels;
    if (!panels) return;
    const slide = openRatio * 0.5;
    panels.forEach((p) => {
      const side = p.userData._side || 1;
      p.position.z = -34.58 + side * slide;
    });
  }

  function animateDoors(targetRatio, durationMs, callback) {
    const startTime = performance.now();
    function step() {
      const t = Math.min((performance.now() - startTime) / durationMs, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setDoors(ease * targetRatio);
      if (t < 1) requestAnimationFrame(step);
      else if (callback) callback();
    }
    step();
  }

  // Animate the elevator car moving vertically + player follows
  function animateCarRide(startY, endY, durationMs, callback) {
    const car = state._elevatorCar;
    const mesh = state.localPlayer && state.localPlayer.mesh;
    const startTime = performance.now();
    const dy = endY - startY;

    function step() {
      const t = Math.min((performance.now() - startTime) / durationMs, 1);
      // Smooth ease-in-out
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const currentY = startY + dy * ease;

      // Move the elevator car
      if (car) car.position.y = currentY;

      // Move the player mesh with the car so they feel the motion
      if (mesh) {
        mesh.position.y = currentY + 0.1;
        state.localPlayer.y = currentY + 0.1;
      }

      if (t < 1) requestAnimationFrame(step);
      else if (callback) callback();
    }
    step();
  }

  function teleportTo(targetX, targetY, targetZ, floor) {
    if (animating || !state.localPlayer) return;
    animating = true;

    const startY = state.localPlayer.y;
    const goingUp = targetY > startY;

    // Phase 1: Close doors (350ms)
    animateDoors(0, 350, () => {
      floorDisplay.textContent = floor;

      // Phase 2: Ride up/down (800ms – smooth ascent/descent)
      // The elevator car + player mesh move together
      const rideDuration = 800;
      const car = state._elevatorCar;
      const mesh = state.localPlayer.mesh;

      // Start positions
      if (car) car.position.y = startY;

      animateCarRide(startY, targetY, rideDuration, () => {
        // Phase 3: Snap final position & open doors (350ms)
        state.localPlayer.x = targetX;
        state.localPlayer.z = targetZ;
        if (mesh) {
          mesh.position.x = targetX;
          mesh.position.z = targetZ;
        }
        // Floor number already set

        animateDoors(1, 350, () => {
          animating = false;
        });
      });
    });
  }

  upBtn.addEventListener('click', () => teleportTo(0, 7.5, -30, '2'));
  downBtn.addEventListener('click', () => teleportTo(0, 0.1, -34, 'L'));

  state._elevatorCheck = () => {
    if (animating || !state.localPlayer) return;
    const dz = state.localPlayer.z - ELEVATOR_Z;
    const dx = state.localPlayer.x;
    const near = dx * dx + dz * dz < PROXIMITY_SQ;

    if (near && !wasNear) {
      panel.classList.add('elevator-visible');
      panel.setAttribute('aria-hidden', 'false');
      floorDisplay.textContent = state.localPlayer.y > 5 ? '2' : 'L';
      animateDoors(1, 300);
      wasNear = true;
    } else if (!near && wasNear) {
      panel.classList.remove('elevator-visible');
      panel.setAttribute('aria-hidden', 'true');
      animateDoors(0, 300);
      wasNear = false;
    }
  };
}
