// Classroom desk, bench, and podium geometry for Metalyceum room interiors
import * as THREE from 'three';
import { addSceneryCollider } from '../scenery/utils.js';
import { registerStaticScenery } from '../scenery/visibility.js';
import { state } from '../state.js';

export function buildClassroomAssets() {
  const woodMat = new THREE.MeshStandardMaterial({
    color: '#854d0e',
    roughness: 0.85,
  });
  const legMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.7,
  });

  const classroomGroup = new THREE.Group();

  function createDesk(dx, dz) {
    const desk = new THREE.Group();
    const topGeo = new THREE.BoxGeometry(1.2, 0.1, 3.5);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 1.0;
    top.castShadow = true;
    top.receiveShadow = true;
    desk.add(top);

    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 4);
    const legOffsets = [
      { x: -0.5, z: -1.6 },
      { x: 0.5, z: -1.6 },
      { x: -0.5, z: 1.6 },
      { x: 0.5, z: 1.6 },
    ];
    legOffsets.forEach((offset) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offset.x, 0.5, offset.z);
      leg.castShadow = true;
      desk.add(leg);
    });

    desk.position.set(dx, 0, dz);
    classroomGroup.add(desk);
  }

  function createBench(bx, bz) {
    const bench = new THREE.Group();
    const seatGeo = new THREE.BoxGeometry(0.5, 0.08, 3.0);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.6;
    seat.castShadow = true;
    seat.receiveShadow = true;
    bench.add(seat);

    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 4);
    const legOffsets = [
      { x: -0.2, z: -1.4 },
      { x: 0.2, z: -1.4 },
      { x: -0.2, z: 1.4 },
      { x: 0.2, z: 1.4 },
    ];
    legOffsets.forEach((offset) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offset.x, 0.3, offset.z);
      leg.castShadow = true;
      bench.add(leg);
    });

    bench.position.set(bx, 0, bz);
    classroomGroup.add(bench);
  }

  const cols = [-5, 0, 5];
  const rows = [-6, -1, 4];

  rows.forEach((dx) => {
    cols.forEach((dz) => {
      createDesk(dx, dz);
      createBench(dx - 1.0, dz);
      // Colliders for desk + bench pair
      const gx = 17 + dx;
      const gz = 8 + dz;
      addSceneryCollider(
        gx - 0.6,
        gx + 0.6,
        gz - 1.75,
        gz + 1.75,
        'room6-desk',
      );
      const bx = 17 + (dx - 1.0);
      addSceneryCollider(
        bx - 0.25,
        bx + 0.25,
        gz - 1.5,
        gz + 1.5,
        'room6-bench',
      );
    });
  });

  const podiumGroup = new THREE.Group();
  const podiumGeo = new THREE.BoxGeometry(1.2, 1.2, 2.2);
  const podium = new THREE.Mesh(podiumGeo, woodMat);
  podium.position.y = 0.6;
  podium.castShadow = true;
  podium.receiveShadow = true;
  podiumGroup.add(podium);

  const topGeo = new THREE.BoxGeometry(0.8, 0.1, 1.8);
  topGeo.rotateZ(Math.PI / 8);
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.set(-0.1, 1.25, 0);
  podiumGroup.add(top);

  podiumGroup.position.set(8.5, 0, 0);
  classroomGroup.add(podiumGroup);
  addSceneryCollider(25.5 - 0.6, 25.5 + 0.6, 8 - 1.1, 8 + 1.1, 'room6-podium');

  classroomGroup.position.set(17, 0, 8);
  registerStaticScenery(classroomGroup, { kind: 'room', roomId: 6 });
  state.scene.add(classroomGroup);
}
