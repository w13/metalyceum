// Top-down Mini-Map for Metalyceum
// Renders a camera-oriented circular overview showing the terrain, building layout,
// walls, rooms, the local player (as an arrow), and other players/NPCs nearby.
import { state } from './state.js';
import { ROOM_LAYOUTS } from './config.js';

const MAP_RADIUS_PX = 95;       // visible radius in canvas pixels
const WORLD_RADIUS = 180;       // world units visible from center
const SCALE = MAP_RADIUS_PX / WORLD_RADIUS;
const MAP_SIZE = MAP_RADIUS_PX * 2;
const Z_INDEX = 50;             // below overlays (z:100) so minimap stays behind modals

let canvas = null;
let ctx = null;
let initialized = false;

// Colors
const GRASS_COLOR = '#1a3a1a';
const GRASS_FLAT = '#1e4420';
const MAP_BORDER = '#334155';
const WALL_FILL = 'rgba(71, 85, 105, 0.7)';
const ROOM_FILL = 'rgba(30, 41, 59, 0.35)';
const PLAYER_COLOR = '#38bdf8';
const REMOTE_COLOR = '#f59e0b';
const NPC_COLOR = '#a3e635';
const GRID_COLOR = 'rgba(74, 120, 60, 0.2)';
const COMPASS_COLOR = '#94a3b8';
const TEXT_COLOR = '#94a3b8';

export function initMinimap() {
  canvas = document.getElementById('minimap-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'minimap-canvas';
    canvas.style.cssText = `position:absolute;bottom:16px;right:16px;width:${MAP_SIZE+10}px;height:${MAP_SIZE+10}px;border-radius:50%;border:2px solid rgba(51,65,85,0.6);box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none;z-index:${Z_INDEX};`;
    document.body.appendChild(canvas);
  }
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  ctx = canvas.getContext('2d');
  initialized = true;
}

function worldToMap(wx, wz, px, pz) {
  const dx = wx - px;
  const dz = wz - pz;
  return {
    sx: MAP_RADIUS_PX + dx * SCALE,
    sy: MAP_RADIUS_PX - dz * SCALE
  };
}

function clipCircle(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
}

export function renderMinimap() {
  if (!initialized || !ctx || !state.localPlayer || !state.camera) return;

  const px = state.localPlayer.x;
  const pz = state.localPlayer.z;
  const playerRy = state.localPlayer.ry;
  const cw = canvas.width;
  const ch = canvas.height;
  const cx = cw / 2;
  const cy = ch / 2;

  // Camera yaw: angle from player to camera (used to orient minimap so camera looks "up")
  const camAngle = Math.atan2(
    state.camera.position.x - px,
    state.camera.position.z - pz
  );

  ctx.clearRect(0, 0, cw, ch);
  clipCircle(ctx, cx, cy, MAP_RADIUS_PX);

  // --- Rotate the whole map so camera direction faces up ---
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(camAngle);
  ctx.translate(-cx, -cy);

  // --- Terrain background ---
  // Fill the visible area with grass, then overlay the flat building zone
  ctx.fillStyle = GRASS_COLOR;
  ctx.fillRect(0, 0, cw, ch);

  // Helper: draw a flat zone circle at world position (wx, wz) with given radius
  function drawFlatZone(wx, wz, radius) {
    const o = (wx - px) * SCALE;
    const p = (wz - pz) * SCALE;
    const rotSx = cx + o * Math.cos(camAngle) + p * Math.sin(camAngle);
    const rotSy = cy - o * Math.sin(camAngle) + p * Math.cos(camAngle);
    ctx.beginPath();
    ctx.arc(rotSx, rotSy, radius * SCALE, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central flat zone (distFromCenter < 52)
  ctx.fillStyle = GRASS_FLAT;
  drawFlatZone(0, 0, 52);

  // Amphitheater flat zone (~65, 150, radius ~22)
  ctx.fillStyle = GRASS_FLAT;
  drawFlatZone(65, 150, 22);

  // Concert venue flat zone (~-85, 140, radius ~23)
  ctx.fillStyle = GRASS_FLAT;
  drawFlatZone(-85, 140, 23);

  // Grid lines (every 10 world units)
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 0.5;
  const gridStart = Math.floor((pz - WORLD_RADIUS) / 10) * 10;
  const gridEnd = Math.ceil((pz + WORLD_RADIUS) / 10) * 10;
  for (let gz = gridStart; gz <= gridEnd; gz += 10) {
    const { sy } = worldToMap(px, gz, px, pz);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(cw, sy);
    ctx.stroke();
  }
  const gridStartX = Math.floor((px - WORLD_RADIUS) / 10) * 10;
  const gridEndX = Math.ceil((px + WORLD_RADIUS) / 10) * 10;
  for (let gx = gridStartX; gx <= gridEndX; gx += 10) {
    const { sx } = worldToMap(gx, pz, px, pz);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, ch);
    ctx.stroke();
  }

  // Rooms (filled semi-transparent areas)
  state.ROOMS.forEach((room) => {
    const layout = ROOM_LAYOUTS[room.id] || {};
    const topLeft = worldToMap(room.x - room.width / 2, room.z - room.depth / 2, px, pz);
    const botRight = worldToMap(room.x + room.width / 2, room.z + room.depth / 2, px, pz);
    const rw = botRight.sx - topLeft.sx;
    const rh = topLeft.sy - botRight.sy;

    ctx.fillStyle = layout.themeColor ? layout.themeColor + '40' : ROOM_FILL;
    ctx.fillRect(topLeft.sx, botRight.sy, rw, rh);

    if (rw > 20) {
      ctx.fillStyle = layout.themeColor || TEXT_COLOR;
      ctx.font = `${Math.min(9, Math.max(6, rw / 4))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name.substring(0, 3), topLeft.sx + rw / 2, botRight.sy + rh / 2);
    }
  });

  // Walls
  ctx.fillStyle = WALL_FILL;
  state.WALLS.forEach((wall) => {
    const w = wall.max.x - wall.min.x;
    const h = wall.max.z - wall.min.z;
    if (w < 0.1 || h < 0.1) return;
    const tl = worldToMap(wall.min.x, wall.min.z, px, pz);
    const br = worldToMap(wall.max.x, wall.max.z, px, pz);
    const rw = br.sx - tl.sx;
    const rh = tl.sy - br.sy;
    if (rw < 1 && rh < 1) {
      ctx.fillStyle = WALL_FILL;
      ctx.beginPath();
      ctx.arc(tl.sx, tl.sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(tl.sx, br.sy, Math.max(rw, 1), Math.max(rh, 1));
    }
  });

  // Plaza outline
  const plazaCenter = worldToMap(0, 49.5, px, pz);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(plazaCenter.sx, plazaCenter.sy, 18 * SCALE, 0, Math.PI * 2);
  ctx.stroke();

  const worldRadiusSq = WORLD_RADIUS * WORLD_RADIUS;

  // NPCs
  state.npcs.forEach((npc) => {
    const pos = worldToMap(npc.x, npc.z, px, pz);
    const dx = npc.x - px, dz = npc.z - pz;
    if (dx * dx + dz * dz > worldRadiusSq) return;
    ctx.fillStyle = NPC_COLOR;
    ctx.beginPath();
    ctx.arc(pos.sx, pos.sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Remote players
  state.remotePlayers.forEach((p) => {
    const pos = worldToMap(p.x, p.z, px, pz);
    const dx = p.x - px, dz = p.z - pz;
    if (dx * dx + dz * dz > worldRadiusSq) return;
    ctx.fillStyle = REMOTE_COLOR;
    ctx.beginPath();
    ctx.arc(pos.sx, pos.sy, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Local player arrow (at center, rotated to face direction)
  ctx.translate(cx, cy);
  // Undo the world rotation for the arrow so it shows true facing
  ctx.rotate(-camAngle);
  ctx.rotate(-playerRy);
  ctx.fillStyle = PLAYER_COLOR;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(-4, 5);
  ctx.lineTo(0, 3);
  ctx.lineTo(4, 5);
  ctx.closePath();
  ctx.fill();

  // Restore the rotated world context
  ctx.restore();

  // Restore from clip
  ctx.restore();

  // --- Circular border (not rotated) ---
  ctx.beginPath();
  ctx.arc(cx, cy, MAP_RADIUS_PX, 0, Math.PI * 2);
  ctx.strokeStyle = MAP_BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();

  // --- Compass: north indicator rotates relative to camera ---
  const compassDist = MAP_RADIUS_PX * 0.82;
  const compassX = cx + compassDist * Math.sin(camAngle);
  const compassY = cy - compassDist * Math.cos(camAngle);

  ctx.fillStyle = COMPASS_COLOR;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', compassX, compassY);

  // Player position label below minimap
  ctx.fillStyle = TEXT_COLOR;
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${px.toFixed(0)}, ${pz.toFixed(0)}`, cx, cy + MAP_RADIUS_PX + 4);
}

export function toggleMinimap() {
  if (canvas) {
    canvas.style.display = canvas.style.display === 'none' ? '' : 'none';
  }
}
