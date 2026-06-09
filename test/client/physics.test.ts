import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAIN_BUILDING_MEZZANINE_Y,
  MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y,
} from '../../public/js/config.js';
import {
  checkCollision,
  getRoomIdForPosition,
  getTerrainHeight,
  isPointInsideRoom,
} from '../../public/js/physics.js';
import { state } from '../../public/js/state.js';

describe('Client Physics & Room Queries', () => {
  beforeEach(() => {
    // Reset global state values
    state.localPlayer = {
      x: 0,
      y: 0,
      z: 44,
      currentRoom: -1,
      velocity: new THREE.Vector3(0, 0, 0),
    } as any;
    state.WALLS = [];
    state.PLACED_ASSET_COLLIDERS = [];
  });

  describe('getRoomIdForPosition', () => {
    it('correctly maps coordinates to North Hall (ID 0)', () => {
      // North Hall is at x: -17, z: -30, width: 24, depth: 20
      // Bounds: X [-29, -5], Z [-40, -20]
      const roomId = getRoomIdForPosition(-17, -30);
      expect(roomId).toBe(0);
    });

    it('correctly maps coordinates to Outdoor Amphitheater (ID 8)', () => {
      // Outdoor Amphitheater is at x: 65, z: 150, width: 40, depth: 36
      const roomId = getRoomIdForPosition(65, 150);
      expect(roomId).toBe(8);
    });

    it('treats the concert venue entrance threshold as part of the room', () => {
      const roomId = getRoomIdForPosition(-61, 140);
      expect(roomId).toBe(9);
    });

    it('returns -1 for outdoor points', () => {
      // Outside the building and amphitheater/concert venue
      const roomId = getRoomIdForPosition(0, 44);
      expect(roomId).toBe(-1);
    });
  });

  describe('isPointInsideRoom', () => {
    it('returns true when inside a specific room bounds', () => {
      const room = state.ROOMS[0]; // North Hall
      expect(isPointInsideRoom(-17, -30, room)).toBe(true);
    });

    it('returns false when outside a specific room bounds', () => {
      const room = state.ROOMS[0]; // North Hall
      expect(isPointInsideRoom(0, 0, room)).toBe(false);
    });

    it('uses explicit bounds when a room defines them', () => {
      const room = state.ROOMS[9]; // Concert Venue
      expect(isPointInsideRoom(-61, 140, room)).toBe(true);
      expect(isPointInsideRoom(-58, 140, room)).toBe(false);
    });
  });

  describe('checkCollision', () => {
    it('prevents player from walking past map boundaries', () => {
      // Map size is 600. Limit is 600 / 2 - 2 = 298.
      expect(checkCollision(299, 0)).toBe(true);
      expect(checkCollision(-299, 0)).toBe(true);
      expect(checkCollision(0, 299)).toBe(true);
      expect(checkCollision(0, -299)).toBe(true);
      expect(checkCollision(0, 0)).toBe(false);
    });

    it('returns true when colliding with a static wall', () => {
      // Add a wall to the scene
      const wallBox = new THREE.Box3(
        new THREE.Vector3(5, -1, 5),
        new THREE.Vector3(10, 1, 10),
      );
      state.WALLS.push(wallBox);

      // Check collision within sphere radius (0.4)
      expect(checkCollision(7.5, 7.5)).toBe(true);
      expect(checkCollision(4.8, 7.5)).toBe(true); // Close enough to intersect sphere
      expect(checkCollision(0, 0)).toBe(false); // Far away
    });

    it('returns true when colliding with a placed asset collider', () => {
      // Placed asset colliders are simple bounding boxes
      state.PLACED_ASSET_COLLIDERS.push({
        minX: 12,
        maxX: 14,
        minZ: 12,
        maxZ: 14,
      } as any);

      expect(checkCollision(13, 13)).toBe(true);
      expect(checkCollision(11.8, 13)).toBe(true); // Hits boundary radius
      expect(checkCollision(0, 0)).toBe(false);
    });

    it('prevents player from walking past the second-floor south-facing railing', () => {
      // Simulate player on the second floor
      state.localPlayer.y = MAIN_BUILDING_MEZZANINE_Y;

      // Add the railing collider as it is added in buildBuilding
      const f2Height = 3.3;
      state.WALLS.push(
        new THREE.Box3(
          new THREE.Vector3(-2.1, MAIN_BUILDING_MEZZANINE_Y, 39.5),
          new THREE.Vector3(2.1, MAIN_BUILDING_MEZZANINE_Y + f2Height, 40.5),
        ),
      );

      // At Z = 39.6 with player sphere of radius 0.4 (extends Z from 39.2 to 40.0),
      // it should intersect the box [39.5, 40.5] and return true (collision).
      expect(checkCollision(0, 39.6)).toBe(true);

      // Farther south (e.g. Z = 40.0) should also collide
      expect(checkCollision(0, 40.0)).toBe(true);

      // Safe area (e.g. Z = 38.0) should not collide
      expect(checkCollision(0, 38.0)).toBe(false);

      // Off to the sides (e.g. X = 3.0) should not collide with this railing box
      expect(checkCollision(3.0, 39.6)).toBe(false);
    });
  });

  describe('getTerrainHeight', () => {
    it('returns 0 in the flat safety zone around center building', () => {
      // Within radius of 52 from center, terrain height is flat (0)
      expect(getTerrainHeight(0, 0)).toBe(0);
      expect(getTerrainHeight(10, -10)).toBe(0);
    });

    it('returns 0 in the flat zone for the fountain plaza', () => {
      // z > 38 && Math.abs(x) < 18 is flat (0)
      expect(getTerrainHeight(10, 42)).toBe(0);
    });

    it('returns 0 on the road to the concert venue (specifically at the clipping coordinate -17.98, 68.60)', () => {
      // Road 2 path points include (-18, 68) which should be fully flattened (0)
      expect(getTerrainHeight(-17.98, 68.6)).toBeCloseTo(0, 4);
    });

    it('uses the shared mezzanine height when sampling the upper floor', () => {
      state.localPlayer.y = MAIN_BUILDING_MEZZANINE_Y;
      expect(getTerrainHeight(0, 0)).toBe(MAIN_BUILDING_MEZZANINE_Y);
      expect(getTerrainHeight(18, -12)).toBe(MAIN_BUILDING_MEZZANINE_Y);
    });

    it('switches to mezzanine sampling at the shared upper-level threshold', () => {
      state.localPlayer.y = MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y - 0.01;
      expect(getTerrainHeight(0, 0)).toBe(0);

      state.localPlayer.y = MAIN_BUILDING_UPPER_LEVEL_THRESHOLD_Y;
      expect(getTerrainHeight(0, 0)).toBe(MAIN_BUILDING_MEZZANINE_Y);
    });

    it('calculates hilly height outside the flat safety zones', () => {
      const height = getTerrainHeight(100, 100);
      expect(height).not.toBe(0);
      expect(typeof height).toBe('number');
    });
  });
});
