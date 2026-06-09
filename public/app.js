// Metalyceum Entry Point (ES6 Module coordinator)

import {
  initLandingAudio,
  pauseSoundtrackPlayback,
  prepareSoundtrackLoginTransition,
  resumeAudioContext,
  resumeLandingAudio,
  startSoundtrackPlayback,
  stopLandingAudio,
} from './js/audio.js';
import {
  initEngine,
  startAnimationLoop,
  stopAnimationLoop,
} from './js/engine.js';
import { initMinimap } from './js/minimap.js';
import {
  pauseActiveEmbeddedYoutube,
  renderEventBoard,
  resumeActiveEmbeddedYoutube,
  scheduleRoomVisualRefresh,
  updateRoomPanelDetails,
} from './js/room-panel.js';
import { state } from './js/state.js';
import { initDebugPanel, initSoundtrackUi, initUiHandlers } from './js/ui.js';

// Dev-tools: only active on localhost or when ?debug is in the URL
const _isDev =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1' ||
  location.search.includes('debug');

import { initDevTools } from './js/dev-tools.js';

// Global Callback called by YouTube SDK iframe API script loading
window.onYouTubeIframeAPIReady = () => {
  state.ytApiReady = true;
};

// --- Global Error Capture Ring Buffer ---
const MAX_ERRORS = 50;
function setFatalErrorBanner(message) {
  const banner = document.getElementById('fatal-error-banner');
  const label = document.getElementById('fatal-error-message');
  if (!banner || !label) return;
  if (!message) {
    banner.style.display = 'none';
    label.textContent = '';
    return;
  }
  label.textContent = message;
  banner.style.display = 'block';
}

function captureError(type, msg, stack) {
  state.errorLog.push({
    ts: Date.now(),
    type,
    msg: String(msg).slice(0, 500),
    stack: stack ? String(stack).slice(0, 1000) : null,
  });
  if (state.errorLog.length > MAX_ERRORS) state.errorLog.shift();
  if (type === 'uncaught' || type === 'promise') {
    setFatalErrorBanner(
      `Client error: ${String(msg).slice(0, 180)}. Add ?diag to the URL for details.`,
    );
  }
}

const origOnError = window.onerror;
window.onerror = function (msg, source, line, col, err) {
  captureError('uncaught', msg, err?.stack);
  origOnError?.apply(this, arguments);
};

window.addEventListener('unhandledrejection', (e) => {
  captureError(
    'promise',
    e.reason || 'Unknown promise rejection',
    e.reason?.stack,
  );
});

// Patch console.error to capture as well
const origConsoleError = console.error;
console.error = (...args) => {
  captureError(
    'console',
    args
      .map((a) =>
        typeof a === 'object' ? (a?.message ?? JSON.stringify(a)) : String(a),
      )
      .join(' '),
  );
  origConsoleError.apply(console, args);
};

// Expose full diagnostics dump for browser console / puppeteer
window.__metalyceumDump = () => {
  const diag =
    typeof getEngineDiagnostics === 'function'
      ? getEngineDiagnostics()
      : { error: 'engine not loaded' };
  const result = {
    ts: Date.now(),
    errors: state.errorLog.slice(-20),
    diagnostics: diag,
    isJoined: state.isJoined,
    playerPos: state.localPlayer
      ? {
          x: state.localPlayer.x,
          y: state.localPlayer.y,
          z: state.localPlayer.z,
          room: state.localPlayer.currentRoom,
        }
      : null,
    remoteCount: state.remotePlayers?.size ?? 0,
    rooms: state.ROOMS?.map((r) => ({
      id: r.id,
      name: r.name,
      sourceType: r.sourceType,
      sourceValue: r.sourceValue?.slice(0, 30),
    })),
  };
  // Copy to clipboard for easy pasting into chat
  const json = JSON.stringify(result, null, 2);
  try {
    navigator.clipboard?.writeText(json);
  } catch {}
  console.log(
    '[Metalyceum] Diagnostics captured. Run copy(__metalyceumDump()) to get the JSON.\n',
    result,
  );
  return result;
};

// --- Performance Optimization & App Visibility ---
function initPerformanceOptimization() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopAnimationLoop();
      pauseSoundtrackPlayback();
      pauseActiveEmbeddedYoutube();
      if (state.boardYtPlayer && state.boardYtPlayer.pauseVideo) {
        try {
          state.boardYtPlayer.pauseVideo();
        } catch (e) {}
      }
      return;
    }

    startAnimationLoop();
    if (state.localPlayer.currentRoom !== -1) {
      resumeActiveEmbeddedYoutube();
    }
    if (state.isJoined) {
      resumeAudioContext();
      startSoundtrackPlayback();
    }
  });

  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.contentVisibility = 'auto';
    gameContainer.style.containIntrinsicSize = 'auto none auto 100vh';
  }
}

// --- App Entry Point ---
// Auto-enable debug panel if ?debug or ?diag in URL
if (location.search.includes('debug') || location.search.includes('diag')) {
  // Will be picked up after module init — queue it
  queueMicrotask(() => {
    import('./js/state.js').then((m) => {
      m.state.DEBUG_STATE.enabled = true;
    });
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  // Build the 3D world — async so yields allow loading-screen text to update without freezing the tab
  await initEngine();
  initMinimap();
  if (_isDev) initDevTools();
  initDebugPanel();
  initSoundtrackUi();
  initUiHandlers();
  initPerformanceOptimization();
  renderEventBoard();

  // --- Landing page audio ---
  // Start music on first user interaction (autoplay policy) on the login overlay
  const loginOverlay = document.getElementById('login-overlay');
  const musicHint = document.getElementById('login-music-hint');
  let landingStarted = false;

  function startLandingOnce() {
    if (landingStarted) return;
    landingStarted = true;
    initLandingAudio();
    resumeLandingAudio();
    // Swap hint to "Now playing"
    if (musicHint) {
      musicHint.innerHTML =
        '<span class="login-music-icon">🎵</span> Welcome Threshold — playing';
      musicHint.style.color = 'rgba(167, 211, 175, 0.85)';
    }
  }

  if (loginOverlay) {
    loginOverlay.addEventListener('pointerdown', startLandingOnce, {
      once: false,
    });
    loginOverlay.addEventListener('keydown', startLandingOnce, { once: false });
  }

  // Wire stop into the login submit so music fades out on enter
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener(
      'submit',
      () => {
        prepareSoundtrackLoginTransition();
        stopLandingAudio(2.4);
      },
      { capture: true },
    ); // capture fires before ui.js listener removes the overlay
  }

  state.roomStatusTimer = window.setInterval(() => {
    renderEventBoard();
    scheduleRoomVisualRefresh();
    if (state.localPlayer.currentRoom !== -1) {
      updateRoomPanelDetails();
    }
  }, 30000);

  // Kickstart animation loop
  startAnimationLoop();
});
