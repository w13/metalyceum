import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { state } from '../../public/js/state.js';
import { devState, runWorldAudit } from '../../public/js/dev-tools.js';

describe('World Placement Auditor', () => {
  beforeEach(() => {
    // Reset global state
    state.placedAssets = new Map();
    state.WALLS = [];
    devState.auditIssues = [];
    
    state.localPlayer = {
      x: 0,
      y: 0,
      z: 44,
      currentRoom: -1,
      velocity: new THREE.Vector3(0, 0, 0)
    } as any;
  });

  it('detects clipping between two overlapping assets', () => {
    // Tree catalog footprint is 1.2
    // Asset 1: tree at (10, 0, 10), scale 1.0 (footprint radius = 0.6)
    state.placedAssets.set('asset-1', {
      asset: { id: 'asset-1', type: 'tree', x: 10.0, y: 0.0, z: 10.0, rotationY: 0, scale: 1.0, roomId: -1 },
      group: new THREE.Group()
    });

    // Asset 2: boulder at (10.5, 0, 10.0), scale 1.0 (footprint radius = 0.55)
    // Distance = 0.5. Required distance = 0.6 + 0.55 = 1.15. Thus they clip!
    state.placedAssets.set('asset-2', {
      asset: { id: 'asset-2', type: 'boulder', x: 10.5, y: 0.0, z: 10.0, rotationY: 0, scale: 1.0, roomId: -1 },
      group: new THREE.Group()
    });

    runWorldAudit();

    const clippingIssues = (devState.auditIssues as any[]).filter(iss => iss.type === 'clipping');
    expect(clippingIssues.length).toBeGreaterThan(0);
    expect(clippingIssues[0].message).toContain('Clipping');
  });

  it('detects potential z-fighting between coincident assets', () => {
    state.placedAssets.set('asset-1', {
      asset: { id: 'asset-1', type: 'tree', x: 15.0, y: 0.0, z: 15.0, rotationY: 0, scale: 1.0, roomId: -1 },
      group: new THREE.Group()
    });

    // Asset 2 is placed at almost identical coordinates (dist < 0.08)
    state.placedAssets.set('asset-2', {
      asset: { id: 'asset-2', type: 'tree', x: 15.01, y: 0.0, z: 15.01, rotationY: 0, scale: 1.0, roomId: -1 },
      group: new THREE.Group()
    });

    runWorldAudit();

    const zFightingIssues = (devState.auditIssues as any[]).filter(iss => iss.type === 'z-fighting');
    expect(zFightingIssues.length).toBeGreaterThan(0);
    expect(zFightingIssues[0].message).toContain('Z-Fighting');
  });

  it('detects river encroachment when an asset is placed in the river channel', () => {
    // River points include [65, 80]. Placing a tree at (66, 0, 80) is within 5 units channel width.
    state.placedAssets.set('asset-river', {
      asset: { id: 'asset-river', type: 'tree', x: 66.0, y: 0.0, z: 80.0, rotationY: 0, scale: 1.0, roomId: -1 },
      group: new THREE.Group()
    });

    runWorldAudit();

    const riverIssues = (devState.auditIssues as any[]).filter(iss => iss.type === 'river');
    expect(riverIssues.length).toBeGreaterThan(0);
    expect(riverIssues[0].message).toContain('River Encroachment');
  });

  it('detects floating and buried assets relative to terrain height', () => {
    // Outside flat building zones (e.g. at x: 100, z: 100)
    // Let's get the actual terrain height at (100, 100) and place an asset way above/below it
    // Wait, getTerrainHeight at (100, 100) is about 3.32.
    // Placing at y: 10.0 (floating) and y: -5.0 (buried)
    state.placedAssets.set('asset-floating', {
      asset: { id: 'asset-floating', type: 'tree', x: 100.0, y: 15.0, z: 100.0, rotationY: 0, scale: 1.0, roomId: -1 },
      group: new THREE.Group()
    });

    state.placedAssets.set('asset-buried', {
      asset: { id: 'asset-buried', type: 'tree', x: 100.0, y: -10.0, z: 100.0, rotationY: 0, scale: 1.0, roomId: -1 },
      group: new THREE.Group()
    });

    runWorldAudit();

    const floatingIssues = (devState.auditIssues as any[]).filter(iss => iss.type === 'floating');
    const buriedIssues = (devState.auditIssues as any[]).filter(iss => iss.type === 'buried');

    expect(floatingIssues.length).toBe(1);
    expect(buriedIssues.length).toBe(1);
  });
});
