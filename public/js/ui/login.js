// Login form interface, custom avatar color syncing, and entry coordinator for Metalyceum

import { resumeAudioContext } from '../audio.js';
import { createPlayerAvatar } from '../characters.js';
import { connectMultiplayer } from '../multiplayer.js';
import { state } from '../state.js';

function getLoginElements() {
  const loginOverlay = document.getElementById('login-overlay');
  const loginCard = loginOverlay
    ? loginOverlay.querySelector('.login-card')
    : null;
  return { loginOverlay, loginCard };
}

function hideLoginOverlay() {
  const { loginOverlay, loginCard } = getLoginElements();
  if (loginCard) {
    loginCard.style.opacity = '0';
    loginCard.style.transform = 'translateY(-20px)';
  }
  document.activeElement?.blur?.();
  setTimeout(() => {
    if (loginOverlay) {
      loginOverlay.classList.remove('active');
      loginOverlay.style.display = 'none';
    }
  }, 500);
}

export function initLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('username-input').value.trim();
    const avatarType = 'explorer';
    const color = document.getElementById('color-input').value;

    if (!username) return;

    state.localPlayer.username = username;
    state.localPlayer.avatarType = avatarType;
    state.localPlayer.color = color;

    const avatar = createPlayerAvatar(avatarType, color, username, true);
    state.localPlayer.mesh = avatar.group;
    state.localPlayer.leftLeg = avatar.leftLeg;
    state.localPlayer.rightLeg = avatar.rightLeg;
    state.localPlayer.leftArm = avatar.leftArm;
    state.localPlayer.rightArm = avatar.rightArm;

    // Face the building entrance (south / -z direction)
    state.localPlayer.ry = Math.PI;
    state.localPlayer.mesh.rotation.y = Math.PI;
    state.localPlayer.mesh.position.set(
      state.localPlayer.x,
      state.localPlayer.y,
      state.localPlayer.z,
    );

    // Camera behind the player, looking past them toward the building entrance & sign
    state.controls.target.set(0, 2.0, state.localPlayer.z - 10);
    state.camera.position.set(3, 5.5, state.localPlayer.z + 16);
    state.controls.update();

    hideLoginOverlay();

    connectMultiplayer();
    state.isJoined = true;
    resumeAudioContext();
  });
}

export function initColorPickerSync() {
  const colorPicker = document.getElementById('color-input');
  const colorHexEl = document.getElementById('color-hex');
  if (!colorPicker || !colorHexEl) return;

  colorPicker.addEventListener('input', (e) => {
    colorHexEl.textContent = e.target.value.toUpperCase();
  });
}
