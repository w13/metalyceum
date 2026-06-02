// 1920s-style elevator control panel
import { state } from '../state.js';

export function initElevatorUI() {
  const panel = document.getElementById('elevator-panel');
  const floorDisplay = document.getElementById('elevator-floor-display');
  const upBtn = document.getElementById('elevator-up-btn');
  const downBtn = document.getElementById('elevator-down-btn');
  if (!panel || !floorDisplay || !upBtn || !downBtn) return;

  let wasNear = false;

  function teleportTo(x, y, z, floor) {
    if (!state.localPlayer) return;
    state.localPlayer.x = x;
    state.localPlayer.y = y;
    state.localPlayer.z = z;
    if (state.localPlayer.mesh) {
      state.localPlayer.mesh.position.set(x, y, z);
    }
    floorDisplay.textContent = floor;
    // Close doors animation
    panel.setAttribute('aria-hidden', 'true');
    panel.classList.remove('elevator-visible');
    setTimeout(() => {
      // Reopen at destination
      panel.classList.add('elevator-visible');
      panel.setAttribute('aria-hidden', 'false');
    }, 600);
  }

  upBtn.addEventListener('click', () => teleportTo(0, 7.5, -30, '2'));
  downBtn.addEventListener('click', () => teleportTo(0, 0.1, -34, 'L'));

  // Per-frame distance check — show panel when player is near the elevator
  state._elevatorCheck = () => {
    if (!state.localPlayer) return;
    const dz = state.localPlayer.z - (-36);
    const dx = state.localPlayer.x - 0;
    const near = dx * dx + dz * dz < 16; // within 4 units
    if (near && !wasNear) {
      panel.classList.add('elevator-visible');
      panel.setAttribute('aria-hidden', 'false');
      floorDisplay.textContent = state.localPlayer.y > 5 ? '2' : 'L';
      wasNear = true;
    } else if (!near && wasNear) {
      panel.classList.remove('elevator-visible');
      panel.setAttribute('aria-hidden', 'true');
      wasNear = false;
    }
  };
}
