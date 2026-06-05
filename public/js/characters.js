// Player Avatars for Metalyceum
import * as THREE from 'three';
import { state } from './state.js';
import { MAP_SIZE } from './config.js';
import { checkCollision, getTerrainHeight } from './physics.js';

// --- Player Name Tag Sprite ---
function createPlayerNameSprite(name, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  const r = 8;
  const x = 8, y = 8, w = 240, h = 48;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(3, 0.75, 1);
  return sprite;
}

// --- Player Avatar Creation ---
const EMOJIS = ['👋', '🎵', '💃', '🤘', '👀', '✨', '🔥', '💬', '🤔', '😎', '🙌', '💪'];

function createNpcEmojiSprite(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '42px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.8, 0.8, 1);
  sprite.position.y = 3.2;
  sprite.visible = false;
  return sprite;
}

export function createPlayerAvatar(avatarType, colorHex, username, isLocal = false, isNpc = false, npcStyle = {}) {
  const avatarGroup = new THREE.Group();

  const shirtMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: npcStyle.skin || '#fbcfe8', roughness: 0.8 });
  const legMat = new THREE.MeshStandardMaterial({ color: npcStyle.pants || '#1e293b', roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: npcStyle.shoes || '#18181b', roughness: 0.9 });
  const brownMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.85 });
  const hatBandMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
  
  const torsoGeo = new THREE.CylinderGeometry(0.35, 0.28, 1.0, 6);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  avatarGroup.add(torso);

  const headGeo = new THREE.SphereGeometry(0.28, 6, 6);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.8;
  head.castShadow = true;
  avatarGroup.add(head);

  // Optional glasses
  if (npcStyle.glasses) {
    const glassMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.3, metalness: 0.5 });
    const lensMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.1, transparent: true, opacity: 0.35 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.05), glassMat);
    frame.position.set(0, 1.85, 0.32);
    avatarGroup.add(frame);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), lensMat);
    lens.position.set(-0.1, 1.85, 0.35);
    avatarGroup.add(lens);
    const lens2 = lens.clone();
    lens2.position.x = 0.1;
    avatarGroup.add(lens2);
  }

  // Hat (style-dependent)
  if (npcStyle.hat !== 'none') {
  const hatGroup = new THREE.Group();
  const brimGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 8);
  const brim = new THREE.Mesh(brimGeo, brownMat);
  brim.position.y = 2.02;
  brim.castShadow = true;
  hatGroup.add(brim);

  const bandGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.08, 8);
  const band = new THREE.Mesh(bandGeo, hatBandMat);
  band.position.y = 2.1;
  hatGroup.add(band);

  const crownGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 8);
  const crown = new THREE.Mesh(crownGeo, brownMat);
  crown.position.y = 2.25;
  crown.castShadow = true;
  hatGroup.add(crown);
  avatarGroup.add(hatGroup);
  }

  // Backpack (not all NPCs carry one)
  if (!npcStyle.noBackpack) {
  const packGeo = new THREE.BoxGeometry(0.42, 0.6, 0.22);
  const backpack = new THREE.Mesh(packGeo, brownMat);
  backpack.position.set(0, 1.1, -0.28);
  backpack.castShadow = true;
  avatarGroup.add(backpack);
  }

  // Arms
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 4);
  armGeo.translate(0, -0.35, 0);
  
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.48, 1.5, 0);
  leftArm.castShadow = true;
  avatarGroup.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.48, 1.5, 0);
  rightArm.castShadow = true;
  avatarGroup.add(rightArm);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 4);
  legGeo.translate(0, -0.3, 0);

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.2, 0.6, 0);
  leftLeg.castShadow = true;
  avatarGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.2, 0.6, 0);
  rightLeg.castShadow = true;
  avatarGroup.add(rightLeg);

  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.1, 0.25);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(0, -0.55, 0.05);
  leftShoe.castShadow = true;
  leftLeg.add(leftShoe);
  
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0, -0.55, 0.05);
  rightShoe.castShadow = true;
  rightLeg.add(rightShoe);

  // Emoji sprite (NPCs only — hidden by default)
  const emojiSprite = isNpc ? createNpcEmojiSprite('👋') : null;
  if (emojiSprite) avatarGroup.add(emojiSprite);

  // Name tag
  let tagColor = '#38bdf8';
  if (isLocal) tagColor = '#818cf8';
  else if (isNpc) tagColor = '#f59e0b';
  const nameTag = createPlayerNameSprite(username, tagColor);
  nameTag.position.set(0, 2.7, 0);
  avatarGroup.add(nameTag);

  state.scene.add(avatarGroup);

  return {
    group: avatarGroup,
    leftLeg, rightLeg,
    leftArm, rightArm,
    nameTag,
    emojiSprite
  };
}

// --- NPC Generation ---
const NPC_SPAWNS = [
  // Indoor NPCs
  { x: -17, z: -30, room: 0, name: 'Alex',  color: '#3b82f6', hat: 'none', noBackpack: true,  glasses: true,  pants: '#1e293b', shoes: '#18181b' },
  { x: 14,  z: -30, room: 4, name: 'Riley', color: '#a855f7', hat: 'none', noBackpack: true,  glasses: false, pants: '#4c1d95', shoes: '#2e1065', skin: '#fcd9b6' },
  { x: 17,  z: 8,   room: 6, name: 'Quinn', color: '#06b6d4', hat: 'none', noBackpack: true,  glasses: true,  pants: '#155e75', shoes: '#18181b' },
  // Lobby NPCs
  { x: -3,  z: 35,  room: -1, name: 'Jay',   color: '#3b82f6', hat: 'none', noBackpack: false, glasses: true,  pants: '#1e293b', shoes: '#18181b' },
  { x: 0,   z: -35, room: -1, name: 'River', color: '#22c55e', hat: 'none', noBackpack: false, glasses: false, pants: '#064e3b', shoes: '#18181b' },
  { x: 3,   z: 38,  room: -1, name: 'Parker',color: '#14b8a6', hat: 'none', noBackpack: true,  glasses: false, pants: '#115e59', shoes: '#18181b' },
  // Amphitheater
  { x: 60,  z: 148, room: 8,  name: 'Ember', color: '#f97316', hat: 'none', noBackpack: true,  glasses: false, pants: '#1e293b', shoes: '#18181b' },
  { x: 70,  z: 155, room: 8,  name: 'Vale',  color: '#a855f7', hat: 'none', noBackpack: false, glasses: true,  pants: '#4c1d95', shoes: '#2e1065' },
  // Concert venue
  { x: -80, z: 142, room: 9,  name: 'Lyric', color: '#06b6d4', hat: 'none', noBackpack: false, glasses: false, pants: '#155e75', shoes: '#18181b' },
  { x: -90, z: 136, room: 9,  name: 'Echo',  color: '#ec4899', hat: 'none', noBackpack: true,  glasses: true,  pants: '#831843', shoes: '#18181b' },
];

export function spawnNpcs() {
  NPC_SPAWNS.forEach((spawn) => {
    const npcColor = spawn.color;
    const npcUsername = spawn.name;

    const avatar = createPlayerAvatar('player', npcColor, npcUsername, false, true, spawn);

    const npc = {
      id: `npc-${spawn.name}`,
      x: spawn.x,
      y: getTerrainHeight(spawn.x, spawn.z, true),
      z: spawn.z,
      speed: 2.5,
      ry: Math.random() * Math.PI * 2,
      room: spawn.room,
      isMoving: false,
      state: 'idle',
      waitTimer: 2 + Math.random() * 4,
      targetX: spawn.x,
      targetZ: spawn.z,
      color: npcColor,
      username: npcUsername,
      mesh: avatar.group,
      leftLeg: avatar.leftLeg,
      rightLeg: avatar.rightLeg,
      leftArm: avatar.leftArm,
      rightArm: avatar.rightArm,
      nameTag: avatar.nameTag,
      emojiSprite: avatar.emojiSprite,
      emojiTimer: Math.random() * 10 + 5,
      emojiDuration: 0,
    };

    npc.mesh.position.set(npc.x, npc.y, npc.z);
    npc.mesh.rotation.y = npc.ry;

    state.npcs.push(npc);
  });
}

// --- NPC Update Loop ---
function setNpcIdle(npc, waitOverride = null) {
  npc.state = 'idle';
  npc.isMoving = false;
  npc.waitTimer = waitOverride ?? (Math.random() * 4 + 2);
  // Hide emoji when walking starts
  if (npc.emojiSprite) npc.emojiSprite.visible = false;
  npc.emojiDuration = 0;
}

function resetNpcLimbSwing(npc) {
  if (npc.leftLeg && npc.rightLeg) {
    npc.leftLeg.rotation.x = 0;
    npc.rightLeg.rotation.x = 0;
  }
  if (npc.leftArm && npc.rightArm) {
    npc.leftArm.rotation.x = 0;
    npc.rightArm.rotation.x = 0;
  }
}

function chooseNpcTarget(npc) {
  const limit = MAP_SIZE / 2 - 4;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 12;
    const targetX = Math.max(-limit, Math.min(limit, npc.x + Math.cos(angle) * dist));
    const targetZ = Math.max(-limit, Math.min(limit, npc.z + Math.sin(angle) * dist));
    if (!checkCollision(targetX, targetZ)) {
      npc.targetX = targetX;
      npc.targetZ = targetZ;
      npc.state = 'walk';
      npc.isMoving = true;
      if (npc.emojiSprite) npc.emojiSprite.visible = false;
      npc.emojiDuration = 0;
      return true;
    }
  }

  return false;
}

function moveNpcTowardTarget(npc, dt) {
  const dx = npc.targetX - npc.x;
  const dz = npc.targetZ - npc.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.2) {
    setNpcIdle(npc);
    resetNpcLimbSwing(npc);
    return;
  }

  const moveStep = Math.min(npc.speed * dt, dist);
  const angle = Math.atan2(dz, dx);
  const nextX = npc.x + Math.cos(angle) * moveStep;
  const nextZ = npc.z + Math.sin(angle) * moveStep;

  if (checkCollision(nextX, nextZ)) {
    setNpcIdle(npc, 0.4 + Math.random() * 0.6);
    resetNpcLimbSwing(npc);
    return;
  }

  npc.x = nextX;
  npc.z = nextZ;
  npc.ry = angle;
  // Only resample terrain when the NPC has moved >0.5 units — getTerrainHeight is
  // expensive (river scan + trig) and NPC movement per frame is tiny (~0.02u at 60fps).
  const dxTerrain = npc.x - (npc._lastTerrainX ?? npc.x + 1);
  const dzTerrain = npc.z - (npc._lastTerrainZ ?? npc.z + 1);
  if (dxTerrain * dxTerrain + dzTerrain * dzTerrain > 0.25) {
    npc.y = getTerrainHeight(npc.x, npc.z, true);
    npc._lastTerrainX = npc.x;
    npc._lastTerrainZ = npc.z;
  }
  npc.mesh.position.set(npc.x, npc.y, npc.z);
  npc.mesh.rotation.y = -npc.ry + Math.PI / 2;

  const walkCycle = performance.now() * 0.008;
  if (npc.leftLeg && npc.rightLeg) {
    npc.leftLeg.rotation.x = Math.sin(walkCycle) * 0.58;
    npc.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.58;
  }
  if (npc.leftArm && npc.rightArm) {
    npc.leftArm.rotation.x = -Math.sin(walkCycle) * 0.45;
    npc.rightArm.rotation.x = Math.sin(walkCycle) * 0.45;
  }
}

export function updateNpcs(dt) {
  state.npcs.forEach((npc) => {
    // Cull NPC updates when >100u from the player — movement, limb animation,
    // and emoji timing are all imperceptible at that distance.
    const _npcDx = state.localPlayer ? state.localPlayer.x - npc.x : 0;
    const _npcDz = state.localPlayer ? state.localPlayer.z - npc.z : 0;
    if (_npcDx * _npcDx + _npcDz * _npcDz > 10000) return; // 100u²
    // Emoji animation — show random emoji during idle, hide during walk
    if (npc.emojiSprite) {
      npc.emojiTimer -= dt;
      if (npc.emojiDuration > 0) {
        npc.emojiDuration -= dt;
        if (npc.emojiDuration <= 0) {
          npc.emojiSprite.visible = false;
        }
      } else if (npc.emojiTimer <= 0 && npc.state === 'idle') {
        const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        const canvas = npc.emojiSprite.material.map.image;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 64, 64);
        ctx.font = '42px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, 32, 34);
        npc.emojiSprite.material.map.needsUpdate = true;
        npc.emojiSprite.visible = true;
        npc.emojiDuration = 1.5 + Math.random() * 1.5;
        npc.emojiTimer = 8 + Math.random() * 12;
      }
    }

    if (npc.state === "idle") {
      npc.waitTimer -= dt;
      if (npc.waitTimer <= 0) {
        if (!chooseNpcTarget(npc)) {
          setNpcIdle(npc, 1);
          resetNpcLimbSwing(npc);
        }
      }
    } else if (npc.state === "walk") {
      moveNpcTowardTarget(npc, dt);
    }
  });
}

export function animateAvatarWalk(playerObj, dt, now, isSprinting = false) {
  const isMoving = playerObj.isMoving;
  const leftLeg = playerObj.leftLeg;
  const rightLeg = playerObj.rightLeg;
  const leftArm = playerObj.leftArm;
  const rightArm = playerObj.rightArm;

  if (!leftLeg || !rightLeg) return;

  if (isMoving && playerObj.isGrounded) {
    if (isSprinting) {
      // Bunny hop — both legs move together, arms up
      const st = now * 0.014;
      const hop = Math.abs(Math.sin(st));
      leftLeg.rotation.x = Math.sin(st) * 0.5;
      rightLeg.rotation.x = Math.sin(st) * 0.5;
      leftLeg.position.y = 0.6 + hop * 0.06;
      rightLeg.position.y = 0.6 + hop * 0.06;
      if (leftArm && rightArm) {
        leftArm.rotation.x = -hop * 0.5;
        rightArm.rotation.x = -hop * 0.5;
      }
    } else {
      const time = now * 0.012;
      const swingRange = 0.6;
      leftLeg.rotation.x = Math.sin(time) * swingRange;
      rightLeg.rotation.x = -Math.sin(time) * swingRange;
      if (leftArm && rightArm) {
        leftArm.rotation.x = -Math.sin(time) * swingRange;
        rightArm.rotation.x = Math.sin(time) * swingRange;
      }
    }
  } else {
    const lerpSpeed = 10 * dt;
    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, lerpSpeed);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, lerpSpeed);
    leftLeg.position.y = THREE.MathUtils.lerp(leftLeg.position.y || 0.6, 0.6, lerpSpeed);
    rightLeg.position.y = THREE.MathUtils.lerp(rightLeg.position.y || 0.6, 0.6, lerpSpeed);
    
    if (leftArm && rightArm) {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, lerpSpeed);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, lerpSpeed);
    }
  }
  
  if (!playerObj.isGrounded && leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, -Math.PI / 3, 5 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, Math.PI / 3, 5 * dt);
  } else if (leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0, 10 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, 10 * dt);
  }
}

