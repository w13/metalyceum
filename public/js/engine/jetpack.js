// Jetpack flight system — thrust particles, smoke, and crash physics
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import * as THREE from 'three';

const POOL_SIZE = 60;
const THRUST_COLOR = 0xff6600;
const SMOKE_COLOR = 0x888888;

// Pre-allocated particle pool — zero allocs at runtime
let pool = [];
let poolIdx = 0;
let crashing = false;
let crashTime = 0;
let crashAngVel = 0;
let rollTimer = 0;
let rolling = false;
let crashRollAxis = 0;

function ensurePool() {
  if (pool.length) return;
  const geo = new THREE.SphereGeometry(0.06, 4, 4);
  for (let i = 0; i < POOL_SIZE; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: THRUST_COLOR, transparent: true, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    state.scene.add(mesh);
    pool.push({ mesh, mat, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.06 });
  }
}

function spawnParticle(px, py, pz, vx, vy, vz, color, life, size) {
  ensurePool();
  const p = pool[poolIdx];
  poolIdx = (poolIdx + 1) % POOL_SIZE;
  p.mesh.position.set(px, py, pz);
  p.mesh.visible = true;
  p.mat.color.setHex(color);
  p.mat.opacity = 1;
  p.vx = vx; p.vy = vy; p.vz = vz;
  p.life = life; p.maxLife = life;
  p.size = size;
  p.mesh.scale.setScalar(size / 0.06);
}

export function toggleJetpackTakeoff() {
  if (!state.localPlayer || state.localPlayer.flying || crashing || rolling) return;
  state.localPlayer.flying = true;
  state.localPlayer.velocity.y = 12.0;
  state.localPlayer.isGrounded = false;
  state.keys.t = false;
}

export function toggleJetpackLand() {
  if (!state.localPlayer || !state.localPlayer.flying || crashing || rolling) return;
  crashing = true;
  crashTime = 0;
  crashAngVel = 20 + Math.random() * 10;
  crashRollAxis = (Math.random() - 0.5) * 2;
  state.localPlayer.flying = false;
  state.keys.y = false;
}

export function updateJetpack(dt, now) {
  ensurePool();
  if (!state.localPlayer || !state.localPlayer.mesh) return;

  const lp = state.localPlayer;
  const px = lp.x, py = lp.y, pz = lp.z;

  // Idle thrust
  if (lp.flying) {
    for (let i = 0; i < 3; i++) {
      spawnParticle(
        px + (Math.random() - 0.5) * 0.4, py - 0.6, pz + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.3, -(1.0 + Math.random()), (Math.random() - 0.5) * 0.3,
        THRUST_COLOR, 0.4 + Math.random() * 0.3, 0.04 + Math.random() * 0.04
      );
    }
    if (Math.random() < 0.4) {
      spawnParticle(
        px + (Math.random() - 0.5) * 0.5, py - 0.8, pz + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5, -(0.5 + Math.random() * 0.5), (Math.random() - 0.5) * 0.5,
        SMOKE_COLOR, 0.8 + Math.random() * 0.4, 0.08 + Math.random() * 0.06
      );
    }
  }

  // Crash sequence
  if (crashing) {
    crashTime += dt;
    if (crashTime < 0.8) {
      lp.ry += crashAngVel * dt;
      lp.mesh.rotation.x = Math.sin(crashTime * 12) * 0.5 * crashRollAxis;
      lp.mesh.rotation.z = Math.cos(crashTime * 10) * 0.3;
      lp.velocity.y -= 35.0 * dt;
      lp.y += lp.velocity.y * dt;

      for (let i = 0; i < 4; i++) {
        spawnParticle(
          px + (Math.random() - 0.5) * 0.6, py - 0.3, pz + (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 2, Math.random() * 1 - 2, (Math.random() - 0.5) * 2,
          SMOKE_COLOR, 0.6 + Math.random() * 0.4, 0.1 + Math.random() * 0.1
        );
      }

      const groundY = getTerrainHeight(px, pz) + 0.5;
      if (lp.y <= groundY) {
        lp.y = groundY;
        rolling = true;
        rollTimer = 0;
        crashing = false;
        crashAngVel = 8;
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          spawnParticle(px, groundY, pz, Math.cos(a)*2, Math.random()*2, Math.sin(a)*2, 0xaaaaaa, 0.5, 0.15);
        }
      }
    }
  }

  if (rolling) {
    rollTimer += dt;
    lp.ry += crashAngVel * dt * 0.5;
    lp.mesh.rotation.x = Math.sin(rollTimer * 10) * 0.8;
    lp.mesh.rotation.z = Math.cos(rollTimer * 8) * 0.4;
    if (rollTimer > 0.8) {
      rolling = false;
      lp.mesh.rotation.x = 0;
      lp.mesh.rotation.z = 0;
      lp.isGrounded = true;
      lp.velocity.y = 0;
      crashAngVel = 0;
    }
  }

  // Update particle ages
  for (let i = 0; i < POOL_SIZE; i++) {
    const p = pool[i];
    if (!p.mesh.visible) continue;
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.vz *= 0.98;
    if (p.life <= 0) {
      p.mesh.visible = false;
      p.mat.opacity = 0;
    } else {
      p.mat.opacity = p.life / p.maxLife;
    }
  }
}

export function clearJetpackParticles() {
  pool.forEach(p => { p.mesh.visible = false; p.mat.opacity = 0; });
}
