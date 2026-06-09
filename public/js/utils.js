// Security and Date Utilities for Metalyceum

import { pointToSegmentDistSq } from './math.js';
import { state } from './state.js';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
// Exported flat segment arrays for physics terrain flattening (without width)
export const AMP_ROAD_SEGMENTS = [
  [4.3, 62.7, 14, 78],
  [14, 78, 27, 97],
  [27, 97, 42, 118],
  [42, 118, 56, 137],
  [56, 137, 65, 150],
];
export const CV_ROAD_SEGMENTS = [
  [-5.3, 61.8, -18, 68],
  [-18, 68, -26, 86],
  [-26, 86, -38, 104],
  [-38, 104, -48, 122],
  [-48, 122, -60, 140],
];

// Built from the exported segment arrays to keep a single source of truth.
const VENUE_ROAD_SEGMENTS = [
  ...AMP_ROAD_SEGMENTS.map(([x1, z1, x2, z2]) => ({
    x1,
    z1,
    x2,
    z2,
    width: 5.0,
  })),
  ...CV_ROAD_SEGMENTS.map(([x1, z1, x2, z2]) => ({
    x1,
    z1,
    x2,
    z2,
    width: 4.5,
  })),
];

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
  if (
    url.hostname === 'meet.google.com' ||
    url.hostname.endsWith('.meet.google.com')
  ) {
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
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
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
    const m = url.pathname.match(
      /\/(?:live|embed|shorts|v)\/([A-Za-z0-9_-]{11})/,
    );
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

  const nextSourceValue =
    typeof roomData.sourceValue === 'string'
      ? roomData.sourceValue
      : typeof roomData.videoId === 'string'
        ? roomData.videoId
        : room.sourceValue;
  room.sourceValue = nextSourceValue || '';
  room.video = room.sourceValue;
  room.sourceType = roomData.sourceType || deriveSourceType(room.sourceValue);

  if (roomData.startTime === null) {
    room.startTime = null;
  } else if (typeof roomData.startTime === 'string') {
    room.startTime = roomData.startTime;
  }

  if (
    typeof roomData.durationMinutes === 'number' &&
    Number.isFinite(roomData.durationMinutes)
  ) {
    room.durationMinutes = Math.max(0, Math.round(roomData.durationMinutes));
  }

  if (
    typeof roomData.updatedAt === 'number' &&
    Number.isFinite(roomData.updatedAt)
  ) {
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
    minute: '2-digit',
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
    return {
      startDate: null,
      endDate: null,
      durationMinutes: room.durationMinutes || 0,
    };
  }
  const startDate = parseDateValue(room.startTime);
  if (!startDate) {
    return {
      startDate: null,
      endDate: null,
      durationMinutes: room.durationMinutes || 0,
    };
  }
  const durationMinutes = Math.max(0, room.durationMinutes || 0);
  const endDate =
    durationMinutes > 0
      ? new Date(startDate.getTime() + durationMinutes * 60 * 1000)
      : null;
  return { startDate, endDate, durationMinutes };
}

export function getRoomEventStatus(room) {
  const sourceValue = room.sourceValue || '';
  const { startDate, endDate, durationMinutes } = getRoomEventWindow(room);
  const now = new Date();

  if (!sourceValue && !startDate) {
    return {
      tone: 'idle',
      label: 'Idle',
      detail: 'No event scheduled yet.',
    };
  }

  if (!startDate) {
    return {
      tone: sourceValue ? 'ready' : 'idle',
      label: sourceValue ? 'Open room' : 'Idle',
      detail: sourceValue
        ? 'Source is ready. Add a start time to schedule it.'
        : 'No event scheduled yet.',
    };
  }

  if (!sourceValue) {
    if (now < startDate) {
      return {
        tone: 'ready',
        label: 'Scheduled',
        detail: `Starts ${formatEventBoundary(startDate)}. Add a source before it begins.`,
      };
    }

    if (!endDate || durationMinutes === 0 || now <= endDate) {
      return {
        tone: 'ready',
        label: 'Awaiting source',
        detail:
          'This room has started, but no YouTube Live or Google Meet source is attached yet.',
      };
    }

    return {
      tone: 'ended',
      label: 'Ended',
      detail: `Ended ${formatEventBoundary(endDate)}`,
    };
  }

  if (now < startDate) {
    return {
      tone: 'upcoming',
      label: 'Upcoming',
      detail: `Starts ${formatEventBoundary(startDate)}`,
    };
  }

  if (!endDate || durationMinutes === 0 || now <= endDate) {
    return {
      tone: 'live',
      label: 'Live now',
      detail: endDate
        ? `Ends ${formatEventBoundary(endDate)}`
        : 'Live with no end time set.',
    };
  }

  return {
    tone: 'ended',
    label: 'Ended',
    detail: `Ended ${formatEventBoundary(endDate)}`,
  };
}

export function getRoomPlaybackStartSeconds(room) {
  if (!room.startTime || room.sourceType !== 'youtube') return 0;
  const { startDate, durationMinutes } = getRoomEventWindow(room);
  if (!startDate) return 0;
  const elapsed = Math.floor((Date.now() - startDate.getTime()) / 1000);
  if (elapsed < 0) return 0;

  // Never send `start` for an ongoing live stream — YouTube treats any start
  // parameter as a recording seek and shows "This live stream recording is not
  // available." Only seek into the video once the event has a defined duration
  // and that window has fully elapsed (i.e. it's now a VOD recording).
  if (durationMinutes <= 0) return 0;
  if (elapsed < durationMinutes * 60) return 0;
  return Math.min(durationMinutes * 60, elapsed);
}

// ── World placement validation ────────────────────────────────────────────────
export function isFrontPlazaFootprint(x, z) {
  const approachPromenade = z > 40 && z < 53.5 && Math.abs(x) < 6.5;
  const fountainPromenade = z >= 53.5 && z < 68 && Math.abs(x) < 9.5;
  const entryGardens =
    z > 42 && z < 52 && Math.abs(x) > 6.5 && Math.abs(x) < 18.5;
  const fountainGardens =
    z > 51 && z < 66 && Math.abs(x) > 8.25 && Math.abs(x) < 22.5;
  const fountainCourt = x * x + (z - 56.5) * (z - 56.5) < 86;
  const outerGardenPods =
    z > 60 && z < 67.5 && Math.abs(x) > 17.5 && Math.abs(x) < 26.5;
  return (
    approachPromenade ||
    fountainPromenade ||
    entryGardens ||
    fountainGardens ||
    fountainCourt ||
    outerGardenPods
  );
}

export function isVenueRoadFootprint(x, z, margin = 0) {
  return VENUE_ROAD_SEGMENTS.some((segment) => {
    const radius = segment.width / 2 + margin;
    return (
      pointToSegmentDistSq(
        x,
        z,
        segment.x1,
        segment.z1,
        segment.x2,
        segment.z2,
      ) <
      radius * radius
    );
  });
}

// Single source of truth for the exclusion zones used by tree, flower, grass,
// and boulder placement.  Returns true when (x, z) is a valid outdoor spot.
export function isWorldPlacementAllowed(x, z) {
  return !(
    (
      (Math.abs(x) < 32 && Math.abs(z) < 44) || // building footprint
      isFrontPlazaFootprint(x, z) ||
      isVenueRoadFootprint(x, z, 2.5) ||
      (Math.abs(x - 65) < 40 && Math.abs(z - 150) < 40) || // amphitheater (65, 150)
      (z > 115 && z < 160 && x > -110 && x < -60) || // concert venue (-85, 140)
      (Math.abs(x - 160) < 60 && Math.abs(z - 220) < 55) || // airport (160, 220)
      (Math.abs(x - 120) < 30 && Math.abs(z - 80) < 30) || // cave & underground city
      (z > 60 && z < 130 && x > 0 && x < 70) || // road to amphitheater
      (z > 60 && z < 115 && x > -90 && x < 0) || // road to concert venue
      (z > 42 && z < 60 && Math.abs(x) < 3)
    ) // road to main building
  );
}
