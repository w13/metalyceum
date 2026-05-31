// Soundtrack playlist rendering and HUD music playback controllers for Metalyceum
import { state } from '../state.js';
import { resumeAudioContext, pauseSoundtrackPlayback, updateSoundtrackUi, jumpToTrack } from '../audio.js';
import { SOUNDTRACK_LIBRARY } from '../config.js';

export function initSoundtrackUi() {
  state.soundtrackCard = document.getElementById('soundtrack-card');
  state.soundtrackTitleEl = document.getElementById('soundtrack-title');
  state.soundtrackStatusEl = document.getElementById('soundtrack-status');
  state.soundtrackPlayPauseBtn = document.getElementById('soundtrack-playpause-btn');
  state.soundtrackPrevBtn = document.getElementById('soundtrack-prev-btn');
  state.soundtrackNextBtn = document.getElementById('soundtrack-next-btn');
  state.soundtrackTracklistEl = document.getElementById('soundtrack-tracklist');
  populateSoundtrackTracklist();
  updateSoundtrackUi();
}

function populateSoundtrackTracklist() {
  if (!state.soundtrackTracklistEl) return;
  state.soundtrackTracklistEl.innerHTML = '';
  SOUNDTRACK_LIBRARY.forEach((track, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'soundtrack-track-btn';
    btn.dataset.trackIndex = String(index);
    btn.textContent = track.title;
    btn.addEventListener('click', () => jumpToTrack(index));
    state.soundtrackTracklistEl.appendChild(btn);
  });
}

export function initSoundtrackControls() {
  const playPauseBtn = document.getElementById('soundtrack-playpause-btn');
  const prevBtn = document.getElementById('soundtrack-prev-btn');
  const nextBtn = document.getElementById('soundtrack-next-btn');

  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', async () => {
      if (state.soundtrackState.enabled && state.soundtrackState.isPlaying) {
        state.soundtrackState.enabled = false;
        pauseSoundtrackPlayback();
        updateSoundtrackUi();
      } else {
        state.soundtrackState.enabled = true;
        updateSoundtrackUi();
        await resumeAudioContext();
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      jumpToTrack(state.soundtrackState.trackIndex - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      jumpToTrack(state.soundtrackState.trackIndex + 1);
    });
  }
}
