// Game Engine, Camera, Rendering Loop, and Physics Update Scheduler for Metalyceum
import { state } from './state.js';
import {
  ROOM_HEIGHT,
  MAP_SIZE,
  CAMERA_FOLLOW_LERP,
  REMOTE_PLAYER_SMOOTHING,
  WORLD_CONFIG,
  ROOM_LAYOUTS
} from './config.js';
import { getTerrainHeight, checkCollision, isLocalPlayerUnderRoof } from './physics.js';
import {
  initSceneryAssets,
  createBoulder,
  createPlayerAvatar,
  spawnNpcs,
  updateNpcs,
  createRoomIndicator,
  buildExteriorPlaza,
  buildRoomInteriorSet,
  registerStaticScenery,
  refreshStaticSceneryVisibility,
  createGrassTexture,
  createBrickTexture,
  createStoneTexture,
  createWoodTexture,
  createSignBoardTexture
} from './scenery.js';
import { syncPosition } from './multiplayer.js';
import {
  initDebugPanel,
  initSoundtrackUi,
  updateDebugPanel,
  setupRoomVideo,
  updateClassroomBoard,
  refreshRoomPlayersList,
  updateRoomPanelDetails,
  updateRoomIndicatorAnimations
} from './ui.js';
import { transformControlsMode } from './editor.js';

// Reusable scratch variables to cut allocations down to 0 per frame
const _oldPos = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _desiredCameraPos = new THREE.Vector3();
const _orbitOffset = new THREE.Vector3();
const _orbitSpherical = new THREE.Spherical();

export function frameIndependentLerp(current, target, dt, decay = 0.001) {
  const factor = 1 - Math.pow(decay, dt);
  return THREE.MathUtils.lerp(current, target, factor);
}

export function orbitCamera(deltaTheta, deltaPhi) {
  _orbitOffset.copy(state.camera.position).sub(state.controls.target);
  _orbitSpherical.setFromVector3(_orbitOffset);
  _orbitSpherical.theta += deltaTheta;
  _orbitSpherical.phi += deltaPhi;
  _orbitSpherical.phi = Math.max(
    state.controls.minPolarAngle,
    Math.min(state.controls.maxPolarAngle, _orbitSpherical.phi)
  );
  _orbitSpherical.makeSafe();
  _orbitOffset.setFromSpherical(_orbitSpherical);
  state.camera.position.copy(state.controls.target).add(_orbitOffset);
  state.camera.lookAt(state.controls.target);
}

export function animateAvatarWalk(playerObj, dt) {
  const isMoving = playerObj.isMoving;
  const leftLeg = playerObj.leftLeg;
  const rightLeg = playerObj.rightLeg;
  const leftArm = playerObj.leftArm;
  const rightArm = playerObj.rightArm;

  if (!leftLeg || !rightLeg) return;

  if (isMoving && playerObj.isGrounded) {
    const time = Date.now() * 0.012;
    const swingRange = 0.6;
    
    leftLeg.rotation.x = Math.sin(time) * swingRange;
    rightLeg.rotation.x = -Math.sin(time) * swingRange;
    
    if (leftArm && rightArm) {
      leftArm.rotation.x = -Math.sin(time) * swingRange;
      rightArm.rotation.x = Math.sin(time) * swingRange;
    }
  } else {
    const lerpSpeed = 10 * dt;
    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, lerpSpeed);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, lerpSpeed);
    
    if (leftArm && rightArm) {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, lerpSpeed);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, lerpSpeed);
    }
  }
  
  if (!playerObj.isGrounded && leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, -Math.PI / 3, 5 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, Math.PI / 3, 5 * dt);
  } else if (leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0, 10 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, 10 * dt);
  }
}

export function detectRoomEntry() {
  let activeRoomId = -1;

  for (const room of state.ROOMS) {
    const rx = room.x;
    const rz = room.z;
    const minX = rx - room.width / 2;
    const maxX = rx + room.width / 2;
    const minZ = rz - room.depth / 2;
    const maxZ = rz + room.depth / 2;

    if (state.localPlayer.x >= minX && state.localPlayer.x <= maxX &&
        state.localPlayer.z >= minZ && state.localPlayer.z <= maxZ) {
      activeRoomId = room.id;
      break;
    }
  }

  if (activeRoomId !== state.localPlayer.currentRoom) {
    state.localPlayer.currentRoom = activeRoomId;
    
    if (state.socket && state.socket.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({
        type: "room_change",
        room: activeRoomId
      }));
    }

    const locTag = document.getElementById('hud-location');
    const panel = document.getElementById('room-panel');
    
    if (activeRoomId === -1) {
      if (locTag) locTag.innerText = "Exploring Outdoors";
      if (panel) {
        panel.classList.remove('room-panel-visible');
        panel.setAttribute('aria-hidden', 'true');
      }
      if (state.ytPlayer && state.ytPlayer.pauseVideo) {
        try { state.ytPlayer.pauseVideo(); } catch (e) {}
      }
      state.activeRoomVideoId = "";
    } else {
      const room = state.ROOMS[activeRoomId];
      if (locTag) locTag.innerText = `In Room: ${room.name}`;
      
      updateRoomPanelDetails();
      if (panel) {
        panel.classList.add('room-panel-visible');
        panel.setAttribute('aria-hidden', 'false');
      }
      
      setupRoomVideo(activeRoomId);
      refreshRoomPlayersList();
    }
  }
}

// Teleport observer to bypass circular updates
window.addEventListener('room-marker-teleport', () => {
  detectRoomEntry();
  syncPosition();
});

export function updateLocalPlayer(dt) {
  if (!state.isJoined || !state.localPlayer.mesh) return;
  if (state.editor.enabled) {
    state.localPlayer.isMoving = false;
    state.localPlayer.velocity.x = 0;
    state.localPlayer.velocity.z = 0;
    animateAvatarWalk(state.localPlayer, dt);
    return;
  }

  const oldPos = _oldPos.copy(state.localPlayer.mesh.position);

  const acceleration = 55.0;
  const maxSpeed = 9.5;
  const drag = 8.5;
  const gravity = 25.0;
  const jumpForce = 10.0;
  
  const groundY = getTerrainHeight(state.localPlayer.x, state.localPlayer.z);
  
  if (!state.localPlayer.isGrounded) {
    state.localPlayer.velocity.y -= gravity * dt;
    state.localPlayer.y += state.localPlayer.velocity.y * dt;
    
    if (state.localPlayer.y <= groundY) {
      state.localPlayer.y = groundY;
      state.localPlayer.velocity.y = 0;
      state.localPlayer.isGrounded = true;
    }
  } else {
    state.localPlayer.y = groundY;
    
    if (state.keys.space) {
      state.localPlayer.velocity.y = jumpForce;
      state.localPlayer.isGrounded = false;
      state.keys.space = false;
    }
  }

  const moveDirection = _moveDir.set(0, 0, 0);

  if (state.keys.w) moveDirection.z -= 1;
  if (state.keys.s) moveDirection.z += 1;
  if (state.keys.a) moveDirection.x -= 1;
  if (state.keys.d) moveDirection.x += 1;
  
  moveDirection.normalize();

  state.localPlayer.velocity.x -= state.localPlayer.velocity.x * drag * dt;
  state.localPlayer.velocity.z -= state.localPlayer.velocity.z * drag * dt;

  if (moveDirection.lengthSq() > 0) {
    const camDirection = _camDir;
    state.camera.getWorldDirection(camDirection);
    camDirection.y = 0;
    camDirection.normalize();

    const camRight = _camRight;
    camRight.crossVectors(state.camera.up, camDirection).negate().normalize();

    const targetDirection = _targetDir.set(0, 0, 0)
      .addScaledVector(camDirection, -moveDirection.z)
      .addScaledVector(camRight, moveDirection.x)
      .normalize();

    state.localPlayer.velocity.x += targetDirection.x * acceleration * dt;
    state.localPlayer.velocity.z += targetDirection.z * acceleration * dt;
  }

  const speedXZ = Math.sqrt(state.localPlayer.velocity.x * state.localPlayer.velocity.x + state.localPlayer.velocity.z * state.localPlayer.velocity.z);
  if (speedXZ > maxSpeed) {
    state.localPlayer.velocity.x = (state.localPlayer.velocity.x / speedXZ) * maxSpeed;
    state.localPlayer.velocity.z = (state.localPlayer.velocity.z / speedXZ) * maxSpeed;
  }

  const stepX = state.localPlayer.velocity.x * dt;
  const stepZ = state.localPlayer.velocity.z * dt;

  if (Math.abs(stepX) > 0.0001 || Math.abs(stepZ) > 0.0001) {
    let nextX = state.localPlayer.x + stepX;
    let nextZ = state.localPlayer.z + stepZ;
    
    if (!checkCollision(nextX, nextZ)) {
      state.localPlayer.x = nextX;
      state.localPlayer.z = nextZ;
    } else {
      if (!checkCollision(nextX, state.localPlayer.z)) {
        state.localPlayer.x = nextX;
        state.localPlayer.velocity.z = 0;
      }
      else if (!checkCollision(state.localPlayer.x, nextZ)) {
        state.localPlayer.z = nextZ;
        state.localPlayer.velocity.x = 0;
      } else {
        state.localPlayer.velocity.x = 0;
        state.localPlayer.velocity.z = 0;
      }
    }
  }

  if (speedXZ > 0.4) {
    const targetAngle = Math.atan2(state.localPlayer.velocity.x, state.localPlayer.velocity.z);
    
    let diff = targetAngle - state.localPlayer.ry;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    state.localPlayer.ry += diff * 15.0 * dt;
    state.localPlayer.isMoving = true;
  } else {
    state.localPlayer.isMoving = false;
  }

  state.localPlayer.mesh.position.set(state.localPlayer.x, state.localPlayer.y, state.localPlayer.z);
  state.localPlayer.mesh.rotation.y = state.localPlayer.ry;
  
  const delta = _delta.subVectors(state.localPlayer.mesh.position, oldPos);
  _desiredCameraPos.copy(state.camera.position).add(delta);
  state.camera.position.lerp(_desiredCameraPos, CAMERA_FOLLOW_LERP);
  state.controls.target.x = frameIndependentLerp(state.controls.target.x, state.localPlayer.mesh.position.x, dt, 0.0009);
  state.controls.target.y = frameIndependentLerp(state.controls.target.y, state.localPlayer.mesh.position.y + 1.2, dt, 0.0009);
  state.controls.target.z = frameIndependentLerp(state.controls.target.z, state.localPlayer.mesh.position.z, dt, 0.0009);

  animateAvatarWalk(state.localPlayer, dt);
  detectRoomEntry();
  syncPosition();
}

export function animate() {
  const now = performance.now();
  const dt = Math.min((now - state.lastTime) / 1000, 0.1);
  state.lastTime = now;
  
  const rotateSpeed = 1.8 * dt;
  let deltaTheta = 0;
  let deltaPhi = 0;
  if (state.cameraKeys.ArrowLeft) deltaTheta -= rotateSpeed;
  if (state.cameraKeys.ArrowRight) deltaTheta += rotateSpeed;
  if (state.cameraKeys.ArrowUp) deltaPhi -= rotateSpeed;
  if (state.cameraKeys.ArrowDown) deltaPhi += rotateSpeed;
  if (deltaTheta !== 0 || deltaPhi !== 0) {
    orbitCamera(deltaTheta, deltaPhi);
  }
  
  const time = now * 0.005;
  state.torches.forEach((t) => {
    const flicker = Math.sin(time * 3 + t.seed) * Math.cos(time * 7 + t.seed) * 0.15;
    if (t.light) t.light.intensity = t.baseIntensity + flicker;
    t.flame.scale.set(
      1 + flicker * 0.1, 
      1 + Math.sin(time * 10 + t.seed) * 0.15, 
      1 + flicker * 0.1
    );
  });
  
  updateLocalPlayer(dt);
  updateNpcs(dt);
  
  state.remotePlayers.forEach((p) => {
    const lerpSpeed = 1 - Math.pow(REMOTE_PLAYER_SMOOTHING, dt);
    
    p.x = THREE.MathUtils.lerp(p.x, p.targetX, lerpSpeed);
    p.y = THREE.MathUtils.lerp(p.y, p.targetY, lerpSpeed);
    p.z = THREE.MathUtils.lerp(p.z, p.targetZ, lerpSpeed);
    
    let diff = p.targetRy - p.ry;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    p.ry += diff * lerpSpeed;
    
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = p.ry;
    
    animateAvatarWalk(p, dt);

    const horizontalDistance = state.camera.position.distanceTo(p.mesh.position);
    p.mesh.visible = horizontalDistance < 95;
    if (p.nameTag) {
      p.nameTag.visible = horizontalDistance < 42;
    }
  });

  updateRoomIndicatorAnimations(now);
  refreshStaticSceneryVisibility();
  
  const isInside = isLocalPlayerUnderRoof();
  const targetOpacity = isInside ? 0.0 : 1.0;
  
  if (state.ceilingMat) {
    state.ceilingMat.opacity = THREE.MathUtils.lerp(state.ceilingMat.opacity, targetOpacity, 8 * dt);
    state.ceilingMesh.visible = state.ceilingMat.opacity > 0.02;
  }
  
  if (state.upperWallMat) {
    state.upperWallMat.opacity = THREE.MathUtils.lerp(state.upperWallMat.opacity, targetOpacity, 8 * dt);
    
    if (state.signFrontMat) state.signFrontMat.opacity = state.upperWallMat.opacity;
    if (state.signSideMat) state.signSideMat.opacity = state.upperWallMat.opacity;
    
    state.upperWalls.forEach(w => {
      w.visible = state.upperWallMat.opacity > 0.02;
    });
  }

  updateClassroomBoard();

  if (state.sceneSunLight) {
    state.sceneSunLight.intensity = isInside ? 0.62 : 0.92;
  }
  if (state.sceneHemisphereLight) {
    state.sceneHemisphereLight.intensity = isInside ? 0.55 : 0.78;
  }

  state.controls.update();
  updateDebugPanel(now);

  state.renderer.render(state.scene, state.camera);
}

export function startAnimationLoop() {
  if (!state.renderer || state.animationLoopRunning) return;
  state.lastTime = performance.now();
  state.renderer.setAnimationLoop(animate);
  state.animationLoopRunning = true;
}

export function stopAnimationLoop() {
  if (!state.renderer || !state.animationLoopRunning) return;
  state.renderer.setAnimationLoop(null);
  state.animationLoopRunning = false;
}

export function onWindowResize() {
  state.camera.aspect = window.innerWidth / window.innerHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
}

// --- Initial Scene Setup ---
export function initEngine() {
  const container = document.getElementById('game-container');
  if (!container) return;

  // Initialize the player velocity vector (state.js leaves it null on purpose
  // so the data module stays free of THREE).
  state.localPlayer.velocity = new THREE.Vector3();

  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(WORLD_CONFIG.skyBottom);
  state.scene.fog = new THREE.FogExp2(WORLD_CONFIG.fogColor, 0.012);
  state.placedAssetGroup = new THREE.Group();
  state.scene.add(state.placedAssetGroup);
  
  state.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  state.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance'
  });
  state.renderer.setSize(window.innerWidth, window.innerHeight);
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFShadowMap;
  state.renderer.outputEncoding = THREE.sRGBEncoding;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.05;
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  container.appendChild(state.renderer.domElement);
  
  state.controls = new THREE.OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.08;
  state.controls.minDistance = 3;
  state.controls.maxDistance = 35;
  state.controls.maxPolarAngle = Math.PI / 2.1;

  if (window.THREE && THREE.TransformControls) {
    state.editor.transformControls = new THREE.TransformControls(state.camera, state.renderer.domElement);
    state.editor.transformControls.setMode(transformControlsMode(state.editor.mode));
    state.editor.transformControls.visible = false;
    state.editor.transformControls.addEventListener('dragging-changed', (event) => {
      state.editor.transformDragging = Boolean(event.value);
      state.controls.enabled = !state.editor.transformDragging;
    });
    state.editor.transformControls.addEventListener('objectChange', () => {
      syncSelectedAssetFromObject();
    });
    state.scene.add(state.editor.transformControls);
  }
  
  state.sceneAmbientLight = new THREE.AmbientLight('#cbd5e1', 0.32);
  state.scene.add(state.sceneAmbientLight);

  state.sceneHemisphereLight = new THREE.HemisphereLight('#93c5fd', '#020617', 0.78);
  state.sceneHemisphereLight.position.set(0, 40, 0);
  state.scene.add(state.sceneHemisphereLight);
  
  state.sceneSunLight = new THREE.DirectionalLight('#dbeafe', 0.92);
  state.sceneSunLight.position.set(40, 60, 20);
  state.sceneSunLight.castShadow = true;
  state.sceneSunLight.shadow.mapSize.width = 1024;
  state.sceneSunLight.shadow.mapSize.height = 1024;
  state.sceneSunLight.shadow.camera.near = 0.5;
  state.sceneSunLight.shadow.camera.far = 150;
  
  const d = 60;
  state.sceneSunLight.shadow.camera.left = -d;
  state.sceneSunLight.shadow.camera.right = d;
  state.sceneSunLight.shadow.camera.top = d;
  state.sceneSunLight.shadow.camera.bottom = -d;
  state.sceneSunLight.shadow.bias = -0.0005;
  state.scene.add(state.sceneSunLight);

  state.skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(WORLD_CONFIG.skyTop) },
        bottomColor: { value: new THREE.Color(WORLD_CONFIG.skyBottom) },
        offset: { value: 18 },
        exponent: { value: 0.9 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `
    })
  );
  state.scene.add(state.skyDome);
  
  buildMap();
  refreshStaticSceneryVisibility();
  
  // Custom event trigger for syncRoomVisuals
  const event = new CustomEvent('room-marker-teleport');
  window.dispatchEvent(event);
  
  spawnNpcs();
  
  window.addEventListener('resize', onWindowResize);
  const loading = document.getElementById('loading-screen');
  if (loading) loading.classList.remove('active');
}

export function buildMap() {
  const grassTex = createGrassTexture();
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 60, 60);
  
  const positions = groundGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const vx = positions.getX(i);
    const vy = positions.getY(i);
    const height = getTerrainHeight(vx, -vy);
    positions.setZ(i, height);
  }
  groundGeo.computeVertexNormals();

  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  state.scene.add(ground);
  
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#372d20', roughness: 0.9 });
  const fenceGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3);
  const railGeo = new THREE.BoxGeometry(0.15, 0.2, 5.2);
  
  let postCount = 0;
  let railCount = 0;
  const limit = MAP_SIZE / 2 - 1.5;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    for (let offset = -limit; offset <= limit; offset += 5) {
      postCount++;
      if (offset < limit) {
        railCount += 2;
      }
    }
  }
  
  const postInstances = new THREE.InstancedMesh(fenceGeo, fenceMat, postCount);
  const railInstances = new THREE.InstancedMesh(railGeo, fenceMat, railCount);
  postInstances.castShadow = false;
  railInstances.castShadow = false;
  
  const tempObj = new THREE.Object3D();
  let postIdx = 0;
  let railIdx = 0;
  
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    const isHorizontal = angle === 0 || angle === Math.PI;
    
    for (let offset = -limit; offset <= limit; offset += 5) {
      const x = isHorizontal ? (angle === 0 ? limit : -limit) : offset;
      const z = isHorizontal ? offset : (angle === Math.PI / 2 ? limit : -limit);
      const groundY = getTerrainHeight(x, z);

      tempObj.position.set(x, groundY + 0.6, z);
      tempObj.rotation.set(0, 0, 0);
      tempObj.scale.set(1, 1, 1);
      tempObj.updateMatrix();
      postInstances.setMatrixAt(postIdx++, tempObj.matrix);
      
      if (offset < limit) {
        const railX = isHorizontal ? x : offset + 2.5;
        const railZ = isHorizontal ? offset + 2.5 : z;
        const railY = getTerrainHeight(railX, railZ);

        tempObj.position.set(railX, railY + 0.9, railZ);
        tempObj.rotation.set(0, isHorizontal ? Math.PI / 2 : 0, 0);
        tempObj.scale.set(1, 1, 1);
        tempObj.updateMatrix();
        railInstances.setMatrixAt(railIdx++, tempObj.matrix);
        
        tempObj.position.set(railX, railY + 0.4, railZ);
        tempObj.rotation.set(0, isHorizontal ? Math.PI / 2 : 0, 0);
        tempObj.scale.set(1, 1, 1);
        tempObj.updateMatrix();
        railInstances.setMatrixAt(railIdx++, tempObj.matrix);
      }
    }
  }
  state.scene.add(postInstances);
  state.scene.add(railInstances);

  initSceneryAssets();

  const trunkInstances = new THREE.InstancedMesh(state.sharedScenery.treeTrunkGeo, state.sharedScenery.treeTrunkMat, 35);
  const cone1Instances = new THREE.InstancedMesh(state.sharedScenery.treeCone1Geo, state.sharedScenery.treeFoliageMat, 35);
  const cone2Instances = new THREE.InstancedMesh(state.sharedScenery.treeCone2Geo, state.sharedScenery.treeFoliageMat, 35);
  
  trunkInstances.castShadow = true;
  trunkInstances.receiveShadow = true;
  cone1Instances.castShadow = true;
  cone2Instances.castShadow = true;

  for (let i = 0; i < 35; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * (MAP_SIZE - 15);
      z = (Math.random() - 0.5) * (MAP_SIZE - 15);
    } while (Math.abs(x) < 32 && Math.abs(z) < 44);
    
    const groundY = getTerrainHeight(x, z);
    const scale = 0.85 + Math.random() * 0.45;
    
    tempObj.position.set(x, groundY + 2 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    trunkInstances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 4.2 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    cone1Instances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 5.6 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    cone2Instances.setMatrixAt(i, tempObj.matrix);
  }
  state.scene.add(trunkInstances);
  state.scene.add(cone1Instances);
  state.scene.add(cone2Instances);

  for (let i = 0; i < 15; i++) {
    createBoulder();
  }

  const flowerColors = ['#f43f5e', '#eab308', '#3b82f6', '#a855f7'];
  const stemInstances = new THREE.InstancedMesh(state.sharedScenery.flowerStemGeo, state.sharedScenery.flowerStemMat, 40);
  const leafInstances = new THREE.InstancedMesh(state.sharedScenery.flowerLeafGeo, state.sharedScenery.flowerStemMat, 40);
  const centerInstances = new THREE.InstancedMesh(state.sharedScenery.flowerCenterGeo, state.sharedScenery.flowerCenterMat, 40);
  
  stemInstances.castShadow = true;
  leafInstances.castShadow = true;
  centerInstances.castShadow = true;

  for (let i = 0; i < 40; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * (MAP_SIZE - 20);
      z = (Math.random() - 0.5) * (MAP_SIZE - 20);
    } while (Math.abs(x) < 32 && Math.abs(z) < 44);
    
    const groundY = getTerrainHeight(x, z);
    const scale = 0.8 + Math.random() * 0.4;
    
    tempObj.position.set(x, groundY + 0.25 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    stemInstances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 0.15 * scale, z + 0.08 * scale);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    leafInstances.setMatrixAt(i, tempObj.matrix);
    
    tempObj.position.set(x, groundY + 0.5 * scale, z);
    tempObj.scale.set(scale, scale, scale);
    tempObj.rotation.set(0, 0, 0);
    tempObj.updateMatrix();
    centerInstances.setMatrixAt(i, tempObj.matrix);
    
    const randomColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
    centerInstances.setColorAt(i, new THREE.Color(randomColor));
  }
  state.scene.add(stemInstances);
  state.scene.add(leafInstances);
  state.scene.add(centerInstances);

  const grassInstances = new THREE.InstancedMesh(state.sharedScenery.grassBladeGeo, state.sharedScenery.grassTuftMat, 180);
  grassInstances.castShadow = true;
  let bladeIdx = 0;
  for (let i = 0; i < 60; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * (MAP_SIZE - 20);
      z = (Math.random() - 0.5) * (MAP_SIZE - 20);
    } while (Math.abs(x) < 32 && Math.abs(z) < 44);
    
    const groundY = getTerrainHeight(x, z);
    
    for (let j = 0; j < 3; j++) {
      const rotZ = (Math.random() - 0.5) * 0.4;
      const rotX = (Math.random() - 0.5) * 0.4;
      const rotY = Math.random() * Math.PI * 2;
      const scaleY = 0.8 + Math.random() * 0.4;
      
      tempObj.position.set(x, groundY, z);
      tempObj.rotation.set(rotX, rotY, rotZ);
      tempObj.scale.set(1, scaleY, 1);
      tempObj.updateMatrix();
      grassInstances.setMatrixAt(bladeIdx++, tempObj.matrix);
    }
  }
  state.scene.add(grassInstances);

  buildExteriorPlaza();
  buildBuilding();
}

function syncSelectedAssetFromObject() {
  const customEvent = new CustomEvent('sync-selected-asset-object');
  window.dispatchEvent(customEvent);
}

export function buildBuilding() {
  const stoneTex = createStoneTexture();
  const brickTex = createBrickTexture();
  const woodTex = createWoodTexture();
  
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  state.upperWallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85, transparent: true, opacity: 1.0 });
  
  const woodFloorMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.75 });
  const stoneFloorMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.2, emissive: '#020617', emissiveIntensity: 0.2 });

  state.ROOMS.forEach((room) => {
    const isWood = room.id % 2 === 0;
    const mat = isWood ? woodFloorMat : stoneFloorMat;
    const roomFloorGeo = new THREE.PlaneGeometry(room.width, room.depth);
    const roomFloor = new THREE.Mesh(roomFloorGeo, mat);
    roomFloor.rotation.x = -Math.PI / 2;
    roomFloor.position.set(room.x, 0.01, room.z);
    roomFloor.receiveShadow = true;
    state.scene.add(roomFloor);

    buildRoomInteriorSet(room);
  });

  const lobbyFloorGeo = new THREE.PlaneGeometry(10, 80);
  const lobbyFloor = new THREE.Mesh(lobbyFloorGeo, stoneFloorMat);
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.position.set(0, 0.015, 0);
  lobbyFloor.receiveShadow = true;
  state.scene.add(lobbyFloor);

  function addWallSegment(xStart, zStart, xEnd, zEnd, height = ROOM_HEIGHT) {
    const dx = xEnd - xStart;
    const dz = zEnd - zStart;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return;
    const angle = Math.atan2(dz, dx);
    
    const thickness = 0.5;
    const lowerHeight = 3.5;
    const upperHeight = height - lowerHeight;
    
    const lowerGeo = new THREE.BoxGeometry(len, lowerHeight, thickness);
    const lowerWall = new THREE.Mesh(lowerGeo, wallMat);
    lowerWall.position.set((xStart + xEnd) / 2, lowerHeight / 2, (zStart + zEnd) / 2);
    lowerWall.rotation.y = -angle;
    lowerWall.castShadow = true;
    lowerWall.receiveShadow = true;
    state.scene.add(lowerWall);
    
    if (upperHeight > 0.05) {
      const upperGeo = new THREE.BoxGeometry(len, upperHeight, thickness);
      const upperWall = new THREE.Mesh(upperGeo, state.upperWallMat);
      upperWall.position.set((xStart + xEnd) / 2, lowerHeight + upperHeight / 2, (zStart + zEnd) / 2);
      upperWall.rotation.y = -angle;
      upperWall.castShadow = true;
      upperWall.receiveShadow = true;
      state.scene.add(upperWall);
      state.upperWalls.push(upperWall);
    }
    
    const baseboardHeight = 0.35;
    const baseboardThickness = 0.08;
    const baseboardGeo = new THREE.BoxGeometry(len, baseboardHeight, baseboardThickness);
    const baseboardMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9 });
    
    const baseboard1 = new THREE.Mesh(baseboardGeo, baseboardMat);
    baseboard1.position.set(0, -lowerHeight / 2 + baseboardHeight / 2, thickness / 2 + baseboardThickness / 2);
    baseboard1.castShadow = true;
    baseboard1.receiveShadow = true;
    lowerWall.add(baseboard1);
    
    const baseboard2 = new THREE.Mesh(baseboardGeo, baseboardMat);
    baseboard2.position.set(0, -lowerHeight / 2 + baseboardHeight / 2, -thickness / 2 - baseboardThickness / 2);
    baseboard2.castShadow = true;
    baseboard2.receiveShadow = true;
    lowerWall.add(baseboard2);

    const pad = 0.35;
    state.WALLS.push({
      minX: Math.min(xStart, xEnd) - (dz === 0 ? 0 : pad) - (dx === 0 ? thickness/2 + pad : 0),
      maxX: Math.max(xStart, xEnd) + (dz === 0 ? 0 : pad) + (dx === 0 ? thickness/2 + pad : 0),
      minZ: Math.min(zStart, zEnd) - (dx === 0 ? 0 : pad) - (dz === 0 ? thickness/2 + pad : 0),
      maxZ: Math.max(zStart, zEnd) + (dx === 0 ? 0 : pad) + (dz === 0 ? thickness/2 + pad : 0),
    });
  }

  state.ROOMS.forEach((room) => {
    const xMin = room.x - room.width / 2;
    const xMax = room.x + room.width / 2;
    const zMin = room.z - room.depth / 2;
    const zMax = room.z + room.depth / 2;

    if (room.x < 0) {
      addWallSegment(xMin, zMin, xMin, zMax);
    } else {
      addWallSegment(xMax, zMin, xMax, zMax);
    }

    addWallSegment(xMin, zMin, xMax, zMin);
    addWallSegment(xMin, zMax, xMax, zMax);

    const corridorX = room.x < 0 ? -5 : 5;
    addWallSegment(corridorX, zMin, corridorX, room.z - 2);
    addWallSegment(corridorX, room.z + 2, corridorX, zMax);
  });

  addWallSegment(-5, -20, -5, -18);
  addWallSegment(-5, -2, -5, 2);
  addWallSegment(-5, 14, -5, 18);
  addWallSegment(-5, 34, -5, 40);

  addWallSegment(5, -40, 5, -38);
  addWallSegment(5, -22, 5, -18);
  addWallSegment(5, -6, 5, -2);
  addWallSegment(5, 18, 5, 20);
  addWallSegment(5, 36, 5, 40);

  addWallSegment(-5, -40, 5, -40);
  addWallSegment(-5, 40, -2, 40);
  addWallSegment(2, 40, 5, 40);

  state.ROOMS.forEach((room) => {
    const corridorX = room.x < 0 ? -5 : 5;
    createDoorFrame(corridorX, room.z, 'V', 4);
  });

  createDoorFrame(0, 40, 'H', 4);

  const colsZ = [-35, -25, -15, -5, 5, 15, 25, 35];
  const columnColor = '#f1f5f9';
  const columnMat = new THREE.MeshStandardMaterial({
    color: columnColor,
    roughness: 0.6,
    metalness: 0.1
  });

  const columnHeight = ROOM_HEIGHT;
  const shaftHeight = columnHeight - 0.6;
  const echinusHeight = 0.3;
  const abacusHeight = 0.3;

  const shaftGeo = new THREE.CylinderGeometry(0.3, 0.38, shaftHeight, 16);
  const echinusGeo = new THREE.CylinderGeometry(0.5, 0.3, echinusHeight, 16);
  const abacusGeo = new THREE.BoxGeometry(1.1, abacusHeight, 1.1);

  const columnPositions = [];
  colsZ.forEach(cz => columnPositions.push({ x: -4.2, z: cz }));
  colsZ.forEach(cz => columnPositions.push({ x: 4.2, z: cz }));
  columnPositions.push({ x: -3.5, z: 40.8 });
  columnPositions.push({ x: -1.5, z: 40.8 });
  columnPositions.push({ x: 1.5, z: 40.8 });
  columnPositions.push({ x: 3.5, z: 40.8 });

  const totalColumns = columnPositions.length;

  const shaftInstances = new THREE.InstancedMesh(shaftGeo, columnMat, totalColumns);
  const echinusInstances = new THREE.InstancedMesh(echinusGeo, columnMat, totalColumns);
  const abacusInstances = new THREE.InstancedMesh(abacusGeo, columnMat, totalColumns);

  shaftInstances.castShadow = true;
  shaftInstances.receiveShadow = true;
  echinusInstances.castShadow = true;
  echinusInstances.receiveShadow = true;
  abacusInstances.castShadow = true;
  abacusInstances.receiveShadow = true;

  const tempObj = new THREE.Object3D();

  for (let i = 0; i < totalColumns; i++) {
    const pos = columnPositions[i];
    
    tempObj.position.set(pos.x, shaftHeight / 2, pos.z);
    tempObj.updateMatrix();
    shaftInstances.setMatrixAt(i, tempObj.matrix);

    tempObj.position.set(pos.x, shaftHeight + echinusHeight / 2, pos.z);
    tempObj.updateMatrix();
    echinusInstances.setMatrixAt(i, tempObj.matrix);

    tempObj.position.set(pos.x, shaftHeight + echinusHeight + abacusHeight / 2, pos.z);
    tempObj.updateMatrix();
    abacusInstances.setMatrixAt(i, tempObj.matrix);
  }

  state.scene.add(shaftInstances);
  state.scene.add(echinusInstances);
  state.scene.add(abacusInstances);

  state.ROOMS.forEach((room) => {
    const layout = ROOM_LAYOUTS[room.id] || { themeColor: WORLD_CONFIG.signAccent };
    const screenGroup = new THREE.Group();
    
    const outerGeo = new THREE.BoxGeometry(7, 4, 0.2);
    const outerFrame = new THREE.Mesh(outerGeo, frameMat);
    outerFrame.castShadow = true;
    screenGroup.add(outerFrame);
    
    const innerGeo = new THREE.BoxGeometry(6.6, 3.6, 0.05);
    const innerScreen = new THREE.Mesh(innerGeo, screenMat);
    innerScreen.position.z = 0.1;
    innerScreen.userData = { roomId: room.id };
    state.clickableScreens.push(innerScreen);
    screenGroup.add(innerScreen);

    const borderMat = new THREE.MeshBasicMaterial({ color: layout.themeColor, wireframe: true });
    const screenBorder = new THREE.Mesh(innerGeo, borderMat);
    screenBorder.position.z = 0.11;
    screenBorder.scale.set(1.02, 1.02, 1.02);
    screenGroup.add(screenBorder);
    
    if (room.x < 0) {
      const xPos = room.x - room.width / 2 + 0.15;
      screenGroup.position.set(xPos, 3.5, room.z);
      screenGroup.rotation.y = Math.PI / 2;
      state.scene.add(screenGroup);
      
      createWallTorch(room.x - room.width / 2 + 0.25, 2.5, room.z - 4, Math.PI / 2, room.id, true);
      createWallTorch(room.x - room.width / 2 + 0.25, 2.5, room.z + 4, Math.PI / 2, room.id, false);
    } else {
      const xPos = room.x + room.width / 2 - 0.15;
      screenGroup.position.set(xPos, 3.5, room.z);
      screenGroup.rotation.y = -Math.PI / 2;
      state.scene.add(screenGroup);
      
      createWallTorch(room.x + room.width / 2 - 0.25, 2.5, room.z - 4, -Math.PI / 2, room.id, true);
      createWallTorch(room.x + room.width / 2 - 0.25, 2.5, room.z + 4, -Math.PI / 2, room.id, false);
    }
    
    createRoomIndicator(room);
  });

  state.ceilingMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.9, transparent: true, opacity: 1.0 });
  const ceilingGeo = new THREE.BoxGeometry(60, 0.2, 80);
  state.ceilingMesh = new THREE.Mesh(ceilingGeo, state.ceilingMat);
  state.ceilingMesh.position.set(0, ROOM_HEIGHT + 0.1, 0);
  state.ceilingMesh.castShadow = true;
  state.ceilingMesh.receiveShadow = true;
  state.scene.add(state.ceilingMesh);

  buildClassroomAssets();

  const signTex = createSignBoardTexture();
  state.signFrontMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6, transparent: true, opacity: 1.0 });
  state.signSideMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8, transparent: true, opacity: 1.0 });
  
  const signMaterials = [state.signSideMat, state.signSideMat, state.signSideMat, state.signSideMat, state.signFrontMat, state.signSideMat];
  const signGeo = new THREE.BoxGeometry(10.5, 1.4, 0.1);
  const signMesh = new THREE.Mesh(signGeo, signMaterials);
  
  signMesh.position.set(0, 4.4, 40.3);
  signMesh.castShadow = true;
  signMesh.receiveShadow = true;
  state.scene.add(signMesh);
  state.upperWalls.push(signMesh);
}

export function createDoorFrame(cx, cz, dir, width) {
  const frameMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#2d1e18', roughness: 0.95 });
  
  const postHeight = 3.0;
  const postWidth = 0.45;
  const postDepth = 0.65;
  
  const group = new THREE.Group();
  
  if (dir === 'H') {
    const post1Geo = new THREE.BoxGeometry(postWidth, postHeight, postDepth);
    const post1 = new THREE.Mesh(post1Geo, frameMat);
    post1.position.set(-width/2, postHeight/2, 0);
    post1.castShadow = true;
    post1.receiveShadow = true;
    group.add(post1);
    
    const post2Geo = new THREE.BoxGeometry(postWidth, postHeight, postDepth);
    const post2 = new THREE.Mesh(post2Geo, frameMat);
    post2.position.set(width/2, postHeight/2, 0);
    post2.castShadow = true;
    post2.receiveShadow = true;
    group.add(post2);
    
    const lintelLen = width + postWidth;
    const lintelHeight = 0.45;
    const lintelGeo = new THREE.BoxGeometry(lintelLen, lintelHeight, postDepth + 0.05);
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, postHeight + lintelHeight/2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);
    
    const braceGeo = new THREE.BoxGeometry(0.2, 0.8, postDepth - 0.05);
    braceGeo.rotateZ(Math.PI / 4);
    
    const braceLeft = new THREE.Mesh(braceGeo, trimMat);
    braceLeft.position.set(-width/2 + 0.4, postHeight - 0.35, 0);
    braceLeft.castShadow = true;
    group.add(braceLeft);
    
    const braceRight = new THREE.Mesh(braceGeo, trimMat);
    braceRight.position.set(width/2 - 0.4, postHeight - 0.35, 0);
    braceRight.castShadow = true;
    group.add(braceRight);
    
  } else {
    const post1Geo = new THREE.BoxGeometry(postDepth, postHeight, postWidth);
    const post1 = new THREE.Mesh(post1Geo, frameMat);
    post1.position.set(0, postHeight/2, -width/2);
    post1.castShadow = true;
    post1.receiveShadow = true;
    group.add(post1);
    
    const post2Geo = new THREE.BoxGeometry(postDepth, postHeight, postWidth);
    const post2 = new THREE.Mesh(post2Geo, frameMat);
    post2.position.set(0, postHeight/2, width/2);
    post2.castShadow = true;
    post2.receiveShadow = true;
    group.add(post2);
    
    const lintelLen = width + postWidth;
    const lintelHeight = 0.45;
    const lintelGeo = new THREE.BoxGeometry(postDepth + 0.05, lintelHeight, lintelLen);
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(0, postHeight + lintelHeight/2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    group.add(lintel);
    
    const braceGeo = new THREE.BoxGeometry(postDepth - 0.05, 0.8, 0.2);
    braceGeo.rotateX(Math.PI / 4);
    
    const braceNorth = new THREE.Mesh(braceGeo, trimMat);
    braceNorth.position.set(0, postHeight - 0.35, -width/2 + 0.4);
    braceNorth.castShadow = true;
    group.add(braceNorth);
    
    const braceSouth = new THREE.Mesh(braceGeo, trimMat);
    braceSouth.position.set(0, postHeight - 0.35, width/2 - 0.4);
    braceSouth.castShadow = true;
    group.add(braceSouth);
  }
  
  group.position.set(cx, 0, cz);
  state.scene.add(group);
}

export function buildClassroomAssets() {
  const woodMat = new THREE.MeshStandardMaterial({ color: '#854d0e', roughness: 0.85 });
  const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });
  
  const classroomGroup = new THREE.Group();
  
  function createDesk(dx, dz) {
    const desk = new THREE.Group();
    const topGeo = new THREE.BoxGeometry(1.2, 0.1, 3.5);
    const top = new THREE.Mesh(topGeo, woodMat);
    top.position.y = 1.0;
    top.castShadow = true;
    top.receiveShadow = true;
    desk.add(top);
    
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.0, 4);
    const legOffsets = [
      { x: -0.5, z: -1.6 },
      { x: 0.5, z: -1.6 },
      { x: -0.5, z: 1.6 },
      { x: 0.5, z: 1.6 }
    ];
    legOffsets.forEach(offset => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offset.x, 0.5, offset.z);
      leg.castShadow = true;
      desk.add(leg);
    });
    
    desk.position.set(dx, 0, dz);
    classroomGroup.add(desk);
  }
  
  function createBench(bx, bz) {
    const bench = new THREE.Group();
    const seatGeo = new THREE.BoxGeometry(0.5, 0.08, 3.0);
    const seat = new THREE.Mesh(seatGeo, woodMat);
    seat.position.y = 0.6;
    seat.castShadow = true;
    seat.receiveShadow = true;
    bench.add(seat);
    
    const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 4);
    const legOffsets = [
      { x: -0.2, z: -1.4 },
      { x: 0.2, z: -1.4 },
      { x: -0.2, z: 1.4 },
      { x: 0.2, z: 1.4 }
    ];
    legOffsets.forEach(offset => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(offset.x, 0.3, offset.z);
      leg.castShadow = true;
      bench.add(leg);
    });
    
    bench.position.set(bx, 0, bz);
    classroomGroup.add(bench);
  }
  
  const cols = [-5, 0, 5];
  const rows = [-6, -1, 4];
  
  rows.forEach(dx => {
    cols.forEach(dz => {
      createDesk(dx, dz);
      createBench(dx - 1.0, dz);
    });
  });
  
  const podiumGroup = new THREE.Group();
  const podiumGeo = new THREE.BoxGeometry(1.2, 1.2, 2.2);
  const podium = new THREE.Mesh(podiumGeo, woodMat);
  podium.position.y = 0.6;
  podium.castShadow = true;
  podium.receiveShadow = true;
  podiumGroup.add(podium);
  
  const topGeo = new THREE.BoxGeometry(0.8, 0.1, 1.8);
  topGeo.rotateZ(Math.PI / 8);
  const top = new THREE.Mesh(topGeo, woodMat);
  top.position.set(-0.1, 1.25, 0);
  podiumGroup.add(top);
  
  podiumGroup.position.set(8.5, 0, 0);
  classroomGroup.add(podiumGroup);
  
  classroomGroup.position.set(17, 0, 8);
  registerStaticScenery(classroomGroup, { kind: 'room', roomId: 6 });
  state.scene.add(classroomGroup);
}

export function createWallTorch(x, y, z, rotationY, roomId = null, withLight = true) {
  initSceneryAssets();
  const torchGroup = new THREE.Group();

  const bracket = new THREE.Mesh(state.sharedScenery.torchBracketGeo, state.sharedScenery.torchMetalMat);
  bracket.position.set(0, 0, -0.15);
  torchGroup.add(bracket);

  const stick = new THREE.Mesh(state.sharedScenery.torchStickGeo, state.sharedScenery.torchWoodMat);
  stick.position.set(0, 0.1, -0.05);
  torchGroup.add(stick);

  const flame = new THREE.Mesh(state.sharedScenery.torchFlameGeo, state.sharedScenery.torchFlameMat);
  flame.position.set(0, 0.55, 0.1);
  torchGroup.add(flame);

  const particle = new THREE.Mesh(state.sharedScenery.torchParticleGeo, state.sharedScenery.torchParticleMat);
  particle.position.set(0, 0.65, 0.1);
  torchGroup.add(particle);

  let light = null;
  if (withLight) {
    light = new THREE.PointLight('#f97316', 1.1, 11);
    light.position.set(0, 0.7, 0.15);
    light.castShadow = false;
    torchGroup.add(light);
  }

  torchGroup.position.set(x, y, z);
  torchGroup.rotation.y = rotationY;

  if (roomId !== null) {
    registerStaticScenery(torchGroup, { kind: 'room', roomId });
  }
  state.scene.add(torchGroup);

  state.torches.push({
    light,
    flame,
    baseIntensity: light ? light.intensity : 0,
    seed: Math.random() * 100
  });
}
