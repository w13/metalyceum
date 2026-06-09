// Torch flickering for Metalyceum
import { state } from './state.js';

export function updateTorches(now) {
  if (state.frameCount % 4 !== 0) return;
  const time = now * 0.005;
  state.torches.forEach((t) => {
    // Skip torches attached to invisible parent groups (e.g. faded second-floor torches)
    if (t.flame.parent && !t.flame.parent.visible) return;
    if (t.worldPos.distanceToSquared(state.camera.position) > 3600) return; // 60 units
    const flicker = Math.sin(time * 3 + t.seed) * Math.cos(time * 7 + t.seed) * 0.15;
    if (t.light) t.light.intensity = t.baseIntensity + flicker;
    t.flame.scale.set(
      1 + flicker * 0.1,
      1 + Math.sin(time * 10 + t.seed) * 0.15,
      1 + flicker * 0.1
    );
  });
}
