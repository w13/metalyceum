// Shared furniture factories — reusable across building interiors and mezzanine.
// Import these instead of building duplicate geometry in each venue.
import * as THREE from 'three';
import { state } from '../state.js';
import { addSceneryCollider } from './utils.js';

const _M = {
  walnut: new THREE.MeshStandardMaterial({ color: '#3a1508', roughness: 0.35, metalness: 0.1 }),
  mahogany: new THREE.MeshStandardMaterial({ color: '#4a2010', roughness: 0.4, metalness: 0.08 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.78 }),
  slate: new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72 }),
  foliage: new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.8, flatShading: true }),
  lightWood: new THREE.MeshStandardMaterial({ color: '#6b4f3b', roughness: 0.86 }),
  seat: new THREE.MeshStandardMaterial({ color: '#4a3520', roughness: 0.75 }),
};

/** A wooden bench with a back panel. @param {number} y - base Y level (ground or mezzanine) */
export function createBench(cx, cz, length, rotY, y = 0, mat = _M.walnut, legMat = _M.darkMetal) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(length, 0.12, 0.6), mat);
  seat.position.set(0, y + 0.6, 0);
  seat.castShadow = true; seat.receiveShadow = true; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(length, 0.65, 0.1), mat);
  back.position.set(0, y + 0.95, -0.28);
  back.castShadow = true; g.add(back);
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5);
  [-length / 2 + 0.25, length / 2 - 0.25].forEach(lx => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, y + 0.3, 0);
    leg.castShadow = true; g.add(leg);
  });
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  return g;
}

/** A planter with 4 cone leaves. @param {number} y - base Y level */
export function createPlant(cx, cz, y = 0, large = false, planterMat = _M.slate, foliageMat = _M.foliage) {
  const g = new THREE.Group();
  const r = large ? 0.6 : 0.5;
  const planter = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.25, 0.7, 7), planterMat);
  planter.position.set(0, y + 0.35, 0);
  planter.castShadow = true; g.add(planter);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.3, 5), foliageMat);
    leaf.position.set(Math.cos(a) * 0.12, y + 1.1, Math.sin(a) * 0.12);
    leaf.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.25;
    leaf.castShadow = true; g.add(leaf);
  }
  g.position.set(cx, 0, cz);
  return g;
}

/** A round cafe table with pedestal base. @param {number} y - base Y level */
export function createCircleTable(cx, cz, radius, y = 0, tableMat = _M.lightWood) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.12, 16), tableMat);
  top.position.set(0, y + 0.82, 0);
  top.castShadow = true; g.add(top);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.72, 8), _M.darkMetal);
  pedestal.position.set(0, y + 0.4, 0);
  pedestal.castShadow = true; g.add(pedestal);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.06, 8), _M.darkMetal);
  base.position.set(0, y + 0.04, 0);
  g.add(base);
  g.position.set(cx, 0, cz);
  return g;
}

/** A single chair. @param {number} y - base Y level */
export function createChair(cx, cz, rotY, y = 0, accentColor = '#38bdf8', executive = false) {
  const g = new THREE.Group();
  const seatH = executive ? 0.58 : 0.5;
  const seatMat = new THREE.MeshStandardMaterial({ color: '#4a3520', roughness: 0.75 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42), seatMat);
  seat.position.set(0, y + seatH, 0);
  seat.castShadow = true; g.add(seat);
  const backH = executive ? 0.55 : 0.4;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, backH, 0.04), seatMat);
  back.position.set(0, y + seatH + backH / 2 + 0.04, -0.2);
  back.castShadow = true; g.add(back);
  if (accentColor !== '#4a3520') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.01),
      new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5 }));
    stripe.position.set(0, y + seatH + 0.06, -0.21);
    g.add(stripe);
  }
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, seatH, 4);
  [-0.16, 0.16].forEach(lx => {
    [-0.14, 0.14].forEach(lz => {
      const leg = new THREE.Mesh(legGeo, _M.darkMetal);
      leg.position.set(lx, y + seatH / 2, lz);
      leg.castShadow = true; g.add(leg);
    });
  });
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  return g;
}

/** Convenience: table + N chairs in a circle, adds collider. */
export function placeTableWithChairs(cx, cz, tableRadius, chairCount, chairRadius, y = 0, accentColor = '#38bdf8', tableMat = _M.lightWood, scene = state.scene, dest = null) {
  const table = createCircleTable(cx, cz, tableRadius, y, tableMat);
  (dest || scene).add(table);
  for (let i = 0; i < chairCount; i++) {
    const a = (Math.PI * 2 * i) / chairCount;
    const chair = createChair(
      cx + Math.cos(a) * chairRadius,
      cz + Math.sin(a) * chairRadius,
      a + Math.PI, y, accentColor,
    );
    (dest || scene).add(chair);
  }
  addSceneryCollider(cx - tableRadius, cx + tableRadius, cz - tableRadius, cz + tableRadius, `table-${cx}-${cz}`);
}

/** A bookshelf with colored book spines. */
export function createBookshelf(cx, cz, rotY, y = 0) {
  const g = new THREE.Group();
  const shelfMat = _M.mahogany;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.4), shelfMat);
  frame.position.set(0, y + 0.9, 0);
  frame.castShadow = true; g.add(frame);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1.65, 1.6, 0.25),
    new THREE.MeshStandardMaterial({ color: '#1a0f05', roughness: 0.9 }));
  inner.position.set(0, y + 0.9, 0.02);
  g.add(inner);
  const bookColors = ['#b91c1c', '#c2410c', '#a16207', '#15803d', '#1d4ed8', '#7e22ce', '#be123c', '#0d9488', '#4f46e5'];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.18),
        new THREE.MeshStandardMaterial({ color: bookColors[(row * 4 + col) % bookColors.length], roughness: 0.7 }));
      book.position.set(-0.6 + col * 0.4, y + 0.25 + row * 0.38, 0.11);
      book.rotation.z = (Math.random() - 0.5) * 0.06;
      g.add(book);
    }
  }
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  return g;
}
