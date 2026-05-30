// Soundtrack and Ambient Spatial Audio for Metalyceum
import { state } from './state.js';
import { SOUNDTRACK_LIBRARY, SOUNDTRACK_STATE, NOTE_OFFSETS } from './config.js';
import { getRoomEventStatus } from './utils.js';

export function normalizeSoundtrackLibrary() {
  return SOUNDTRACK_LIBRARY.map((track) => ({
    ...track,
    events: track.lanes
      .flatMap((lane) => lane.notes.map(([beat, note, duration, velocity]) => ({
        beat,
        note,
        duration,
        velocity,
        lane
      })))
      .sort((a, b) => a.beat - b.beat)
  }));
}

export function noteNameToFrequency(note) {
  const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!match) {
    throw new Error(`Unsupported note: ${note}`);
  }
  const [, pitchClass, octaveRaw] = match;
  const octave = Number.parseInt(octaveRaw, 10);
  const midi = (octave + 1) * 12 + NOTE_OFFSETS[pitchClass];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function beatsToSeconds(beats, bpm) {
  return (60 / bpm) * beats;
}

export function updateSoundtrackUi() {
  if (!state.soundtrackCard || !state.soundtrackTitleEl || !state.soundtrackStatusEl || !state.soundtrackToggleBtn) return;

  const track = state.soundtrackTracks[SOUNDTRACK_STATE.trackIndex];
  state.soundtrackTitleEl.textContent = track ? track.title : 'Ambient soundtrack';
  state.soundtrackStatusEl.textContent = !SOUNDTRACK_STATE.enabled
    ? 'Muted'
    : SOUNDTRACK_STATE.isPlaying
      ? `Playlist active · Track ${SOUNDTRACK_STATE.trackIndex + 1} of ${state.soundtrackTracks.length}`
      : 'Ready after join';
  state.soundtrackToggleBtn.textContent = SOUNDTRACK_STATE.enabled ? 'Mute' : 'Unmute';
  state.soundtrackCard.classList.toggle('muted', !SOUNDTRACK_STATE.enabled);
}

export function clearSoundtrackTimers() {
  if (SOUNDTRACK_STATE.schedulerId !== null) {
    window.clearTimeout(SOUNDTRACK_STATE.schedulerId);
    SOUNDTRACK_STATE.schedulerId = null;
  }
  if (SOUNDTRACK_STATE.transitionId !== null) {
    window.clearTimeout(SOUNDTRACK_STATE.transitionId);
    SOUNDTRACK_STATE.transitionId = null;
  }
}

export function stopActiveSoundtrackNodes(fadeSeconds = 0.18) {
  if (!state.audioCtx) return;
  const stopAt = state.audioCtx.currentTime + fadeSeconds + 0.04;
  SOUNDTRACK_STATE.activeNodes.forEach((entry) => {
    entry.gain.gain.cancelScheduledValues(state.audioCtx.currentTime);
    entry.gain.gain.setTargetAtTime(0.0001, state.audioCtx.currentTime, Math.max(fadeSeconds / 3, 0.03));
    try {
      entry.oscillator.stop(stopAt);
    } catch (err) {
      // Oscillators can only be stopped once; ignore redundant stop attempts.
    }
  });
}

export function scheduleSoundtrackNote(track, event) {
  if (!state.audioCtx || !state.soundtrackMasterGain) return;

  const noteStart = SOUNDTRACK_STATE.trackStartedAt + beatsToSeconds(event.beat, track.bpm);
  const noteDuration = beatsToSeconds(event.duration, track.bpm);
  const lane = event.lane;
  const oscillator = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();
  const stereoPanner = typeof state.audioCtx.createStereoPanner === 'function'
    ? state.audioCtx.createStereoPanner()
    : null;

  oscillator.type = lane.wave;
  oscillator.frequency.setValueAtTime(noteNameToFrequency(event.note), noteStart);

  gain.gain.setValueAtTime(0.0001, noteStart);
  gain.gain.linearRampToValueAtTime(Math.max(lane.volume * event.velocity, 0.0001), noteStart + lane.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration + lane.release);

  oscillator.connect(gain);
  if (stereoPanner) {
    stereoPanner.pan.value = lane.pan || 0;
    gain.connect(stereoPanner);
    stereoPanner.connect(state.soundtrackMasterGain);
  } else {
    gain.connect(state.soundtrackMasterGain);
  }

  const nodeRecord = { oscillator, gain };
  SOUNDTRACK_STATE.activeNodes.add(nodeRecord);
  oscillator.onended = () => {
    SOUNDTRACK_STATE.activeNodes.delete(nodeRecord);
    oscillator.disconnect();
    gain.disconnect();
    if (stereoPanner) stereoPanner.disconnect();
  };

  oscillator.start(noteStart);
  oscillator.stop(noteStart + noteDuration + lane.release + 0.05);
}

export function queueNextSoundtrackTrack(delaySeconds = 0.4) {
  if (SOUNDTRACK_STATE.transitionId !== null || !SOUNDTRACK_STATE.enabled) return;
  SOUNDTRACK_STATE.transitionId = window.setTimeout(() => {
    SOUNDTRACK_STATE.transitionId = null;
    SOUNDTRACK_STATE.trackIndex = (SOUNDTRACK_STATE.trackIndex + 1) % state.soundtrackTracks.length;
    startSoundtrackPlayback();
  }, delaySeconds * 1000);
}

export function scheduleSoundtrackTick() {
  if (!state.audioCtx || !SOUNDTRACK_STATE.isPlaying || !SOUNDTRACK_STATE.enabled) return;

  const track = state.soundtrackTracks[SOUNDTRACK_STATE.trackIndex];
  if (!track) return;

  const lookAheadBeat = Math.max(
    0,
    ((state.audioCtx.currentTime + SOUNDTRACK_STATE.lookAheadSeconds) - SOUNDTRACK_STATE.trackStartedAt) / (60 / track.bpm)
  );

  while (
    SOUNDTRACK_STATE.nextEventIndex < track.events.length &&
    track.events[SOUNDTRACK_STATE.nextEventIndex].beat < lookAheadBeat
  ) {
    scheduleSoundtrackNote(track, track.events[SOUNDTRACK_STATE.nextEventIndex]);
    SOUNDTRACK_STATE.nextEventIndex += 1;
  }

  if (
    SOUNDTRACK_STATE.nextEventIndex >= track.events.length &&
    state.audioCtx.currentTime >= SOUNDTRACK_STATE.trackEndTime
  ) {
    SOUNDTRACK_STATE.isPlaying = false;
    updateSoundtrackUi();
    queueNextSoundtrackTrack();
    return;
  }

  SOUNDTRACK_STATE.schedulerId = window.setTimeout(scheduleSoundtrackTick, SOUNDTRACK_STATE.schedulerIntervalMs);
}

export function startSoundtrackPlayback() {
  if (!state.audioCtx || !state.soundtrackMasterGain || !SOUNDTRACK_STATE.enabled || state.soundtrackTracks.length === 0) return;

  clearSoundtrackTimers();
  stopActiveSoundtrackNodes(0.08);

  const track = state.soundtrackTracks[SOUNDTRACK_STATE.trackIndex];
  SOUNDTRACK_STATE.trackStartedAt = state.audioCtx.currentTime + 0.08;
  SOUNDTRACK_STATE.trackEndTime = SOUNDTRACK_STATE.trackStartedAt + beatsToSeconds(track.lengthBeats, track.bpm);
  SOUNDTRACK_STATE.nextEventIndex = 0;
  SOUNDTRACK_STATE.isPlaying = true;
  state.soundtrackMasterGain.gain.cancelScheduledValues(state.audioCtx.currentTime);
  state.soundtrackMasterGain.gain.setTargetAtTime(0.14, state.audioCtx.currentTime, 0.2);
  updateSoundtrackUi();
  scheduleSoundtrackTick();
}

export function pauseSoundtrackPlayback() {
  if (!state.audioCtx) return;
  clearSoundtrackTimers();
  SOUNDTRACK_STATE.isPlaying = false;
  if (state.soundtrackMasterGain) {
    state.soundtrackMasterGain.gain.cancelScheduledValues(state.audioCtx.currentTime);
    state.soundtrackMasterGain.gain.setTargetAtTime(0.0001, state.audioCtx.currentTime, 0.08);
  }
  stopActiveSoundtrackNodes(0.14);
  updateSoundtrackUi();
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

  if (state.soundtrackTracks.length === 0) {
    state.soundtrackTracks = normalizeSoundtrackLibrary();
  }
  state.soundtrackMasterGain = state.audioCtx.createGain();
  state.soundtrackMasterGain.gain.value = 0.0001;
  state.soundtrackMasterGain.connect(state.audioCtx.destination);
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
    if (state.isJoined && SOUNDTRACK_STATE.enabled && !SOUNDTRACK_STATE.isPlaying) {
      startSoundtrackPlayback();
    }
  }
}
