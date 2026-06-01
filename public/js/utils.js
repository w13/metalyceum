// Security and Date Utilities for Metalyceum
import { state } from './state.js';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const VENUE_ROAD_SEGMENTS = [
  { x1: 4.3, z1: 62.7, x2: 14, z2: 78, width: 5.0 },
  { x1: 14, z1: 78, x2: 27, z2: 97, width: 5.0 },
  { x1: 27, z1: 97, x2: 42, z2: 118, width: 5.0 },
  { x1: 42, z1: 118, x2: 56, z2: 137, width: 5.0 },
  { x1: 56, z1: 137, x2: 65, z2: 150, width: 5.0 },
  { x1: -5.3, z1: 61.8, x2: -18, z2: 68, width: 4.5 },
  { x1: -18, z1: 68, x2: -26, z2: 86, width: 4.5 },
  { x1: -26, z1: 86, x2: -38, z2: 104, width: 4.5 },
  { x1: -38, z1: 104, x2: -48, z2: 122, width: 4.5 },
  { x1: -48, z1: 122, x2: -60, z2: 140, width: 4.5 }
];

function pointToSegmentDistanceSquared(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSquared = dx * dx + dz * dz;
  if (lenSquared === 0) {
    const ddx = px - x1;
    const ddz = pz - z1;
    return ddx * ddx + ddz * ddz;
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSquared));
  const cx = x1 + dx * t;
  const cz = z1 + dz * t;
  const ddx = px - cx;
  const ddz = pz - cz;
  return ddx * ddx + ddz * ddz;
}

function tryParseUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch (e) {
    return null;
  }
}

function normalizeMeetUrl(value) {
  const url = tryParseUrl(value);
  if (!url) return null;
  if (url.hostname === 'meet.google.com' || url.hostname.endsWith('.meet.google.com')) {
    return `https://meet.google.com${url.pathname}`;
  }
  return null;
}

function parseDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventBoundary(date) {
  return date ? formatDateTime(date.toISOString()) : 'Not scheduled';
}

export function sanitizeColor(c, fallback = '#3b82f6') {
  return (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) ? c : fallback;
}

// Accept only a meet.google.com link; return a normalized https URL or null.
export function safeMeetUrl(v) {
  return normalizeMeetUrl(v);
}

// Strictly parse a media input into a YouTube ID or a meet.google.com URL.
// Returns the normalized value, or null to reject.
export function parseVideoInput(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  if (YOUTUBE_ID_PATTERN.test(s)) return s;

  const meetUrl = normalizeMeetUrl(s);
  if (meetUrl) return meetUrl;

  const url = tryParseUrl(s);
  if (!url) return null;

  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
    const idFromV = url.searchParams.get('v');
    if (idFromV && YOUTUBE_ID_PATTERN.test(idFromV)) return idFromV;
    // /live/ID, /embed/ID, /shorts/ID, /v/ID
    const m = url.pathname.match(/\/(?:live|embed|shorts|v)\/([A-Za-z0-9_-]{11})/);
    if (m && YOUTUBE_ID_PATTERN.test(m[1])) return m[1];
    return null;
  }

  if (url.hostname === 'youtu.be') {
    const id = url.pathname.slice(1).split(/[?#]/)[0];
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

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
  const date = parseDateValue(value);
  if (!date) return 'Not scheduled';
  return new Intl.DateTimeFormat([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export function formatDateTimeLocalValue(value) {
  const date = parseDateValue(value);
  if (!date) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getRoomEventWindow(room) {
  if (!room.startTime) {
    return { startDate: null, endDate: null, durationMinutes: room.durationMinutes || 0 };
  }
  const startDate = parseDateValue(room.startTime);
  if (!startDate) {
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
        detail: `Starts ${formatEventBoundary(startDate)}. Add a source before it begins.`
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
      detail: `Ended ${formatEventBoundary(endDate)}`
    };
  }

  if (now < startDate) {
    return {
      tone: 'upcoming',
      label: 'Upcoming',
      detail: `Starts ${formatEventBoundary(startDate)}`
    };
  }

  if (!endDate || durationMinutes === 0 || now <= endDate) {
    return {
      tone: 'live',
      label: 'Live now',
      detail: endDate ? `Ends ${formatEventBoundary(endDate)}` : 'Live with no end time set.'
    };
  }

  return {
    tone: 'ended',
    label: 'Ended',
    detail: `Ended ${formatEventBoundary(endDate)}`
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

// ── World placement validation ────────────────────────────────────────────────
export function isFrontPlazaFootprint(x, z) {
  const approachPromenade = z > 40 && z < 53.5 && Math.abs(x) < 6.5;
  const fountainPromenade = z >= 53.5 && z < 68 && Math.abs(x) < 9.5;
  const entryGardens = z > 42 && z < 52 && Math.abs(x) > 6.5 && Math.abs(x) < 18.5;
  const fountainGardens = z > 51 && z < 66 && Math.abs(x) > 8.25 && Math.abs(x) < 22.5;
  const fountainCourt = x * x + (z - 56.5) * (z - 56.5) < 86;
  const outerGardenPods = z > 60 && z < 67.5 && Math.abs(x) > 17.5 && Math.abs(x) < 26.5;
  return approachPromenade || fountainPromenade || entryGardens || fountainGardens || fountainCourt || outerGardenPods;
}

export function isVenueRoadFootprint(x, z, margin = 0) {
  return VENUE_ROAD_SEGMENTS.some((segment) => {
    const radius = segment.width / 2 + margin;
    return pointToSegmentDistanceSquared(x, z, segment.x1, segment.z1, segment.x2, segment.z2) < radius * radius;
  });
}

// Single source of truth for the exclusion zones used by tree, flower, grass,
// and boulder placement.  Returns true when (x, z) is a valid outdoor spot.
export function isWorldPlacementAllowed(x, z) {
  return !(
    (Math.abs(x) < 32 && Math.abs(z) < 44) ||        // building footprint
    isFrontPlazaFootprint(x, z) ||
    isVenueRoadFootprint(x, z, 2.5) ||
    (Math.abs(x - 65) < 40 && Math.abs(z - 150) < 40) || // amphitheater (65, 150)
    (z > 115 && z < 160 && x > -110 && x < -60) ||    // concert venue (-85, 140)
    (z > 60 && z < 130 && x > 0 && x < 70) ||         // road to amphitheater
    (z > 60 && z < 115 && x > -90 && x < 0) ||        // road to concert venue
    (z > 42 && z < 60 && Math.abs(x) < 3)             // road to main building
  );
}
