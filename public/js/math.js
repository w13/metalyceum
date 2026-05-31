// Frame-rate-independent math helpers for Metalyceum

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
