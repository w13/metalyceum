// Airport — runway, terminal, control tower, hangar, helicopters, and private jet
import * as THREE from 'three';
import { state } from '../state.js';
import { getTerrainHeight } from '../physics.js';
import { registerStaticScenery } from './visibility.js';

export function buildAirport() {
  const ax = 160, az = 220;
  const baseY = getTerrainHeight(ax, az);
  const g = new THREE.Group();

  const concMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.85, metalness: 0.04 });
  const markingMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const terminalMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.15, metalness: 0.8, transparent: true, opacity: 0.75 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 });
  const hangarMat = new THREE.MeshStandardMaterial({ color: '#6b7280', roughness: 0.75, metalness: 0.2 });
  const hangarRoofMat = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.7, metalness: 0.15 });
  const lightMat = new THREE.MeshBasicMaterial({ color: '#fbbf24' });
  const redLightMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
  const jetMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.25, metalness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });

  // ── Runway ──────────────────────────────────────────────────────────
  const runwayW = 12, runwayL = 100;
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(runwayW, runwayL), concMat);
  rw.rotation.x = -Math.PI / 2;
  rw.position.set(ax, baseY + 0.04, az);
  rw.receiveShadow = true;
  g.add(rw);

  for (let i = -45; i <= 45; i += 10) {
    const mk = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3), markingMat);
    mk.rotation.x = -Math.PI / 2;
    mk.position.set(ax, baseY + 0.05, az + i);
    g.add(mk);
  }

  for (let side = -1; side <= 1; side += 2) {
    for (let i = -48; i <= 48; i += 8) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.15, 6), lightMat);
      l.position.set(ax + side * (runwayW / 2 + 0.4), baseY + 0.08, az + i);
      g.add(l);
    }
  }

  for (let side = -1; side <= 1; side += 2) {
    for (let xOff = -1; xOff <= 1; xOff += 2) {
      const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.18, 6), redLightMat);
      rl.position.set(ax + xOff * 2.5, baseY + 0.09, az + side * (runwayL / 2 - 0.5));
      g.add(rl);
    }
  }

  // ── Taxiway ─────────────────────────────────────────────────────────
  const taxiMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.8 });
  const tw = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), taxiMat);
  tw.rotation.x = -Math.PI / 2;
  tw.position.set(ax + runwayW / 2 + 4, baseY + 0.04, az);
  tw.receiveShadow = true;
  g.add(tw);

  // ── Terminal ────────────────────────────────────────────────────────
  const tX = ax + 18, tZ = az;
  const tw2 = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), concMat);
  tw2.rotation.x = -Math.PI / 2;
  tw2.position.set(tX, baseY + 0.02, tZ);
  tw2.receiveShadow = true;
  g.add(tw2);

  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([nx, nz]) => {
    const ww = nx !== 0 ? 0.3 : 12.3;
    const dd = nx !== 0 ? 20.3 : 0.3;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(nx !== 0 ? ww : 20, 6, nx !== 0 ? dd : ww), terminalMat);
    wall.position.set(tX + nx * 10, baseY + 3, tZ + nz * 6);
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);
  });

  for (let xOff = -6; xOff <= 6; xOff += 5) {
    for (let yOff = 1; yOff <= 3; yOff += 2) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.15), glassMat);
      win.position.set(tX + xOff, baseY + yOff + 0.8, tZ + 6.01);
      g.add(win);
    }
  }

  const troof = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.25, 12.6), roofMat);
  troof.position.set(tX, baseY + 6.125, tZ);
  troof.castShadow = true;
  troof.receiveShadow = true;
  g.add(troof);

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(10, 0.15, 2.5), roofMat);
  canopy.position.set(tX, baseY + 2.5, tZ + 7.3);
  canopy.castShadow = true;
  g.add(canopy);

  // Boarding bridge (jetway)
  const bridgeMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.7 });
  const jb = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 6), bridgeMat);
  jb.position.set(ax + 14, baseY + 3.5, az - 3);
  jb.rotation.y = 0.3;
  jb.castShadow = true;
  g.add(jb);

  // ── Control tower ──────────────────────────────────────────────────
  const twrX = ax + 22, twrZ = az - 20;
  const twrMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.7 });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 14, 8), twrMat);
  shaft.position.set(twrX, baseY + 7, twrZ);
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  g.add(shaft);

  const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.2, 1.8, 12), glassMat);
  cab.position.set(twrX, baseY + 15.1, twrZ);
  cab.castShadow = true;
  cab.receiveShadow = true;
  g.add(cab);

  const cRoof = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.3, 12), roofMat);
  cRoof.position.set(twrX, baseY + 16, twrZ);
  cRoof.castShadow = true;
  cRoof.receiveShadow = true;
  g.add(cRoof);

  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 4), twrMat);
  ant.position.set(twrX, baseY + 16.7, twrZ);
  g.add(ant);

  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), redLightMat);
  beacon.position.set(twrX, baseY + 17.1, twrZ);
  g.add(beacon);

  // ── Large Hangar with huge sliding door ────────────────────────────
  const hangW = 42, hangD = 32, hangH = 14;
  const hx = ax - 30, hz = az + 32;

  // Floor
  const hf = new THREE.Mesh(new THREE.PlaneGeometry(hangW, hangD), concMat);
  hf.rotation.x = -Math.PI / 2;
  hf.position.set(hx, baseY + 0.02, hz);
  hf.receiveShadow = true;
  g.add(hf);

  // Back and side walls
  const hBack = new THREE.Mesh(new THREE.BoxGeometry(hangW, hangH, 0.3), hangarMat);
  hBack.position.set(hx, baseY + hangH / 2, hz + hangD / 2);
  hBack.castShadow = true;
  hBack.receiveShadow = true;
  g.add(hBack);

  for (let side = -1; side <= 1; side += 2) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.3, hangH, hangD), hangarMat);
    sw.position.set(hx + side * hangW / 2, baseY + hangH / 2, hz);
    sw.castShadow = true;
    sw.receiveShadow = true;
    g.add(sw);
  }

  // Roof
  const hRoof = new THREE.Mesh(new THREE.BoxGeometry(hangW + 1, 0.4, hangD + 1), hangarRoofMat);
  hRoof.position.set(hx, baseY + hangH + 0.2, hz);
  hRoof.castShadow = true;
  hRoof.receiveShadow = true;
  g.add(hRoof);
  state.roofMeshes.push(hRoof);

  // Entrance frame
  const frameMat = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.7, metalness: 0.15 });
  const pL = new THREE.Mesh(new THREE.BoxGeometry(0.5, hangH, 0.5), frameMat);
  pL.position.set(hx - hangW/2 + 0.25, baseY + hangH/2, hz - hangD/2);
  pL.castShadow = true; g.add(pL);
  const pR = new THREE.Mesh(new THREE.BoxGeometry(0.5, hangH, 0.5), frameMat);
  pR.position.set(hx + hangW/2 - 0.25, baseY + hangH/2, hz - hangD/2);
  pR.castShadow = true; g.add(pR);
  const header = new THREE.Mesh(new THREE.BoxGeometry(hangW, 0.6, 0.5), frameMat);
  header.position.set(hx, baseY + hangH - 0.3, hz - hangD/2);
  header.castShadow = true; g.add(header);

  // Sectional sliding door — partially open (stacked panels pushed to one side)
  const doorMat = new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.7, metalness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, hangH - 1.0, 8.2), doorMat);
    // Panels stacked to the left side of the opening
    panel.position.set(hx - hangW/2 + 0.5 + i * 0.15, baseY + (hangH - 1.0) / 2, hz - hangD/2 + 0.3);
    g.add(panel);
  }

  // ── Private Jet (inside the hangar, facing out) ────────────────────
  function makeJet(px, pz, ry) {
    const jg = new THREE.Group();
    const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 5.5, 10), jetMat);
    fuse.rotation.x = Math.PI / 2;
    fuse.position.y = 0.6;
    fuse.castShadow = true;
    fuse.receiveShadow = true;
    jg.add(fuse);

    for (let side = -1; side <= 1; side += 2) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.8), jetMat);
      wing.position.set(side * 1.4, 0.8, 0.3);
      wing.rotation.z = side * 0.15;
      wing.castShadow = true;
      wing.receiveShadow = true;
      jg.add(wing);
    }

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.04), accentMat);
    tail.position.set(0, 1.05, -2.6);
    jg.add(tail);
    for (let side = -1; side <= 1; side += 2) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.3), accentMat);
      st.position.set(side * 0.35, 0.75, -2.5);
      jg.add(st);
    }

    for (let side = -1; side <= 1; side += 2) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8), darkMat);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(side * 1.8, 0.25, 0.6);
      jg.add(eng);
    }

    for (let i = -2; i <= 2; i += 0.8) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), darkMat);
      w.position.set(0, 0.7, i);
      jg.add(w);
    }

    jg.position.set(px, baseY + 0.03, pz);
    jg.rotation.y = ry;
    return jg;
  }

  g.add(makeJet(hx, hz + 2, 0));

  // ── Helicopters ────────────────────────────────────────────────────
  function makeHelicopter(px, pz, ry) {
    const hg = new THREE.Group();

    const fuse = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.4, metalness: 0.3 }));
    fuse.scale.set(1, 0.7, 1.3);
    fuse.position.y = 0.35;
    fuse.castShadow = true;
    hg.add(fuse);

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.5 }));
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.35, -0.7);
    hg.add(boom);

    const tRot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.04), darkMat);
    tRot.position.set(0, 0.45, -1.15);
    hg.add(tRot);

    // Skids
    for (let side = -1; side <= 1; side += 2) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 4), darkMat);
      skid.position.set(side * 0.3, 0.05, 0.1);
      hg.add(skid);
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4), darkMat);
      strut.position.set(side * 0.2, 0.2, 0);
      hg.add(strut);
    }

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), darkMat);
    mast.position.set(0, 0.7, 0);
    hg.add(mast);

    for (let i = 0; i < 2; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.05), new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5 }));
      blade.position.set(i === 0 ? 0.45 : -0.45, 0.85, 0);
      hg.add(blade);
    }

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 6), glassMat);
    cockpit.position.set(0, 0.45, 0.4);
    cockpit.scale.set(0.6, 0.4, 0.5);
    hg.add(cockpit);

    hg.position.set(px, baseY + 0.02, pz);
    hg.rotation.y = ry;
    return hg;
  }

  g.add(makeHelicopter(ax - 28, az + 48, 0.3));
  g.add(makeHelicopter(ax - 20, az + 48, -0.2));

  // ── Fuel truck ──────────────────────────────────────────────────────
  const fuelMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.7 });
  const ftCab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 }));
  ftCab.position.set(ax - 8, baseY + 0.2, az + 14);
  g.add(ftCab);
  const ftTank = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.8, 8), fuelMat);
  ftTank.rotation.x = Math.PI / 2;
  ftTank.position.set(ax - 7.3, baseY + 0.25, az + 14);
  g.add(ftTank);

  // ── Windsock ──────────────────────────────────────────────────────
  const poleMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.85 });
  const sockMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.7 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3.5, 4), poleMat);
  pole.position.set(ax - 3, baseY + 1.75, az - 45);
  pole.castShadow = true;
  pole.receiveShadow = true;
  g.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), sockMat);
  sock.position.set(ax - 3, baseY + 3.5, az - 44.5);
  sock.rotation.z = -0.3;
  sock.castShadow = true;
  sock.receiveShadow = true;
  g.add(sock);

  // ── Fence ──────────────────────────────────────────────────────────
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.7 });
  for (let side = -1; side <= 1; side += 2) {
    for (let i = -48; i <= 48; i += 4) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.8, 4), fenceMat);
      post.position.set(ax + side * (runwayW / 2 + 1.2), baseY + 0.4, az + i);
      post.castShadow = true;
      post.receiveShadow = true;
      g.add(post);
    }
  }

  state.scene.add(g);
  registerStaticScenery(rw,   { kind: 'outdoor', distance: 180 });
  registerStaticScenery(troof, { kind: 'outdoor', distance: 150 });
}
