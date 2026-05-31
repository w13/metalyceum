// Soundtrack and Ambient Spatial Audio for Metalyceum
import { state } from './state.js';
import { SOUNDTRACK_LIBRARY } from './config.js';
import { getRoomEventStatus } from './utils.js';

// ---------------------------------------------------------------------------
// Shared soundtrack / MIDI helpers
// ---------------------------------------------------------------------------
const MIDI_IMPORT_URL = 'https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.28/+esm';
const LANDING_MASTER_VOLUME = 1.18;

let _landingCtx = null;
let _landingGain = null;
let _landingLoopId = null;
let _landingActiveNodes = new Set();
let _midiParserPromise = null;
let _soundtrackLoadPromise = null;
let _soundtrackLoadError = null;
let _hasSelectedInitialTrack = false;
const _midiFileCache = new Map();

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function beatsToSeconds(beats, bpm) {
  return (60 / bpm) * beats;
}

function secondsToBeats(seconds, bpm) {
  return seconds / (60 / bpm);
}

function pickRandomTrackIndex(count) {
  if (count <= 1) return 0;
  return Math.floor(Math.random() * count);
}

function ensureInitialSoundtrackTrackIndex(count) {
  if (_hasSelectedInitialTrack || count <= 0) {
    return state.soundtrackState.trackIndex;
  }
  state.soundtrackState.trackIndex = pickRandomTrackIndex(count);
  _hasSelectedInitialTrack = true;
  return state.soundtrackState.trackIndex;
}

function normalizeSourceLane(source) {
  return {
    wave: source.wave || 'triangle',
    volume: source.volume ?? 0.12,
    attack: source.attack ?? 0.02,
    release: source.release ?? 0.18,
    pan: source.pan ?? 0,
    transpose: source.transpose ?? 0
  };
}

function collectMidiEvents(midiData, lane, bpm) {
  const ticksPerBeat = midiData.header.ppq || 480;
  const fallbackBpm = bpm || 80;
  const secondsPerBeat = 60 / fallbackBpm;

  return midiData.tracks.flatMap((midiTrack) => midiTrack.notes.map((note) => {
    const beat = typeof note.ticks === 'number'
      ? note.ticks / ticksPerBeat
      : secondsToBeats(note.time ?? 0, fallbackBpm);
    const duration = typeof note.durationTicks === 'number'
      ? note.durationTicks / ticksPerBeat
      : secondsToBeats(note.duration ?? secondsPerBeat, fallbackBpm);

    return {
      beat,
      duration: Math.max(duration, 0.05),
      velocity: Math.max(note.velocity ?? 0.7, 0.08),
      midi: note.midi + lane.transpose,
      lane
    };
  }));
}

async function getMidiParser() {
  if (!_midiParserPromise) {
    _midiParserPromise = import(MIDI_IMPORT_URL);
  }
  const mod = await _midiParserPromise;
  return mod.Midi;
}

async function loadMidiSource(Midi, path) {
  if (_midiFileCache.has(path)) {
    return _midiFileCache.get(path);
  }

  const loadPromise = (async () => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Unable to load MIDI source: ${path}`);
    }
    return new Midi(await response.arrayBuffer());
  })().catch((error) => {
    _midiFileCache.delete(path);
    throw error;
  });

  _midiFileCache.set(path, loadPromise);
  return loadPromise;
}

export async function normalizeSoundtrackLibrary() {
  if (state.soundtrackTracks.length > 0) {
    return state.soundtrackTracks;
  }
  if (_soundtrackLoadPromise) {
    return _soundtrackLoadPromise;
  }

  _soundtrackLoadError = null;
  _soundtrackLoadPromise = (async () => {
    const Midi = await getMidiParser();
    const tracks = await Promise.all(SOUNDTRACK_LIBRARY.map(async (trackConfig) => {
      const parsedSources = await Promise.all(trackConfig.sources.map(async (sourceConfig) => {
        const midi = await loadMidiSource(Midi, sourceConfig.path);
        return {
          lane: normalizeSourceLane(sourceConfig),
          midi
        };
      }));

      const tempoBpm = parsedSources.flatMap(({ midi }) => midi.header.tempos || [])[0]?.bpm;
      const bpm = tempoBpm || trackConfig.fallbackBpm || 80;
      const events = parsedSources
        .flatMap(({ lane, midi }) => collectMidiEvents(midi, lane, bpm))
        .sort((a, b) => a.beat - b.beat);
      const lengthBeats = Math.max(
        4,
        events.reduce((maxBeat, event) => Math.max(maxBeat, event.beat + event.duration), 0)
      );

      return {
        title: trackConfig.title,
        bpm,
        lengthBeats,
        events
      };
    }));

    state.soundtrackTracks = tracks;
    ensureInitialSoundtrackTrackIndex(tracks.length);
    return tracks;
  })()
    .catch((err) => {
      _soundtrackLoadError = err;
      console.warn('[Metalyceum] Unable to load MIDI soundtrack library:', err);
      throw err;
    })
    .finally(() => {
      _soundtrackLoadPromise = null;
      updateSoundtrackUi();
    });

  return _soundtrackLoadPromise;
}

function stopActiveNodeSet(audioCtx, activeNodes, fadeSeconds = 0.18) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const stopAt = now + fadeSeconds + 0.04;
  activeNodes.forEach((entry) => {
    entry.gain.gain.cancelScheduledValues(now);
    entry.gain.gain.setTargetAtTime(0.0001, now, Math.max(fadeSeconds / 3, 0.03));
    try {
      entry.oscillator.stop(stopAt);
    } catch (err) {
      // Oscillators can only be stopped once; ignore redundant stop attempts.
    }
  });
}

function scheduleTrackEvent(audioCtx, outputGain, activeNodes, trackStartedAt, track, event) {
  if (!audioCtx || !outputGain) return;

  const noteStart = trackStartedAt + beatsToSeconds(event.beat, track.bpm);
  const noteDuration = beatsToSeconds(event.duration, track.bpm);
  const lane = event.lane;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const stereoPanner = typeof audioCtx.createStereoPanner === 'function'
    ? audioCtx.createStereoPanner()
    : null;

  oscillator.type = lane.wave;
  oscillator.frequency.setValueAtTime(midiToFrequency(event.midi), noteStart);

  gain.gain.setValueAtTime(0.0001, noteStart);
  gain.gain.linearRampToValueAtTime(Math.max(lane.volume * event.velocity, 0.0001), noteStart + lane.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration + lane.release);

  oscillator.connect(gain);
  if (stereoPanner) {
    stereoPanner.pan.value = lane.pan || 0;
    gain.connect(stereoPanner);
    stereoPanner.connect(outputGain);
  } else {
    gain.connect(outputGain);
  }

  const nodeRecord = { oscillator, gain, stereoPanner };
  activeNodes.add(nodeRecord);
  oscillator.onended = () => {
    activeNodes.delete(nodeRecord);
    oscillator.disconnect();
    gain.disconnect();
    if (stereoPanner) stereoPanner.disconnect();
  };

  oscillator.start(noteStart);
  oscillator.stop(noteStart + noteDuration + lane.release + 0.05);
}

function scheduleLandingTrack(track, startAt) {
  if (!_landingCtx || !_landingGain) return;

  track.events.forEach((event) => {
    scheduleTrackEvent(_landingCtx, _landingGain, _landingActiveNodes, startAt, track, event);
  });

  const trackEnd = startAt + beatsToSeconds(track.lengthBeats, track.bpm) + 1.2;
  const loopDelay = (trackEnd - _landingCtx.currentTime - 0.45) * 1000;
  _landingLoopId = setTimeout(() => {
    if (_landingCtx && _landingGain) {
      scheduleLandingTrack(track, _landingCtx.currentTime + 0.08);
    }
  }, Math.max(loopDelay, 500));
}

export function initLandingAudio() {
  if (_landingCtx) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    _landingCtx = new AudioCtx();
    _landingGain = _landingCtx.createGain();
    _landingGain.gain.setValueAtTime(0.0001, _landingCtx.currentTime);
    _landingGain.gain.linearRampToValueAtTime(LANDING_MASTER_VOLUME, _landingCtx.currentTime + 2.5);
    _landingGain.connect(_landingCtx.destination);
    normalizeSoundtrackLibrary()
      .then((tracks) => {
        if (!_landingCtx || !_landingGain) return;
        const landingTrackIndex = ensureInitialSoundtrackTrackIndex(tracks.length);
        const landingTrack = tracks[landingTrackIndex];
        if (!landingTrack) return;
        scheduleLandingTrack(landingTrack, _landingCtx.currentTime + 0.12);
      })
      .catch((err) => {
        console.warn('[Metalyceum] Landing soundtrack preload failed:', err);
      });
  } catch (err) {
    console.warn('[Metalyceum] Landing audio init failed:', err);
  }
}

export function resumeLandingAudio() {
  if (!_landingCtx) return;
  if (_landingCtx.state === 'suspended') {
    _landingCtx.resume().catch((err) => {
      console.warn('[Metalyceum] Landing audio resume failed:', err);
    });
  }
}

export function stopLandingAudio(fadeSecs = 1.8) {
  if (!_landingCtx || !_landingGain) return;
  if (_landingLoopId !== null) { clearTimeout(_landingLoopId); _landingLoopId = null; }
  stopActiveNodeSet(_landingCtx, _landingActiveNodes, Math.min(fadeSecs, 0.36));
  const now = _landingCtx.currentTime;
  _landingGain.gain.cancelScheduledValues(now);
  _landingGain.gain.setTargetAtTime(0.0001, now, fadeSecs / 3);
  setTimeout(() => {
    try { _landingCtx.close(); } catch (err) {
      console.warn('[Metalyceum] Landing audio close failed:', err);
    }
    _landingCtx = null;
    _landingGain = null;
    _landingActiveNodes = new Set();
  }, (fadeSecs + 0.5) * 1000);
}

export function updateSoundtrackUi() {
  if (!state.soundtrackCard || !state.soundtrackTitleEl || !state.soundtrackStatusEl) return;

  const track = state.soundtrackTracks[state.soundtrackState.trackIndex]
    || SOUNDTRACK_LIBRARY[state.soundtrackState.trackIndex];
  state.soundtrackTitleEl.textContent = track ? track.title : 'Ambient soundtrack';

  const total = Math.max(state.soundtrackTracks.length, SOUNDTRACK_LIBRARY.length);
  const idx = state.soundtrackState.trackIndex + 1;
  const isLoading = !state.soundtrackTracks.length && !!_soundtrackLoadPromise;
  const isUnavailable = !state.soundtrackTracks.length && !!_soundtrackLoadError;
  state.soundtrackStatusEl.textContent = !state.soundtrackState.enabled
    ? `Paused · ${idx} / ${total}`
    : isUnavailable
      ? `Unavailable · ${idx} / ${total}`
      : isLoading
        ? `Loading · ${idx} / ${total}`
        : state.soundtrackState.isPlaying
          ? `Playing · ${idx} / ${total}`
          : `Ready · ${idx} / ${total}`;

  if (state.soundtrackPlayPauseBtn) {
    const playing = state.soundtrackState.enabled && state.soundtrackState.isPlaying;
    state.soundtrackPlayPauseBtn.textContent = playing ? '⏸' : '▶';
    state.soundtrackPlayPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  }

  state.soundtrackCard.classList.toggle('paused', !state.soundtrackState.enabled);

  // Keep the music icon button in active state while the panel is open
  // (icon active state is toggled by click handler; here we just reflect play state via label)
  const musicIconBtn = state.musicIconBtn || document.getElementById('music-icon-btn');
  if (musicIconBtn) {
    const playing = state.soundtrackState.enabled && state.soundtrackState.isPlaying;
    const label = musicIconBtn.querySelector('.hud-icon-label');
    if (label) label.textContent = playing ? '♪ On' : 'Music';
  }

  if (state.soundtrackTracklistEl) {
    state.soundtrackTracklistEl.querySelectorAll('.soundtrack-track-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === state.soundtrackState.trackIndex);
    });
  }
}

export function jumpToTrack(index) {
  const count = Math.max(state.soundtrackTracks.length, SOUNDTRACK_LIBRARY.length);
  if (!count) return;
  _hasSelectedInitialTrack = true;
  state.soundtrackState.trackIndex = ((index % count) + count) % count;
  clearSoundtrackTimers();
  if (state.soundtrackState.enabled && state.audioCtx && state.soundtrackTracks.length > 0) {
    startSoundtrackPlayback();
  } else {
    updateSoundtrackUi();
  }
}

export function clearSoundtrackTimers() {
  if (state.soundtrackState.schedulerId !== null) {
    window.clearTimeout(state.soundtrackState.schedulerId);
    state.soundtrackState.schedulerId = null;
  }
  if (state.soundtrackState.transitionId !== null) {
    window.clearTimeout(state.soundtrackState.transitionId);
    state.soundtrackState.transitionId = null;
  }
}

function clearSoundtrackResumePoint() {
  state.soundtrackState.resumeTrackIndex = null;
  state.soundtrackState.resumeBeatOffset = null;
}

function captureSoundtrackResumePoint() {
  const track = state.soundtrackTracks[state.soundtrackState.trackIndex];
  if (!state.audioCtx || !track) {
    clearSoundtrackResumePoint();
    return;
  }

  const secondsPerBeat = 60 / track.bpm;
  const elapsedSeconds = Math.max(0, state.audioCtx.currentTime - state.soundtrackState.trackStartedAt);
  const elapsedBeats = elapsedSeconds / secondsPerBeat;
  const clampedBeat = Math.min(
    Math.max(elapsedBeats, 0),
    Math.max(track.lengthBeats - 0.01, 0)
  );

  state.soundtrackState.resumeTrackIndex = state.soundtrackState.trackIndex;
  state.soundtrackState.resumeBeatOffset = clampedBeat;
}

export function stopActiveSoundtrackNodes(fadeSeconds = 0.18) {
  stopActiveNodeSet(state.audioCtx, state.soundtrackState.activeNodes, fadeSeconds);
}

export function scheduleSoundtrackNote(track, event) {
  scheduleTrackEvent(
    state.audioCtx,
    state.soundtrackMasterGain,
    state.soundtrackState.activeNodes,
    state.soundtrackState.trackStartedAt,
    track,
    event
  );
}

export function queueNextSoundtrackTrack(delaySeconds = 0.4) {
  const count = state.soundtrackTracks.length;
  if (state.soundtrackState.transitionId !== null || !state.soundtrackState.enabled || !count) return;
  state.soundtrackState.transitionId = window.setTimeout(() => {
    state.soundtrackState.transitionId = null;
    state.soundtrackState.trackIndex = (state.soundtrackState.trackIndex + 1) % count;
    startSoundtrackPlayback();
  }, delaySeconds * 1000);
}

export function scheduleSoundtrackTick() {
  if (!state.audioCtx || !state.soundtrackState.isPlaying || !state.soundtrackState.enabled) return;

  const track = state.soundtrackTracks[state.soundtrackState.trackIndex];
  if (!track) return;

  const lookAheadBeat = Math.max(
    0,
    ((state.audioCtx.currentTime + state.soundtrackState.lookAheadSeconds) - state.soundtrackState.trackStartedAt) / (60 / track.bpm)
  );

  while (
    state.soundtrackState.nextEventIndex < track.events.length &&
    track.events[state.soundtrackState.nextEventIndex].beat < lookAheadBeat
  ) {
    scheduleSoundtrackNote(track, track.events[state.soundtrackState.nextEventIndex]);
    state.soundtrackState.nextEventIndex += 1;
  }

  if (
    state.soundtrackState.nextEventIndex >= track.events.length &&
    state.audioCtx.currentTime >= state.soundtrackState.trackEndTime
  ) {
    state.soundtrackState.isPlaying = false;
    updateSoundtrackUi();
    queueNextSoundtrackTrack();
    return;
  }

  state.soundtrackState.schedulerId = window.setTimeout(scheduleSoundtrackTick, state.soundtrackState.schedulerIntervalMs);
}

export function startSoundtrackPlayback() {
  if (!state.audioCtx || !state.soundtrackMasterGain || !state.soundtrackState.enabled) {
    return;
  }
  if (state.soundtrackTracks.length === 0) {
    updateSoundtrackUi();
    normalizeSoundtrackLibrary()
      .then(() => {
        if (state.audioCtx && state.soundtrackMasterGain && state.soundtrackState.enabled && !state.soundtrackState.isPlaying) {
          startSoundtrackPlayback();
        }
      })
      .catch((err) => {
        console.warn('[Metalyceum] Soundtrack preload failed:', err);
      });
    return;
  }

  clearSoundtrackTimers();
  stopActiveSoundtrackNodes(0.08);
  ensureInitialSoundtrackTrackIndex(state.soundtrackTracks.length);

  const track = state.soundtrackTracks[state.soundtrackState.trackIndex];
  if (!track) return;
  const startDelaySeconds = state.soundtrackState.pendingStartDelaySeconds ?? 0;
  const fadeInSeconds = state.soundtrackState.pendingFadeInSeconds ?? 0.7;
  const targetVolume = state.soundtrackState.masterVolume ?? 1;
  const resumeBeatOffset = state.soundtrackState.resumeTrackIndex === state.soundtrackState.trackIndex
    ? Math.max(0, Math.min(state.soundtrackState.resumeBeatOffset ?? 0, Math.max(track.lengthBeats - 0.01, 0)))
    : 0;
  state.soundtrackState.pendingStartDelaySeconds = 0;
  state.soundtrackState.pendingFadeInSeconds = 0.7;
  clearSoundtrackResumePoint();
  state.soundtrackState.trackStartedAt = state.audioCtx.currentTime + 0.08 + startDelaySeconds - beatsToSeconds(resumeBeatOffset, track.bpm);
  state.soundtrackState.trackEndTime = state.soundtrackState.trackStartedAt + beatsToSeconds(track.lengthBeats, track.bpm);
  state.soundtrackState.nextEventIndex = track.events.findIndex((event) => event.beat >= resumeBeatOffset);
  if (state.soundtrackState.nextEventIndex === -1) {
    state.soundtrackState.nextEventIndex = track.events.length;
  }
  state.soundtrackState.isPlaying = true;
  state.soundtrackMasterGain.gain.cancelScheduledValues(state.audioCtx.currentTime);
  state.soundtrackMasterGain.gain.setValueAtTime(0.0001, state.audioCtx.currentTime);
  state.soundtrackMasterGain.gain.linearRampToValueAtTime(
    targetVolume,
    state.audioCtx.currentTime + startDelaySeconds + fadeInSeconds
  );
  updateSoundtrackUi();
  scheduleSoundtrackTick();
}

export function pauseSoundtrackPlayback({ preservePosition = false, fadeOutSeconds = 0.14 } = {}) {
  if (!state.audioCtx) return;
  if (preservePosition && state.soundtrackState.isPlaying) {
    captureSoundtrackResumePoint();
  } else {
    clearSoundtrackResumePoint();
  }
  clearSoundtrackTimers();
  state.soundtrackState.isPlaying = false;
  if (state.soundtrackMasterGain) {
    state.soundtrackMasterGain.gain.cancelScheduledValues(state.audioCtx.currentTime);
    state.soundtrackMasterGain.gain.setTargetAtTime(0.0001, state.audioCtx.currentTime, Math.max(fadeOutSeconds / 3, 0.04));
  }
  // Stop active oscillators synchronously — `clearSoundtrackTimers()` prevents
  // re-entrance so this is safe without deferring. A stale microtask could fire
  // after `startSoundtrackPlayback()` recreates nodes.
  stopActiveSoundtrackNodes(fadeOutSeconds);
  updateSoundtrackUi();
}

export function suppressSoundtrackForRoomMedia() {
  if (state.soundtrackState.suppressedByRoomMedia) {
    if (state.soundtrackState.isPlaying) {
      pauseSoundtrackPlayback({ preservePosition: true, fadeOutSeconds: 0.18 });
    }
    return;
  }

  state.soundtrackState.suppressedByRoomMedia = true;
  state.soundtrackState.previousEnabled = state.soundtrackState.enabled;
  state.soundtrackState.previousPlaying = state.soundtrackState.isPlaying;
  state.soundtrackState.enabled = false;
  pauseSoundtrackPlayback({ preservePosition: true, fadeOutSeconds: 0.18 });
}

export function restoreSoundtrackAfterRoomMedia() {
  if (!state.soundtrackState.suppressedByRoomMedia) return;

  const shouldEnable = state.soundtrackState.previousEnabled;
  const shouldResume = shouldEnable && state.soundtrackState.previousPlaying;

  state.soundtrackState.suppressedByRoomMedia = false;
  state.soundtrackState.previousEnabled = true;
  state.soundtrackState.previousPlaying = false;
  state.soundtrackState.enabled = shouldEnable;
  state.soundtrackState.pendingStartDelaySeconds = 0;
  state.soundtrackState.pendingFadeInSeconds = 0.22;
  updateSoundtrackUi();

  if (shouldResume) {
    resumeAudioContext().catch((err) => {
      console.warn('[Metalyceum] Audio context resume failed:', err);
    });
  } else {
    clearSoundtrackResumePoint();
  }
}

export function ensureAudioReady() {
  if (state.audioCtx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  state.audioListener = new THREE.AudioListener();
  state.camera.add(state.audioListener);
  // Share THREE's listener AudioContext for everything, so panners (3D room
  // audio) can connect to the listener input without crossing contexts, and
  // the listener position tracks the camera for correct positional audio.
  state.audioCtx = state.audioListener.context;

  state.soundtrackMasterGain = state.audioCtx.createGain();
  state.soundtrackMasterGain.gain.value = 0.0001;
  state.soundtrackMasterGain.connect(state.audioCtx.destination);
  void normalizeSoundtrackLibrary();
}

export function startAmbientRoomAudio() {
  if (!state.audioCtx || state.ambientAudioStarted) return;
  state.ambientAudioStarted = true;

  state.ROOMS.forEach((room, index) => {
    const marker = state.ROOM_INDICATORS.get(room.id);
    if (!marker) return;

    const oscillator = state.audioCtx.createOscillator();
    oscillator.type = index % 2 === 0 ? 'triangle' : 'sine';
    oscillator.frequency.value = 130 + index * 18;

    const gain = state.audioCtx.createGain();
    gain.gain.value = 0;

    const panner = state.audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 5;
    panner.maxDistance = 55;
    panner.rolloffFactor = 1.2;
    panner.positionX.value = marker.group.position.x;
    panner.positionY.value = 2.2;
    panner.positionZ.value = marker.group.position.z;

    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(state.audioListener.getInput());
    oscillator.start();

    state.roomAudioNodes.set(room.id, { oscillator, gain, panner });
  });
}

export function updateRoomAudioState() {
  if (!state.audioCtx || !state.audioListener) return;

  state.roomAudioNodes.forEach((nodes, roomId) => {
    const room = state.ROOMS[roomId];
    if (!room) return;
    const status = getRoomEventStatus(room);
    const gainTarget = status.tone === 'live' ? 0.017 : status.tone === 'upcoming' ? 0.009 : 0.0;
    nodes.gain.gain.setTargetAtTime(gainTarget, state.audioCtx.currentTime, 0.18);
  });
}

export async function resumeAudioContext() {
  ensureAudioReady();
  if (!state.audioCtx) return;
  if (state.audioCtx.state === 'suspended') {
    try {
      await state.audioCtx.resume();
    } catch (err) {
      console.warn('Unable to resume audio context', err);
    }
  }
  if (state.audioCtx.state === 'running') {
    startAmbientRoomAudio();
    updateRoomAudioState();
    if (state.soundtrackState.enabled && !state.soundtrackState.isPlaying) {
      startSoundtrackPlayback();
    }
  }
}

export function prepareSoundtrackLoginTransition() {
  clearSoundtrackResumePoint();
  state.soundtrackState.pendingStartDelaySeconds = 0.9;
  state.soundtrackState.pendingFadeInSeconds = 1.9;
}
