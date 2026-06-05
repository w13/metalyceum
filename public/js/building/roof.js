// Greek Museum Roof — gabled terracotta-tile roof with pediments
import * as THREE from 'three';
import { state } from '../state.js';

export function buildRoof(batcher, materials, config) {
  const { addMesh, addOrientedBox } = batcher;
  const { limestoneMat, bronzeMat, limestoneShadowMat } = materials;
  const { entablatureY, registerRoofMesh = null } = config;

  const halfBldgW = 30;
  const halfBldgD = 40;
  const roofOverhang = 1.05;
  const roofHalfW = halfBldgW + roofOverhang;
  const roofHalfD = halfBldgD + roofOverhang;
  const roofBaseY = entablatureY + 0.34;
  const roofRise = 8.1;
  const roofRidgeY = roofBaseY + roofRise;
  const roofSlopeRun = roofHalfW;

  // Roof tile texture
  function createRoofTileTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#b8462a';
    ctx.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) {
      const y = row * 16;
      ctx.fillStyle = row % 2 === 0 ? '#c94f30' : '#a83d22';
      ctx.fillRect(0, y, 128, 18);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 16);
      ctx.lineTo(128, y + 16);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(0, y + 2);
      ctx.lineTo(128, y + 2);
      ctx.stroke();
    }
    for (let i = 0; i < 300; i++) {
      const g = 70 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${g}, ${g}, ${g}, 0.06)`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 4);
    return tex;
  }

  const roofTileTex = createRoofTileTexture();
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTileTex, roughness: 0.75, color: '#cc5533' });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: '#8a3a20', roughness: 0.7 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#e7dfd2', roughness: 0.65 });

  function addRoofMesh(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (registerRoofMesh) registerRoofMesh(mesh);
    else state.roofMeshes.push(mesh);
    state.scene.add(mesh);
  }

  // ── Roof seat (base plate the roof sits on) ─────────────────────────────
  const roofSeat = new THREE.Mesh(
    new THREE.BoxGeometry(halfBldgW * 2 + 0.6, 0.18, halfBldgD * 2 + 0.6),
    trimMat
  );
  roofSeat.position.set(0, roofBaseY - 0.12, 0);
  addRoofMesh(roofSeat);

  // ── Pitched roof slope (one side at a time) ─────────────────────────────
  const roofHypotenuse = Math.sqrt(roofSlopeRun * roofSlopeRun + roofRise * roofRise);

  function buildRoofSlope(xSign) {
    const slopeGeo = new THREE.BoxGeometry(roofHypotenuse + 0.28, 0.3, roofHalfD * 2 + 0.85);
    const slopeMesh = new THREE.Mesh(slopeGeo, roofMat);
    slopeMesh.position.set(xSign * roofSlopeRun / 2, roofBaseY + roofRise / 2, 0);
    slopeMesh.rotation.z = -xSign * Math.atan2(roofRise, roofSlopeRun);
    addRoofMesh(slopeMesh);

    const eaveX = xSign * (roofHalfW + 0.08);
    const eaveTrim = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.22, roofHalfD * 2 + 0.95),
      trimMat
    );
    eaveTrim.position.set(eaveX, roofBaseY + 0.03, 0);
    addRoofMesh(eaveTrim);

    for (let iz = -roofHalfD + 2.2; iz < roofHalfD - 1.4; iz += 3.15) {
      const tileCap = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 1.05),
        ridgeMat
      );
      tileCap.position.set(eaveX, roofBaseY + 0.16, iz);
      addRoofMesh(tileCap);
    }
  }

  buildRoofSlope(-1);
  buildRoofSlope(1);

  // ── Ridge beam with decorative tile caps ────────────────────────────────
  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.36, roofHalfD * 2 - 0.35),
    ridgeMat
  );
  ridgeBeam.position.set(0, roofRidgeY + 0.03, 0);
  addRoofMesh(ridgeBeam);

  for (let iz = -roofHalfD + 2.2; iz < roofHalfD - 1.4; iz += 3.15) {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      ridgeMat
    );
    cap.position.set(0, roofRidgeY + 0.22, iz);
    addRoofMesh(cap);
  }

  // ── Pediments (triangular gable ends on north/south facades) ────────────
  function buildPediment(zSign) {
    const zPos = zSign * roofHalfD;
    // Triangular pediment face (front and back)
    const shape = new THREE.Shape();
    shape.moveTo(-roofHalfW, 0);
    shape.lineTo(roofHalfW, 0);
    shape.lineTo(0, roofRise);
    shape.closePath();

    const wallDepth = 0.2;
    const pedGeo = new THREE.ExtrudeGeometry(shape, { depth: wallDepth, bevelEnabled: false });
    const pedMesh = new THREE.Mesh(pedGeo, ridgeMat);
    pedMesh.position.set(0, roofBaseY, zSign === 1 ? zPos - wallDepth : zPos);
    addRoofMesh(pedMesh);

    const rakeLen = Math.sqrt(roofHalfW * roofHalfW + roofRise * roofRise);
    const rakeAngle = Math.atan2(roofRise, roofHalfW);
    const rakeZ = zSign * (roofHalfD + 0.18);

    const leftRake = new THREE.Mesh(
      new THREE.BoxGeometry(rakeLen, 0.18, 0.22),
      trimMat
    );
    leftRake.position.set(-roofHalfW / 2, roofBaseY + roofRise / 2, rakeZ);
    leftRake.rotation.z = rakeAngle;
    addRoofMesh(leftRake);

    const rightRake = new THREE.Mesh(
      new THREE.BoxGeometry(rakeLen, 0.18, 0.22),
      trimMat
    );
    rightRake.position.set(roofHalfW / 2, roofBaseY + roofRise / 2, rakeZ);
    rightRake.rotation.z = -rakeAngle;
    addRoofMesh(rightRake);

    const baseCornice = new THREE.Mesh(
      new THREE.BoxGeometry(halfBldgW * 2 + 0.2, 0.18, 0.28),
      trimMat
    );
    baseCornice.position.set(0, roofBaseY - 0.03, zSign * (roofHalfD + 0.14));
    addRoofMesh(baseCornice);

    // Apex finial
    const apexFinial = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      ridgeMat
    );
    apexFinial.position.set(0, roofRidgeY + 0.28, zSign * (roofHalfD + 0.12));
    addRoofMesh(apexFinial);
  }

  buildPediment(1);   // south facade
  buildPediment(-1);  // north facade
}
