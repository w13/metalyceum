import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { state } from '../../public/js/state.js';
import {
  getRoomIdForPosition,
  checkCollision,
  isPointInsideRoom,
  getTerrainHeight
} from '../../public/js/physics.js';

describe('Client Physics & Room Queries', () => {
  beforeEach(() => {
    // Reset global state values
    state.localPlayer = {
      x: 0,
      y: 0,
      z: 44,
      currentRoom: -1,
      velocity: new THREE.Vector3(0, 0, 0)
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
        new THREE.Vector3(10, 1, 10)
      );
      state.WALLS.push(wallBox);

      // Check collision within sphere radius (0.4)
      expect(checkCollision(7.5, 7.5)).toBe(true);
      expect(checkCollision(4.8, 7.5)).toBe(true); // Close enough to intersect sphere
      expect(checkCollision(0, 0)).toBe(false);    // Far away
    });

    it('returns true when colliding with a placed asset collider', () => {
      // Placed asset colliders are simple bounding boxes
      state.PLACED_ASSET_COLLIDERS.push({
        minX: 12,
        maxX: 14,
        minZ: 12,
        maxZ: 14
      } as any);

      expect(checkCollision(13, 13)).toBe(true);
      expect(checkCollision(11.8, 13)).toBe(true); // Hits boundary radius
      expect(checkCollision(0, 0)).toBe(false);
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

    it('calculates hilly height outside the flat safety zones', () => {
      const height = getTerrainHeight(100, 100);
      expect(height).not.toBe(0);
      expect(typeof height).toBe('number');
    });
  });
});
