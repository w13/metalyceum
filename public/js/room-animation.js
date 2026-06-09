// Scenery and fountain animation loop for Metalyceum
import { state } from './state.js';

export function updateRoomIndicatorAnimations(now) {
  // Throttle to every 3rd frame — pulsing is imperceptible at 20 vs 60 fps
  if ((now | 0) % 3 !== 0) return;
  const time = now * 0.001;
  state.ROOM_INDICATORS.forEach((marker) => {
    if (!marker.group.visible) return;
    const statusTone = marker.group.userData.statusTone || 'idle';
    const pulse =
      statusTone === 'live'
        ? 1 + Math.sin(time * 3.6 + marker.seed) * 0.08
        : 1 + Math.sin(time * 1.8 + marker.seed) * 0.04;
    marker.ring.scale.setScalar(pulse);
    marker.glow.material.opacity =
      statusTone === 'live'
        ? 0.55 + Math.sin(time * 4 + marker.seed) * 0.1
        : 0.35;
    marker.group.rotation.y = (now * 0.0025) % (Math.PI * 2);
  });

  state.animatedScenery.forEach((item) => {
    if (!item.object.visible) return;
    if (item.type === 'banner') {
      // Skip banner sway when camera is far — imperceptible at distance
      if (
        state.camera &&
        state.camera.position.distanceToSquared(item.object.position) > 14400
      )
        return;
      item.object.rotation.z =
        Math.sin(time * item.speed + item.seed) * item.amplitude;
    } else if (item.type === 'river' && item.update) {
      item.update(now);
    } else if (item.type === 'fountain') {
      // Skip all fountain work when camera is far away (fountain is never registered
      // as static scenery so its visible flag stays true — gate manually here)
      if (
        state.camera &&
        state.camera.position.distanceToSquared(item.object.position) > 8100
      )
        return; // 90 units

      const data = item.object.userData || {};
      const basinPulse = Math.sin(time * 1.6 + item.seed) * 0.02;
      const upperPulse = Math.sin(time * 2.4 + item.seed * 1.3) * 0.012;
      const jetPulse = (Math.sin(time * 6 + item.seed) + 1) * 0.5;

      // item.object.rotation.y = time * 0.1; -- removed: made the fountain spin disorientingly

      // ── Basin + upper water volume pulse ──────────────────────────────────
      if (data.basinWater) {
        data.basinWater.position.y =
          data.basinWater.userData.baseY + basinPulse * 0.45;
      }
      if (data.upperWater) {
        data.upperWater.position.y =
          data.upperWater.userData.baseY + upperPulse * 0.3;
      }

      // ── Vertex-displacement waves on pool surfaces ────────────────────────
      // Throttled to every 8th frame; computeVertexNormals skipped because
      // the surfaces are transparent DoubleSide planes where normals are imperceptible.
      if (state.frameCount % 8 === 0) {
        if (data.poolSurface) {
          const mesh = data.poolSurface;
          const geo = mesh.geometry;
          const pos = geo.attributes.position;
          const radii = geo.userData?.poolRadii;
          const waveAmp = mesh.userData.waveAmp || 0.025;
          const waveFreq = mesh.userData.waveFreq || 2.5;
          if (pos && radii) {
            for (let i = 0; i < pos.count; i++) {
              const r = radii[i];
              pos.setZ(
                i,
                Math.sin(r * waveFreq - time * 2.2) * waveAmp +
                  Math.sin(r * waveFreq * 0.6 + time * 1.4 + item.seed) *
                    waveAmp *
                    0.5,
              );
            }
            pos.needsUpdate = true;
          }
          mesh.position.y = mesh.userData.baseY + basinPulse * 0.8;
          mesh.material.opacity = 0.44 + jetPulse * 0.18;
        }

        if (data.poolSurface2) {
          const mesh = data.poolSurface2;
          const geo = mesh.geometry;
          const pos = geo.attributes.position;
          const radii = geo.userData?.poolRadii;
          const waveAmp = mesh.userData.waveAmp || 0.018;
          const waveFreq = mesh.userData.waveFreq || 3.8;
          if (pos && radii) {
            for (let i = 0; i < pos.count; i++) {
              const r = radii[i];
              pos.setZ(
                i,
                Math.sin(r * waveFreq + time * 3.4 + item.seed * 0.7) *
                  waveAmp +
                  Math.cos(r * waveFreq * 0.5 - time * 1.1) * waveAmp * 0.4,
              );
            }
            pos.needsUpdate = true;
          }
          mesh.position.y = mesh.userData.baseY + basinPulse * 0.5;
          mesh.material.opacity = 0.24 + jetPulse * 0.12;
        }
      }

      // ── Emanating ripple rings ────────────────────────────────────────────
      if (data.poolRipple) {
        const ringPulse = (Math.sin(time * 2.8 + item.seed) + 1) * 0.5;
        data.poolRipple.position.y =
          data.poolRipple.userData.baseY + basinPulse * 0.5;
        data.poolRipple.scale.setScalar(0.96 + ringPulse * 0.08);
        data.poolRipple.rotation.z = time * 0.2;
        data.poolRipple.material.opacity = 0.1 + ringPulse * 0.15;
      }
      if (data.poolRipple2) {
        const ringPulse2 =
          (Math.sin(time * 2.8 + item.seed + Math.PI) + 1) * 0.5;
        data.poolRipple2.position.y =
          data.poolRipple2.userData.baseY + basinPulse * 0.4;
        data.poolRipple2.scale.setScalar(0.96 + ringPulse2 * 0.08);
        data.poolRipple2.rotation.z = -time * 0.18;
        data.poolRipple2.material.opacity = 0.1 + ringPulse2 * 0.12;
      }

      // ── Fake caustic light ────────────────────────────────────────────────
      if (data.causticDisc) {
        data.causticDisc.position.y = data.causticDisc.userData.baseY;
        data.causticDisc.rotation.z = time * 0.06;
        data.causticDisc.scale.setScalar(
          1 + Math.sin(time * 1.3 + item.seed) * 0.04,
        );
        data.causticDisc.material.opacity = 0.06 + jetPulse * 0.1;
      }

      // ── Upper bowl water (volumetric body + domed cap + surface) ────────
      // Water body cylinder — pulse vertically for a "breathing" water volume
      if (data.upperWaterBody) {
        data.upperWaterBody.position.y =
          data.upperWaterBody.userData.baseY + upperPulse * 0.4;
        data.upperWaterBody.scale.y =
          1 + Math.sin(time * 2 + item.seed * 1.1) * 0.04;
      }
      // Surface film — shimmer and opacity
      if (data.upperWater) {
        data.upperWater.position.y =
          data.upperWater.userData.baseY + upperPulse * 0.3;
        data.upperWater.material.opacity = 0.3 + jetPulse * 0.12;
      }
      if (data.upperPoolSurface) {
        data.upperPoolSurface.position.y =
          data.upperPoolSurface.userData.baseY + upperPulse;
        data.upperPoolSurface.scale.setScalar(1 + upperPulse * 0.05);
        data.upperPoolSurface.material.opacity = 0.4 + jetPulse * 0.16;
      }

      // Upper ripple rings (two, opposite phase)
      if (data.upperRipple) {
        const upperRingPulse =
          (Math.sin(time * 3.4 + item.seed * 1.1) + 1) * 0.5;
        data.upperRipple.position.y =
          data.upperRipple.userData.baseY + upperPulse * 0.6;
        data.upperRipple.scale.setScalar(0.94 + upperRingPulse * 0.1);
        data.upperRipple.material.opacity = 0.12 + upperRingPulse * 0.2;
      }
      if (data.upperRipple2) {
        const upperRingPulse2 =
          (Math.sin(time * 3.4 + item.seed * 1.1 + Math.PI) + 1) * 0.5;
        data.upperRipple2.position.y =
          data.upperRipple2.userData.baseY + upperPulse * 0.5;
        data.upperRipple2.scale.setScalar(0.94 + upperRingPulse2 * 0.1);
        data.upperRipple2.material.opacity = 0.12 + upperRingPulse2 * 0.16;
      }

      // ── 3D apple water blob ───────────────────────────────────────────────
      if (data.waterApple) {
        const appleBob = Math.sin(time * 1.5 + item.seed) * 0.028;
        const appleBreath = Math.sin(time * 2.2 + item.seed * 1.4);
        data.waterApple.position.y = data.waterApple.userData.baseY + appleBob;
        data.waterApple.scale.x = 1 + appleBreath * 0.022;
        data.waterApple.scale.z = 1 + appleBreath * 0.022;
        data.waterApple.scale.y = 1 - appleBreath * 0.018;
        data.waterApple.material.opacity = 0.62 + jetPulse * 0.14;
        data.waterApple.rotation.y = time * 0.28;
      }
      if (data.waterAppleGlow) {
        const glowBob = Math.sin(time * 1.5 + item.seed + 0.9) * 0.022;
        const glowBreath = Math.sin(time * 1.8 + item.seed * 0.8);
        data.waterAppleGlow.position.y =
          data.waterAppleGlow.userData.baseY + glowBob;
        data.waterAppleGlow.scale.setScalar(1 + glowBreath * 0.03);
        data.waterAppleGlow.material.opacity = 0.3 + jetPulse * 0.16;
        data.waterAppleGlow.rotation.y = -time * 0.18;
      }

      // ── Center spray jet ──────────────────────────────────────────────────
      if (data.centerJet) {
        data.centerJet.position.y =
          data.centerJet.userData.baseY +
          Math.sin(time * 4.5 + item.seed) * 0.05;
        data.centerJet.scale.y = 0.9 + jetPulse * 0.35;
        data.centerJet.material.opacity = 0.24 + jetPulse * 0.22;
      }

      // ── Cascade streams ───────────────────────────────────────────────────
      if (Array.isArray(data.cascadeStreams)) {
        data.cascadeStreams.forEach((stream) => {
          const streamPulse =
            (Math.sin(time * 4.2 + item.seed + stream.userData.phase) + 1) *
            0.5;
          stream.position.y =
            stream.userData.baseY + (streamPulse - 0.5) * 0.08;
          stream.scale.y = 0.88 + streamPulse * 0.24;
          stream.material.opacity = 0.22 + streamPulse * 0.18;
        });
      }

      // ── Rising bubbles ────────────────────────────────────────────────────
      if (Array.isArray(data.bubbles)) {
        data.bubbles.forEach((bubble) => {
          const ud = bubble.userData;
          // Rise
          let by = bubble.position.y + ud.riseSpeed * 0.016;
          // Wobble
          const wobbleX =
            Math.sin(time * ud.wobbleFreq + ud.phase) * ud.wobbleAmp;
          const wobbleZ =
            Math.cos(time * ud.wobbleFreq * 0.7 + ud.phase) * ud.wobbleAmp;
          // Respawn when too high
          if (by > ud.maxY) {
            by = ud.respawnY;
          }
          // Fade near top
          const fade =
            by > ud.maxY - 0.5 ? Math.max(0, (ud.maxY - by) / 0.5) : 1;
          bubble.position.set(
            Math.cos(time * 0.4 + ud.phase) * ud.radius + wobbleX,
            by,
            Math.sin(time * 0.35 + ud.phase) * ud.radius + wobbleZ,
          );
          bubble.material.opacity = 0.4 * fade;
          bubble.scale.setScalar(0.8 + Math.sin(time * 2 + ud.phase) * 0.2);
        });
      }
    } else if (item.type === 'fish') {
      // Fish orbit the fountain — skip when camera is far (same threshold as fountain)
      if (
        state.camera &&
        state.camera.position.distanceToSquared(item.object.position) > 8100
      )
        return;

      const data = item.object.userData || {};
      // Store anchor on first frame
      if (data._anchorX === undefined) {
        data._anchorX = item.object.position.x;
        data._anchorY = item.object.position.y;
        data._anchorZ = item.object.position.z;
      }
      const angle = (data.orbitAngle || 0) + time * (data.orbitSpeed || 0.8);
      const radius = data.orbitRadius || 1.5;
      const bob =
        Math.sin(time * (data.bobSpeed || 1.5) + (data.bobPhase || 0)) * 0.06;
      item.object.position.x = data._anchorX + Math.cos(angle) * radius;
      item.object.position.z = data._anchorZ + Math.sin(angle) * radius;
      item.object.position.y = data._anchorY + bob;
      item.object.rotation.y = -angle + Math.PI / 2;
      // Tail wag
      if (item.object.children[1]) {
        item.object.children[1].rotation.z =
          Math.sin(time * 5 + (data.bobPhase || 0)) * 0.35;
      }
    }
  });
}
