import * as THREE from 'three';
import { FLAT, HALF_PI } from '../math.js';
import { getTerrainHeight } from '../physics.js';
import { state } from '../state.js';
import { registerStaticScenery } from './visibility.js';

export function buildAmphitheater() {
  const ax = 65,
    az = 150;
  const baseY = getTerrainHeight(ax, az);
  const group = new THREE.Group();

  // Materials
  const stoneMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.78,
  });
  const warmStoneMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.7,
  });
  const seatMat = new THREE.MeshStandardMaterial({
    color: '#57534e',
    roughness: 0.75,
    flatShading: true,
  });
  const stageMat = new THREE.MeshStandardMaterial({
    color: '#4a5568',
    roughness: 0.6,
    metalness: 0.08,
  });
  const marbleMat = new THREE.MeshStandardMaterial({
    color: '#e8e0d0',
    roughness: 0.15,
    metalness: 0.05,
  });
  const screenMat = state.sharedScenery.screenMat;
  const stageAngle = Math.PI * 0.25;
  const cosSA = Math.cos(stageAngle);
  const sinSA = Math.sin(stageAngle);
  const perpAngle = stageAngle + Math.PI / 2;
  const cosPA = Math.cos(perpAngle);
  const rowCount = 12;
  const rowStartRadius = 9;
  const rowSpacing = 2.0;
  const arcAngle = Math.PI * 0.85;
  const outerRadius = rowStartRadius + (rowCount - 1) * rowSpacing + 0.5;

  // Row Y: each row sits directly on the terrain hill contour
  function rowY(row) {
    const radius = rowStartRadius + row * rowSpacing;
    const angles = [-arcAngle / 2, 0, arcAngle / 2];
    let sum = 0;
    for (const theta of angles) {
      const wa = -(theta + Math.PI * 0.25);
      sum += getTerrainHeight(
        ax + Math.cos(wa) * radius,
        az - Math.sin(wa) * radius,
      );
    }
    return sum / 3 + 0.03;
  }

  // ── Unified amphitheater ──────────────────────────────────────────────
  // Orchestra: flat marble circle at center
  const orch = new THREE.Mesh(new THREE.CircleGeometry(8, 36), marbleMat);
  orch.rotation.x = FLAT;
  orch.position.set(ax, baseY + 0.03, az);
  orch.receiveShadow = true;
  group.add(orch);

  // Orchestra border
  const ob = new THREE.Mesh(
    new THREE.RingGeometry(7.8, 8.2, 36),
    new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.5 }),
  );
  ob.rotation.x = FLAT;
  ob.position.set(ax, baseY + 0.035, az);
  group.add(ob);

  // Stepped seating — concentric arcs rising with the terrain hill
  for (let row = 0; row < rowCount; row++) {
    const r = rowStartRadius + row * rowSpacing;
    const y = rowY(row);
    const segs = 24 + row * 2;
    const sg = new THREE.Mesh(
      new THREE.RingGeometry(
        r - 0.5,
        r + 0.5,
        segs,
        1,
        -arcAngle / 2,
        arcAngle,
      ),
      seatMat,
    );
    sg.rotation.x = FLAT;
    sg.position.set(ax, y, az);
    sg.rotation.z = Math.PI * 0.25;
    sg.castShadow = true;
    sg.receiveShadow = true;
    group.add(sg);

    if (row > 0) {
      const prevY = rowY(row - 1);
      const rh = y - prevY;
      if (rh > 0.01) {
        const riser = new THREE.Mesh(
          new THREE.CylinderGeometry(
            r + 0.5,
            r + 0.5,
            rh - 0.03,
            segs,
            1,
            true,
            -arcAngle / 2,
            arcAngle,
          ),
          stoneMat,
        );
        riser.position.set(ax, (y + prevY) / 2, az);
        riser.rotation.y = Math.PI * 0.25;
        riser.castShadow = true;
        riser.receiveShadow = true;
        group.add(riser);
      }
    }
  }

  // Radial stairs — 5 staircases up the seating
  const stairMat = new THREE.MeshStandardMaterial({
    color: '#78716c',
    roughness: 0.72,
  });
  for (let s = 0; s < 5; s++) {
    const theta = -arcAngle / 2 + (arcAngle / 6) * (s + 1);
    const ca = Math.cos(theta + Math.PI * 0.25);
    const sa = Math.sin(theta + Math.PI * 0.25);
    const stepGeo = new THREE.BoxGeometry(1.0, 0.35, 0.9);
    const inst = new THREE.InstancedMesh(stepGeo, stairMat, rowCount);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const obj = new THREE.Object3D();
    for (let row = 0; row < rowCount; row++) {
      const r = rowStartRadius + row * rowSpacing;
      const y = rowY(row);
      obj.position.set(ax + ca * (r - 0.5), y - 0.075, az - sa * (r - 0.5));
      obj.updateMatrix();
      inst.setMatrixAt(row, obj.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  }

  // Retaining wall around outer seating
  const outerY = rowY(rowCount - 1);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(
      outerRadius + 0.3,
      outerRadius + 0.3,
      outerY - baseY + 0.5,
      48,
      1,
      true,
      -arcAngle / 2,
      arcAngle,
    ),
    stoneMat,
  );
  wall.position.set(ax, (baseY + outerY + 0.5) / 2, az);
  wall.rotation.y = Math.PI * 0.25;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  // Wall cap
  const cap = new THREE.Mesh(
    new THREE.RingGeometry(
      outerRadius + 0.1,
      outerRadius + 0.6,
      48,
      1,
      -arcAngle / 2,
      arcAngle,
    ),
    warmStoneMat,
  );
  cap.rotation.x = FLAT;
  cap.position.set(ax, outerY + 0.5, az);
  cap.rotation.z = Math.PI * 0.25;
  cap.castShadow = true;
  cap.receiveShadow = true;
  group.add(cap);

  // Stage — sits at the open side of the seating arc, connected to the orchestra
  const stageDist = rowStartRadius - 1.5;
  const stage = new THREE.Mesh(new THREE.BoxGeometry(22, 0.4, 8), stageMat);
  stage.position.set(
    ax + cosSA * stageDist,
    baseY + 0.2,
    az + sinSA * stageDist,
  );
  stage.receiveShadow = true;
  stage.castShadow = true;
  group.add(stage);

  const sf = new THREE.Mesh(
    new THREE.BoxGeometry(22.1, 0.35, 0.08),
    new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.3 }),
  );
  sf.position.set(
    ax + cosSA * (stageDist - 4),
    baseY + 0.175,
    az + sinSA * (stageDist - 4),
  );
  sf.rotation.y = stageAngle;
  group.add(sf);

  // Scaenae frons — grand backdrop wall with screen
  const sDist = stageDist + 5;
  const sx = ax + cosSA * sDist,
    sz = az + sinSA * sDist;
  const bw = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 0.5), warmStoneMat);
  bw.position.set(sx, baseY + 4.5, sz);
  bw.receiveShadow = true;
  bw.castShadow = true;
  group.add(bw);

  // Screen in front of the scaenae frons wall (offset 1u to avoid clipping through 0.5u wall)
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), screenMat.clone());
  sm.position.set(sx + cosSA * 1.0, baseY + 4.8, sz + sinSA * 1.0);
  sm.rotation.y = stageAngle;
  sm.userData = { roomId: 8 };
  state.clickableScreens.push(sm);
  state.roomScreens.set(8, {
    material: sm.material,
    baseColor: sm.material.color.clone(),
    baseEmissive: sm.material.emissive.clone(),
  });
  group.add(sm);

  const gl = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(7.2, 4.2)),
    new THREE.LineBasicMaterial({
      color: '#22c55e',
      transparent: true,
      opacity: 0.25,
    }),
  );
  gl.position.set(sx + cosSA * 1.0, baseY + 4.8, sz + sinSA * 1.0);
  gl.rotation.y = stageAngle;
  group.add(gl);

  // Entrance stairway from the road
  for (let st = 0; st < 8; st++) {
    const d = stageDist + 2 + st * 0.6;
    const step = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.6), stoneMat);
    step.position.set(ax + cosSA * d, baseY + (st + 1) * 0.2, az + sinSA * d);
    step.receiveShadow = true;
    step.castShadow = true;
    group.add(step);
  }

  // Collision: block the seating arc with stairway gaps
  for (let seg = 0; seg < 10; seg++) {
    if ([2, 4, 6, 8].includes(seg)) continue;
    const ma = -arcAngle / 2 + (arcAngle / 10) * (seg + 0.5);
    const wa = -(ma + Math.PI * 0.25);
    const cx = ax + Math.cos(wa) * 30,
      cz = az - Math.sin(wa) * 30;
    state.PLACED_ASSET_COLLIDERS.push({
      minX: cx - 3,
      maxX: cx + 3,
      minZ: cz - 3,
      maxZ: cz + 3,
      assetId: 'amphitheater',
    });
  }
  // Block the stage area and scaenae frons — pushed further out so the orchestra is walkable
  const stageCx = ax + cosSA * (stageDist + 6);
  const stageCz = az + sinSA * (stageDist + 6);
  state.PLACED_ASSET_COLLIDERS.push({
    minX: stageCx - 16,
    maxX: stageCx + 10,
    minZ: stageCz - 16,
    maxZ: stageCz + 10,
    assetId: 'amphitheater',
  });

  state.scene.add(group);
  state.landmarkGroups.set('amphitheater', group);
  registerStaticScenery(group, { kind: 'outdoor', distance: 150, center: { x: 65, z: 150 } });
}
