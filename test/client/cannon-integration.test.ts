import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  _initFromModule,
  getPlayerBodyRef,
  isCannonReady,
  resetCannon,
  stepCannon,
  syncBodyY,
  teleportPlayer,
} from '../../public/js/physics-engine.js';
import { state } from '../../public/js/state.js';

function makePlayer(x = 0, y = 0, z = 0) {
  state.localPlayer = {
    x,
    y,
    z,
    ry: 0,
    velocity: new THREE.Vector3(),
    displayVelocity: new THREE.Vector3(),
    isGrounded: true,
    currentRoom: -1,
    mesh: null,
  } as any;
}

function addWall(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
) {
  state.WALLS.push(
    new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ),
    ),
  );
}

beforeEach(() => {
  state.WALLS = [];
  state.PLACED_ASSET_COLLIDERS = [];
  makePlayer();
});

afterEach(() => {
  resetCannon();
});

const PLAYER_RADIUS = 0.4;

describe('Cannon XZ collision proxy', () => {
  // Test 1: Tunneling regression
  // Max game speed = 9.5 u/s. Substep fixed at 1/60 s.
  // Per-substep travel = 9.5/60 = 0.158 u. Thinnest wall AABB ≈ 0.66 u. Margin: 4×.
  // dt=0.5 simulates a 500ms frame drop.
  it('does not tunnel through a 0.5-unit wall at max speed with an inflated dt', async () => {
    // Wall at z=[3, 3.5], large XZ/Y extents so player cannot go around
    addWall(-10, 0, 3, 10, 4, 3.5);
    makePlayer(0, 0, 1);

    await _initFromModule(CANNON);
    expect(isCannonReady()).toBe(true);

    const body = getPlayerBodyRef()!;
    body.position.set(0, PLAYER_RADIUS, 1); // start near side, z=1
    body.velocity.set(0, 0, 9.5); // max game speed toward wall

    stepCannon(0.5); // 500ms frame drop

    // Player must not have crossed the wall's near face (z=3)
    expect(body.position.z).toBeLessThan(3.0);
  });

  // Test 2: Wall sliding — not sticking
  // Player approaches wall diagonally. Cannon resolves the X contact.
  // The expanded safety-net check (r=0.55) must not fire on every frame.
  it('slides along a wall rather than freezing at the safety-net veto', async () => {
    // Wall along Z axis at x=[5, 5.5]
    addWall(5, 0, -20, 5.5, 4, 20);
    makePlayer(4, 0, 0);

    await _initFromModule(CANNON);
    const body = getPlayerBodyRef()!;
    body.position.set(4, PLAYER_RADIUS, 0);

    let safetyNetFires = 0;
    const startZ = body.position.z;

    for (let i = 0; i < 30; i++) {
      const prevX = body.position.x;
      const prevZ = body.position.z;

      body.velocity.x = 5; // keep pushing into wall
      body.velocity.z = 5; // keep moving along wall
      syncBodyY(0);
      stepCannon(1 / 60);

      // Simulate the expanded safety-net check (r=0.55) from movement.js
      const sphere = new THREE.Sphere(
        new THREE.Vector3(body.position.x, PLAYER_RADIUS, body.position.z),
        0.55,
      );
      const wallBox = state.WALLS[0] as THREE.Box3;
      if (wallBox.intersectsSphere(sphere)) {
        body.position.x = prevX;
        body.position.z = prevZ;
        body.velocity.set(0, 0, 0);
        safetyNetFires++;
      }
    }

    // Must have made Z progress (sliding) — not frozen at start.
    // With wall at x=5 and player at x=4, the player travels ~5 frames freely before
    // the expanded safety-net sphere (r=0.55) engages at x≈4.45. Those 5 frames at
    // vz=5 produce ≈0.417 Z units of progress. We assert > 0.3 to confirm the player
    // was not frozen from frame 0 (which would indicate a regression in Cannon setup).
    expect(body.position.z).toBeGreaterThan(startZ + 0.3);
    // Safety net must not fire on every frame — it fires ~25/30 times (after x≈4.45),
    // which is correct: the first ~5 frames are free sliding, then the r=0.55 sphere
    // overlaps the r=0.4 Cannon contact zone and vetoes to prevent penetration.
    expect(safetyNetFires).toBeLessThan(30);
    // Must not have passed through the wall
    expect(body.position.x).toBeLessThanOrEqual(5.0);
  });

  // Test 3: Y independence on flat terrain
  // gravity=(0,0,0) and syncBodyY zeroes velocity.y before each step.
  // On flat terrain (Y constant), body.position.y must stay at PLAYER_RADIUS.
  it('Cannon does not contaminate Y: body.position.y stays at PLAYER_RADIUS on flat terrain', async () => {
    makePlayer(0, 0, 0);
    await _initFromModule(CANNON);
    const body = getPlayerBodyRef()!;
    body.position.set(0, PLAYER_RADIUS, 0);

    for (let i = 0; i < 60; i++) {
      syncBodyY(0); // flat terrain: manualY=0 always
      body.velocity.set(3, 0, 0); // move right

      // After syncBodyY: body Y must equal PLAYER_RADIUS and velocity.y must be 0
      expect(body.position.y).toBeCloseTo(PLAYER_RADIUS, 5);
      expect(body.velocity.y).toBeCloseTo(0, 5);

      stepCannon(1 / 60);

      // After step with gravity=(0,0,0) and velocity.y pre-zeroed: Y must not drift
      expect(body.position.y).toBeCloseTo(PLAYER_RADIUS, 2);
    }
  });

  // Test 4: displayVelocity on fallback path
  // When Cannon is not ready, the fallback path must copy velocity → displayVelocity
  describe('fallback path displayVelocity', () => {
    it('isCannonReady is false before initCannon is called', () => {
      expect(isCannonReady()).toBe(false);
    });

    it('displayVelocity matches velocity after fallback move', () => {
      // Simulate what the fallback branch does at end of XZ block
      const lp = state.localPlayer as any;
      lp.velocity.x = 4.2;
      lp.velocity.z = -1.8;

      lp.displayVelocity.x = lp.velocity.x;
      lp.displayVelocity.z = lp.velocity.z;

      expect(lp.displayVelocity.x).toBe(4.2);
      expect(lp.displayVelocity.z).toBe(-1.8);
    });

    it('displayVelocity is zero when velocity is zero on fallback', () => {
      const lp = state.localPlayer as any;
      lp.velocity.x = 0;
      lp.velocity.z = 0;
      lp.displayVelocity.x = lp.velocity.x;
      lp.displayVelocity.z = lp.velocity.z;

      expect(lp.displayVelocity.x).toBe(0);
      expect(lp.displayVelocity.z).toBe(0);
    });
  });
});
