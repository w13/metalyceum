import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initEngine } from '../../public/js/engine.js';
import { resetHdriLoader } from '../../public/js/environment.js';
import { state } from '../../public/js/state.js';

describe('Client Engine & WebGL Renderer', () => {
  beforeEach(() => {
    // 1. Create essential DOM container elements queried by initEngine
    const gameContainer = document.createElement('div');
    gameContainer.id = 'game-container';
    document.body.appendChild(gameContainer);

    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    document.body.appendChild(loadingScreen);

    // Mock window dimensions for three.js aspect ratios
    window.innerWidth = 800;
    window.innerHeight = 600;

    // 2. Initialize default state fields needed for engine startup
    state.localPlayer = {
      x: 0,
      y: 0,
      z: 44,
      currentRoom: -1,
      velocity: new THREE.Vector3(0, 0, 0),
    } as any;
    state.remotePlayers = new Map();
    state.ROOMS = [
      {
        id: 0,
        name: 'North Hall',
        x: -17,
        z: -30,
        width: 24,
        depth: 20,
        video: '',
        sourceValue: '',
        sourceType: 'none',
        startTime: null,
        durationMinutes: 0,
        updatedAt: 0,
      },
      {
        id: 1,
        name: 'East Studio',
        x: -14,
        z: -10,
        width: 18,
        depth: 16,
        video: '',
        sourceValue: '',
        sourceType: 'none',
        startTime: null,
        durationMinutes: 0,
        updatedAt: 0,
      },
    ] as any;
  });

  afterEach(() => {
    // Teardown to prevent WebGL context leaks & bleed between tests
    if (state.scene) {
      state.scene.traverse((object: any) => {
        if (object.isMesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((mat: any) => mat.dispose());
          } else {
            object.material?.dispose();
          }
        }
      });
    }

    if (state.renderer) {
      state.renderer.dispose();
      const gl = state.renderer.getContext();
      if (gl) {
        const extension = gl.getExtension('WEBGL_lose_context');
        if (extension) extension.loseContext();
      }
    }

    document.getElementById('game-container')?.remove();
    document.getElementById('loading-screen')?.remove();

    state.scene = null;
    state.renderer = null;
    state.camera = null;
    state.controls = null;

    resetHdriLoader();
  });

  it('procedurally constructs the campus world scene graph', async () => {
    await initEngine();

    expect(state.scene).toBeInstanceOf(THREE.Scene);
    expect(state.renderer).toBeInstanceOf(THREE.WebGLRenderer);
    expect(state.camera).toBeInstanceOf(THREE.PerspectiveCamera);

    // Verify sky dome and lights are in the scene graph
    const children = state.scene.children;
    expect(children.length).toBeGreaterThan(0);

    const hasSkyDome = children.some((c: any) => c === state.skyDome);
    expect(hasSkyDome).toBe(true);

    const lightsCount = children.filter((c: any) => c.isLight).length;
    expect(lightsCount).toBeGreaterThanOrEqual(3); // Ambient + Hemisphere + Directional Sun
  });

  it('runs initial render and asserts performance budget constraints', async () => {
    await initEngine();

    // Trigger an initial render to populate renderer info
    state.renderer.render(state.scene, state.camera);

    const info = state.renderer.info;

    // Log the actual observed baselines for diagnostics
    console.log('[Browser Test Baselines]:', {
      calls: info.render.calls,
      triangles: info.render.triangles,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
    });

    // NOTE: this scene is near-empty in the vitest browser env (~32 calls vs
    // ~700 live) — these are sanity floors only. The real budget gate is
    // e2e/perf-budget.e2e.ts, which probes the live dev server.
    expect(info.render.calls).toBeLessThan(420);
    expect(info.render.triangles).toBeLessThan(850_000);
    expect(info.memory.textures).toBeLessThan(15);
    expect(info.memory.geometries).toBeLessThan(460);
  });
});
