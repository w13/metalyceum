// Jetpack flight system — thrust particles, smoke, and crash physics
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import * as THREE from 'three';

const THRUST_COLOR = 0xff6600;
const SMOKE_COLOR = 0x888888;
const MAX_PARTICLES = 60;

let particles = [];
let crashTime = 0;
let crashing = false;
let crashAngVel = 0;
let rollTimer = 0;
let rolling = false;
let crashRollAxis = 0;

export function toggleJetpackTakeoff() {
  if (!state.localPlayer || state.localPlayer.flying || crashing || rolling) return;
  state.localPlayer.flying = true;
  state.localPlayer.velocity.y = 12.0;
  state.localPlayer.isGrounded = false;
  state.keys.t = false;
}

export function toggleJetpackLand() {
  if (!state.localPlayer || !state.localPlayer.flying || crashing || rolling) return;
  // Start crash sequence
  crashing = true;
  crashTime = 0;
  crashAngVel = 20 + Math.random() * 10;
  crashRollAxis = (Math.random() - 0.5) * 2;
  state.localPlayer.flying = false;
  state.keys.y = false;
}

function spawnParticle(px, py, pz, vx, vy, vz, color, life, size) {
  if (particles.length >= MAX_PARTICLES) {
    const oldest = particles.shift();
    if (oldest.mesh.parent) oldest.mesh.parent.remove(oldest.mesh);
  }
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(size || 0.06, 4, 4), mat);
  mesh.position.set(px, py, pz);
  state.scene.add(mesh);
  particles.push({ mesh, vx, vy, vz, life, maxLife: life, mat });
}

export function updateJetpack(dt, now) {
  if (!state.localPlayer || !state.localPlayer.mesh) return;

  const lp = state.localPlayer;
  const px = lp.x, py = lp.y, pz = lp.z;

  // ── Thrust particles (flying) ──────────────────────────────────────
  if (lp.flying) {
    // Idle thrust: constant small flames below the player
    for (let i = 0; i < 3; i++) {
      const ox = (Math.random() - 0.5) * 0.4;
      const oz = (Math.random() - 0.5) * 0.4;
      spawnParticle(
        px + ox, py - 0.6, pz + oz,
        (Math.random() - 0.5) * 0.3, -(1.0 + Math.random() * 1.0), (Math.random() - 0.5) * 0.3,
        THRUST_COLOR, 0.4 + Math.random() * 0.3, 0.04 + Math.random() * 0.04
      );
    }
    // Smoke puffs (less frequent)
    if (Math.random() < 0.4) {
      spawnParticle(
        px + (Math.random() - 0.5) * 0.5, py - 0.8, pz + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5, -(0.5 + Math.random() * 0.5), (Math.random() - 0.5) * 0.5,
        SMOKE_COLOR, 0.8 + Math.random() * 0.4, 0.08 + Math.random() * 0.06
      );
    }
  }

  // ── Crash sequence ─────────────────────────────────────────────────
  if (crashing) {
    crashTime += dt;
    const duration = 2.0; // total crash time ~2s

    if (crashTime < 0.8) {
      // Phase 1: spinning descent
      lp.ry += crashAngVel * dt;
      lp.mesh.rotation.x = Math.sin(crashTime * 12) * 0.5 * crashRollAxis;
      lp.mesh.rotation.z = Math.cos(crashTime * 10) * 0.3;

      // Extra gravity
      lp.velocity.y -= 35.0 * dt;
      lp.y += lp.velocity.y * dt;

      // Smoke trail during descent
      for (let i = 0; i < 4; i++) {
        spawnParticle(
          px + (Math.random() - 0.5) * 0.6, py - 0.3, pz + (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 2, Math.random() * 1 - 2, (Math.random() - 0.5) * 2,
          SMOKE_COLOR, 0.6 + Math.random() * 0.4, 0.1 + Math.random() * 0.1
        );
      }

      // Check for ground impact
      const groundY = getTerrainHeight(px, pz) + 0.5;
      if (lp.y <= groundY) {
        lp.y = groundY;
        // Transition to rolling
        rolling = true;
        rollTimer = 0;
        crashing = false;
        crashAngVel = 8; // slow spin for roll
        // Impact smoke puff
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          spawnParticle(px, groundY, pz, Math.cos(a)*2, Math.random()*2, Math.sin(a)*2, 0xaaaaaa, 0.5, 0.15);
        }
      }
    }
  }

  // ── Roll sequence after crash ──────────────────────────────────────
  if (rolling) {
    rollTimer += dt;
    // Player rolls forward/back for ~0.8s
    lp.ry += crashAngVel * dt * 0.5;
    lp.mesh.rotation.x = Math.sin(rollTimer * 10) * 0.8;
    lp.mesh.rotation.z = Math.cos(rollTimer * 8) * 0.4;

    if (rollTimer > 0.8) {
      // Stand up
      rolling = false;
      // Reset rotations smoothly
      lp.mesh.rotation.x = 0;
      lp.mesh.rotation.z = 0;
      lp.isGrounded = true;
      lp.velocity.y = 0;
      crashAngVel = 0;
    }
  }

  // ── Update particle ages ──────────────────────────────────────────
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.vz *= 0.98;

    if (p.life <= 0) {
      state.scene.remove(p.mesh);
      p.mat.dispose();
      particles.splice(i, 1);
    } else {
      p.mat.opacity = Math.max(0, p.life / p.maxLife);
    }
  }
}

// Reset all particles (call when changing scenes)
export function clearJetpackParticles() {
  particles.forEach(p => {
    if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
    p.mat.dispose();
  });
  particles = [];
  crashing = false;
  rolling = false;
}
