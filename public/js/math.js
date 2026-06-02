// Frame-rate-independent math helpers for Metalyceum
import * as THREE from 'three';

export function frameIndependentLerp(current, target, dt, decay = 0.001) {
  const factor = 1 - Math.pow(decay, dt);
  return THREE.MathUtils.lerp(current, target, factor);
}

export function normalizeAngle(angle) {
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

export function frameIndependentAngleLerp(current, target, dt, decay = 0.001) {
  const factor = 1 - Math.pow(decay, dt);
  return current + normalizeAngle(target - current) * factor;
}

// Common rotation constants
export const HALF_PI = Math.PI / 2;
export const FLAT = -HALF_PI; // rotation.x for horizontal (floor/water) meshes

// Point-to-line-segment distance squared (pure math, no allocations)
export function pointToSegmentDistSq(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) {
    const ddx = px - x1;
    const ddz = pz - z1;
    return ddx * ddx + ddz * ddz;
  }
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
  const cx = x1 + dx * t;
  const cz = z1 + dz * t;
  const ddx = px - cx;
  const ddz = pz - cz;
  return ddx * ddx + ddz * ddz;
}
