// Chat Log, Chat Bubbles, and Scope Filtering for Metalyceum
import { state } from './state.js';
import { ROOM_LAYOUTS } from './config.js';

const MAX_RENDERED_CHAT_MESSAGES = 100;

function getChatScopeLabel(scope, roomId = null) {
  if (scope === 'global') return 'Global';
  if (typeof roomId === 'number' && state.ROOMS[roomId]?.name) return state.ROOMS[roomId].name;
  if (state.localPlayer.currentRoom >= 0 && state.ROOMS[state.localPlayer.currentRoom]?.name) return state.ROOMS[state.localPlayer.currentRoom].name;
  return 'Room';
}

function getFilterableChatScope(messageEl) {
  if (messageEl.dataset.scope) return messageEl.dataset.scope;
  return messageEl.classList.contains('system-msg') ? 'system' : 'global';
}

export function syncChatToolbarState() {
  // Note: Send scope buttons removed — chat always sends as global (tagged to room)
  document.querySelectorAll('[data-chat-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.chatFilter === state.chat.filter);
  });

  const input = document.getElementById('chat-input');
  if (input) {
    input.placeholder = state.localPlayer.currentRoom >= 0
      ? `Message everyone in ${state.ROOMS[state.localPlayer.currentRoom].name}...`
      : 'Message everyone in Metalyceum...';
  }
}

export function applyChatFilter() {
  const log = document.getElementById('chat-log');
  if (!log) return;

  for (const child of log.children) {
    const scope = getFilterableChatScope(child);
    child.hidden = state.chat.filter !== 'all' && scope !== 'system' && scope !== state.chat.filter;
  }

  log.scrollTop = log.scrollHeight;
  syncChatToolbarState();
}

export function setChatFilter(filter) {
  state.chat.filter = filter === 'global' || filter === 'room' ? filter : 'all';
  applyChatFilter();
}

export function syncChatScopeWithLocation() {
  if (state.localPlayer.currentRoom === -1 && state.chat.sendScope === 'room') {
    state.chat.sendScope = 'global';
  }
  syncChatToolbarState();
  applyChatFilter();
}

export function getActiveChatScope() {
  if (state.chat.sendScope === 'room' && state.localPlayer.currentRoom >= 0) return 'room';
  return 'global';
}

function trackRenderedChatMessage(log, messageId) {
  state.chat.renderedMessageIds.add(messageId);
  state.chat.renderedMessageOrder.push(messageId);

  while (state.chat.renderedMessageOrder.length > MAX_RENDERED_CHAT_MESSAGES) {
    const oldestMessageId = state.chat.renderedMessageOrder.shift();
    state.chat.renderedMessageIds.delete(oldestMessageId);
    log.querySelector(`[data-message-id="${oldestMessageId}"]`)?.remove();
  }
}

export function addChatLog(author, message, className = "", scope = "system", roomId = null, messageId = null) {
  const log = document.getElementById('chat-log');
  if (!log) return;

  const normalizedMessageId = Number.isInteger(messageId) ? messageId : null;
  if (normalizedMessageId !== null && state.chat.renderedMessageIds.has(normalizedMessageId)) {
    return;
  }

  const msgDiv = document.createElement('div');
  
  if (className) {
    msgDiv.className = className;
    msgDiv.dataset.scope = 'system';
    msgDiv.textContent = message;
  } else {
    msgDiv.className = 'chat-msg';
    msgDiv.dataset.scope = scope;
    if (normalizedMessageId !== null) {
      msgDiv.dataset.messageId = String(normalizedMessageId);
    }
    const badge = document.createElement('span');
    badge.className = `chat-scope-badge ${scope}`;
    badge.textContent = getChatScopeLabel(scope, roomId);
    const authorSpan = document.createElement('span');
    authorSpan.className = 'chat-author';
    authorSpan.style.color = author === state.localPlayer.username ? '#818cf8' : '#38bdf8';
    authorSpan.textContent = `${author}:`;
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    msgDiv.appendChild(badge);
    msgDiv.appendChild(authorSpan);
    msgDiv.appendChild(msgSpan);
  }
  
  log.appendChild(msgDiv);
  if (normalizedMessageId !== null) {
    trackRenderedChatMessage(log, normalizedMessageId);
  }
  applyChatFilter();
}

export function displayChatBubble(playerId, text) {
  let targetP = null;
  if (playerId === state.localPlayer.id) {
    targetP = state.localPlayer;
    targetP.group = state.localPlayer.mesh;
  } else {
    targetP = state.remotePlayers.get(playerId);
  }

  if (!targetP || !targetP.group) return;

  if (targetP.chatBubble) {
    targetP.group.remove(targetP.chatBubble);
    targetP.chatBubble.material.map.dispose();
    targetP.chatBubble.material.dispose();
    targetP.chatBubble = null;
  }
  if (targetP.chatTimeout) {
    clearTimeout(targetP.chatTimeout);
  }

  // Word-wrap text at ~38 chars per line so long messages stack rather than sprawl
  const FONT = 'bold 18px "Courier New", Courier, monospace';
  const LINE_H = 26;
  const PAD_X = 18;
  const PAD_Y = 10;
  const MAX_LINE = 38;

  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur === '' || cur.length + 1 + w.length <= MAX_LINE) {
      cur = cur === '' ? w : cur + ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);

  // Measure actual pixel width with the chosen font
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = FONT;
  const maxPx = Math.max(...lines.map((l) => probe.measureText(l).width));

  const cw = Math.ceil(maxPx + PAD_X * 2);
  const ch = lines.length * LINE_H + PAD_Y * 2;

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  // Rounded dark background for contrast
  const rx = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  ctx.lineTo(cw - rx, 0);
  ctx.quadraticCurveTo(cw, 0, cw, rx);
  ctx.lineTo(cw, ch - rx);
  ctx.quadraticCurveTo(cw, ch, cw - rx, ch);
  ctx.lineTo(rx, ch);
  ctx.quadraticCurveTo(0, ch, 0, ch - rx);
  ctx.lineTo(0, rx);
  ctx.quadraticCurveTo(0, 0, rx, 0);
  ctx.closePath();
  ctx.fill();

  ctx.font = FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#ffffff';

  lines.forEach((line, i) => {
    const y = PAD_Y + (i + 0.5) * LINE_H;
    ctx.strokeText(line, cw / 2, y);
    ctx.fillText(line, cw / 2, y);
  });

  // Derive sprite scale from canvas aspect so there is zero distortion.
  // Target world height: 0.52 units per line, capped at a comfortable maximum.
  const WORLD_LINE_H = 0.52;
  const worldH = Math.min(lines.length * WORLD_LINE_H + 0.18, 2.2);
  const worldW = worldH * (cw / ch);

  const texture = new THREE.CanvasTexture(canvas);
  // depthTest:false ensures the bubble renders above the name tag sprite and
  // is never occluded by it regardless of draw order.
  const bubbleMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const bubbleSprite = new THREE.Sprite(bubbleMat);
  bubbleSprite.scale.set(worldW, worldH, 1);
  // y=3.9 clears the name tag (top edge y≈3.1) for all message lengths.
  bubbleSprite.position.set(0, 3.9, 0);

  targetP.chatBubble = bubbleSprite;
  targetP.group.add(bubbleSprite);

  targetP.chatTimeout = setTimeout(() => {
    if (targetP.group && targetP.chatBubble) {
      targetP.group.remove(targetP.chatBubble);
      targetP.chatBubble.material.map.dispose();
      targetP.chatBubble.material.dispose();
      targetP.chatBubble = null;
    }
  }, 4500);
}
