// Security and Date Utilities for Metalyceum
import { state } from './state.js';

export function sanitizeColor(c, fallback = '#3b82f6') {
  return (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : fallback;
}

// Accept only a meet.google.com link; return a normalized https URL or null.
export function safeMeetUrl(v) {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v.startsWith('http') ? v : 'https://' + v);
    if (u.hostname === 'meet.google.com' || u.hostname.endsWith('.meet.google.com')) {
      return `https://meet.google.com${u.pathname}`;
    }
  } catch (e) {}
  return null;
}

// Strictly parse a media input into a YouTube ID or a meet.google.com URL.
// Returns the normalized value, or null to reject.
export function parseVideoInput(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : 'https://' + s);
    if (u.hostname === 'meet.google.com' || u.hostname.endsWith('.meet.google.com')) {
      return `https://meet.google.com${u.pathname}`;
    }
    if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com') {
      const id = u.searchParams.get('v');
      return id && YT_ID.test(id) ? id : null;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return YT_ID.test(id) ? id : null;
    }
  } catch (e) {}
  return null;
}

export function deriveSourceType(sourceValue) {
  if (!sourceValue) return 'none';
  return sourceValue.includes('meet.google.com') ? 'meet' : 'youtube';
}

export function applyRoomData(roomId, roomData = {}) {
  const room = state.ROOMS[roomId];
  if (!room) return;

  if (typeof roomData.name === 'string' && roomData.name.trim()) {
    room.name = roomData.name.trim();
  }

  const nextSourceValue = typeof roomData.sourceValue === 'string'
    ? roomData.sourceValue
    : typeof roomData.videoId === 'string'
      ? roomData.videoId
      : room.sourceValue;
  room.sourceValue = nextSourceValue || "";
  room.video = room.sourceValue;
  room.sourceType = roomData.sourceType || deriveSourceType(room.sourceValue);

  if (roomData.startTime === null) {
    room.startTime = null;
  } else if (typeof roomData.startTime === 'string') {
    room.startTime = roomData.startTime;
  }

  if (typeof roomData.durationMinutes === 'number' && Number.isFinite(roomData.durationMinutes)) {
    room.durationMinutes = Math.max(0, Math.round(roomData.durationMinutes));
  }

  if (typeof roomData.updatedAt === 'number' && Number.isFinite(roomData.updatedAt)) {
    room.updatedAt = roomData.updatedAt;
  }
}

export function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getRoomEventWindow(room) {
  if (!room.startTime) {
    return { startDate: null, endDate: null, durationMinutes: room.durationMinutes || 0 };
  }
  const startDate = new Date(room.startTime);
  if (Number.isNaN(startDate.getTime())) {
    return { startDate: null, endDate: null, durationMinutes: room.durationMinutes || 0 };
  }
  const durationMinutes = Math.max(0, room.durationMinutes || 0);
  const endDate = durationMinutes > 0
    ? new Date(startDate.getTime() + durationMinutes * 60 * 1000)
    : null;
  return { startDate, endDate, durationMinutes };
}

export function getRoomEventStatus(room) {
  const sourceValue = room.sourceValue || "";
  const { startDate, endDate, durationMinutes } = getRoomEventWindow(room);
  const now = new Date();

  if (!sourceValue && !startDate) {
    return {
      tone: 'idle',
      label: 'Idle',
      detail: 'No event scheduled yet.'
    };
  }

  if (!startDate) {
    return {
      tone: sourceValue ? 'ready' : 'idle',
      label: sourceValue ? 'Open room' : 'Idle',
      detail: sourceValue ? 'Source is ready. Add a start time to schedule it.' : 'No event scheduled yet.'
    };
  }

  if (!sourceValue) {
    if (now < startDate) {
      return {
        tone: 'ready',
        label: 'Scheduled',
        detail: `Starts ${formatDateTime(startDate.toISOString())}. Add a source before it begins.`
      };
    }

    if (!endDate || durationMinutes === 0 || now <= endDate) {
      return {
        tone: 'ready',
        label: 'Awaiting source',
        detail: 'This room has started, but no YouTube Live or Google Meet source is attached yet.'
      };
    }

    return {
      tone: 'ended',
      label: 'Ended',
      detail: `Ended ${formatDateTime(endDate.toISOString())}`
    };
  }

  if (now < startDate) {
    return {
      tone: 'upcoming',
      label: 'Upcoming',
      detail: `Starts ${formatDateTime(startDate.toISOString())}`
    };
  }

  if (!endDate || durationMinutes === 0 || now <= endDate) {
    return {
      tone: 'live',
      label: 'Live now',
      detail: endDate ? `Ends ${formatDateTime(endDate.toISOString())}` : 'Live with no end time set.'
    };
  }

  return {
    tone: 'ended',
    label: 'Ended',
    detail: `Ended ${formatDateTime(endDate.toISOString())}`
  };
}

export function getRoomPlaybackStartSeconds(room) {
  if (!room.startTime || room.sourceType !== 'youtube') return 0;
  const { startDate, durationMinutes } = getRoomEventWindow(room);
  if (!startDate) return 0;
  const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000);
  const clampedElapsed = Math.max(0, elapsed);
  if (durationMinutes > 0) {
    return Math.min(durationMinutes * 60, clampedElapsed);
  }
  return clampedElapsed;
}
