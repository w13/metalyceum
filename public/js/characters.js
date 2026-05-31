// Player Avatars for Metalyceum
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
export function createPlayerAvatar(avatarType, colorHex, username, isLocal = false, isNpc = false) {
  const avatarGroup = new THREE.Group();

  const shirtMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.8 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
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

  // Explorer hat
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

  // Backpack
  const packGeo = new THREE.BoxGeometry(0.42, 0.6, 0.22);
  const backpack = new THREE.Mesh(packGeo, brownMat);
  backpack.position.set(0, 1.1, -0.28);
  backpack.castShadow = true;
  avatarGroup.add(backpack);

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
    nameTag
  };
}

// --- NPC Generation ---
export function spawnNpcs() {
  // All NPCs removed — they were blocking player paths and spawn areas.
  // The function is kept as a no-op to avoid import errors.
}

// --- NPC Update Loop ---
function setNpcIdle(npc, waitOverride = null) {
  npc.state = 'idle';
  npc.isMoving = false;
  npc.waitTimer = waitOverride ?? (Math.random() * 4 + 2);
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
  npc.y = getTerrainHeight(npc.x, npc.z);
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

export function animateAvatarWalk(playerObj, dt, now) {
  const isMoving = playerObj.isMoving;
  const leftLeg = playerObj.leftLeg;
  const rightLeg = playerObj.rightLeg;
  const leftArm = playerObj.leftArm;
  const rightArm = playerObj.rightArm;

  if (!leftLeg || !rightLeg) return;

  if (isMoving && playerObj.isGrounded) {
    const time = now * 0.012;
    const swingRange = 0.6;
    
    leftLeg.rotation.x = Math.sin(time) * swingRange;
    rightLeg.rotation.x = -Math.sin(time) * swingRange;
    
    if (leftArm && rightArm) {
      leftArm.rotation.x = -Math.sin(time) * swingRange;
      rightArm.rotation.x = Math.sin(time) * swingRange;
    }
  } else {
    const lerpSpeed = 10 * dt;
    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, lerpSpeed);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, lerpSpeed);
    
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

