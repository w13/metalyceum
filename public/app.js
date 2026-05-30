// Metalyceum Client App

// --- Configuration Constants ---
const ROOM_WIDTH = 20;
const ROOM_DEPTH = 20;
const ROOM_HEIGHT = 10;
const MAP_SIZE = 150; // Size of the grassy area

// Define the 8 rooms layout
const ROOMS = [
  { id: 0, name: "The Tech Nexus", x: -30, z: -10, video: "" },
  { id: 1, name: "Dev Sandbox", x: -10, z: -10, video: "" },
  { id: 2, name: "Creative Studio", x: 10, z: -10, video: "" },
  { id: 3, name: "Synthesized Beats", x: 30, z: -10, video: "" },
  { id: 4, name: "Rune Tavern", x: -30, z: 10, video: "" },
  { id: 5, name: "Lofi Library", x: -10, z: 10, video: "" },
  { id: 6, name: "The Keynote Stage", x: 10, z: 10, video: "" },
  { id: 7, name: "Retro Gaming Lounge", x: 30, z: 10, video: "" }
];

// Room walls definitions for collision checking
// We will generate the walls mathematically based on the room layout.
const WALLS = [];

// --- Game State Variables ---
let scene, camera, renderer, controls;
let localPlayer = {
  mesh: null,
  body: null,
  leftLeg: null, rightLeg: null,
  leftArm: null, rightArm: null,
  username: "Guest",
  avatarType: "knight",
  color: "#3b82f6",
  x: 0, y: 0, z: 25, // Start outside the building
  ry: 0,
  isMoving: false,
  velocity: new THREE.Vector3(),
  isGrounded: true,
  currentRoom: -1
};

const remotePlayers = new Map(); // id -> player object
let socket = null;
let ytPlayer = null;
let ytApiReady = false;
let activeRoomVideoId = "";
let lastSentPosition = { x: 0, y: 0, z: 0, ry: 0, isMoving: false };

// Input states
const keys = { w: false, a: false, s: false, d: false, space: false };
let isJoined = false;

// Torch list for flickering animation
const torches = [];

// --- Procedural Texture Generators ---
function createGrassTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base green
  ctx.fillStyle = '#2d5a27';
  ctx.fillRect(0, 0, 256, 256);
  
  // Noise & Grass details
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 2 + Math.random() * 6;
    const colorVal = 60 + Math.floor(Math.random() * 40);
    ctx.strokeStyle = `rgb(${colorVal - 20}, ${colorVal + 30}, ${colorVal - 30})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - len);
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  return texture;
}

function createStoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base grey
  ctx.fillStyle = '#4b5563';
  ctx.fillRect(0, 0, 256, 256);
  
  // Grid lines (Tile borders)
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i <= 256; i += 64) {
    ctx.moveTo(i, 0); ctx.lineTo(i, 256);
    ctx.moveTo(0, i); ctx.lineTo(256, i);
  }
  ctx.stroke();
  
  // Texture noise
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const grey = 80 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(${grey}, ${grey}, ${grey}, 0.15)`;
    ctx.fillRect(x, y, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 4);
  return texture;
}

function createBrickTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Base red-brown brick
  ctx.fillStyle = '#5c504a';
  ctx.fillRect(0, 0, 256, 256);
  
  // Mortar lines
  ctx.strokeStyle = '#2d2724';
  ctx.lineWidth = 3;
  ctx.beginPath();
  
  // Horizontal lines
  for (let y = 0; y <= 256; y += 32) {
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
  }
  
  // Vertical staggered lines
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const offset = (row % 2) * 32;
    for (let x = offset; x <= 256 + 32; x += 64) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 32);
    }
  }
  ctx.stroke();
  
  // Brick surface weathering
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const noise = Math.random() > 0.5 ? 20 : -20;
    ctx.fillStyle = `rgba(${92 + noise}, ${80 + noise}, ${74 + noise}, 0.12)`;
    ctx.fillRect(x, y, 3 + Math.random() * 6, 2 + Math.random() * 4);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 2);
  return texture;
}

// --- Dynamic Text Sprites for Player Names ---
function createPlayerNameSprite(name, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
  // Round rect
  const r = 8;
  const x = 8, y = 8, w = 240, h = 48;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  
  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Text
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(3, 0.75, 1);
  return sprite;
}

// --- Initial Scene Setup ---
function initEngine() {
  const container = document.getElementById('game-container');
  
  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#080b11');
  scene.fog = new THREE.FogExp2('#080b11', 0.015);
  
  // 2. Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  
  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  
  // 4. Controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 35;
  controls.maxPolarAngle = Math.PI / 2.1; // Don't clip below ground
  
  // 5. Lights
  const ambientLight = new THREE.AmbientLight('#ffffff', 0.45);
  scene.add(ambientLight);
  
  const sunLight = new THREE.DirectionalLight('#e0f2fe', 0.7);
  sunLight.position.set(40, 60, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 150;
  
  const d = 60;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  
  // Build the static map elements
  buildMap();
  
  // Event listeners
  window.addEventListener('resize', onWindowResize);
  document.getElementById('loading-screen').classList.remove('active');
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Environment & Building Construction ---
function buildMap() {
  // 1. Grassy Ground Plane
  const grassTex = createGrassTexture();
  const groundGeo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE);
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // 2. Fences / Map Boundary
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#372d20', roughness: 0.9 });
  const fenceGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3);
  const railGeo = new THREE.BoxGeometry(0.15, 0.2, 5.2);
  
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
    // Generate square borders
    const isHorizontal = angle === 0 || angle === Math.PI;
    const limit = MAP_SIZE / 2 - 1.5;
    
    for (let offset = -limit; offset <= limit; offset += 5) {
      // Posts
      const post = new THREE.Mesh(fenceGeo, fenceMat);
      const x = isHorizontal ? (angle === 0 ? limit : -limit) : offset;
      const z = isHorizontal ? offset : (angle === Math.PI / 2 ? limit : -limit);
      post.position.set(x, 0.6, z);
      post.castShadow = true;
      scene.add(post);
      
      // Rails (connect to next post)
      if (offset < limit) {
        const railUpper = new THREE.Mesh(railGeo, fenceMat);
        const railLower = new THREE.Mesh(railGeo, fenceMat);
        
        railUpper.position.set(
          isHorizontal ? x : offset + 2.5,
          0.9,
          isHorizontal ? offset + 2.5 : z
        );
        railLower.position.set(
          isHorizontal ? x : offset + 2.5,
          0.4,
          isHorizontal ? offset + 2.5 : z
        );
        
        if (isHorizontal) {
          railUpper.rotation.y = Math.PI / 2;
          railLower.rotation.y = Math.PI / 2;
        }
        
        railUpper.castShadow = true;
        railLower.castShadow = true;
        scene.add(railUpper);
        scene.add(railLower);
      }
    }
  }

  // 3. Low-Poly Trees
  for (let i = 0; i < 30; i++) {
    createTree();
  }

  // 4. The Metalyceum Building (4x2 rooms grid)
  buildBuilding();
}

function createTree() {
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: '#1e3f20', roughness: 0.8, flatShading: true });
  
  const tree = new THREE.Group();
  
  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 5);
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  tree.add(trunk);
  
  // Foliage (layers of cones)
  const coneGeo1 = new THREE.ConeGeometry(2.2, 2.5, 5);
  const cone1 = new THREE.Mesh(coneGeo1, foliageMat);
  cone1.position.y = 4.2;
  cone1.castShadow = true;
  tree.add(cone1);
  
  const coneGeo2 = new THREE.ConeGeometry(1.7, 2, 5);
  const cone2 = new THREE.Mesh(coneGeo2, foliageMat);
  cone2.position.y = 5.6;
  cone2.castShadow = true;
  tree.add(cone2);
  
  // Scatter outside the building zone (building is 80x40 from X: -40 to 40, Z: -20 to 20)
  let x, z;
  do {
    x = (Math.random() - 0.5) * (MAP_SIZE - 15);
    z = (Math.random() - 0.5) * (MAP_SIZE - 15);
  } while (Math.abs(x) < 45 && Math.abs(z) < 25); // Avoid spawning inside or too close to building
  
  tree.position.set(x, 0, z);
  
  const scale = 0.85 + Math.random() * 0.4;
  tree.scale.set(scale, scale, scale);
  scene.add(tree);
}

function buildBuilding() {
  const stoneTex = createStoneTexture();
  const brickTex = createBrickTexture();
  
  const wallMat = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.85 });
  const floorMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.7 });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
  const screenMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.2, emissive: '#020617', emissiveIntensity: 0.2 });
  
  // Total dimensions: X is 80m, Z is 40m
  const startX = -40;
  const startZ = -20;
  const endX = 40;
  const endZ = 20;

  // 1. FLOOR PLACEMENT
  const floorGeo = new THREE.PlaneGeometry(80, 40);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, 0); // Sit slightly above grass
  floor.receiveShadow = true;
  scene.add(floor);

  // Helper function to create wall meshes and register collision bounding boxes
  function addWallSegment(xStart, zStart, xEnd, zEnd, height = ROOM_HEIGHT) {
    const dx = xEnd - xStart;
    const dz = zEnd - zStart;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);
    
    const thickness = 0.5;
    const wallGeo = new THREE.BoxGeometry(len, height, thickness);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    
    // Position at midpoint
    wall.position.set((xStart + xEnd) / 2, height / 2, (zStart + zEnd) / 2);
    wall.rotation.y = -angle;
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    // Register wall bounding box for collision checking
    // Add slightly larger bounding buffer to prevent players clipping through
    const pad = 0.35;
    WALLS.push({
      minX: Math.min(xStart, xEnd) - (dz === 0 ? 0 : pad) - (dx === 0 ? thickness/2 + pad : 0),
      maxX: Math.max(xStart, xEnd) + (dz === 0 ? 0 : pad) + (dx === 0 ? thickness/2 + pad : 0),
      minZ: Math.min(zStart, zEnd) - (dx === 0 ? 0 : pad) - (dz === 0 ? thickness/2 + pad : 0),
      maxZ: Math.max(zStart, zEnd) + (dx === 0 ? 0 : pad) + (dz === 0 ? thickness/2 + pad : 0),
    });
  }

  // 2. EXTERIOR WALLS (80m x 40m Building bounds)
  // Outer North Wall (Z: -20, X from -40 to 40) - has a back exit in the middle
  addWallSegment(-40, -20, -3, -20);
  addWallSegment(3, -20, 40, -20);
  
  // Outer South Wall (Z: 20, X from -40 to 40) - has main entrance in the middle
  addWallSegment(-40, 20, -3, 20);
  addWallSegment(3, 20, 40, 20);
  
  // Outer East & West Walls (X: 40 and X: -40, Z from -20 to 20)
  addWallSegment(-40, -20, -40, 20);
  addWallSegment(40, -20, 40, 20);

  // 3. INTERIOR DIVISION WALLS
  // Horizontal dividing wall down the middle (Z: 0, X from -40 to 40)
  // We leave 3m door openings in the middle of each room corridor
  for (let x = -40; x < 40; x += 20) {
    addWallSegment(x, 0, x + 8.5, 0); // Wall segment
    addWallSegment(x + 11.5, 0, x + 20, 0); // Leave 3m doorway at x + 10
  }

  // Vertical dividing walls (X: -20, 0, 20, Z from -20 to 20)
  // We leave 3m door openings at Z: -10 and Z: 10
  const vertPositions = [-20, 0, 20];
  for (const vx of vertPositions) {
    // North side rooms divider (Z: -20 to 0)
    addWallSegment(vx, -20, vx, -11.5);
    addWallSegment(vx, -8.5, vx, 0); // Doorway at Z: -10
    
    // South side rooms divider (Z: 0 to 20)
    addWallSegment(vx, 0, vx, 8.5);
    addWallSegment(vx, 11.5, vx, 20); // Doorway at Z: 10
  }

  // 4. PILLARS & CORNER DECORATIONS
  const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, ROOM_HEIGHT, 8);
  for (let x = -40; x <= 40; x += 20) {
    for (let z = -20; z <= 20; z += 20) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, ROOM_HEIGHT / 2, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);
    }
  }

  // 5. EMBEDDED SCREENS & WALL MOUNTED TORCHES IN ROOMS
  ROOMS.forEach((room) => {
    // Create physical 3D Screen model on the back wall of each room
    const screenGroup = new THREE.Group();
    
    const outerGeo = new THREE.BoxGeometry(7, 4, 0.2);
    const outerFrame = new THREE.Mesh(outerGeo, frameMat);
    outerFrame.castShadow = true;
    screenGroup.add(outerFrame);
    
    const innerGeo = new THREE.BoxGeometry(6.6, 3.6, 0.05);
    const innerScreen = new THREE.Mesh(innerGeo, screenMat);
    innerScreen.position.z = 0.1;
    screenGroup.add(innerScreen);

    // Glowing border around screen
    const borderMat = new THREE.MeshBasicMaterial({ color: '#3b82f6', wireframe: true });
    const screenBorder = new THREE.Mesh(innerGeo, borderMat);
    screenBorder.position.z = 0.11;
    screenBorder.scale.set(1.02, 1.02, 1.02);
    screenGroup.add(screenBorder);
    
    // Screen positioning: Rooms 0-3 are on north side (back wall is Z: -20, screen faces south)
    // Rooms 4-7 are on south side (back wall is Z: 20, screen faces north)
    if (room.z < 0) {
      screenGroup.position.set(room.x, 3.5, -19.8);
      screenGroup.rotation.y = 0; // Faces South
    } else {
      screenGroup.position.set(room.x, 3.5, 19.8);
      screenGroup.rotation.y = Math.PI; // Faces North
    }
    
    scene.add(screenGroup);

    // Wall-mounted medieval torches inside rooms
    createWallTorch(room.x - 6, 2.5, room.z < 0 ? -19.7 : 19.7, room.z < 0 ? 0 : Math.PI);
    createWallTorch(room.x + 6, 2.5, room.z < 0 ? -19.7 : 19.7, room.z < 0 ? 0 : Math.PI);
  });
}

function createWallTorch(x, y, z, rotationY) {
  const torchGroup = new THREE.Group();
  
  // Bracket
  const bracketGeo = new THREE.BoxGeometry(0.15, 0.4, 0.3);
  const metalMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.8 });
  const bracket = new THREE.Mesh(bracketGeo, metalMat);
  bracket.position.set(0, 0, -0.15);
  torchGroup.add(bracket);

  // Wooden stick
  const stickGeo = new THREE.CylinderGeometry(0.08, 0.06, 0.8, 6);
  stickGeo.rotateX(Math.PI / 8); // Angled outwards
  const woodMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });
  const stick = new THREE.Mesh(stickGeo, woodMat);
  stick.position.set(0, 0.1, -0.05);
  torchGroup.add(stick);

  // Flame glow shape
  const flameGeo = new THREE.ConeGeometry(0.15, 0.4, 5);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#f97316' });
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(0, 0.55, 0.1);
  torchGroup.add(flame);

  // Particle representation for flame (small glowing sphere)
  const particleGeo = new THREE.SphereGeometry(0.1, 4, 4);
  const particleMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
  const particle = new THREE.Mesh(particleGeo, particleMat);
  particle.position.set(0, 0.65, 0.1);
  torchGroup.add(particle);

  // Dynamic Point Light (Flickering source)
  const light = new THREE.PointLight('#f97316', 0.8, 8);
  light.position.set(0, 0.7, 0.15);
  light.castShadow = true;
  light.shadow.bias = -0.002;
  torchGroup.add(light);

  torchGroup.position.set(x, y, z);
  torchGroup.rotation.y = rotationY;
  
  scene.add(torchGroup);

  // Track light and flame mesh to animate flickering
  torches.push({
    light,
    flame,
    baseIntensity: 0.8,
    seed: Math.random() * 100
  });
}

// --- Player Avatar Creation ---
function createPlayerAvatar(avatarType, colorHex, username, isLocal = false) {
  const avatarGroup = new THREE.Group();

  // Color Material
  const shirtMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#fbcfe8', roughness: 0.8 }); // Pinkish peach skin
  const legMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 }); // Dark pants
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 });
  
  // Custom Class Gear
  let hatMat, hatGeo, weaponMat, weaponGeo;
  if (avatarType === 'mage') {
    hatMat = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.5 });
    // Wizard cone hat
    hatGeo = new THREE.ConeGeometry(0.45, 0.8, 6);
  } else if (avatarType === 'knight') {
    hatMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.8, roughness: 0.2 });
    // Knight bucket helmet
    hatGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.45, 6);
  } else { // Ranger
    hatMat = new THREE.MeshStandardMaterial({ color: '#14532d', roughness: 0.7 });
    // Ranger pointed hat/cap
    hatGeo = new THREE.ConeGeometry(0.35, 0.5, 4);
    hatGeo.rotateX(Math.PI/6); // Slanted backwards
  }

  // 1. Torso
  const torsoGeo = new THREE.CylinderGeometry(0.35, 0.28, 1.0, 6);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 1.1;
  torso.castShadow = true;
  torso.receiveShadow = true;
  avatarGroup.add(torso);

  // 2. Head
  const headGeo = new THREE.SphereGeometry(0.28, 6, 6);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 1.8;
  head.castShadow = true;
  avatarGroup.add(head);

  // 3. Hat/Helm
  if (hatGeo) {
    const hat = new THREE.Mesh(hatGeo, hatMat);
    if (avatarType === 'mage') {
      hat.position.y = 2.25;
    } else if (avatarType === 'knight') {
      hat.position.y = 1.85;
    } else {
      hat.position.set(0, 2.05, -0.05);
    }
    hat.castShadow = true;
    avatarGroup.add(hat);
  }

  // 4. Arms (Left / Right)
  const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 4);
  armGeo.translate(0, -0.35, 0); // Set pivot at shoulder
  
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.48, 1.5, 0);
  leftArm.castShadow = true;
  avatarGroup.add(leftArm);
  
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.48, 1.5, 0);
  rightArm.castShadow = true;
  avatarGroup.add(rightArm);

  // 5. Legs (Left / Right)
  const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 4);
  legGeo.translate(0, -0.3, 0); // Pivot at hip

  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.2, 0.6, 0);
  leftLeg.castShadow = true;
  avatarGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.2, 0.6, 0);
  rightLeg.castShadow = true;
  avatarGroup.add(rightLeg);

  // 6. Feet / Shoes
  const shoeGeo = new THREE.BoxGeometry(0.16, 0.1, 0.25);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.2, 0.05, 0.05);
  avatarGroup.add(leftShoe);
  
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0.2, 0.05, 0.05);
  avatarGroup.add(rightShoe);

  // 7. Floating Name Tag
  const tagColor = isLocal ? '#818cf8' : '#38bdf8'; // Purple-blue for self, sky-blue for others
  const nameTag = createPlayerNameSprite(username, tagColor);
  nameTag.position.set(0, 2.7, 0);
  avatarGroup.add(nameTag);

  scene.add(avatarGroup);

  return {
    group: avatarGroup,
    leftLeg, rightLeg,
    leftArm, rightArm,
    nameTag
  };
}

// --- Player Movement & Collisions ---
function checkCollision(targetX, targetZ) {
  // Building outer boundaries check
  // Map limits check
  const mapLim = MAP_SIZE / 2 - 2;
  if (Math.abs(targetX) > mapLim || Math.abs(targetZ) > mapLim) {
    return true; // Collided with edge barrier
  }

  // Iterate over building walls and check bounding boxes
  for (const wall of WALLS) {
    if (targetX >= wall.minX && targetX <= wall.maxX &&
        targetZ >= wall.minZ && targetZ <= wall.maxZ) {
      return true; // Hit a building wall
    }
  }

  return false;
}

function updateLocalPlayer(dt) {
  if (!isJoined || !localPlayer.mesh) return;

  const speed = 11.0;
  const gravity = 25.0;
  const jumpForce = 10.0;
  
  // 1. Vertical Physics (Gravity & Jump)
  if (!localPlayer.isGrounded) {
    localPlayer.velocity.y -= gravity * dt;
    localPlayer.y += localPlayer.velocity.y * dt;
    
    // Check ground collision
    if (localPlayer.y <= 0) {
      localPlayer.y = 0;
      localPlayer.velocity.y = 0;
      localPlayer.isGrounded = true;
    }
  } else if (keys.space) {
    localPlayer.velocity.y = jumpForce;
    localPlayer.isGrounded = false;
    keys.space = false; // Reset jump state
  }

  // 2. Horizontal Movement (WASD relative to Camera rotation)
  const moveDirection = new THREE.Vector3();
  
  if (keys.w) moveDirection.z -= 1;
  if (keys.s) moveDirection.z += 1;
  if (keys.a) moveDirection.x -= 1;
  if (keys.d) moveDirection.x += 1;
  
  moveDirection.normalize();

  if (moveDirection.lengthSq() > 0) {
    // Project camera direction onto ground plane
    const camDirection = new THREE.Vector3();
    camera.getWorldDirection(camDirection);
    camDirection.y = 0;
    camDirection.normalize();
    
    // Camera right vector
    const camRight = new THREE.Vector3();
    camRight.crossVectors(camera.up, camDirection).negate().normalize();
    
    // Formulate relative translation
    const worldMoveVec = new THREE.Vector3()
      .addScaledVector(camDirection, -moveDirection.z)
      .addScaledVector(camRight, moveDirection.x)
      .normalize()
      .multiplyScalar(speed * dt);
      
    // Slide along walls collision response
    let nextX = localPlayer.x + worldMoveVec.x;
    let nextZ = localPlayer.z + worldMoveVec.z;
    
    // Try full movement first
    if (!checkCollision(nextX, nextZ)) {
      localPlayer.x = nextX;
      localPlayer.z = nextZ;
    } else {
      // Try moving along X axis only
      if (!checkCollision(nextX, localPlayer.z)) {
        localPlayer.x = nextX;
      }
      // Try moving along Z axis only
      else if (!checkCollision(localPlayer.x, nextZ)) {
        localPlayer.z = nextZ;
      }
    }
    
    // Face direction of movement
    const angle = Math.atan2(worldMoveVec.x, worldMoveVec.z);
    localPlayer.ry = angle;
    localPlayer.isMoving = true;
  } else {
    localPlayer.isMoving = false;
  }

  // 3. Update localPlayer 3D Model position
  localPlayer.mesh.position.set(localPlayer.x, localPlayer.y, localPlayer.z);
  localPlayer.mesh.rotation.y = localPlayer.ry;
  
  // Orbit controls target player
  controls.target.copy(localPlayer.mesh.position).add(new THREE.Vector3(0, 1.2, 0));

  // 4. Leg and Arm Swing Walking Animation
  animateAvatarWalk(localPlayer, dt);

  // 5. Room entry detection
  detectRoomEntry();

  // 6. Network position sync
  syncPosition();
}

function animateAvatarWalk(playerObj, dt) {
  const isMoving = playerObj.isMoving;
  
  // Limbs access
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
    // Return to neutral
    const lerpSpeed = 10 * dt;
    leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, lerpSpeed);
    rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, lerpSpeed);
    
    if (leftArm && rightArm) {
      leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, lerpSpeed);
      rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, lerpSpeed);
    }
  }
  
  // Vertical jumping animation
  if (!playerObj.isGrounded && leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, -Math.PI / 3, 5 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, Math.PI / 3, 5 * dt);
  } else if (leftArm && rightArm) {
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0, 10 * dt);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, 10 * dt);
  }
}

// --- Room Bounding Box Triggers ---
function detectRoomEntry() {
  let activeRoomId = -1;

  for (const room of ROOMS) {
    // Center coords
    const rx = room.x;
    const rz = room.z;
    
    // Bounds boundaries
    const minX = rx - ROOM_WIDTH / 2;
    const maxX = rx + ROOM_WIDTH / 2;
    const minZ = rz - ROOM_DEPTH / 2;
    const maxZ = rz + ROOM_DEPTH / 2;

    if (localPlayer.x >= minX && localPlayer.x <= maxX &&
        localPlayer.z >= minZ && localPlayer.z <= maxZ) {
      activeRoomId = room.id;
      break;
    }
  }

  // Handle entry/exit triggers
  if (activeRoomId !== localPlayer.currentRoom) {
    const prevRoom = localPlayer.currentRoom;
    localPlayer.currentRoom = activeRoomId;
    
    // Notify server of room change
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: "room_change",
        room: activeRoomId
      }));
    }

    // Update UI HUD location
    const locTag = document.getElementById('hud-location');
    const panel = document.getElementById('room-panel');
    
    if (activeRoomId === -1) {
      locTag.innerText = "Exploring Outdoors";
      panel.classList.remove('room-panel-visible');
      // Stop YouTube
      if (ytPlayer && ytPlayer.pauseVideo) {
        ytPlayer.pauseVideo();
      }
      activeRoomVideoId = "";
    } else {
      const room = ROOMS[activeRoomId];
      locTag.innerText = `In Room: ${room.name}`;
      
      // Update room UI Panel
      document.getElementById('room-title').innerText = room.name;
      panel.classList.add('room-panel-visible');
      
      // Setup/update YouTube stream for this room
      setupRoomVideo(activeRoomId);
      
      // Refresh list of players in the room
      refreshRoomPlayersList();
    }
  }
}

function refreshRoomPlayersList() {
  const listContainer = document.getElementById('room-players-list');
  listContainer.innerHTML = '';
  
  if (localPlayer.currentRoom === -1) return;

  // Add self
  const selfLi = document.createElement('li');
  selfLi.className = 'room-player-item';
  selfLi.innerHTML = `
    <span class="room-player-badge" style="background-color: ${localPlayer.color}"></span>
    <strong>${localPlayer.username} (You)</strong>
  `;
  listContainer.appendChild(selfLi);

  // Add matching remote players
  remotePlayers.forEach((p) => {
    if (p.room === localPlayer.currentRoom) {
      const li = document.createElement('li');
      li.className = 'room-player-item';
      li.innerHTML = `
        <span class="room-player-badge" style="background-color: ${p.color}"></span>
        <span>${p.username}</span>
      `;
      listContainer.appendChild(li);
    }
  });

  // Capacity update
  const count = listContainer.children.length;
  document.getElementById('room-capacity').innerText = `${count} / 10 Players`;
}

// --- YouTube Player Logic ---
function setupRoomVideo(roomId) {
  const room = ROOMS[roomId];
  const videoId = room.video || "";

  if (!videoId) {
    // If no video, clear player container or show placeholder
    return;
  }

  if (activeRoomVideoId === videoId) {
    // Already playing correct video, ensure it's playing
    if (ytPlayer && ytPlayer.playVideo) {
      try {
        ytPlayer.playVideo();
      } catch (e) {}
    }
    return;
  }

  activeRoomVideoId = videoId;

  if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
    ytPlayer.loadVideoById({
      videoId: videoId,
      startSeconds: 0
    });
  } else {
    // Inject YouTube API and wait, or construct player if ready
    try {
      if (window.YT && window.YT.Player) {
        ytPlayer = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            'playsinline': 1,
            'autoplay': 1,
            'controls': 1,
            'rel': 0
          },
          events: {
            'onReady': (event) => {
              event.target.playVideo();
            }
          }
        });
      }
    } catch (err) {
      console.error("Failed to build YT player", err);
    }
  }
}

// Global Callback called by YouTube SDK script loading
window.onYouTubeIframeAPIReady = function() {
  ytApiReady = true;
};

// --- WebSocket Sync ---
function connectMultiplayer() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  socket = new WebSocket(wsUrl);
  
  socket.addEventListener('open', () => {
    document.getElementById('connection-status').classList.add('connected');
    
    // Join the game with profile
    socket.send(JSON.stringify({
      type: "join",
      username: localPlayer.username,
      avatar: localPlayer.avatarType,
      color: localPlayer.color,
      x: localPlayer.x,
      y: localPlayer.y,
      z: localPlayer.z,
      ry: localPlayer.ry
    }));
  });

  socket.addEventListener('close', () => {
    document.getElementById('connection-status').classList.remove('connected');
    addChatLog("System", "Disconnected from server. Reconnecting in 5s...", "system-msg");
    setTimeout(connectMultiplayer, 5000);
  });

  socket.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "init":
          // Receive own ID and list of other players
          localPlayer.id = data.playerId;
          
          // Seed room videos
          if (data.videos) {
            for (let i = 0; i < 8; i++) {
              ROOMS[i].video = data.videos[i];
            }
          }

          // Spawn existing players
          data.players.forEach((p) => {
            spawnRemotePlayer(p);
          });
          break;

        case "join":
          if (data.player.id === localPlayer.id) return;
          spawnRemotePlayer(data.player);
          addChatLog("System", `${data.player.username} entered Metalyceum!`, "system-msg");
          if (localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          break;

        case "move":
          if (data.id === localPlayer.id) return;
          const remoteP = remotePlayers.get(data.id);
          if (remoteP) {
            // Target coordinates for lerping in loop
            remoteP.targetX = data.x;
            remoteP.targetY = data.y;
            remoteP.targetZ = data.z;
            remoteP.targetRy = data.ry;
            remoteP.isMoving = data.isMoving;
          }
          break;

        case "room_change":
          if (data.id === localPlayer.id) return;
          const rPlayer = remotePlayers.get(data.id);
          if (rPlayer) {
            rPlayer.room = data.room;
            if (localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          }
          break;

        case "chat":
          // Bubble text above avatar
          displayChatBubble(data.id, data.message);
          addChatLog(data.username, data.message);
          break;

        case "video_change":
          const rIdx = data.room;
          ROOMS[rIdx].video = data.videoId;
          
          // If local player is inside this room, update playing video feed
          if (localPlayer.currentRoom === rIdx) {
            setupRoomVideo(rIdx);
          }
          break;

        case "leave":
          removeRemotePlayer(data.id);
          if (localPlayer.currentRoom !== -1) refreshRoomPlayersList();
          break;
      }
    } catch (err) {
      console.error("Error handling websocket payload", err);
    }
  });
}

function spawnRemotePlayer(pData) {
  // If already spawned, remove first
  if (remotePlayers.has(pData.id)) {
    removeRemotePlayer(pData.id);
  }

  // Create avatar meshes
  const avatar = createPlayerAvatar(pData.avatar, pData.color, pData.username, false);
  avatar.group.position.set(pData.x, pData.y, pData.z);
  avatar.group.rotation.y = pData.ry;

  const playerObj = {
    id: pData.id,
    username: pData.username,
    color: pData.color,
    avatar: pData.avatar,
    room: pData.room,
    x: pData.x, y: pData.y, z: pData.z,
    ry: pData.ry,
    targetX: pData.x, targetY: pData.y, targetZ: pData.z, targetRy: pData.ry,
    isMoving: pData.isMoving,
    mesh: avatar.group,
    leftLeg: avatar.leftLeg,
    rightLeg: avatar.rightLeg,
    leftArm: avatar.leftArm,
    rightArm: avatar.rightArm,
    nameTag: avatar.nameTag,
    chatBubble: null,
    chatTimeout: null
  };

  remotePlayers.set(pData.id, playerObj);
}

function removeRemotePlayer(id) {
  const p = remotePlayers.get(id);
  if (p) {
    scene.remove(p.mesh);
    // Recursively dispose meshes
    p.mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    // Clear nameTag sprite texture
    if (p.nameTag && p.nameTag.material && p.nameTag.material.map) {
      p.nameTag.material.map.dispose();
      p.nameTag.material.dispose();
    }
    if (p.chatBubble && p.chatBubble.material && p.chatBubble.material.map) {
      p.chatBubble.material.map.dispose();
      p.chatBubble.material.dispose();
    }
    
    remotePlayers.delete(id);
  }
}

// Transmit positions throttled to avoid server congestion
function syncPosition() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  const dx = Math.abs(localPlayer.x - lastSentPosition.x);
  const dy = Math.abs(localPlayer.y - lastSentPosition.y);
  const dz = Math.abs(localPlayer.z - lastSentPosition.z);
  const dry = Math.abs(localPlayer.ry - lastSentPosition.ry);
  const dMoving = localPlayer.isMoving !== lastSentPosition.isMoving;

  // Thresholds
  if (dx > 0.05 || dy > 0.05 || dz > 0.05 || dry > 0.02 || dMoving) {
    socket.send(JSON.stringify({
      type: "move",
      x: parseFloat(localPlayer.x.toFixed(2)),
      y: parseFloat(localPlayer.y.toFixed(2)),
      z: parseFloat(localPlayer.z.toFixed(2)),
      ry: parseFloat(localPlayer.ry.toFixed(3)),
      isMoving: localPlayer.isMoving
    }));

    lastSentPosition = {
      x: localPlayer.x,
      y: localPlayer.y,
      z: localPlayer.z,
      ry: localPlayer.ry,
      isMoving: localPlayer.isMoving
    };
  }
}

// Chat functions
function addChatLog(author, message, className = "") {
  const log = document.getElementById('chat-log');
  const msgDiv = document.createElement('div');
  
  if (className) {
    msgDiv.className = className;
    msgDiv.innerText = message;
  } else {
    msgDiv.className = 'chat-msg';
    msgDiv.innerHTML = `<span class="chat-author" style="color: ${author === localPlayer.username ? '#818cf8' : '#38bdf8'}">${author}:</span><span>${message}</span>`;
  }
  
  log.appendChild(msgDiv);
  log.scrollTop = log.scrollHeight;
}

function displayChatBubble(playerId, text) {
  let targetP = null;
  if (playerId === localPlayer.id) {
    targetP = localPlayer;
    // For local player, wrap mock model parameters or attach directly
    targetP.group = localPlayer.mesh;
  } else {
    targetP = remotePlayers.get(playerId);
  }

  if (!targetP || !targetP.group) return;

  // Remove old bubble if exists
  if (targetP.chatBubble) {
    targetP.group.remove(targetP.chatBubble);
    targetP.chatBubble.material.map.dispose();
    targetP.chatBubble.material.dispose();
    targetP.chatBubble = null;
  }
  if (targetP.chatTimeout) {
    clearTimeout(targetP.chatTimeout);
  }

  // Create chat bubble canvas sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  // Bubble style
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 3;

  const r = 8;
  const x = 6, y = 6, w = 244, h = 50;
  
  // Draw round rect
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  
  // Draw tail arrow
  ctx.lineTo(128 + 10, y + h);
  ctx.lineTo(128, y + h + 12);
  ctx.lineTo(128 - 10, y + h);
  
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Wrap text
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Truncate to fit single line nicely, or multi-line wrap
  let displayVal = text;
  if (text.length > 25) {
    displayVal = text.substring(0, 22) + "...";
  }
  ctx.fillText(displayVal, 128, 30);

  const texture = new THREE.CanvasTexture(canvas);
  const bubbleMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const bubbleSprite = new THREE.Sprite(bubbleMat);
  bubbleSprite.scale.set(2.4, 0.75, 1);
  bubbleSprite.position.set(0, 3.4, 0);

  targetP.chatBubble = bubbleSprite;
  targetP.group.add(bubbleSprite);

  // Auto clean bubble
  targetP.chatTimeout = setTimeout(() => {
    if (targetP.group && targetP.chatBubble) {
      targetP.group.remove(targetP.chatBubble);
      targetP.chatBubble.material.map.dispose();
      targetP.chatBubble.material.dispose();
      targetP.chatBubble = null;
    }
  }, 4500);
}

// --- Main Engine Loop ---
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1); // Limit dt spike
  lastTime = now;
  
  // 1. Update Controls
  controls.update();
  
  // 2. Animate Torches (Point light flickering & flame wiggling)
  const time = now * 0.005;
  torches.forEach((t) => {
    const flicker = Math.sin(time * 3 + t.seed) * Math.cos(time * 7 + t.seed) * 0.15;
    t.light.intensity = t.baseIntensity + flicker;
    t.flame.scale.set(
      1 + flicker * 0.1, 
      1 + Math.sin(time * 10 + t.seed) * 0.15, 
      1 + flicker * 0.1
    );
  });
  
  // 3. Update Local Player Physics/Controls
  updateLocalPlayer(dt);
  
  // 4. Update Remote Players Positions (Interpolate / lerp for smooth motion)
  remotePlayers.forEach((p) => {
    const lerpSpeed = 10.0 * dt;
    
    p.x = THREE.MathUtils.lerp(p.x, p.targetX, lerpSpeed);
    p.y = THREE.MathUtils.lerp(p.y, p.targetY, lerpSpeed);
    p.z = THREE.MathUtils.lerp(p.z, p.targetZ, lerpSpeed);
    
    // Smooth angular lerp
    // Formulate rotation angles correctly
    let diff = p.targetRy - p.ry;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    p.ry += diff * lerpSpeed;
    
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.y = p.ry;
    
    // Limbs walk animation
    animateAvatarWalk(p, dt);
  });
  
  // 5. Render Scene
  renderer.render(scene, camera);
}

// --- Form & UI Handle Bindings ---
function initUiHandlers() {
  // Login form submission
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username-input').value.trim();
    const avatarType = document.querySelector('input[name="avatar-type"]:checked').value;
    const color = document.getElementById('color-input').value;
    
    if (!username) return;
    
    localPlayer.username = username;
    localPlayer.avatarType = avatarType;
    localPlayer.color = color;
    
    // Spawn local avatar
    const avatar = createPlayerAvatar(avatarType, color, username, true);
    localPlayer.mesh = avatar.group;
    localPlayer.mesh.position.set(localPlayer.x, localPlayer.y, localPlayer.z);
    localPlayer.mesh.rotation.y = localPlayer.ry;
    
    // Assign local limb pointers for animation
    localPlayer.leftLeg = avatar.leftLeg;
    localPlayer.rightLeg = avatar.rightLeg;
    localPlayer.leftArm = avatar.leftArm;
    localPlayer.rightArm = avatar.rightArm;
    
    // Set camera starting position behind player
    camera.position.set(localPlayer.x, localPlayer.y + 10, localPlayer.z + 18);
    controls.target.copy(localPlayer.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
    controls.update();

    // Toggle HUD
    document.getElementById('hud-username').innerText = username;
    document.getElementById('login-overlay').classList.remove('active');
    
    // Initialize multiplayer connection
    connectMultiplayer();
    
    isJoined = true;
  });

  // Color picker synchronization
  const colorInput = document.getElementById('color-input');
  colorInput.addEventListener('input', (e) => {
    document.querySelector('.color-value').innerText = e.target.value;
  });

  // Chat message submission
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg || !socket || socket.readyState !== WebSocket.OPEN) return;
    
    socket.send(JSON.stringify({
      type: "chat",
      message: msg
    }));
    
    // Show bubble locally
    displayChatBubble(localPlayer.id, msg);
    addChatLog(localPlayer.username, msg);
    
    input.value = '';
  });

  // Room side panel close btn
  document.getElementById('close-panel-btn').addEventListener('click', () => {
    document.getElementById('room-panel').classList.remove('room-panel-visible');
    if (ytPlayer && ytPlayer.pauseVideo) {
      ytPlayer.pauseVideo();
    }
  });

  // Video feed control panel toggles
  const changeBtn = document.getElementById('change-video-btn');
  const cancelBtn = document.getElementById('cancel-video-btn');
  const submitBtn = document.getElementById('submit-video-btn');
  const modal = document.getElementById('video-input-modal');
  const urlInput = document.getElementById('video-url-input');

  changeBtn.addEventListener('click', () => {
    modal.classList.add('video-modal-visible');
    urlInput.focus();
  });
  
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('video-modal-visible');
    urlInput.value = '';
  });

  submitBtn.addEventListener('click', () => {
    const rawVal = urlInput.value.trim();
    if (!rawVal) return;

    let videoId = rawVal;
    
    // Handle full YouTube URLs to extract video ID
    try {
      if (rawVal.includes('youtube.com/watch')) {
        const urlObj = new URL(rawVal);
        videoId = urlObj.searchParams.get('v') || rawVal;
      } else if (rawVal.includes('youtu.be/')) {
        const parts = rawVal.split('/');
        videoId = parts[parts.length - 1].split('?')[0] || rawVal;
      }
    } catch(e) {}

    if (videoId && socket && socket.readyState === WebSocket.OPEN && localPlayer.currentRoom !== -1) {
      socket.send(JSON.stringify({
        type: "video_change",
        room: localPlayer.currentRoom,
        videoId: videoId
      }));
      
      modal.classList.remove('video-modal-visible');
      urlInput.value = '';
    }
  });

  // Keyboard controls listeners
  window.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT') return; // Ignore movement keys when typing in chat
    
    const key = e.key.toLowerCase();
    if (key === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (key === 's' || e.key === 'ArrowDown') keys.s = true;
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = true;
    if (e.key === ' ') keys.space = true;
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (key === 's' || e.key === 'ArrowDown') keys.s = false;
    if (key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (key === 'd' || e.key === 'ArrowRight') keys.d = false;
  });
  
  // Focus helper: pressing ESC defocuses inputs
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.activeElement.blur();
      modal.classList.remove('video-modal-visible');
    }
  });
}

// --- Content Visibility Background optimization ---
// Using modern web API guidelines to pause background rendering loop when offscreen
function initPerformanceOptimization() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (socket && socket.readyState === WebSocket.OPEN) {
        // Send a standby status
      }
    }
  });

  // Attach contentvisibilityautostatechange to game canvas container to defer calculations
  const gameContainer = document.getElementById('game-container');
  gameContainer.style.contentVisibility = 'auto';
  gameContainer.style.containIntrinsicSize = 'auto none auto 100vh';
  
  gameContainer.addEventListener('contentvisibilityautostatechange', (event) => {
    if (event.skipped) {
      // Browser skipped rendering this, throttle down
      renderer.setAnimationLoop(null);
    } else {
      // Browser resumes, kick off animation loop again
      lastTime = performance.now();
      renderer.setAnimationLoop(animate);
    }
  });
}

// --- App Entry Point ---
window.addEventListener('DOMContentLoaded', () => {
  initEngine();
  initUiHandlers();
  initPerformanceOptimization();
  
  // Kickstart animation loop (WebGL updates)
  renderer.setAnimationLoop(animate);
});
