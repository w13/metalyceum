// Room interior furnishings and sets
import * as THREE from 'three';
import { state } from '../state.js';
import { ROOM_LAYOUTS, WORLD_CONFIG } from '../config.js';
import { registerStaticScenery } from './visibility.js';

export function buildRoomInteriorSet(room) {
  const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
  const group = new THREE.Group();
  group.position.set(room.x, 0, room.z);

  const rugRadius = Math.min(room.width, room.depth) * 0.35;
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(rugRadius, rugRadius, 0.03, 28),
    new THREE.MeshStandardMaterial({
      color: '#0f172a',
      emissive: layout.themeColor,
      emissiveIntensity: 0.06,
      roughness: 0.82
    })
  );
  rug.position.y = 0.03;
  group.add(rug);

  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.04, 3.8),
    new THREE.MeshStandardMaterial({
      color: layout.themeColor,
      emissive: layout.themeColor,
      emissiveIntensity: 0.2,
      roughness: 0.55
    })
  );
  const stripX = room.x < 0 ? room.width / 2 - 0.1 : -room.width / 2 + 0.1;
  strip.position.set(stripX, 0.04, 0);
  group.add(strip);

  const benchMat = new THREE.MeshStandardMaterial({ color: '#3f2a1e', roughness: 0.88 });
  const benchFrameMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.78 });
  const benchWidth = room.width > 20 ? 4.0 : (room.width < 15 ? 2.2 : 3.0);
  
  // North bench
  const benchNorth = new THREE.Group();
  const seatNorth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.14, 0.7), benchMat);
  seatNorth.position.y = 0.62;
  benchNorth.add(seatNorth);
  
  const backNorth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.8, 0.12), benchMat);
  backNorth.position.set(0, 1.0, -0.28);
  benchNorth.add(backNorth);
  
  [-benchWidth / 2 + 0.25, benchWidth / 2 - 0.25].forEach((legX) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 4), benchFrameMat);
    leg.position.set(legX, 0.3, -0.1);
    benchNorth.add(leg);
  });
  benchNorth.position.set(0, 0, -room.depth / 2 + 1.2);
  group.add(benchNorth);

  // South bench
  const benchSouth = new THREE.Group();
  const seatSouth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.14, 0.7), benchMat);
  seatSouth.position.y = 0.62;
  benchSouth.add(seatSouth);
  
  const backSouth = new THREE.Mesh(new THREE.BoxGeometry(benchWidth, 0.8, 0.12), benchMat);
  backSouth.position.set(0, 1.0, -0.28);
  benchSouth.add(backSouth);
  
  [-benchWidth / 2 + 0.25, benchWidth / 2 - 0.25].forEach((legX) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.65, 4), benchFrameMat);
    leg.position.set(legX, 0.3, -0.1);
    benchSouth.add(leg);
  });
  benchSouth.position.set(0, 0, room.depth / 2 - 1.2);
  benchSouth.rotation.y = Math.PI;
  group.add(benchSouth);

  // Corner plant
  const plant = new THREE.Group();
  const planter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.64, 0.7, 6),
    new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72 })
  );
  planter.position.y = 0.35;
  plant.add(planter);

  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 1.2, 5),
      new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.8, flatShading: true })
    );
    leaf.position.set(
      Math.cos((i / 4) * Math.PI * 2) * 0.12,
      1 + Math.random() * 0.15,
      Math.sin((i / 4) * Math.PI * 2) * 0.12
    );
    leaf.rotation.z = (Math.random() - 0.5) * 0.35;
    leaf.rotation.x = (Math.random() - 0.5) * 0.35;
    plant.add(leaf);
  }
  
  const plantX = room.x < 0 ? room.width / 2 - 1.2 : -room.width / 2 + 1.2;
  plant.position.set(plantX, 0, -room.depth / 2 + 1.2);
  group.add(plant);

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({
      color: layout.themeColor,
      transparent: true,
      opacity: 0.5
    })
  );
  spark.position.set(stripX, 0.08, 0);
  group.add(spark);

  registerStaticScenery(group, { kind: 'room', roomId: room.id });
  state.scene.add(group);
}
