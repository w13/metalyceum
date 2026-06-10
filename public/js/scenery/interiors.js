// Room interior furnishings and sets
import * as THREE from 'three';
import { ROOM_LAYOUTS, WORLD_CONFIG } from '../config.js';
import { state } from '../state.js';
import { registerStaticScenery } from './visibility.js';
import { createBench, createPlant } from './furniture.js';

const _darkSlate = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72 });

export function buildRoomInteriorSet(room) {
  const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
  const group = new THREE.Group();
  group.position.set(room.x, 0, room.z);

  const rugRadius = Math.min(room.width, room.depth) * 0.35;
  const rug = new THREE.Mesh(
    new THREE.CylinderGeometry(rugRadius, rugRadius, 0.03, 28),
    new THREE.MeshStandardMaterial({ color: '#0f172a', emissive: layout.themeColor, emissiveIntensity: 0.06, roughness: 0.82 }),
  );
  rug.position.y = 0.03;
  group.add(rug);

  const stripMat = new THREE.MeshStandardMaterial({ color: layout.themeColor, emissive: layout.themeColor, emissiveIntensity: 0.2, roughness: 0.55 });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 3.8), stripMat);
  const stripX = room.x < 0 ? room.width / 2 - 0.1 : -room.width / 2 + 0.1;
  strip.position.set(stripX, 0.04, 0);
  group.add(strip);

  // Benches (north + south) via shared factory, positioned relative to the room group
  const benchW = room.width > 20 ? 4.0 : room.width < 15 ? 2.2 : 3.0;
  const benchMat = new THREE.MeshStandardMaterial({ color: '#3f2a1e', roughness: 0.88 });
  group.add(createBench(0, -room.depth / 2 + 1.2, benchW, 0, 0, benchMat));
  group.add(createBench(0, room.depth / 2 - 1.2, benchW, Math.PI, 0, benchMat));

  // Corner plant via shared factory
  const plantX = room.x < 0 ? room.width / 2 - 1.2 : -room.width / 2 + 1.2;
  group.add(createPlant(plantX, -room.depth / 2 + 1.2, 0, false, _darkSlate));

  const spark = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({
      color: layout.themeColor,
      transparent: true,
      opacity: 0.5,
    }),
  );
  spark.position.set(stripX, 0.08, 0);
  group.add(spark);

  group.traverse((child) => {
    if (child.isMesh) {
      if (child === rug) {
        child.receiveShadow = true;
      } else if (child !== spark) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    }
  });

  registerStaticScenery(group, { kind: 'room', roomId: room.id });
  state.scene.add(group);
}
