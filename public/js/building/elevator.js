import * as THREE from 'three';
import {
  MAIN_BUILDING_ELEVATOR_D,
  MAIN_BUILDING_ELEVATOR_FRONT_Z,
  MAIN_BUILDING_ELEVATOR_GROUND_Y,
  MAIN_BUILDING_ELEVATOR_H,
  MAIN_BUILDING_ELEVATOR_W,
  MAIN_BUILDING_ELEVATOR_Z,
} from '../config.js';
import { FLAT, HALF_PI } from '../math.js';
import { createFloor } from '../scenery/utils.js';

export function buildElevator(scene, materials) {
  const eZ = MAIN_BUILDING_ELEVATOR_Z;
  const eW = MAIN_BUILDING_ELEVATOR_W;
  const eD = MAIN_BUILDING_ELEVATOR_D;
  const eH = MAIN_BUILDING_ELEVATOR_H;
  const eFrontZ = MAIN_BUILDING_ELEVATOR_FRONT_Z;

  const goldMat = new THREE.MeshStandardMaterial({
    color: '#b8860b',
    roughness: 0.2,
    metalness: 0.8,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#cd7f32',
    roughness: 0.25,
    metalness: 0.7,
  });
  const mahoganyMat = new THREE.MeshStandardMaterial({
    color: '#3a1508',
    roughness: 0.35,
    metalness: 0.1,
  });
  const eMarble = new THREE.MeshStandardMaterial({
    color: '#e8e0d0',
    roughness: 0.1,
    metalness: 0.05,
  });
  const eDarkMarble = new THREE.MeshStandardMaterial({
    color: '#2a1a0a',
    roughness: 0.15,
    metalness: 0.12,
  });

  const elevatorCar = new THREE.Group();
  elevatorCar.position.set(0, MAIN_BUILDING_ELEVATOR_GROUND_Y, eZ);

  // Back wall (z = -eD/2) and side walls
  const backWallZ = -(eD / 2 - 0.1);
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(eW - 0.2, eH - 0.5, 0.08),
    mahoganyMat,
  );
  backWall.position.set(0, (eH - 0.5) / 2, backWallZ);
  elevatorCar.add(backWall);

  const backTopTrim = new THREE.Mesh(
    new THREE.BoxGeometry(eW - 0.1, 0.04, 0.1),
    goldMat,
  );
  backTopTrim.position.set(0, eH - 0.3, backWallZ);
  elevatorCar.add(backTopTrim);

  const backBottomTrim = new THREE.Mesh(
    new THREE.BoxGeometry(eW - 0.1, 0.04, 0.1),
    goldMat,
  );
  backBottomTrim.position.set(0, 0.15, backWallZ);
  elevatorCar.add(backBottomTrim);
  [-eW / 2 + 0.1, eW / 2 - 0.1].forEach((xOff) => {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, eH - 0.5, eD - 0.2),
      mahoganyMat,
    );
    p.position.set(xOff, (eH - 0.5) / 2, 0);
    elevatorCar.add(p);
  });

  // Marble floor
  const ef = createFloor(eW - 0.1, eD - 0.1, eMarble, 0, 0.015, 0);
  elevatorCar.add(ef);
  const eb = new THREE.Mesh(
    new THREE.RingGeometry(eW / 2 - 0.25, eW / 2 - 0.05, 24),
    eDarkMarble,
  );
  eb.rotation.x = FLAT;
  eb.position.set(0, 0.017, 0);
  elevatorCar.add(eb);

  // Ceiling + crown molding + chandelier
  elevatorCar.add(createFloor(eW - 0.1, eD - 0.1, eMarble, 0, eH, 0, false));
  const cr = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 16), goldMat);
  cr.position.set(0, eH - 0.01, 0);
  cr.rotation.x = HALF_PI;
  elevatorCar.add(cr);

  const chMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#fef08a',
    emissiveIntensity: 0.4,
  });
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), chMat);
  ch.position.set(0, eH - 0.15, 0);
  elevatorCar.add(ch);
  const cabinLight = new THREE.PointLight('#fef3c7', 0, 6.5, 2.2);
  cabinLight.position.set(0, eH - 0.2, 0);
  elevatorCar.add(cabinLight);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    const d = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 6, 6),
      new THREE.MeshStandardMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 0.6,
      }),
    );
    d.position.set(Math.cos(a) * 0.2, eH - 0.35, Math.sin(a) * 0.2);
    elevatorCar.add(d);
  }
  scene.add(elevatorCar);

  // ── Swing doors (hinged at outer edges, children of car) ──────────────
  const halfDoorW = (eW - 0.3) / 2; // each door panel width
  const doorPivots = [];
  for (let side = -1; side <= 1; side += 2) {
    // Pivot group at the hinge edge
    const pivot = new THREE.Group();
    pivot.position.set(side * (eW / 2 - 0.04), 0, eD / 2);
    elevatorCar.add(pivot);

    // Door panel
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(halfDoorW, eH - 0.7, 0.06),
      mahoganyMat,
    );
    door.position.set((-side * halfDoorW) / 2, (eH - 0.7) / 2, 0);
    pivot.add(door);

    // Gold inlay stripe
    const inlay = new THREE.Mesh(
      new THREE.BoxGeometry(halfDoorW - 0.2, eH - 1.0, 0.07),
      goldMat,
    );
    inlay.position.set((-side * halfDoorW) / 2, (eH - 0.7) / 2, 0.035);
    pivot.add(inlay);

    // Handle (brass pull)
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.18, 6),
      brassMat,
    );
    handle.rotation.x = HALF_PI;
    handle.position.set((-side * halfDoorW) / 3, 1.3, 0.05);
    pivot.add(handle);

    pivot.userData._side = side;
    doorPivots.push(pivot);
  }

  // Door frame (brass pillars + pediment — static in scene, not on car)
  [-0.9, 0.9].forEach((xOff) => {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, eH + 0.2, 0.06),
      brassMat,
    );
    f.position.set(xOff, (eH + 0.2) / 2 - 0.1, eFrontZ + 0.01);
    scene.add(f);
  });
  const ft = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.08), brassMat);
  ft.position.set(0, eH + 0.05, eFrontZ + 0.01);
  scene.add(ft);
  const ps = new THREE.Shape();
  ps.moveTo(-0.9, 0);
  ps.lineTo(0.9, 0);
  ps.lineTo(0, 0.25);
  ps.closePath();
  const pd = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ps, { depth: 0.08, bevelEnabled: false }),
    goldMat,
  );
  pd.position.set(0, eH + 0.1, eFrontZ + 0.01);
  scene.add(pd);

  // Indicator light (static in scene)
  const ib = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.02), brassMat);
  ib.position.set(0, eH + 0.5, eFrontZ + 0.03);
  scene.add(ib);
  const il = new THREE.Mesh(
    new THREE.CircleGeometry(0.04, 8),
    new THREE.MeshBasicMaterial({ color: '#22c55e' }),
  );
  il.position.set(0, eH + 0.5, eFrontZ + 0.04);
  scene.add(il);
  const cb = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), brassMat);
  cb.position.set(0.3, 1.3, eFrontZ + 0.04);
  scene.add(cb);
  const cl = new THREE.Mesh(
    new THREE.CircleGeometry(0.02, 6),
    new THREE.MeshBasicMaterial({ color: '#ef4444' }),
  );
  cl.position.set(0.3, 1.3, eFrontZ + 0.05);
  scene.add(cl);

  // Door collision wall (active when closed, disabled when open)
  const doorCollider = new THREE.Mesh(
    new THREE.BoxGeometry(eW - 0.3, eH, 0.1),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
  );
  doorCollider.position.set(0, eH / 2, eFrontZ + 0.05);
  doorCollider.visible = false;
  scene.add(doorCollider);

  const doorBox = new THREE.Box3().setFromObject(doorCollider);
  doorBox.userData = { _isElevatorDoor: true };

  return {
    car: elevatorCar,
    doorPivots: doorPivots,
    halfHeight: eH / 2,
    cabinLight: cabinLight,
    cabinGlowMat: chMat,
    doorCollider: doorCollider,
    doorBox: doorBox,
  };
}
