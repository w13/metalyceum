// Dev LLM API — exposes window.metalyceumDev with inspection, audit, and teleport methods.
// Called from dev-tools.js initDevTools(). Receives its dependencies to avoid circular imports.
export function exposeLLMApi(ctx) {
  if (typeof window === 'undefined') return;
  const { devState, devTeleport, LANDMARK_REGISTRY, state, runWorldAudit, _nearestLandmark,
          _worldQuery, _sampleTerrain, _auditStaticScenery, _auditZFighting, rebuild3DHelpers,
          toggleDevMap, THREE } = ctx;

  window.metalyceumDev = {
    teleport: (x, z) => devTeleport(x, z),
    teleportTo: (name) => {
      const def = LANDMARK_REGISTRY[name];
      if (!def) {
        console.warn(`[metalyceumDev] Unknown landmark: "${name}". Try: ${Object.keys(LANDMARK_REGISTRY).join(', ')}`);
        return;
      }
      // Venue groups sit at origin with placement baked into vertices (and lazy
      // venues have no group before load) — use the registry's world center plus
      // any editor-applied group offset.
      const [baseX, baseZ] = def.approxCenter;
      const lmGroup = state.landmarkGroups.get(name);
      const offX = lmGroup ? lmGroup.position.x : 0;
      const offZ = lmGroup ? lmGroup.position.z : 0;
      devTeleport(baseX + offX, baseZ + offZ);
    },
    getState: () => devState,
    getPosition: () => state.localPlayer ? { x: state.localPlayer.x, y: state.localPlayer.y, z: state.localPlayer.z } : null,
    getPlayerPos: () => state.localPlayer ? `(${state.localPlayer.x.toFixed(2)}, ${state.localPlayer.y.toFixed(2)}, ${state.localPlayer.z.toFixed(2)})` : 'N/A',
    getNearby: (radius = 120) => {
      if (!state.localPlayer) return [];
      const px = state.localPlayer.x, pz = state.localPlayer.z;
      const results = [];
      state.scene.traverse((obj) => {
        if (results.length >= 30) return;
        if (!obj.isMesh || !obj.geometry) return;
        const dx = obj.position.x - px, dz = obj.position.z - pz;
        if (dx * dx + dz * dz > radius * radius) return;
        let parentInfo = '';
        let cur = obj.parent;
        while (cur && cur !== state.scene) {
          if (state.landmarkGroups) {
            for (const [key, val] of state.landmarkGroups) {
              if (val === cur) { parentInfo = ` (Landmark: ${key})`; cur = null; break; }
            }
          }
          if (cur) cur = cur.parent;
        }
        const g = obj.geometry;
        const p = g.parameters || {};
        const label = g.type + (p.width ? ` ${p.width.toFixed(1)}x${(p.height ?? 0).toFixed(1)}` : p.radiusTop ? ` r${p.radiusTop.toFixed(2)} h${p.height.toFixed(2)}` : '');
        results.push({ label, pos: `(${obj.position.x.toFixed(1)},${obj.position.y.toFixed(1)},${obj.position.z.toFixed(1)})`, dist: Math.sqrt(dx * dx + dz * dz).toFixed(0) + 'u', parent: parentInfo });
      });
      return results.sort((a, b) => parseFloat(a.dist) - parseFloat(b.dist));
    },
    getRooms: () => state.ROOMS ? state.ROOMS.map(r => ({ id: r.id, name: r.name, pos: `(${r.x},${r.z})`, type: r.type })) : [],
    getDiagnostics: () => {
      if (typeof getEngineDiagnostics !== 'function') return { error: 'engine not loaded' };
      const d = getEngineDiagnostics();
      return { fps: d.fps, objects: d.sceneObjects, players: d.remotePlayers, pos: d.player, camera: d.camera, errors: state.errorLog?.slice(-3) };
    },
    auditWorld: () => { runWorldAudit(); return devState.auditIssues; },
    runAudit: () => { runWorldAudit(); return devState.auditIssues; },
    findNearest: (x, z) => _nearestLandmark(x, z),
    queryPosition: (x, z) => _worldQuery(x, z),
    sampleTerrain: (cx, cz, radius, steps) => _sampleTerrain(cx, cz, radius, steps),
    auditStaticScenery: (threshold) => { _auditStaticScenery(threshold); return devState.staticAuditIssues; },
    auditZFighting: (radius) => { _auditZFighting(radius); return devState.zfightIssues; },
    toggleHelpers: (type) => {
      if (type === 'asset-boxes') devState.showAssetBoxes = !devState.showAssetBoxes;
      else if (type === 'wall-boxes') devState.showWallBoxes = !devState.showWallBoxes;
      else if (type === 'river') devState.showRiverPath = !devState.showRiverPath;
      rebuild3DHelpers();
    },
    toggleMap: (force) => toggleDevMap(force),
    rebuildHelpers: () => rebuild3DHelpers(),
    getScreens: () => Array.from(state.roomScreens?.entries() ?? []).map(([id, screen]) => ({ roomId: id, color: screen.baseColor?.getHex?.() })),
    getNpcs: () => state.npcs?.map(n => ({ name: n.name, pos: `(${n.x.toFixed(1)},${n.z.toFixed(1)})` })),
    getElevatorState: () => state._elevatorCar ? { y: state._elevatorCar.position.y } : null,
    getFountainData: () => {
      const f = state.animatedScenery?.find(a => a.type === 'fountain');
      return f ? { seed: f.seed } : null;
    },
    logErrors: () => state.errorLog?.slice(-10),
    getMemoryUsage: () => performance?.memory ? { js: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB' } : null,
  };
}
