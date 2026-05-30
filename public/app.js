// Metalyceum Entry Point (ES6 Module coordinator)
import { state } from './js/state.js';
import { initEngine, startAnimationLoop, stopAnimationLoop } from './js/engine.js';
import {
  initDebugPanel,
  initSoundtrackUi,
  initUiHandlers,
  renderEventBoard,
  scheduleRoomVisualRefresh,
  updateRoomPanelDetails,
  setupRoomVideo
} from './js/ui.js';
import { resumeAudioContext, pauseSoundtrackPlayback } from './js/audio.js';

// Global Callback called by YouTube SDK iframe API script loading
window.onYouTubeIframeAPIReady = function() {
  state.ytApiReady = true;
};

// --- Performance Optimization & App Visibility ---
function initPerformanceOptimization() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopAnimationLoop();
      pauseSoundtrackPlayback();
      if (state.ytPlayer && state.ytPlayer.pauseVideo) {
        try { state.ytPlayer.pauseVideo(); } catch (e) {}
      }
      if (state.boardYtPlayer && state.boardYtPlayer.pauseVideo) {
        try { state.boardYtPlayer.pauseVideo(); } catch (e) {}
      }
      return;
    }
    
    startAnimationLoop();
    if (state.localPlayer.currentRoom !== -1) {
      setupRoomVideo(state.localPlayer.currentRoom);
    }
    if (state.isJoined) {
      resumeAudioContext();
    }
  });

  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.contentVisibility = 'auto';
    gameContainer.style.containIntrinsicSize = 'auto none auto 100vh';
  }
}

// --- App Entry Point ---
window.addEventListener('DOMContentLoaded', () => {
  initEngine();
  initDebugPanel();
  initSoundtrackUi();
  initUiHandlers();
  initPerformanceOptimization();
  renderEventBoard();
  
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
