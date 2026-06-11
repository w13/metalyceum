#!/usr/bin/env node
// Bot load harness — opens N WebSocket players against a Metalyceum server.
//
// Usage:
//   node scripts/bot-harness.mjs --bots 50 --hz 12 --url ws://127.0.0.1:8788/ws
//
// Requires Node >= 22 (global WebSocket). Set MAX_PLAYERS=250 in .dev.vars first.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const BOT_COUNT = Number(args.bots ?? 10);
const SEND_HZ = Number(args.hz ?? 12);
const URL_BASE = args.url ?? 'ws://127.0.0.1:8788/ws';

// Bots wander a 120x120 area around the plaza so relevance filtering is exercised.
const AREA = 60;
const SPEED = 4; // units/sec, walking pace

// Unique per-run suffix: reconnecting with a username whose previous session
// is still inside the server's 15s disconnect-grace window (DISCONNECT_GRACE_MS)
// triggers session *revival*, not a fresh join — dead sessions also still count
// toward the player cap. Unique names make back-to-back runs safe.
const RUN_ID = Date.now().toString(36).slice(-4);

// Heartbeat interval matching the client (15 s). Must send or the server evicts
// the session after STALE_SESSION_MS (45 s).
const HEARTBEAT_INTERVAL_MS = 15_000;

let connected = 0;
let rejected = 0;
let batchesReceived = 0;

function pickWaypoint(bot) {
  bot.tx = (Math.random() - 0.5) * AREA;
  bot.tz = (Math.random() - 0.5) * AREA + 30;
}

function stepToward(bot, dist) {
  const dx = bot.tx - bot.x;
  const dz = bot.tz - bot.z;
  const d = Math.hypot(dx, dz);
  if (d < 1) return pickWaypoint(bot);
  bot.x += (dx / d) * dist;
  bot.z += (dz / d) * dist;
}

function startBot(i) {
  const ws = new WebSocket(`${URL_BASE}?username=bot${i}-${RUN_ID}`);
  const bot = { x: (Math.random() - 0.5) * AREA, z: (Math.random() - 0.5) * AREA + 30, tx: 0, tz: 0 };
  pickWaypoint(bot);

  let moveInterval = null;
  let heartbeatInterval = null;
  let opened = false; // counter integrity: a rejected handshake fires error (and
  // possibly close) without open — only decrement connected if we incremented.

  ws.addEventListener('open', () => {
    opened = true;
    connected++;
    ws.send(JSON.stringify({ type: 'join', x: bot.x, y: 0, z: bot.z, room: -1 }));

    // isMoving is always true and bots never idle — deliberate worst-case load
    // (every bot dirty on every tick, maximal relevance churn). Real traffic
    // idles often; treat these numbers as a ceiling, not typical.
    moveInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return clearInterval(moveInterval);
      stepToward(bot, SPEED / SEND_HZ);
      ws.send(JSON.stringify({
        type: 'move', x: bot.x, y: 0, z: bot.z,
        ry: Math.atan2(bot.tx - bot.x, bot.tz - bot.z),
        isMoving: true,
      }));
    }, 1000 / SEND_HZ);

    // Keep session alive: server evicts after 45 s of silence.
    heartbeatInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return clearInterval(heartbeatInterval);
      ws.send(JSON.stringify({ type: 'heartbeat' }));
    }, HEARTBEAT_INTERVAL_MS);
  });

  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'state_batch') batchesReceived++;
      // heartbeat_ack requires no reply; just consumed silently.
    } catch {}
  });

  ws.addEventListener('close', () => {
    if (opened) {
      connected--;
      opened = false;
    }
    if (moveInterval) clearInterval(moveInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });

  // Over-capacity upgrades are rejected as HTTP 429 *before* the WebSocket
  // handshake completes. In Node 22 this surfaces as an 'error' event
  // (ECONNRESET / unexpected server response) rather than a normal close.
  ws.addEventListener('error', () => {
    rejected++;
    if (moveInterval) clearInterval(moveInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });
}

// Stagger connections (20/sec) to avoid a thundering-herd join.
for (let i = 0; i < BOT_COUNT; i++) setTimeout(() => startBot(i), i * 50);

setInterval(() => {
  console.log(
    `[bots] connected=${connected}/${BOT_COUNT} rejected=${rejected} state_batches/5s=${batchesReceived}`,
  );
  batchesReceived = 0;
}, 5000);
