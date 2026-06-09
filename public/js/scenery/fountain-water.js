// Fountain animated water: pool surfaces, big apple, water blob, ripples, spray, bubbles, fish
import * as THREE from 'three';
import { state } from '../state.js';
import { registerStaticScenery } from './visibility.js';

export function buildFountainWater(fx, fz, fountainBaseY) {
  const waterAnimGroup = new THREE.Group();
  waterAnimGroup.position.set(fx, fountainBaseY, fz);
  state.scene.add(waterAnimGroup);

  // ── Large apple-shaped water column ────────────────────────────────────
  {
    const colTopY = 3.1,
      colBotY = 0.35;
    const baPts = [];
    const baN = 40;
    for (let i = 0; i <= baN; i++) {
      const t = i / baN;
      let r;
      if (t < 0.15) {
        const p = t / 0.15;
        r = 0.3 + p * p * 2.3;
      } else if (t < 0.45) {
        const p = (t - 0.15) / 0.3;
        r = 2.6 - p * 1.0;
      } else if (t < 0.65) {
        const p = (t - 0.45) / 0.2;
        r = 1.6 + 0.2 * Math.sin(p * Math.PI);
      } else if (t < 0.85) {
        const p = (t - 0.65) / 0.2;
        r = 1.4 - p * 0.6;
      } else {
        const p = (t - 0.85) / 0.15;
        r = 0.8 - p * 0.5;
      }
      baPts.push(
        new THREE.Vector2(
          Math.max(0.05, r),
          t * (colTopY - colBotY) - (colTopY - colBotY) / 2,
        ),
      );
    }
    const bigApple = new THREE.Mesh(
      new THREE.LatheGeometry(baPts, 28),
      new THREE.MeshStandardMaterial({
        color: '#1d4ed8',
        emissive: '#0ea5e9',
        emissiveIntensity: 0.3,
        roughness: 0.03,
        metalness: 0.5,
        transparent: true,
        opacity: 0.48,
        side: THREE.DoubleSide,
      }),
    );
    bigApple.position.set(0, (colTopY + colBotY) / 2, 0);
    waterAnimGroup.add(bigApple);
  }

  // ── 3D apple-shaped water blob ─────────────────────────────────────────
  let waterApple = null,
    waterAppleGlow = null;
  {
    const appleR = 0.92,
      appleH = 1.72;
    const pts = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36,
        angle = t * Math.PI;
      let r = Math.sin(angle) * appleR;
      if (t > 0.3 && t < 0.7)
        r *= 1 + 0.14 * Math.sin(((t - 0.3) / 0.4) * Math.PI);
      if (t > 0.8) r *= 1 - ((t - 0.8) / 0.2) * 0.58;
      pts.push(
        new THREE.Vector2(Math.max(0, r), Math.cos(angle) * (appleH / 2)),
      );
    }
    waterApple = new THREE.Mesh(
      new THREE.LatheGeometry(pts, 24),
      new THREE.MeshStandardMaterial({
        color: '#0ea5e9',
        roughness: 0.02,
        metalness: 0.62,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      }),
    );
    waterApple.position.y = 4.35;
    waterApple.userData.baseY = 4.35;
    waterAnimGroup.add(waterApple);

    waterAppleGlow = new THREE.Mesh(
      new THREE.LatheGeometry(
        pts.map((p) => new THREE.Vector2(p.x * 0.72, p.y * 0.9)),
        18,
      ),
      new THREE.MeshStandardMaterial({
        color: '#7dd3fc',
        roughness: 0.01,
        metalness: 0.25,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      }),
    );
    waterAppleGlow.position.y = 4.35;
    waterAppleGlow.userData.baseY = 4.35;
    waterAnimGroup.add(waterAppleGlow);
  }

  // ── Pool surface ──────────────────────────────────────────────────────
  const poolSurfaceGeo = new THREE.CircleGeometry(2.96, 48);
  const poolPos = poolSurfaceGeo.attributes.position;
  const poolRadii = new Float32Array(poolPos.count);
  for (let i = 0; i < poolPos.count; i++)
    poolRadii[i] = Math.sqrt(poolPos.getX(i) ** 2 + poolPos.getY(i) ** 2);
  poolSurfaceGeo.userData.poolRadii = poolRadii;

  const poolSurface = new THREE.Mesh(
    poolSurfaceGeo,
    new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      roughness: 0.05,
      metalness: 0.35,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  poolSurface.position.y = 0.72;
  poolSurface.userData = { baseY: 0.72, waveAmp: 0.025, waveFreq: 2.5 };
  waterAnimGroup.add(poolSurface);

  // ── Ripple rings ──────────────────────────────────────────────────────
  const rippleMat = new THREE.MeshStandardMaterial({
    color: '#67e8f9',
    roughness: 0.02,
    metalness: 0.18,
    transparent: true,
    opacity: 0.2,
    side: THREE.DoubleSide,
  });
  const poolRipple = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 2.6, 48),
    rippleMat,
  );
  poolRipple.position.y = 0.706;
  poolRipple.userData.baseY = 0.706;
  waterAnimGroup.add(poolRipple);

  const poolRipple2 = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 2.6, 48),
    rippleMat.clone(),
  );
  poolRipple2.position.y = 0.707;
  poolRipple2.userData.baseY = 0.707;
  waterAnimGroup.add(poolRipple2);

  // ── Caustic disc ──────────────────────────────────────────────────────
  const causticDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 32),
    new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    }),
  );
  causticDisc.position.y = 0.25;
  causticDisc.userData.baseY = 0.25;
  waterAnimGroup.add(causticDisc);

  // ── Upper bowl water ──────────────────────────────────────────────────
  const upperPoolSurface = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      roughness: 0.02,
      metalness: 0.45,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    }),
  );
  upperPoolSurface.position.y = 3.35;
  upperPoolSurface.userData.baseY = 3.35;
  waterAnimGroup.add(upperPoolSurface);

  const upperRippleMat = new THREE.MeshStandardMaterial({
    color: '#a5f3fc',
    roughness: 0.02,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
  });
  const upperRipple = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.62, 24),
    upperRippleMat,
  );
  upperRipple.position.y = 3.355;
  upperRipple.userData.baseY = 3.355;
  waterAnimGroup.add(upperRipple);

  const upperRipple2 = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.62, 24),
    upperRippleMat.clone(),
  );
  upperRipple2.position.y = 3.356;
  upperRipple2.userData.baseY = 3.356;
  waterAnimGroup.add(upperRipple2);

  // ── Center spray jet ──────────────────────────────────────────────────
  const centerJet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.09, 1.55, 10, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#a5f3fc',
      roughness: 0.02,
      metalness: 0.12,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  centerJet.position.y = 3.72;
  centerJet.userData.baseY = 3.72;
  waterAnimGroup.add(centerJet);

  // ── Cascade streams ──────────────────────────────────────────────────
  const cBlob = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28,
      angle = t * Math.PI;
    let r = Math.sin(angle) * 0.16;
    if (t > 0.2 && t < 0.8)
      r *= 1 + 0.18 * Math.sin(((t - 0.2) / 0.6) * Math.PI);
    cBlob.push(new THREE.Vector2(Math.max(0, r), (t - 0.5) * 2.1));
  }
  const cascadeGeo = new THREE.LatheGeometry(cBlob, 16);
  const cascadeMat = new THREE.MeshStandardMaterial({
    color: '#7dd3fc',
    roughness: 0.02,
    metalness: 0.45,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const cascadeStreams = [];
  for (let i = 0; i < 6; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (Math.PI * 2 * i) / 6;
    const stream = new THREE.Mesh(cascadeGeo, cascadeMat.clone());
    stream.position.set(0, 2.22, 0.92);
    stream.rotation.x = Math.PI * 0.22;
    stream.userData = { baseY: stream.position.y, phase: i * 0.7 };
    pivot.add(stream);
    waterAnimGroup.add(pivot);
    cascadeStreams.push(stream);
  }

  // ── Rising bubbles ────────────────────────────────────────────────────
  const bubbleMat = new THREE.MeshStandardMaterial({
    color: '#bae6fd',
    roughness: 0.0,
    metalness: 0.05,
    transparent: true,
    opacity: 0.45,
  });
  const bubbles = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.4;
    const radius = 0.06 + Math.random() * 0.18;
    const hOff = 0.8 + Math.random() * 1.8;
    const b = new THREE.Mesh(
      new THREE.SphereGeometry(0.025 + Math.random() * 0.03, 6, 6),
      bubbleMat.clone(),
    );
    b.position.set(Math.cos(angle) * radius, hOff, Math.sin(angle) * radius);
    b.userData = {
      radius,
      riseSpeed: 0.3 + Math.random() * 0.25,
      wobbleAmp: 0.02 + Math.random() * 0.03,
      wobbleFreq: 0.8 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      respawnY: hOff,
      maxY: 3.5 + Math.random() * 0.4,
    };
    waterAnimGroup.add(b);
    bubbles.push(b);
  }

  // ── Orbit fish ────────────────────────────────────────────────────────
  const fishColors = ['#f97316', '#f43f5e', '#eab308', '#38bdf8', '#a855f7'];
  for (let i = 0; i < 3; i++) {
    const fishGroup = new THREE.Group();
    const angle = ((Math.PI * 2) / 3) * i;
    const orbitRadius = 1.2 + Math.random() * 0.6;
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      new THREE.MeshStandardMaterial({
        color: fishColors[i],
        roughness: 0.6,
        flatShading: true,
      }),
    );
    body.scale.set(1.4, 0.8, 1);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.15, 4),
      new THREE.MeshStandardMaterial({
        color: fishColors[i],
        roughness: 0.7,
        flatShading: true,
      }),
    );
    tail.position.z = -0.12;
    tail.rotation.x = Math.PI / 2;
    fishGroup.add(body, tail);
    fishGroup.position.set(
      Math.cos(angle) * orbitRadius,
      0.7 + Math.random() * 0.1,
      Math.sin(angle) * orbitRadius,
    );
    fishGroup.userData = {
      orbitRadius,
      orbitSpeed: 0.4 + Math.random() * 0.3,
      bobSpeed: 1.2 + Math.random() * 0.6,
      bobPhase: Math.random() * Math.PI * 2,
    };
    waterAnimGroup.add(fishGroup);
    state.animatedScenery.push({
      object: fishGroup,
      type: 'fish',
      seed: Math.random() * 100,
    });
  }

  // ── Animation registration ────────────────────────────────────────────
  waterAnimGroup.userData = {
    basinWater: null,
    upperWaterBody: null,
    upperWater: null,
    poolSurface,
    poolRipple,
    poolRipple2,
    causticDisc,
    upperPoolSurface,
    upperRipple,
    upperRipple2,
    centerJet,
    cascadeStreams,
    bubbles,
    waterApple,
    waterAppleGlow,
  };

  registerStaticScenery(waterAnimGroup, { kind: 'outdoor', distance: 95 });
  state.animatedScenery.push({
    object: waterAnimGroup,
    type: 'fountain',
    seed: Math.random() * Math.PI * 2,
    speed: 0.3,
    amplitude: 0.02,
  });

  return waterAnimGroup;
}
