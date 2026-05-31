// Metalyceum Entry Point (ES6 Module coordinator)
import { state } from './js/state.js';
import { initEngine, startAnimationLoop, stopAnimationLoop } from './js/engine.js';
import { initDebugPanel, initSoundtrackUi, initUiHandlers } from './js/ui.js';
import {
  pauseActiveEmbeddedYoutube,
  resumeActiveEmbeddedYoutube,
  renderEventBoard,
  scheduleRoomVisualRefresh,
  updateRoomPanelDetails
} from './js/room-panel.js';
import {
  resumeAudioContext,
  pauseSoundtrackPlayback,
  startSoundtrackPlayback,
  initLandingAudio,
  resumeLandingAudio,
  stopLandingAudio,
  prepareSoundtrackLoginTransition
} from './js/audio.js';
import { initMinimap } from './js/minimap.js';
// debug-tweaks is dynamically imported below (non-blocking) to avoid
// breaking login if the module file or lil-gui CDN is unavailable.

// Global Callback called by YouTube SDK iframe API script loading
window.onYouTubeIframeAPIReady = function() {
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
  state.errorLog.push({ ts: Date.now(), type, msg: String(msg).slice(0, 500), stack: stack ? String(stack).slice(0, 1000) : null });
  if (state.errorLog.length > MAX_ERRORS) state.errorLog.shift();
  if (type === 'uncaught' || type === 'promise') {
    setFatalErrorBanner(`Client error: ${String(msg).slice(0, 180)}. Add ?diag to the URL for details.`);
  }
}

const origOnError = window.onerror;
window.onerror = function (msg, source, line, col, err) {
  captureError('uncaught', msg, err?.stack);
  origOnError?.apply(this, arguments);
};

window.addEventListener('unhandledrejection', (e) => {
  captureError('promise', e.reason || 'Unknown promise rejection', e.reason?.stack);
});

// Patch console.error to capture as well
const origConsoleError = console.error;
console.error = function (...args) {
  captureError('console', args.map(a => typeof a === 'object' ? (a?.message ?? JSON.stringify(a)) : String(a)).join(' '));
  origConsoleError.apply(console, args);
};

// Expose full diagnostics dump for browser console / puppeteer
window.__metalyceumDump = function () {
  const diag = typeof getEngineDiagnostics === 'function' ? getEngineDiagnostics() : { error: 'engine not loaded' };
  const result = {
    ts: Date.now(),
    errors: state.errorLog.slice(-20),
    diagnostics: diag,
    isJoined: state.isJoined,
    playerPos: state.localPlayer ? { x: state.localPlayer.x, y: state.localPlayer.y, z: state.localPlayer.z, room: state.localPlayer.currentRoom } : null,
    remoteCount: state.remotePlayers?.size ?? 0,
    rooms: state.ROOMS?.map(r => ({ id: r.id, name: r.name, sourceType: r.sourceType, sourceValue: r.sourceValue?.slice(0, 30) }))
  };
  // Copy to clipboard for easy pasting into chat
  const json = JSON.stringify(result, null, 2);
  try { navigator.clipboard?.writeText(json); } catch {}
  console.log('[Metalyceum] Diagnostics captured. Run copy(__metalyceumDump()) to get the JSON.\n', result);
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
        try { state.boardYtPlayer.pauseVideo(); } catch (e) {}
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
    import('./js/state.js').then(m => { m.state.DEBUG_STATE.enabled = true; });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  // Start building the 3D world immediately (visible behind the translucent login overlay)
  initEngine();
  initMinimap();
  // Debug-tweaks loaded lazily — survives missing file or CDN failure
  import('./js/debug-tweaks.js').then(m => m.initDebugTweaks()).catch(e => {
    console.warn('[app] Debug tweaks unavailable:', e);
  });
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
      musicHint.innerHTML = '<span class="login-music-icon">🎵</span> Welcome Threshold — playing';
      musicHint.style.color = 'rgba(167, 211, 175, 0.85)';
    }
  }

  if (loginOverlay) {
    loginOverlay.addEventListener('pointerdown', startLandingOnce, { once: false });
    loginOverlay.addEventListener('keydown', startLandingOnce, { once: false });
  }

  // Wire stop into the login submit so music fades out on enter
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', () => {
      prepareSoundtrackLoginTransition();
      stopLandingAudio(2.4);
    }, { capture: true }); // capture fires before ui.js listener removes the overlay
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
