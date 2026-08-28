import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createScientificWorld } from "./scientific-world.js";

const canvas = document.querySelector("#sim");
const MOBILE_RENDERING = window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 700;
const MAX_DEVICE_PIXEL_RATIO = Math.min(MOBILE_RENDERING ? 1.2 : 1.45, window.devicePixelRatio || 1);

const ui = {
  cut: document.querySelector("#cut-value"),
  battery: document.querySelector("#battery-value"),
  batteryLabel: document.querySelector("#battery-label"),
  time: document.querySelector("#time-value"),
  status: document.querySelector("#status-value"),
  clippings: document.querySelector("#clippings-value"),
  hint: document.querySelector("#hint"),
  auto: document.querySelector("#auto-toggle"),
  sound: document.querySelector("#sound-toggle"),
  startModal: document.querySelector("#start-modal"),
  finishModal: document.querySelector("#finish-modal"),
  finishScore: document.querySelector("#finish-score"),
  finishDetail: document.querySelector("#finish-detail"),
  planetProgress: document.querySelector("#planet-progress"),
  terrainReadout: document.querySelector("#terrain-readout"),
  planetGlobe: document.querySelector("#planet-globe"),
  granaryDot: document.querySelector("#granary-dot"),
  planetDot: document.querySelector("#planet-dot"),
  barbarianDot: document.querySelector("#barbarian-dot"),
  cameraDot: document.querySelector("#camera-dot"),
  zoomGlobe: document.querySelector("#zoom-globe"),
  surfaceView: document.querySelector("#surface-view"),
  chaseView: document.querySelector("#chase-view"),
  crew: document.querySelector("#crew-value"),
  generation: document.querySelector("#generation-value"),
  level: document.querySelector("#level-value"),
  score: document.querySelector("#score-value"),
  hatchLabel: document.querySelector("#hatch-label"),
  hatchProgress: document.querySelector("#hatch-progress"),
  councilStatus: document.querySelector("#council-status"),
  councilSkills: document.querySelector("#council-skills"),
  councilBallot: document.querySelector("#council-ballot"),
  stockpileStatus: document.querySelector("#stockpile-status"),
  buildingStatus: document.querySelector("#building-status"),
  birthToast: document.querySelector("#birth-toast"),
  threat: document.querySelector("#threat-value"),
  nitro: document.querySelector("#nitro-button"),
  tractorUpgrade: document.querySelector("#tractor-upgrade"),
  treasury: document.querySelector("#treasury-value"),
  mintSilver: document.querySelector("#mint-silver"),
  mintGold: document.querySelector("#mint-gold"),
};

const FIELD_W = 10800;
const FIELD_H = 5400;
const SURFACE_SCALE = 6;
const COLS = 1080;
const ROWS = 540;
const CELL_W = FIELD_W / COLS;
const CELL_H = FIELD_H / ROWS;
const MODEL_DECK_RADIUS = 48;
const DECK_RADIUS = MODEL_DECK_RADIUS / SURFACE_SCALE;
const MOWER_CLEARANCE = 26 / SURFACE_SCALE;
const SPEED_SCALE = 1 / SURFACE_SCALE;
const SIMULATION_SPEED = 1.7;
const FINISH_THRESHOLD = 0.985;
const PLANET_RADIUS = (FIELD_W / (Math.PI * 2)) * SURFACE_SCALE;
const TERRAIN_AMPLITUDE = 320;
const CLIPPINGS_PER_CELL = 0.0042;
const REPRODUCTION_KG = 0.25;
const REPRODUCTION_CELLS = Math.ceil(REPRODUCTION_KG / CLIPPINGS_PER_CELL);
const LEVEL_KG = 1;
const LEVEL_CELLS = Math.ceil(LEVEL_KG / CLIPPINGS_PER_CELL);
const MAX_WORKER_LEVEL = 5;
const LEVEL_BOOST_SECONDS = 7;
const LEVEL_BOOST_MULTIPLIER = 1.75;
const TREE_REGROW_DELAY = 16;
const TREE_GROW_SECONDS = 28;
const TREE_GROW_LEVELS = 77;
const TREE_REWARD_CELLS = Math.ceil(0.35 / CLIPPINGS_PER_CELL);
const BASE_COLONY_CAP = 12;
const MAX_COLONY = 20;
const DRAGON_COUNT = 3;
const DRAGON_BROOD_MEALS = 3;
const TRACTOR_COST = 5000;
const FULL_DETAIL_DRAGONS = MOBILE_RENDERING ? 3 : 6;
const GRANARY_UNLOAD_RADIUS = 126 / SURFACE_SCALE;
const FIRST_CASTLE_COST = 0.6;
const CASTLE_FOUNDATION_COST = 1.5;
const CASTLE_UPGRADE_COST = 2.5;
const MAX_CASTLES = 1;
const MAX_CASTLE_LEVEL = 7;
const MAX_VILLAGE_WALL_LEVEL = 7;
const MAX_VILLAGE_SKILL = 7;
const MAX_STRONGHOLD_LEVEL = 7;
const COUNCIL_INTERVAL = 18;
const SILVER_GRAIN_COST = 0.5;
const SILVER_PER_MINT = 10;
const SILVER_PER_GOLD = 100;

const scientificWorld = createScientificWorld({ width: FIELD_W, height: FIELD_H, gridWidth: 192, gridHeight: 96, seed: 7319, seaLevel: 0.215 });
const WATER_COLLISION = Object.freeze({ kind: "water", id: "water" });
const chargePads = [
  { x: FIELD_W * 0.05, y: FIELD_H * 0.25 }, { x: FIELD_W * 0.22, y: FIELD_H * 0.48 },
  { x: FIELD_W * 0.39, y: FIELD_H * 0.22 }, { x: FIELD_W * 0.56, y: FIELD_H * 0.76 },
  { x: FIELD_W * 0.73, y: FIELD_H * 0.36 }, { x: FIELD_W * 0.91, y: FIELD_H * 0.78 },
];

function relocateChargePadsToLand() {
  for (const pad of chargePads) {
    if (!scientificWorld.sample(pad.x, pad.y).water) continue;
    let placed = false;
    for (let radius = 60; radius <= 1500 && !placed; radius += 60) {
      for (let step = 0; step < 32; step += 1) {
        const angle = (step / 32) * Math.PI * 2;
        const x = wrapRaw(pad.x + Math.cos(angle) * radius, FIELD_W);
        const y = Math.max(80, Math.min(FIELD_H - 80, pad.y + Math.sin(angle) * radius));
        const sample = scientificWorld.sample(x, y);
        if (!sample.water && sample.relief < 0.82) {
          pad.x = x;
          pad.y = y;
          placed = true;
          break;
        }
      }
    }
  }
}

function wrapRaw(value, maximum) {
  return ((value % maximum) + maximum) % maximum;
}

relocateChargePadsToLand();
const granary = { x: chargePads[0].x, y: chargePads[0].y };

function findBarbarianVillageSite() {
  const antipodeX = wrapRaw(granary.x + FIELD_W / 2, FIELD_W);
  const antipodeY = FIELD_H - granary.y;
  for (let radius = 0; radius <= 1200; radius += 60) {
    for (let step = 0; step < 40; step += 1) {
      const angle = (step / 40) * Math.PI * 2;
      const x = wrapRaw(antipodeX + Math.cos(angle) * radius, FIELD_W);
      const y = Math.max(150, Math.min(FIELD_H - 150, antipodeY + Math.sin(angle) * radius));
      const center = scientificWorld.sample(x, y);
      if (center.water || center.relief > 0.78) continue;
      let dry = true;
      for (let ring = 0; ring < 12; ring += 1) {
        const ringAngle = (ring / 12) * Math.PI * 2;
        if (scientificWorld.sample(wrapRaw(x + Math.cos(ringAngle) * 58, FIELD_W), y + Math.sin(ringAngle) * 58).water) {
          dry = false;
          break;
        }
      }
      if (dry) return { x, y };
    }
  }
  return { x: antipodeX, y: antipodeY };
}

const barbarianSite = findBarbarianVillageSite();

function planetNoise(index, salt = 0) {
  let value = Math.imul(index + 41 + salt * 101, 2654435761);
  value = Math.imul(value ^ (value >>> 15), 2246822519);
  return ((value ^ (value >>> 13)) >>> 0) / 4294967295;
}

function createPlanetObstacles() {
  const result = [];
  for (let index = 0; index < 108; index += 1) {
    const x = 90 + planetNoise(index, 1) * (FIELD_W - 180);
    const y = 110 + planetNoise(index, 2) * (FIELD_H - 220);
    if (scientificWorld.sample(x, y).water) continue;
    if (chargePads.some((pad) => Math.hypot(x - pad.x, y - pad.y) < 190 / SURFACE_SCALE)) continue;
    if (Math.hypot(worldDeltaX(x, barbarianSite.x), y - barbarianSite.y) < 95) continue;
    const choice = planetNoise(index, 3);
    if (choice < 0.14) {
      result.push({ kind: "ellipse", id: "pond", x, y, rx: (85 + planetNoise(index, 4) * 85) / SURFACE_SCALE, ry: (55 + planetNoise(index, 5) * 55) / SURFACE_SCALE });
    } else if (choice < 0.28) {
      result.push({ kind: "circle", id: "flowers", x, y, r: (48 + planetNoise(index, 4) * 44) / SURFACE_SCALE });
    } else if (choice < 0.82) {
      result.push({ kind: "circle", id: "tree", x, y, r: (34 + planetNoise(index, 4) * 27) / SURFACE_SCALE, growth: 1, growthLevel: TREE_GROW_LEVELS, regrowAt: 0, nextGrowthAt: 0 });
    } else {
      result.push({ kind: "circle", id: "stone", x, y, r: (16 + planetNoise(index, 4) * 16) / SURFACE_SCALE });
    }
  }
  return result;
}

const obstacles = createPlanetObstacles();
obstacles.push({ kind: "circle", id: "barbarian-village", x: barbarianSite.x, y: barbarianSite.y, r: 48 });

const lawnLayer = document.createElement("canvas");
const lawnCtx = lawnLayer.getContext("2d");
const CELL_PX = 2;
lawnLayer.width = COLS * CELL_PX;
lawnLayer.height = ROWS * CELL_PX;

const cuttable = new Uint8Array(COLS * ROWS);
const cut = new Uint8Array(COLS * ROWS);
const cropStage = new Uint8Array(COLS * ROWS);
const cropType = new Uint8Array(COLS * ROWS);
let totalCuttable = 0;
let cutCount = 0;
let currentCutCount = 0;
const cropSproutQueue = [];
const cropYoungQueue = [];
const unplantedHarvestCells = [];
let cropSproutHead = 0;
let cropYoungHead = 0;
let cropCellsPlanted = 0;
let seed = 7319;
// Keep the simulation paused until the player explicitly starts it. This also
// ensures the first interaction can unlock audio on mobile browsers.
let running = false;
let finished = false;
let elapsed = 0;
let damage = 0;
let lastImpact = -10;
let view = { scale: 1, x: 0, y: 0 };
let pixelRatio = 1;
let renderer;
let scene;
let camera;
let cameraControls;
let planetRoot;
let mowerModel;
let lawnTexture;
let sun;
let sunTarget;
let cloudLayer;
let treeTrunkInstances;
let treeCrownInstances;
let granaryGrainPile;
let treeVisualsDirty = false;
let treeVisualRefreshIn = 0;
let treesCut = 0;
let treesTrimmed = 0;
let renderPixelRatio = MAX_DEVICE_PIXEL_RATIO;
let performanceWindowTime = 0;
let performanceWindowFrames = 0;
let lawnTextureDirty = false;
let textureRefreshIn = 0;
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
const cameraNormalScratch = new THREE.Vector3(0, 1, 0);
const planetRaySphere = new THREE.Sphere(new THREE.Vector3(), PLANET_RADIUS);
let cameraZoom = 1;
let globeView = false;
let savedCameraPose = null;
let surfaceView = false;
let savedSurfacePose = null;
let surfaceCameraMode = "pov";
let surfaceLookYaw = 0;
let surfaceLookPitch = -0.08;
let surfaceChaseDistance = 480;
const surfacePointers = new Map();
let surfaceLookPointerId = null;
let surfaceLookX = 0;
let surfaceLookY = 0;
let surfacePinchDistance = 0;
let surfacePinchZoom = 1;
let surfacePinchChaseDistance = 480;
let cameraHoldActive = false;
let heldCameraPose = null;
const USE_CUSTOM_CAMERA_CONTROLS = false;

const mower = {
  x: chargePads[0].x,
  y: chargePads[0].y,
  angle: 0.22,
  speed: 0,
  battery: 100,
  width: 48,
  length: 72,
  id: 1,
  workerType: "mower",
  generation: 1,
  level: 1,
  levelBoostUntil: 0,
  deckRadius: DECK_RADIUS,
  baseDeckRadius: DECK_RADIUS,
  clearance: MOWER_CLEARANCE,
  mowedCells: 0,
  reproductionProgress: 0,
  grainCargoCells: 0,
  returningToGranary: false,
  burningUntil: 0,
  arrowStaggerUntil: 0,
  disabledUntil: 0,
  protectedUntil: 18,
  boostFuel: 100,
  boosting: false,
  velocityX: 0,
  velocityY: 0,
};

const offspring = [];
const dragons = [];
const rocs = [];
let nextMowerId = 2;
let birthToastUntil = 0;
let mowersLost = 0;
let upgradeSpent = 0;
let grainStoredKg = 0;
let grainLoadsDelivered = 0;
let grainDeliveredKg = 0;
const castles = [];
let nextCastleId = 1;
let castleConstructionCooldownUntil = 0;
let nextRocId = 1;
let dragonsTakenByRocs = 0;
const villageSkills = { agriculture: 0, machinery: 0, forestry: 0, defense: 0 };
let councilRound = 0;
let nextCouncilAt = 8;
let lastCouncilResult = "Saving grain for the first ballot";
let lastBallot = "";
let silverCoins = 0;
let goldCoins = 0;
let creaturesEatenByCat = 0;
let rocRespawnBlockedUntil = 0;
let apexCat = null;
let villageWallLevel = 0;
let villageWallModel = null;
let timberStock = 0;
let stoneStock = 0;
const stronghold = { housing: 0, mill: 0, smithy: 0, lumberyard: 0, guardTower: 0 };
let strongholdModel = null;
const strongholdMillWheels = [];
const civilizationNames = ["Mower outpost", "Farmstead", "Village", "Town", "Stronghold", "Planetary civilization"];
let civilizationLevel = 0;
let barbarianVillage = null;
const barbarianArrows = [];
let barbarianArrowHits = 0;

const cameraSpin = { yaw: 0, pitch: 0 };

const input = { left: false, right: false, forward: false, reverse: false };
let boostHeld = false;
let eBrakeHeld = false;
const pointerDrive = { active: false, x: 0, y: 0 };
const viewDrag = { active: false, pointerId: null, x: 0, y: 0 };
const globeDrag = { active: false, pointerId: null, normal: new THREE.Vector3() };
const touchPoints = new Map();
let pinchStartDistance = 0;
let pinchStartZoom = 1;
let autoBeforeTouch = false;
const particles = [];

let autoMode = false;
let autoTarget = null;
let autoRetargetIn = 0;
let autoCharging = false;
let autoRecovery = 0;
let autoRecoverySteer = 1;

let audio = null;
let soundOn = true;

function hash(x, y, s = seed) {
  let n = Math.imul(x + 17, 374761393) ^ Math.imul(y + 31, 668265263) ^ s;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function wrapX(x) {
  return ((x % FIELD_W) + FIELD_W) % FIELD_W;
}

function worldDeltaX(targetX, sourceX) {
  let difference = targetX - sourceX;
  if (difference > FIELD_W / 2) difference -= FIELD_W;
  if (difference < -FIELD_W / 2) difference += FIELD_W;
  return difference;
}

function planetFrame(x, y) {
  const longitude = (wrapX(x) / FIELD_W) * Math.PI * 2;
  const latitude = Math.PI / 2 - (Math.max(0, Math.min(FIELD_H, y)) / FIELD_H) * Math.PI;
  const cosLatitude = Math.cos(latitude);
  const normal = new THREE.Vector3(
    -cosLatitude * Math.cos(longitude),
    Math.sin(latitude),
    cosLatitude * Math.sin(longitude),
  );
  const east = new THREE.Vector3(Math.sin(longitude), 0, Math.cos(longitude)).normalize();
  const south = new THREE.Vector3(
    -Math.sin(latitude) * Math.cos(longitude),
    -cosLatitude,
    Math.sin(latitude) * Math.sin(longitude),
  ).normalize();
  return {
    normal,
    east,
    south,
    position: normal.clone().multiplyScalar(PLANET_RADIUS),
  };
}

function topographicDetail(nx, ny, nz, relief) {
  const rolling = Math.sin(nx * 73 + nz * 41 - ny * 29) * Math.cos(ny * 67 + nx * 31);
  const fine = Math.sin(nx * 149 - nz * 113 + ny * 53) * Math.cos(nz * 127 - ny * 47);
  return rolling * (9 + relief * 19) + fine * (3 + relief * 8);
}

function terrainHeightFromNormal(x, y, z) {
  const sample = scientificWorld.sampleNormal(x, y, z);
  if (sample.ocean) return -24 - (scientificWorld.seaLevel - sample.elevation) * 210;
  const continentalRelief = 8 + Math.pow(sample.relief, 1.35) * (TERRAIN_AMPLITUDE - 8);
  const waterCarve = sample.river * 13 + sample.lake * 18;
  // Inland water is texture-defined. Keep its bed above the planet-wide ocean
  // shell so that shell cannot break through as flickering cyan strips.
  return Math.max(6, continentalRelief - waterCarve + topographicDetail(x, y, z, sample.relief));
}

function terrainHeightAt(x, y) {
  const sample = scientificWorld.sample(x, y);
  if (sample.ocean) return -24 - (scientificWorld.seaLevel - sample.elevation) * 210;
  const longitude = (wrapX(x) / FIELD_W) * Math.PI * 2;
  const latitude = Math.PI / 2 - (Math.max(0, Math.min(FIELD_H, y)) / FIELD_H) * Math.PI;
  const cosLatitude = Math.cos(latitude);
  const nx = -cosLatitude * Math.cos(longitude);
  const ny = Math.sin(latitude);
  const nz = cosLatitude * Math.sin(longitude);
  return Math.max(6,
    8 + Math.pow(sample.relief, 1.35) * (TERRAIN_AMPLITUDE - 8)
    - sample.river * 13 - sample.lake * 18
    + topographicDetail(nx, ny, nz, sample.relief));
}

function scientificTerrainColor(sample) {
  if (sample.ocean || sample.lake > 0.22 || sample.river > 0.85) return new THREE.Color(0x71827a);
  const contour = Math.floor(sample.relief * 12) % 2 ? 0.92 : 1;
  if (sample.biome === "alpine") return new THREE.Color(0xa5a79d).multiplyScalar(contour);
  if (sample.biome === "dryland") return new THREE.Color(0x8a7b4f).multiplyScalar(contour);
  if (sample.biome === "wetland") return new THREE.Color(0x315e46).multiplyScalar(contour);
  return new THREE.Color(0x557653).multiplyScalar(contour);
}

function createTerrainGeometry() {
  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, MOBILE_RENDERING ? 192 : 256, MOBILE_RENDERING ? 96 : 160);
  const positions = geometry.getAttribute("position");
  const vertex = new THREE.Vector3();
  const colors = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    vertex.fromBufferAttribute(positions, index).normalize();
    const height = terrainHeightFromNormal(vertex.x, vertex.y, vertex.z);
    const color = scientificTerrainColor(scientificWorld.sampleNormal(vertex.x, vertex.y, vertex.z));
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    vertex.multiplyScalar(PLANET_RADIUS + height);
    positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
  }
  positions.needsUpdate = true;
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function worldVectorToCoordinates(vector) {
  const normal = vector.clone().normalize();
  let longitude = Math.atan2(normal.z, -normal.x);
  if (longitude < 0) longitude += Math.PI * 2;
  const latitude = Math.asin(Math.max(-1, Math.min(1, normal.y)));
  return {
    x: (longitude / (Math.PI * 2)) * FIELD_W,
    y: ((Math.PI / 2 - latitude) / Math.PI) * FIELD_H,
  };
}

function insideObstacle(x, y, margin = 0, skipWater = false) {
  const wrappedX = wrapX(x);
  if (!skipWater && scientificWorld.sample(wrappedX, y).water) return WATER_COLLISION;
  for (const shape of obstacles) {
    if (shape.id === "tree" && shape.growth <= 0.04) continue;
    const dx = worldDeltaX(wrappedX, shape.x);
    if (shape.kind === "rect") {
      if (wrappedX >= shape.x - margin && wrappedX <= shape.x + shape.w + margin && y >= shape.y - margin && y <= shape.y + shape.h + margin) return shape;
    } else if (shape.kind === "circle") {
      const growthScale = shape.id === "tree" ? Math.max(0.08, shape.growth) : 1;
      if (Math.hypot(dx, y - shape.y) <= shape.r * growthScale + margin) return shape;
    } else if (shape.kind === "ellipse") {
      const nx = dx / (shape.rx + margin);
      const ny = (y - shape.y) / (shape.ry + margin);
      if (nx * nx + ny * ny <= 1) return shape;
    }
  }
  return null;
}

function insideChargePad(x, y, margin = 0) {
  return chargePads.some((pad) => Math.abs(worldDeltaX(pad.x, x)) <= 70 / SURFACE_SCALE + margin && Math.abs(pad.y - y) <= 55 / SURFACE_SCALE + margin);
}

function renderGrassCell(col, row, isCut) {
  const x = (col + 0.5) * CELL_W;
  const y = (row + 0.5) * CELL_H;
  const world = scientificWorld.sample(x, y);
  if (world.water) {
    if (world.ocean) {
      // The ocean sphere supplies the visible sea surface. Keeping its bed
      // neutral prevents shoreline raster/mesh differences from flashing blue.
      lawnCtx.fillStyle = "#263a31";
      lawnCtx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX + 0.4, CELL_PX + 0.4);
      return;
    }
    const blueLightness = 23 + world.river * 4 + world.lake * 3;
    lawnCtx.fillStyle = `hsl(199 38% ${blueLightness}%)`;
    lawnCtx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX + 0.4, CELL_PX + 0.4);
    return;
  }
  const noise = hash(col, row);
  const macro = hash(Math.floor(col / 16), Math.floor(row / 12), seed ^ 0x5f3759df);
  const polar = Math.abs((row / Math.max(1, ROWS - 1)) * 2 - 1);
  const stripe = (col + Math.floor(row * 0.35)) % 10 < 5 ? 1 : 0;
  const index = row * COLS + col;
  const stage = cropStage[index];
  const plantedType = cropType[index];
  const cropHues = [52, 48, 112, 278, 205];
  const standingHue = world.biome === "dryland" ? 43 : world.biome === "alpine" ? 62 : world.biome === "wetland" ? 72 : 52;
  const contour = Math.floor(world.relief * 14) % 2;
  const lightness = isCut
    ? stage === 0
      ? 17 + noise * 4 + stripe * 3
      : 20 + stage * 6 + noise * 5 + stripe * 3
    : 39 + noise * 8 + stripe * 3 + (macro - 0.5) * 8 - polar * 3 - contour * 2;
  const saturation = isCut ? stage === 0 ? 32 : 38 + stage * 8 : world.biome === "alpine" ? 18 : 44 + world.moisture * 13;
  const hue = isCut
    ? stage === 0 ? 28 : cropHues[plantedType] + macro * 5
    : plantedType ? cropHues[plantedType] + macro * 5 : standingHue + macro * 7;
  lawnCtx.fillStyle = `hsl(${hue} ${saturation}% ${lightness}%)`;
  lawnCtx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX + 0.4, CELL_PX + 0.4);

  if (isCut && stage > 0 && noise > 0.62) {
    lawnCtx.fillStyle = stage >= 3 ? "rgba(244, 225, 150, .58)" : "rgba(164, 215, 137, .5)";
    lawnCtx.fillRect(col * CELL_PX + stripe * 0.7, row * CELL_PX + 0.45, 0.8, 1.2);
  } else if (!isCut && noise > 0.87) {
    lawnCtx.fillStyle = noise > 0.95 ? "rgba(255, 229, 145, .62)" : "rgba(233, 194, 94, .4)";
    lawnCtx.fillRect(col * CELL_PX + 0.7, row * CELL_PX + 0.5, 1, 1);
  }
}

function generateLawn() {
  cut.fill(0);
  cuttable.fill(0);
  cropStage.fill(0);
  cropType.fill(0);
  totalCuttable = 0;
  cutCount = 0;
  currentCutCount = 0;
  cropSproutQueue.length = 0;
  cropYoungQueue.length = 0;
  unplantedHarvestCells.length = 0;
  cropSproutHead = 0;
  cropYoungHead = 0;
  cropCellsPlanted = 0;
  lawnCtx.fillStyle = "#20352a";
  lawnCtx.fillRect(0, 0, lawnLayer.width, lawnLayer.height);

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = (col + 0.5) * CELL_W;
      const y = (row + 0.5) * CELL_H;
      const index = row * COLS + col;
      const polarBorder = y < 38 / SURFACE_SCALE || y > FIELD_H - 38 / SURFACE_SCALE;
      const world = scientificWorld.sample(x, y);
      if (!polarBorder && !world.water && !insideObstacle(x, y, 8 / SURFACE_SCALE, true) && !insideChargePad(x, y, 5 / SURFACE_SCALE)) {
        cuttable[index] = 1;
        totalCuttable += 1;
        renderGrassCell(col, row, false);
      } else if (world.water) {
        renderGrassCell(col, row, false);
      } else {
        lawnCtx.fillStyle = hash(col, row) > 0.5 ? "#26372e" : "#233229";
        lawnCtx.fillRect(col * CELL_PX, row * CELL_PX, CELL_PX + 0.4, CELL_PX + 0.4);
      }
    }
  }
  if (lawnTexture) lawnTexture.needsUpdate = true;
  lawnTextureDirty = false;
}

function clearOffspring() {
  for (const child of offspring) {
    child.model?.removeFromParent();
    child.model?.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
  }
  offspring.length = 0;
  nextMowerId = 2;
  birthToastUntil = 0;
  ui.birthToast?.classList.remove("is-visible");
}

function clearCastles() {
  clearRocs();
  for (const castle of castles) {
    castle.marker?.remove();
    castle.model?.removeFromParent();
    castle.model?.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
    const obstacleIndex = obstacles.indexOf(castle.collision);
    if (obstacleIndex >= 0) obstacles.splice(obstacleIndex, 1);
  }
  castles.length = 0;
  villageWallModel?.removeFromParent();
  villageWallModel?.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  villageWallModel = null;
  villageWallLevel = 0;
  strongholdModel?.removeFromParent();
  strongholdModel?.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  strongholdModel = null;
  strongholdMillWheels.length = 0;
  Object.keys(stronghold).forEach((building) => { stronghold[building] = 0; });
  civilizationLevel = 0;
  nextCastleId = 1;
  castleConstructionCooldownUntil = 0;
}

function clearRocs() {
  for (const roc of rocs) {
    roc.model?.removeFromParent();
    roc.model?.traverse((object) => {
      object.geometry?.dispose?.();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
      else object.material?.dispose?.();
    });
  }
  rocs.length = 0;
  nextRocId = 1;
  dragonsTakenByRocs = 0;
}

function resetBarbarianVillage() {
  for (const arrow of barbarianArrows) arrow.model?.removeFromParent();
  barbarianArrows.length = 0;
  barbarianArrowHits = 0;
  for (const [index, bowman] of (barbarianVillage?.bowmen || []).entries()) {
    bowman.nextShot = 16 + index * 0.45;
    bowman.draw = 0;
  }
}

function resetLawn() {
  if (surfaceView) leaveSurfaceView();
  clearOffspring();
  clearCastles();
  for (const tree of obstacles.filter((shape) => shape.id === "tree")) {
    tree.growth = 1;
    tree.growthLevel = TREE_GROW_LEVELS;
    tree.regrowAt = 0;
    tree.nextGrowthAt = 0;
  }
  treesCut = 0;
  treesTrimmed = 0;
  treeVisualsDirty = true;
  seed = (seed * 1664525 + 1013904223) >>> 0;
  generateLawn();
  mower.x = chargePads[0].x;
  mower.y = chargePads[0].y;
  mower.angle = 0.22;
  mower.speed = 0;
  mower.battery = 100;
  mower.mowedCells = 0;
  mower.level = 1;
  mower.levelBoostUntil = 0;
  mower.baseDeckRadius = mower.workerType === "tractor" ? 82 / SURFACE_SCALE : DECK_RADIUS;
  mower.deckRadius = mower.baseDeckRadius;
  mower.reproductionProgress = 0;
  mower.grainCargoCells = 0;
  mower.returningToGranary = false;
  mower.burningUntil = 0;
  mower.arrowStaggerUntil = 0;
  mower.disabledUntil = 0;
  mower.protectedUntil = 18;
  mower.boostFuel = 100;
  mower.boosting = false;
  mower.velocityX = 0;
  mower.velocityY = 0;
  if (mowerModel) mowerModel.visible = true;
  mowersLost = 0;
  upgradeSpent = 0;
  grainStoredKg = 0;
  grainLoadsDelivered = 0;
  grainDeliveredKg = 0;
  timberStock = 0;
  stoneStock = 0;
  Object.keys(villageSkills).forEach((skill) => { villageSkills[skill] = 0; });
  councilRound = 0;
  nextCouncilAt = 8;
  lastCouncilResult = "Saving grain for the first ballot";
  lastBallot = "";
  silverCoins = 0;
  goldCoins = 0;
  creaturesEatenByCat = 0;
  rocRespawnBlockedUntil = 0;
  resetApexCat();
  elapsed = 0;
  damage = 0;
  finished = false;
  particles.length = 0;
  autoTarget = null;
  autoRetargetIn = 0;
  autoCharging = false;
  autoRecovery = 0;
  resetDragons();
  resetBarbarianVillage();
  ui.finishModal.classList.remove("modal--open");
  running = true;
  updateUI();
}

function initAudio() {
  if (audio) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    soundOn = false;
    return;
  }
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const harmonic = context.createOscillator();
  const gain = context.createGain();
  const harmonicGain = context.createGain();
  oscillator.type = "sawtooth";
  harmonic.type = "square";
  oscillator.frequency.value = 52;
  harmonic.frequency.value = 104;
  gain.gain.value = 0;
  harmonicGain.gain.value = 0.018;
  oscillator.connect(gain);
  harmonic.connect(harmonicGain).connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  harmonic.start();
  audio = { context, oscillator, harmonic, gain };
}

function updateAudio() {
  if (!audio) return;
  const now = audio.context.currentTime;
  const speedRatio = Math.min(1, Math.abs(mower.speed) / (210 * SPEED_SCALE));
  const level = soundOn && running ? 0.018 + speedRatio * 0.035 : 0;
  audio.gain.gain.setTargetAtTime(level, now, 0.05);
  audio.oscillator.frequency.setTargetAtTime(52 + speedRatio * 20, now, 0.05);
  audio.harmonic.frequency.setTargetAtTime(104 + speedRatio * 34, now, 0.05);
}

function grainCapacityKg(agent) {
  const baseCapacity = agent.workerType === "tractor"
    ? 2.2
    : agent.workerType === "planter"
      ? 0
    : agent.workerType === "trimmer"
      ? 0.35
      : agent.workerType === "chainsaw"
        ? 0
        : agent.workerType === "bucket"
          ? 0
        : 0.65;
  return baseCapacity * (1 + ((agent.level || 1) - 1) * 0.12) * (1 + villageSkills.machinery * 0.1);
}

function colonyCapacity() {
  return Math.min(MAX_COLONY, BASE_COLONY_CAP + stronghold.housing + (stronghold.housing >= MAX_STRONGHOLD_LEVEL ? 1 : 0));
}

function grainCargoKg(agent) {
  return (agent.grainCargoCells || 0) * CLIPPINGS_PER_CELL;
}

function grainHoldIsFull(agent) {
  const capacity = grainCapacityKg(agent);
  return capacity > 0 && grainCargoKg(agent) >= capacity;
}

function isAtGranary(agent) {
  return Math.hypot(worldDeltaX(granary.x, agent.x), granary.y - agent.y) <= GRANARY_UNLOAD_RADIUS;
}

function tryUnloadGrain(agent) {
  if (["chainsaw", "bucket", "miner"].includes(agent.workerType) || !isAtGranary(agent) || Math.abs(agent.speed) > 18 * SPEED_SCALE) return 0;
  const delivered = grainCargoKg(agent);
  if (delivered <= 0.001) {
    agent.returningToGranary = false;
    return 0;
  }
  const milled = delivered * (1 + stronghold.mill * 0.12);
  grainStoredKg += milled;
  grainLoadsDelivered += 1;
  grainDeliveredKg += milled;
  if (nextCouncilAt > elapsed + 1.5) nextCouncilAt = elapsed + 1.5;
  agent.grainCargoCells = 0;
  agent.returningToGranary = false;
  agent.target = null;
  if (agent === mower) autoTarget = null;
  const workerName = agent === mower ? "Founder" : agent.workerType === "trimmer" ? `Harvester ${agent.id}` : `Mower ${agent.id}`;
  announceAttack(`${workerName} delivered ${milled.toFixed(1)} kg crop to the ${stronghold.mill ? "mill" : "granary"}`);
  return milled;
}

function mintSilver() {
  if (grainStoredKg + 0.0001 < SILVER_GRAIN_COST) {
    announceAttack(`${(SILVER_GRAIN_COST - grainStoredKg).toFixed(1)} kg more grain needed to mint silver`);
    return false;
  }
  grainStoredKg -= SILVER_GRAIN_COST;
  silverCoins += SILVER_PER_MINT;
  announceAttack(`${SILVER_GRAIN_COST.toFixed(1)} kg grain minted into ${SILVER_PER_MINT} silver`);
  return true;
}

function mintGold() {
  if (silverCoins < SILVER_PER_GOLD) {
    announceAttack(`${SILVER_PER_GOLD - silverCoins} more silver needed to mint gold`);
    return false;
  }
  silverCoins -= SILVER_PER_GOLD;
  goldCoins += 1;
  announceAttack(`${SILVER_PER_GOLD} silver coined into 1 gold`);
  return true;
}

function castleSiteIsDry(x, y, radius) {
  const center = scientificWorld.sample(x, y);
  if (center.water || center.relief < 0.24) return false;
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    const sample = scientificWorld.sample(wrapX(x + Math.cos(angle) * radius), y + Math.sin(angle) * radius);
    if (sample.water) return false;
  }
  return true;
}

function castleSiteIsAvailable(x, y, siteRadius, nearGranary = false) {
  if (!castleSiteIsDry(x, y, siteRadius)) return false;
  if (insideObstacle(x, y, siteRadius)) return false;
  const stationClearance = nearGranary ? 48 : 95;
  const granaryClearance = nearGranary ? 52 : 120;
  if (chargePads.some((pad) => Math.hypot(worldDeltaX(x, pad.x), y - pad.y) < stationClearance)) return false;
  if (Math.hypot(worldDeltaX(x, granary.x), y - granary.y) < granaryClearance) return false;
  if (castles.some((castle) => Math.hypot(worldDeltaX(x, castle.x), y - castle.y) < 175)) return false;
  return true;
}

function findCastleSite() {
  // The first and only castle is the spawn citadel: the granary/charge-pad
  // where the founder mower begins becomes the protected heart of the fort.
  if (castles.length >= MAX_CASTLES) return null;
  return { x: granary.x, y: granary.y, score: 1 };
}

function createCastleModel(castle) {
  const level = castle.level;
  const group = new THREE.Group();
  group.name = `spawn-citadel-level-${level}`;
  const frame = planetFrame(castle.x, castle.y);
  group.position.copy(frame.normal).multiplyScalar(PLANET_RADIUS + terrainHeightAt(castle.x, castle.y) + 3);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    frame.east,
    frame.normal,
    frame.east.clone().cross(frame.normal).normalize(),
  ));

  const modelScale = 0.9;
  const stonePalette = [0x716d63, 0x79756b, 0x817d72, 0x898477, 0x918b7c, 0x999282, 0xa29a89];
  const bannerPalette = [0x9f3f31, 0xb14b34, 0xc06b36, 0xc89135, 0xa36d32, 0x7f4c8e, 0x6c3f87];
  const stone = new THREE.MeshStandardMaterial({ color: stonePalette[level - 1], roughness: 0.95, metalness: 0.02 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x353631, roughness: 0.9, metalness: 0.08 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x222928, roughness: 0.48, metalness: 0.74 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x553824, roughness: 0.92 });
  const archerDark = new THREE.MeshStandardMaterial({ color: 0x171b19, emissive: 0x090d0b, emissiveIntensity: 0.12, roughness: 1 });
  const bannerMaterial = new THREE.MeshStandardMaterial({
    color: bannerPalette[level - 1],
    emissive: 0x210b09,
    emissiveIntensity: 0.16,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });

  const addMesh = (geometry, material, x, y, z, parent = group) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Leave the exact spawn/granary center as a courtyard so the mower can
  // still drive and unload. The keep anchors the north-west side instead.
  const keepSize = 72 + level * 5;
  const keepHeight = 84 + level * 17;
  const keepX = -98;
  const keepZ = -82;
  addMesh(new THREE.BoxGeometry(keepSize, keepHeight, keepSize), stone, keepX, keepHeight / 2, keepZ);
  addMesh(new THREE.BoxGeometry(keepSize + 12, 8, keepSize + 12), darkStone, keepX, keepHeight + 2, keepZ);

  const keepMerlon = 12;
  for (let index = -2; index <= 2; index += 1) {
    const along = index * (keepSize / 5);
    addMesh(new THREE.BoxGeometry(keepMerlon, 14, 10), stone, keepX + along, keepHeight + 12, keepZ - keepSize / 2);
    addMesh(new THREE.BoxGeometry(keepMerlon, 14, 10), stone, keepX + along, keepHeight + 12, keepZ + keepSize / 2);
    addMesh(new THREE.BoxGeometry(10, 14, keepMerlon), stone, keepX - keepSize / 2, keepHeight + 12, keepZ + along);
    addMesh(new THREE.BoxGeometry(10, 14, keepMerlon), stone, keepX + keepSize / 2, keepHeight + 12, keepZ + along);
  }

  const flagPole = addMesh(new THREE.CylinderGeometry(2.4, 3, 82, 8), darkStone, keepX, keepHeight + 45, keepZ);
  flagPole.castShadow = false;
  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(44 + level * 4, 9);
  flagShape.lineTo(0, 23);
  flagShape.closePath();
  const flag = addMesh(new THREE.ShapeGeometry(flagShape), bannerMaterial, keepX + 3, keepHeight + 60, keepZ);
  flag.rotation.y = Math.PI / 2;

  const ringRadii = [170];
  if (level >= 4) ringRadii.push(305);
  if (level >= 6) ringRadii.push(455);
  group.userData.ringRadii = ringRadii.slice();
  group.userData.portcullises = [];

  const addCrenellations = (radius, wallHeight, wallThickness, gateHalfWidth, ringIndex) => {
    const count = MOBILE_RENDERING ? 7 : 11;
    const merlonWidth = 15 + ringIndex * 2;
    const inset = 4;
    for (let index = 0; index < count; index += 1) {
      const t = -radius + 20 + index * ((radius * 2 - 40) / Math.max(1, count - 1));
      addMesh(new THREE.BoxGeometry(merlonWidth, 15, wallThickness + 7), stone, t, wallHeight + 7, -radius + inset);
      addMesh(new THREE.BoxGeometry(merlonWidth, 15, wallThickness + 7), stone, t, wallHeight + 7, radius - inset);
      addMesh(new THREE.BoxGeometry(wallThickness + 7, 15, merlonWidth), stone, -radius + inset, wallHeight + 7, t);
      if (Math.abs(t) > gateHalfWidth + 14) {
        addMesh(new THREE.BoxGeometry(wallThickness + 7, 15, merlonWidth), stone, radius - inset, wallHeight + 7, t);
      }
    }
  };

  const addTower = (x, z, wallHeight, ringIndex, outwardX = 0, outwardZ = 0) => {
    const towerRadius = 25 + level * 1.5 + ringIndex * 3;
    const towerHeight = wallHeight + 30 + Math.max(0, 2 - ringIndex) * 8 + level * 2;
    addMesh(new THREE.CylinderGeometry(towerRadius * 1.03, towerRadius * 1.11, towerHeight, 10), stone, x, towerHeight / 2, z);
    const crown = addMesh(new THREE.CylinderGeometry(towerRadius * 1.24, towerRadius * 1.14, 11, 10), darkStone, x, towerHeight + 2, z);
    crown.castShadow = true;
    if (level >= 2) {
      const slitY = towerHeight * 0.62;
      const sx = outwardX || Math.sign(x);
      const sz = outwardZ || Math.sign(z);
      const slitX = x + sx * (towerRadius + 0.8);
      const slitZ = z + sz * (towerRadius + 0.8);
      const slit = addMesh(new THREE.BoxGeometry(sz ? 8 : 2.5, 18, sx ? 8 : 2.5), archerDark, slitX, slitY, slitZ);
      slit.castShadow = false;
    }
    return towerHeight;
  };

  const addPortcullis = (radius, wallHeight, gateHalfWidth, wallThickness, ringIndex) => {
    const gateGroup = new THREE.Group();
    gateGroup.name = `portcullis-ring-${ringIndex + 1}`;
    gateGroup.position.set(radius + wallThickness * 0.05, 0, 0);
    const gateHeight = Math.max(42, wallHeight * 0.72);
    const barCount = MOBILE_RENDERING ? 7 : 9;
    for (let index = 0; index < barCount; index += 1) {
      const z = -gateHalfWidth + (index / Math.max(1, barCount - 1)) * gateHalfWidth * 2;
      const bar = addMesh(new THREE.BoxGeometry(3.3, gateHeight, 3.3), iron, 0, gateHeight / 2, z, gateGroup);
      bar.castShadow = false;
    }
    for (const y of [gateHeight * 0.34, gateHeight * 0.67]) {
      const brace = addMesh(new THREE.BoxGeometry(3.8, 3.8, gateHalfWidth * 2 + 8), iron, 0, y, 0, gateGroup);
      brace.castShadow = false;
    }
    gateGroup.userData.closedY = 0;
    gateGroup.userData.openY = gateHeight * 0.86;
    gateGroup.userData.openAmount = 0;
    group.add(gateGroup);
    group.userData.portcullises.push(gateGroup);
  };

  ringRadii.forEach((radius, ringIndex) => {
    const wallHeight = 54 + level * 7 - ringIndex * 5;
    const wallThickness = 16 + level * 1.5 + ringIndex * 2;
    const gateHalfWidth = 42 + level * 2 + ringIndex * 4;
    const west = addMesh(new THREE.BoxGeometry(wallThickness, wallHeight, radius * 2), stone, -radius, wallHeight / 2, 0);
    const north = addMesh(new THREE.BoxGeometry(radius * 2, wallHeight, wallThickness), stone, 0, wallHeight / 2, -radius);
    const south = addMesh(new THREE.BoxGeometry(radius * 2, wallHeight, wallThickness), stone, 0, wallHeight / 2, radius);
    const eastSegmentLength = radius - gateHalfWidth;
    const eastA = addMesh(new THREE.BoxGeometry(wallThickness, wallHeight, eastSegmentLength), stone, radius, wallHeight / 2, -(gateHalfWidth + eastSegmentLength / 2));
    const eastB = addMesh(new THREE.BoxGeometry(wallThickness, wallHeight, eastSegmentLength), stone, radius, wallHeight / 2, gateHalfWidth + eastSegmentLength / 2);
    [west, north, south, eastA, eastB].forEach((wall) => { wall.receiveShadow = true; });

    addCrenellations(radius, wallHeight, wallThickness, gateHalfWidth, ringIndex);
    addTower(-radius, -radius, wallHeight, ringIndex, -1, -1);
    addTower(-radius, radius, wallHeight, ringIndex, -1, 1);
    addTower(radius, -radius, wallHeight, ringIndex, 1, -1);
    addTower(radius, radius, wallHeight, ringIndex, 1, 1);

    const gateTowerZ = gateHalfWidth + 26 + ringIndex * 3;
    const gateTowerHeight = Math.max(
      addTower(radius, -gateTowerZ, wallHeight + 8, ringIndex, 1, 0),
      addTower(radius, gateTowerZ, wallHeight + 8, ringIndex, 1, 0),
    );
    addMesh(new THREE.BoxGeometry(wallThickness + 12, 18, gateTowerZ * 2 - 30), darkStone, radius, wallHeight + 18, 0);
    addPortcullis(radius, wallHeight, gateHalfWidth, wallThickness, ringIndex);

    if (level >= 5 && ringIndex > 0) {
      addTower(0, -radius, wallHeight, ringIndex, 0, -1);
      addTower(0, radius, wallHeight, ringIndex, 0, 1);
      addTower(-radius, 0, wallHeight, ringIndex, -1, 0);
    }
    if (level >= 7 && ringIndex === ringRadii.length - 1) {
      const barbicanX = radius + 72;
      addTower(barbicanX, -gateTowerZ * 0.72, wallHeight - 4, ringIndex, 1, 0);
      addTower(barbicanX, gateTowerZ * 0.72, wallHeight - 4, ringIndex, 1, 0);
      addMesh(new THREE.BoxGeometry(72, 12, gateTowerZ * 1.25), darkStone, radius + 36, 9, 0);
    }
  });

  if (level >= 2) {
    const archerCount = MOBILE_RENDERING ? 4 + level : 6 + level * 2;
    const outerRadius = ringRadii[ringRadii.length - 1];
    for (let index = 0; index < archerCount; index += 1) {
      const angle = (index / archerCount) * Math.PI * 2;
      const radius = outerRadius - 18;
      const post = addMesh(new THREE.CylinderGeometry(2.1, 2.3, 18, 6), wood, Math.cos(angle) * radius, 62 + level * 5, Math.sin(angle) * radius);
      post.castShadow = false;
    }
  }

  // A roc nest remains on the oldest inner tower as a visual callback to
  // the existing anti-dragon system.
  const nestMaterial = new THREE.MeshStandardMaterial({ color: 0x594128, roughness: 1, side: THREE.DoubleSide });
  const nest = addMesh(new THREE.TorusGeometry(27 + level, 7, 7, 22), nestMaterial, -170, 108 + level * 8, -170);
  nest.rotation.x = Math.PI / 2;

  group.scale.setScalar(modelScale);
  return group;
}

function createCastleMarker(castle) {
  const marker = document.createElement("span");
  marker.className = "castle-dot";
  marker.style.left = `${8 + (castle.x / FIELD_W) * 84}%`;
  marker.style.top = `${8 + (castle.y / FIELD_H) * 84}%`;
  ui.planetGlobe?.prepend(marker);
  return marker;
}

function foundCastle() {
  const site = findCastleSite();
  if (!site || !planetRoot) {
    castleConstructionCooldownUntil = elapsed + 5;
    return false;
  }
  const castle = {
    id: nextCastleId++,
    x: site.x,
    y: site.y,
    level: 1,
    collision: { kind: "circle", id: "castle-keep", x: wrapX(site.x - 16), y: site.y - 13, r: 9 },
  };
  castle.model = createCastleModel(castle);
  castle.marker = createCastleMarker(castle);
  obstacles.push(castle.collision);
  castles.push(castle);
  planetRoot.add(castle.model);
  const foundationCost = castles.length === 1 ? FIRST_CASTLE_COST : CASTLE_FOUNDATION_COST;
  grainStoredKg = Math.max(0, grainStoredKg - foundationCost);
  castleConstructionCooldownUntil = elapsed + 2.8;
  announceAttack(castle.id === 1
    ? `Castle 1 founded near the granary · ${foundationCost.toFixed(1)} kg grain`
    : `Castle ${castle.id} founded on high ground · ${foundationCost.toFixed(1)} kg grain`);
  return true;
}

function upgradeCastle(castle) {
  const cost = CASTLE_UPGRADE_COST * castle.level;
  if (grainStoredKg < cost || castle.level >= MAX_CASTLE_LEVEL) return false;
  grainStoredKg -= cost;
  castle.level += 1;
  castle.collision.r = 9 + castle.level * 0.8;
  castle.model?.removeFromParent();
  castle.model?.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  castle.model = createCastleModel(castle);
  planetRoot.add(castle.model);
  castleConstructionCooldownUntil = elapsed + 3.2;
  announceAttack(`Castle ${castle.id} upgraded to level ${castle.level} · ${cost.toFixed(1)} kg grain`);
  return true;
}

function villageWallCost() {
  return 0.8 + villageWallLevel * 0.45;
}

function villageWallResourceCost() {
  return {
    cost: villageWallCost(),
    timberCost: 0.5 + villageWallLevel * 0.25,
    stoneCost: 1 + villageWallLevel * 0.5,
  };
}

function strongholdBuildingCost(type) {
  const level = stronghold[type];
  const costs = {
    housing: { cost: 0.45 + level * 0.3, timberCost: 1 + level * 0.75, stoneCost: 0.5 + level * 0.25 },
    mill: { cost: 0.65 + level * 0.4, timberCost: 1.5 + level, stoneCost: 1 + level * 0.5 },
    smithy: { cost: 0.55 + level * 0.4, timberCost: 0.5 + level * 0.5, stoneCost: 2 + level },
    lumberyard: { cost: 0.4 + level * 0.25, timberCost: 0.5 + level * 0.5, stoneCost: 0.5 + level * 0.25 },
    guardTower: { cost: 0.7 + level * 0.4, timberCost: 1 + level * 0.75, stoneCost: 2 + level },
  };
  return costs[type];
}

function proposalAffordable(proposal) {
  return proposal.cost <= grainStoredKg + 0.0001
    && (proposal.timberCost || 0) <= timberStock + 0.0001
    && (proposal.stoneCost || 0) <= stoneStock + 0.0001;
}

function spendProposalResources(proposal) {
  if (!proposalAffordable(proposal)) return false;
  grainStoredKg -= proposal.cost || 0;
  timberStock -= proposal.timberCost || 0;
  stoneStock -= proposal.stoneCost || 0;
  return true;
}

function strongholdCostText(cost) {
  const pieces = [`${cost.cost.toFixed(1)}g`];
  if (cost.timberCost) pieces.push(`${cost.timberCost.toFixed(1)}t`);
  if (cost.stoneCost) pieces.push(`${cost.stoneCost.toFixed(1)}s`);
  return pieces.join("/");
}

function civilizationTargetLevel() {
  const population = 1 + offspring.length;
  const buildings = Object.values(stronghold).reduce((total, level) => total + level, 0);
  if (population >= 12 && buildings >= 16 && villageWallLevel >= 5 && castles.length) return 5;
  if (population >= 10 && buildings >= 11 && villageWallLevel >= 3) return 4;
  if (population >= 7 && buildings >= 6 && villageWallLevel >= 1) return 3;
  if (population >= 4 && buildings >= 2) return 2;
  if (population >= 2) return 1;
  return 0;
}

function updateCivilization() {
  const nextLevel = Math.max(civilizationLevel, civilizationTargetLevel());
  if (nextLevel === civilizationLevel) return;
  civilizationLevel = nextLevel;
  refreshStrongholdModel();
  announceAttack(`${civilizationNames[civilizationLevel]} established · the mower council expands the settlement`);
}

function refreshStrongholdModel() {
  if (!planetRoot) return;
  strongholdModel?.removeFromParent();
  strongholdModel?.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  strongholdMillWheels.length = 0;
  const group = new THREE.Group();
  group.name = "stronghold-workshops";
  const frame = planetFrame(granary.x, granary.y);
  group.position.copy(frame.normal).multiplyScalar(PLANET_RADIUS + terrainHeightAt(granary.x, granary.y) + 3);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    frame.east,
    frame.normal,
    frame.east.clone().cross(frame.normal).normalize(),
  ));
  const stone = new THREE.MeshStandardMaterial({ color: 0x79786f, roughness: 0.96 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x63462f, roughness: 0.95 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x3c342f, roughness: 0.9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x343b3a, roughness: 0.48, metalness: 0.5 });
  const ember = new THREE.MeshStandardMaterial({ color: 0xf18a3b, emissive: 0xb83712, emissiveIntensity: 1.2 });
  const mesh = (geometry, material, position, parent = group) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  };
  if (civilizationLevel >= 1) {
    mesh(new THREE.CylinderGeometry(44, 52, 10, 10), stone, [0, 5, 0]);
    mesh(new THREE.CylinderGeometry(14, 23, 18, 8), ember, [0, 14, 0]);
  }
  if (civilizationLevel >= 2) {
    mesh(new THREE.BoxGeometry(560, 4, 28), stone, [0, 2, 0]);
    mesh(new THREE.BoxGeometry(28, 4, 560), stone, [0, 2, 0]);
  }
  if (civilizationLevel >= 3) {
    mesh(new THREE.CylinderGeometry(86, 100, 12, 12), stone, [0, 6, 0]);
    const marketRoof = mesh(new THREE.ConeGeometry(74, 48, 8), roof, [0, 40, 0]);
    marketRoof.rotation.y = Math.PI / 8;
  }
  if (civilizationLevel >= 4) {
    mesh(new THREE.BoxGeometry(122, 86, 104), stone, [0, 43, 0]);
    const hallRoof = mesh(new THREE.ConeGeometry(92, 56, 4), roof, [0, 114, 0]);
    hallRoof.rotation.y = Math.PI / 4;
  }
  if (civilizationLevel >= 5) {
    mesh(new THREE.CylinderGeometry(20, 27, 180, 10), iron, [0, 90, 0]);
    mesh(new THREE.SphereGeometry(28, 12, 8), ember, [0, 190, 0]);
  }
  const houseSites = [[-260, -150], [-205, -270], [-95, -330], [35, -330], [155, -285], [250, -195], [285, -70]];
  for (let index = 0; index < stronghold.housing; index += 1) {
    const [x, z] = houseSites[index % houseSites.length];
    mesh(new THREE.BoxGeometry(92, 62, 74), stone, [x, 31, z]);
    const cap = mesh(new THREE.ConeGeometry(66, 46, 4), roof, [x, 83, z]);
    cap.rotation.y = Math.PI / 4;
    mesh(new THREE.BoxGeometry(24, 38, 4), wood, [x, 19, z + 39]);
  }
  if (stronghold.mill) {
    const x = -275, z = 95;
    const millHeight = 90 + stronghold.mill * 12;
    mesh(new THREE.CylinderGeometry(54, 64, millHeight, 10), stone, [x, millHeight / 2, z]);
    const cap = mesh(new THREE.ConeGeometry(68 + stronghold.mill * 2, 62, 10), roof, [x, millHeight + 31, z]);
    cap.rotation.y = Math.PI / 10;
    const wheel = new THREE.Group();
    wheel.position.set(x, millHeight * 0.72, z + 59);
    for (let blade = 0; blade < 4; blade += 1) {
      const arm = mesh(new THREE.BoxGeometry(10, 112, 6), wood, [0, 49, 0], wheel);
      arm.rotation.z = blade * Math.PI / 2;
    }
    group.add(wheel);
    strongholdMillWheels.push(wheel);
  }
  if (stronghold.smithy) {
    const x = -40, z = 220;
    const smithyHeight = 62 + stronghold.smithy * 8;
    mesh(new THREE.BoxGeometry(120 + stronghold.smithy * 8, smithyHeight, 92), stone, [x, smithyHeight / 2, z]);
    const cap = mesh(new THREE.ConeGeometry(88 + stronghold.smithy * 3, 48, 4), roof, [x, smithyHeight + 24, z]);
    cap.rotation.y = Math.PI / 4;
    mesh(new THREE.BoxGeometry(25, 80 + stronghold.smithy * 14, 25), stone, [x - 35, 60 + stronghold.smithy * 7, z - 22]);
    mesh(new THREE.BoxGeometry(25, 9, 19), ember, [x + 38, 24, z + 49]);
    mesh(new THREE.BoxGeometry(52, 8, 25), iron, [x + 22, 30, z + 44]);
  }
  if (stronghold.lumberyard) {
    const x = 225, z = 175;
    mesh(new THREE.BoxGeometry(150, 12, 108), wood, [x, 6, z]);
    const logRows = Math.min(5, 1 + stronghold.lumberyard);
    for (let row = 0; row < logRows; row += 1) {
      for (let log = 0; log < 4; log += 1) {
        const timber = mesh(new THREE.CylinderGeometry(8, 8, 96, 8), wood, [x - 50 + log * 31, 18 + row * 15, z]);
        timber.rotation.x = Math.PI / 2;
      }
    }
  }
  const towerSites = [[330, -160], [345, 35], [285, 225], [115, 340], [-105, 345], [-285, 230], [-345, 25]];
  for (let index = 0; index < stronghold.guardTower; index += 1) {
    const [x, z] = towerSites[index % towerSites.length];
    const towerHeight = 100 + (index + 1) * 12;
    mesh(new THREE.CylinderGeometry(35, 42, towerHeight, 8), stone, [x, towerHeight / 2, z]);
    mesh(new THREE.CylinderGeometry(48, 43, 15, 8), roof, [x, towerHeight + 3, z]);
  }
  group.scale.setScalar(0.9);
  strongholdModel = group;
  planetRoot.add(group);
}

function buildStronghold(type, proposal) {
  if (!planetRoot || stronghold[type] >= MAX_STRONGHOLD_LEVEL || !spendProposalResources(proposal)) return false;
  stronghold[type] += 1;
  refreshStrongholdModel();
  castleConstructionCooldownUntil = elapsed + 2.5;
  const labels = { housing: "housing quarter", mill: "windmill", smithy: "smithy", lumberyard: "lumberyard", guardTower: "guard tower" };
  announceAttack(`${labels[type]} raised to level ${stronghold[type]} · ${strongholdCostText(proposal)}`);
  return true;
}

function createVillageWallModel(level) {
  const group = new THREE.Group();
  group.name = `village-walls-level-${level}`;
  const frame = planetFrame(granary.x, granary.y);
  group.position.copy(frame.normal).multiplyScalar(PLANET_RADIUS + terrainHeightAt(granary.x, granary.y) + 2);
  const basis = new THREE.Matrix4().makeBasis(
    frame.east,
    frame.normal,
    frame.east.clone().cross(frame.normal).normalize(),
  );
  group.quaternion.setFromRotationMatrix(basis);
  const stone = new THREE.MeshStandardMaterial({ color: level < 4 ? 0x716d63 : 0x898377, roughness: 0.94 });
  const cap = new THREE.MeshStandardMaterial({ color: 0x343531, roughness: 0.88 });
  const banner = new THREE.MeshStandardMaterial({ color: 0xb44b35, emissive: 0x2b0d08, emissiveIntensity: 0.18, roughness: 0.82 });
  const segments = 24;
  const radius = 700 + level * 48;
  const wallHeight = 48 + level * 9;
  const thickness = 18 + level * 2.5;
  const segmentLength = (Math.PI * 2 * radius / segments) * 0.91;
  const addPart = (geometry, material, x, y, z, rotationY = 0) => {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.rotation.y = rotationY;
    part.castShadow = true;
    part.receiveShadow = true;
    group.add(part);
    return part;
  };
  for (let index = 0; index < segments; index += 1) {
    if ([0, 6, 12, 18].includes(index)) continue;
    const angle = (index / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    addPart(new THREE.BoxGeometry(segmentLength, wallHeight, thickness), stone, x, wallHeight / 2, z, -angle);
    if (level >= 3) {
      for (const offset of [-0.34, 0, 0.34]) {
        const blockX = x + Math.cos(angle + Math.PI / 2) * segmentLength * offset;
        const blockZ = z + Math.sin(angle + Math.PI / 2) * segmentLength * offset;
        addPart(new THREE.BoxGeometry(21, 14, thickness + 7), cap, blockX, wallHeight + 6, blockZ, -angle);
      }
    }
  }
  for (const index of [0, 3, 6, 9, 12, 15, 18, 21]) {
    const angle = (index / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const gate = [0, 6, 12, 18].includes(index);
    const towerRadius = gate ? 29 + level * 2 : 24 + level * 1.5;
    const towerHeight = wallHeight + (gate ? 36 : 22);
    const sideOffsets = gate ? [-42, 42] : [0];
    for (const offset of sideOffsets) {
      const tx = x + Math.cos(angle + Math.PI / 2) * offset;
      const tz = z + Math.sin(angle + Math.PI / 2) * offset;
      addPart(new THREE.CylinderGeometry(towerRadius, towerRadius * 1.06, towerHeight, 10), stone, tx, towerHeight / 2, tz);
      const crown = addPart(new THREE.TorusGeometry(towerRadius * 0.82, 4, 6, 18), cap, tx, towerHeight, tz);
      crown.rotation.x = Math.PI / 2;
    }
    if (gate) {
      const arch = addPart(new THREE.BoxGeometry(86, 16, thickness + 8), cap, x, wallHeight + 12, z, -angle);
      arch.castShadow = true;
      if (level >= 2) {
        const flag = addPart(new THREE.BoxGeometry(3, 42, 3), cap, x, wallHeight + 40, z);
        const cloth = addPart(new THREE.BoxGeometry(28, 15, 2), banner, x + 14, wallHeight + 53, z);
        cloth.rotation.y = -angle;
        flag.castShadow = false;
      }
    }
  }
  group.scale.setScalar(0.9);
  return group;
}

function expandVillageWalls() {
  if (!planetRoot || villageWallLevel >= MAX_VILLAGE_WALL_LEVEL) return false;
  const cost = villageWallResourceCost();
  if (!spendProposalResources(cost)) return false;
  villageWallLevel += 1;
  villageWallModel?.removeFromParent();
  villageWallModel?.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  villageWallModel = createVillageWallModel(villageWallLevel);
  planetRoot.add(villageWallModel);
  castleConstructionCooldownUntil = elapsed + 2.6;
  announceAttack(`Village walls expanded to level ${villageWallLevel} · ${strongholdCostText(cost)}`);
  return true;
}

function villageSkillCost(skill) {
  return 0.7 + villageSkills[skill] * 0.35;
}

function councilCitizens() {
  return [mower, ...offspring].filter((worker) => !(worker.disabledUntil > elapsed));
}

function councilProposals() {
  const proposals = [];
  if (!castles.length) {
    proposals.push({ key: "castle", label: "Spawn citadel 1", cost: FIRST_CASTLE_COST, execute: () => foundCastle() });
  } else if (castles[0].level < MAX_CASTLE_LEVEL) {
    const castle = castles[0];
    const cost = CASTLE_UPGRADE_COST * castle.level;
    proposals.push({ key: "castle", label: `Spawn citadel ${castle.level + 1}`, cost, execute: () => upgradeCastle(castle) });
  }
  if (villageWallLevel < MAX_VILLAGE_WALL_LEVEL) {
    proposals.push({ key: "walls", label: `Village walls ${villageWallLevel + 1}`, ...villageWallResourceCost(), execute: () => expandVillageWalls() });
  }
  for (const [key, label] of [["housing", "Housing"], ["mill", "Mill"], ["smithy", "Smithy"], ["lumberyard", "Lumberyard"], ["guardTower", "Watchtower"]]) {
    if (stronghold[key] >= MAX_STRONGHOLD_LEVEL) continue;
    const proposal = { key, label: `${label} ${stronghold[key] + 1}`, ...strongholdBuildingCost(key) };
    proposal.execute = () => buildStronghold(key, proposal);
    proposals.push(proposal);
  }
  const skillPrerequisite = { agriculture: "mill", machinery: "smithy", forestry: "lumberyard", defense: "guardTower" };
  for (const [key, label] of [["agriculture", "Agriculture"], ["machinery", "Machinery"], ["forestry", "Forestry"], ["defense", "Sky defense"]]) {
    if (villageSkills[key] >= MAX_VILLAGE_SKILL || !stronghold[skillPrerequisite[key]]) continue;
    const cost = villageSkillCost(key);
    proposals.push({
      key,
      label: `${label} ${villageSkills[key] + 1}`,
      cost,
      execute: () => {
        if (grainStoredKg < cost) return false;
        grainStoredKg -= cost;
        villageSkills[key] += 1;
        return true;
      },
    });
  }
  return proposals;
}

function workerProposalAffinity(worker, proposal) {
  let affinity = hash(worker.id * 97 + councilRound, proposal.key.length * 211, seed ^ 0x62d4b91f) * 1.8;
  if (proposal.key === "castle") affinity += 2.3 + dragons.length * 0.22 + villageSkills.defense * 0.12;
  if (worker.workerType === "planter" && proposal.key === "agriculture") affinity += 3.4;
  if (worker.workerType === "planter" && proposal.key === "mill") affinity += 3.8;
  if (["mower", "tractor"].includes(worker.workerType) && proposal.key === "machinery") affinity += 2.8;
  if (["mower", "tractor"].includes(worker.workerType) && ["housing", "smithy"].includes(proposal.key)) affinity += 2.2;
  if (worker.workerType === "chainsaw" && proposal.key === "forestry") affinity += 3.5;
  if (worker.workerType === "chainsaw" && proposal.key === "lumberyard") affinity += 4;
  if (worker.workerType === "bucket" && proposal.key === "forestry") affinity += 4.2;
  if (worker.workerType === "bucket" && proposal.key === "machinery") affinity += 3.2;
  if (worker.workerType === "miner" && ["smithy", "walls", "guardTower"].includes(proposal.key)) affinity += 4;
  if (worker.workerType === "trimmer" && proposal.key === "defense") affinity += 2.2;
  if (worker.workerType === "trimmer" && proposal.key === "guardTower") affinity += 2.8;
  if (dragons.length > rocs.length && proposal.key === "defense") affinity += 1.8;
  if (proposal.key === "walls") affinity += 1.25 + dragons.length * 0.12;
  if (villageWallLevel === 0 && proposal.key === "walls") affinity += 4.5;
  affinity -= proposal.cost * 0.12;
  return affinity;
}

function holdVillageElection() {
  const citizens = councilCitizens();
  const affordable = councilProposals().filter(proposalAffordable);
  if (!citizens.length || !affordable.length) {
    const cheapest = councilProposals().sort((a, b) => (a.cost + (a.timberCost || 0) + (a.stoneCost || 0)) - (b.cost + (b.timberCost || 0) + (b.stoneCost || 0)))[0];
    lastCouncilResult = cheapest
      ? `Saving for ${cheapest.label} · ${strongholdCostText(cheapest)}`
      : "All village skills complete";
    lastBallot = "";
    nextCouncilAt = elapsed + 4;
    return false;
  }

  councilRound += 1;
  const totals = new Map(affordable.map((proposal) => [proposal.key, 0]));
  for (const citizen of citizens) {
    const choice = affordable.reduce((best, proposal) => {
      const score = workerProposalAffinity(citizen, proposal);
      return !best || score > best.score ? { proposal, score } : best;
    }, null).proposal;
    totals.set(choice.key, totals.get(choice.key) + 1);
  }
  const winner = affordable.reduce((best, proposal) => {
    const votes = totals.get(proposal.key);
    const tie = hash(councilRound, proposal.key.length * 17, seed);
    return !best || votes > best.votes || (votes === best.votes && tie > best.tie)
      ? { proposal, votes, tie }
      : best;
  }, null);
  lastBallot = affordable
    .map((proposal) => `${proposal.label.replace(/\s\d+$/, "")}:${totals.get(proposal.key)}`)
    .join(" · ");
  if (!winner.proposal.execute()) {
    lastCouncilResult = `Ballot ${councilRound} stalled · ${winner.proposal.label}`;
    nextCouncilAt = elapsed + 3;
    return false;
  }
  lastCouncilResult = `Ballot ${councilRound}: ${winner.proposal.label} won ${winner.votes}/${citizens.length}`;
  nextCouncilAt = elapsed + COUNCIL_INTERVAL;
  announceAttack(lastCouncilResult);
  return true;
}

function processVillageCouncil() {
  if (!planetRoot || elapsed < nextCouncilAt || elapsed < castleConstructionCooldownUntil) return;
  holdVillageElection();
}

function cellNeedsHarvest(index) {
  return Boolean(cuttable[index] && (!cut[index] || cropStage[index] >= 3));
}

function cutGrass(mowingAgent = mower, emitParticles = true) {
  if (mowingAgent.disabledUntil > elapsed || Math.abs(mowingAgent.speed) < 8 * SPEED_SCALE || mowingAgent.battery <= 0 || grainHoldIsFull(mowingAgent)) return 0;
  const deckRadius = mowingAgent.deckRadius || DECK_RADIUS;
  const toolOffset = mowingAgent.workerType === "trimmer"
    ? 55 / SURFACE_SCALE
    : mowingAgent.workerType === "tractor"
      ? -110 / SURFACE_SCALE
      : -15 / SURFACE_SCALE;
  const deckX = wrapX(mowingAgent.x + Math.cos(mowingAgent.angle) * toolOffset);
  const deckY = mowingAgent.y + Math.sin(mowingAgent.angle) * toolOffset;
  const minCol = Math.floor((deckX - deckRadius) / CELL_W);
  const maxCol = Math.ceil((deckX + deckRadius) / CELL_W);
  const minRow = Math.max(0, Math.floor((deckY - deckRadius) / CELL_H));
  const maxRow = Math.min(ROWS - 1, Math.ceil((deckY + deckRadius) / CELL_H));
  let newlyCut = 0;
  let harvestedCropCells = 0;

  for (let row = minRow; row <= maxRow; row += 1) {
    for (let rawCol = minCol; rawCol <= maxCol; rawCol += 1) {
      const col = ((rawCol % COLS) + COLS) % COLS;
      const index = row * COLS + col;
      if (!cellNeedsHarvest(index)) continue;
      const x = (col + 0.5) * CELL_W;
      const y = (row + 0.5) * CELL_H;
      if (Math.hypot(worldDeltaX(x, deckX), y - deckY) > deckRadius) continue;

      if (cut[index] && cropStage[index] >= 3) {
        cropStage[index] = 0;
        cropType[index] = 0;
        harvestedCropCells += 1;
        // Mature crops are productive harvesting too. Keep them in the
        // lifetime work total so every completed harvest earns points.
        cutCount += 1;
        unplantedHarvestCells.push(index);
        renderGrassCell(col, row, true);
        continue;
      }

      cut[index] = 1;
      cropStage[index] = 0;
      cropType[index] = 0;
      cutCount += 1;
      currentCutCount += 1;
      newlyCut += 1;
      unplantedHarvestCells.push(index);
      renderGrassCell(col, row, true);
    }
  }

  if (newlyCut > 0) {
    mowingAgent.mowedCells = (mowingAgent.mowedCells || 0) + newlyCut;
    mowingAgent.reproductionProgress = (mowingAgent.reproductionProgress || 0) + newlyCut;
    processWorkerLeveling(mowingAgent);
  }

  if (harvestedCropCells > 0) {
    mowingAgent.grainCargoCells = (mowingAgent.grainCargoCells || 0) + harvestedCropCells;
    if (grainHoldIsFull(mowingAgent)) mowingAgent.returningToGranary = true;
  }

  if (emitParticles && (newlyCut > 0 || harvestedCropCells > 0) && particles.length < 90) {
    const workedCells = newlyCut + harvestedCropCells;
    for (let i = 0; i < Math.min(4, workedCells); i += 1) {
      particles.push({
        x: deckX + (Math.random() - 0.5) * 45,
        y: deckY + (Math.random() - 0.5) * 45,
        vx: -Math.cos(mowingAgent.angle) * (35 + Math.random() * 35) + (Math.random() - 0.5) * 30,
        vy: -Math.sin(mowingAgent.angle) * (35 + Math.random() * 35) + (Math.random() - 0.5) * 30,
        life: 0.65 + Math.random() * 0.4,
      });
    }
    if (mowingAgent === mower) mower.battery = Math.max(0, mower.battery - workedCells * 0.00045);
  }
  return newlyCut;
}

function targetStillNeedsPlanting(target) {
  if (!target) return false;
  const col = ((Math.floor(target.x / CELL_W) % COLS) + COLS) % COLS;
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(target.y / CELL_H)));
  const index = row * COLS + col;
  return Boolean(cuttable[index] && cut[index] && cropStage[index] === 0);
}

function choosePlanterTarget(agent) {
  let best = null;
  let bestScore = Infinity;
  const queueStart = Math.max(0, unplantedHarvestCells.length - 3200);
  for (let queueIndex = unplantedHarvestCells.length - 1; queueIndex >= queueStart; queueIndex -= 1) {
    const index = unplantedHarvestCells[queueIndex];
    if (!cut[index] || cropStage[index] !== 0) continue;
    const row = Math.floor(index / COLS);
    const col = index - row * COLS;
    const x = (col + 0.5) * CELL_W;
    const y = (row + 0.5) * CELL_H;
    const distance = Math.hypot(worldDeltaX(x, agent.x), y - agent.y);
    const score = distance + (routeIsBlocked(agent.x, agent.y, x, y) ? 220 / SURFACE_SCALE : 0);
    if (score < bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  if (best) return best;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const cursor = agent.searchCursor++;
    const angle = hash(cursor, agent.id * 43, seed ^ 0x1f123bb5) * Math.PI * 2;
    const radius = 20 + Math.pow(hash(cursor, agent.id * 61, seed ^ 0x7f4a7c15), 1.6) * 1050;
    const x = wrapX(agent.x + Math.cos(angle) * radius);
    const y = Math.max(CELL_H, Math.min(FIELD_H - CELL_H, agent.y + Math.sin(angle) * radius));
    const col = Math.floor(x / CELL_W);
    const row = Math.floor(y / CELL_H);
    const index = row * COLS + col;
    if (!cuttable[index] || !cut[index] || cropStage[index] !== 0) continue;
    const distance = Math.hypot(worldDeltaX(x, agent.x), y - agent.y);
    const routePenalty = routeIsBlocked(agent.x, agent.y, x, y) ? 220 / SURFACE_SCALE : 0;
    const score = distance + routePenalty;
    if (score < bestScore) {
      bestScore = score;
      best = { x: (col + 0.5) * CELL_W, y: (row + 0.5) * CELL_H };
    }
  }
  return best;
}

function plantCrops(agent) {
  if (agent.disabledUntil > elapsed || Math.abs(agent.speed) < 5 * SPEED_SCALE) return 0;
  const radius = (44 / SURFACE_SCALE) * (1 + villageSkills.agriculture * 0.08);
  const planterX = wrapX(agent.x - Math.cos(agent.angle) * (18 / SURFACE_SCALE));
  const planterY = agent.y - Math.sin(agent.angle) * (18 / SURFACE_SCALE);
  const minCol = Math.floor((planterX - radius) / CELL_W);
  const maxCol = Math.ceil((planterX + radius) / CELL_W);
  const minRow = Math.max(0, Math.floor((planterY - radius) / CELL_H));
  const maxRow = Math.min(ROWS - 1, Math.ceil((planterY + radius) / CELL_H));
  let planted = 0;
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let rawCol = minCol; rawCol <= maxCol; rawCol += 1) {
      const col = ((rawCol % COLS) + COLS) % COLS;
      const index = row * COLS + col;
      if (!cuttable[index] || !cut[index] || cropStage[index] !== 0) continue;
      const x = (col + 0.5) * CELL_W;
      const y = (row + 0.5) * CELL_H;
      if (Math.hypot(worldDeltaX(x, planterX), y - planterY) > radius) continue;
      const variety = 1 + Math.floor(hash(col, row, seed ^ (agent.id * 7919)) * 4);
      cropType[index] = variety;
      cropStage[index] = 1;
      const cropSpeed = 1 + villageSkills.agriculture * 0.12;
      cropSproutQueue.push({ index, growAt: elapsed + 8 / cropSpeed });
      cropYoungQueue.push({ index, growAt: elapsed + 22 / cropSpeed });
      renderGrassCell(col, row, true);
      planted += 1;
    }
  }
  if (planted > 0) {
    cropCellsPlanted += planted;
    agent.plantedCells = (agent.plantedCells || 0) + planted;
    agent.mowedCells = (agent.mowedCells || 0) + planted;
    agent.reproductionProgress = (agent.reproductionProgress || 0) + planted;
    processWorkerLeveling(agent);
    lawnTextureDirty = true;
  }
  return planted;
}

function angleDifference(target, current) {
  let difference = target - current;
  while (difference > Math.PI) difference -= Math.PI * 2;
  while (difference < -Math.PI) difference += Math.PI * 2;
  return difference;
}

function isOnChargePad() {
  return insideChargePad(mower.x, mower.y);
}

function nearestChargePad() {
  return chargePads.reduce((nearest, pad) => {
    const distance = Math.hypot(worldDeltaX(pad.x, mower.x), pad.y - mower.y);
    return !nearest || distance < nearest.distance ? { ...pad, distance } : nearest;
  }, null);
}

function setAutoMode(enabled) {
  autoMode = enabled;
  autoTarget = null;
  autoRetargetIn = 0;
  autoRecovery = 0;
  releaseControls();
  ui.auto.classList.toggle("is-on", autoMode);
  ui.auto.setAttribute("aria-pressed", String(autoMode));
  ui.auto.textContent = autoMode ? "Auto on" : "Auto";
}

function pointIsBlocked(x, y, margin = 31 / SURFACE_SCALE) {
  return y < 38 / SURFACE_SCALE + margin || y > FIELD_H - 38 / SURFACE_SCALE - margin || Boolean(insideObstacle(wrapX(x), y, margin));
}

function routeIsBlocked(x1, y1, x2, y2) {
  const dx = worldDeltaX(x2, x1);
  const distance = Math.hypot(dx, y2 - y1);
  const steps = Math.min(9, Math.floor(distance / (48 / SURFACE_SCALE)));
  for (let step = 1; step <= steps; step += 1) {
    const amount = step / Math.max(1, steps);
    if (pointIsBlocked(wrapX(x1 + dx * amount), y1 + (y2 - y1) * amount, 25 / SURFACE_SCALE)) return true;
  }
  return false;
}

function chooseAutoTarget() {
  if (mower.battery < 16) autoCharging = true;
  if (autoCharging && mower.battery >= 96) autoCharging = false;
  if (autoCharging) {
    const pad = nearestChargePad();
    return { x: pad.x, y: pad.y, charging: true };
  }
  if (grainHoldIsFull(mower)) mower.returningToGranary = true;
  if (mower.returningToGranary && grainCargoKg(mower) > 0.001) {
    return { x: granary.x, y: granary.y, granary: true };
  }

  const candidates = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const index = row * COLS + col;
      if (!cellNeedsHarvest(index)) continue;
      const x = (col + 0.5) * CELL_W;
      const y = (row + 0.5) * CELL_H;
      const dx = worldDeltaX(x, mower.x);
      const distance = Math.hypot(dx, y - mower.y);
      if (distance < DECK_RADIUS * 0.65) continue;
      const directionCost = Math.abs(angleDifference(Math.atan2(y - mower.y, dx), mower.angle)) * (34 / SURFACE_SCALE);
      const baseScore = distance + directionCost;
      if (candidates.length < 18 || baseScore < candidates[candidates.length - 1].baseScore) {
        candidates.push({ x, y, baseScore });
        candidates.sort((a, b) => a.baseScore - b.baseScore);
        if (candidates.length > 18) candidates.pop();
      }
    }
  }
  let best = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const score = candidate.baseScore + (routeIsBlocked(mower.x, mower.y, candidate.x, candidate.y) ? 260 / SURFACE_SCALE : 0);
    if (score < bestScore) {
      bestScore = score;
      best = { x: candidate.x, y: candidate.y, charging: false };
    }
  }
  return best;
}

function getAutoControls(dt) {
  if (autoRecovery > 0) {
    autoRecovery -= dt;
    return { steer: autoRecoverySteer, drive: -0.72 };
  }

  autoRetargetIn -= dt;
  if (!autoTarget || autoRetargetIn <= 0 || (!autoTarget.charging && !autoTarget.granary && Math.hypot(worldDeltaX(autoTarget.x, mower.x), autoTarget.y - mower.y) < MODEL_DECK_RADIUS / SURFACE_SCALE)) {
    autoTarget = chooseAutoTarget();
    autoRetargetIn = 0.28;
  }
  if (!autoTarget) return { steer: 0, drive: 0 };
  if (autoTarget.charging && isOnChargePad()) return { steer: 0, drive: 0 };
  if (autoTarget.granary && isAtGranary(mower)) return { steer: 0, drive: 0 };

  const desired = Math.atan2(autoTarget.y - mower.y, worldDeltaX(autoTarget.x, mower.x));
  const probeDistance = 78 / SURFACE_SCALE;
  const forwardBlocked = pointIsBlocked(
    mower.x + Math.cos(mower.angle) * probeDistance,
    mower.y + Math.sin(mower.angle) * probeDistance,
  );

  let steeringAngle = desired;
  if (forwardBlocked) {
    const options = [-1.35, -0.9, 0.9, 1.35]
      .map((offset) => ({
        angle: mower.angle + offset,
        offset,
        blocked: pointIsBlocked(
          mower.x + Math.cos(mower.angle + offset) * probeDistance,
          mower.y + Math.sin(mower.angle + offset) * probeDistance,
        ),
      }))
      .filter((option) => !option.blocked)
      .sort((a, b) => Math.abs(angleDifference(desired, a.angle)) - Math.abs(angleDifference(desired, b.angle)));
    if (options.length) steeringAngle = options[0].angle;
    else {
      autoRecovery = 0.58;
      autoRecoverySteer *= -1;
      return { steer: autoRecoverySteer, drive: -0.72 };
    }
  }

  const difference = angleDifference(steeringAngle, mower.angle);
  return {
    steer: Math.max(-1, Math.min(1, difference * 1.65)),
    drive: Math.abs(difference) > 1.7 ? 0.35 : autoTarget.charging || autoTarget.granary ? 0.78 : 0.88,
  };
}

function targetStillNeedsMowing(target) {
  if (!target) return false;
  const col = ((Math.floor(target.x / CELL_W) % COLS) + COLS) % COLS;
  const row = Math.max(0, Math.min(ROWS - 1, Math.floor(target.y / CELL_H)));
  const index = row * COLS + col;
  return cellNeedsHarvest(index);
}

function chooseColonyTarget(agent) {
  let best = null;
  let bestScore = Infinity;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const cursor = agent.searchCursor++;
    const angle = hash(cursor, agent.id * 19, seed ^ 0x45d9f3b) * Math.PI * 2;
    const radius = 28 + Math.pow(hash(cursor, agent.id * 31, seed ^ 0x27d4eb2d), 1.7) * 900;
    const x = wrapX(agent.x + Math.cos(angle) * radius);
    const y = Math.max(CELL_H, Math.min(FIELD_H - CELL_H, agent.y + Math.sin(angle) * radius));
    const col = Math.floor(x / CELL_W);
    const row = Math.floor(y / CELL_H);
    const index = row * COLS + col;
    if (!cellNeedsHarvest(index)) continue;
    const distance = Math.hypot(worldDeltaX(x, agent.x), y - agent.y);
    const routePenalty = routeIsBlocked(agent.x, agent.y, x, y) ? 220 / SURFACE_SCALE : 0;
    const crowdPenalty = offspring.some((other) => other !== agent && other.target && Math.hypot(worldDeltaX(x, other.target.x), y - other.target.y) < 90) ? 90 : 0;
    const score = distance + routePenalty + crowdPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = { x: (col + 0.5) * CELL_W, y: (row + 0.5) * CELL_H };
    }
  }
  return best;
}

function getPlanterControls(agent, dt) {
  if (agent.recovery > 0) {
    agent.recovery -= dt;
    return { steer: agent.recoverySteer, drive: -0.62 };
  }
  agent.retargetIn -= dt;
  const targetDistance = agent.target
    ? Math.hypot(worldDeltaX(agent.target.x, agent.x), agent.target.y - agent.y)
    : Infinity;
  if (!targetStillNeedsPlanting(agent.target) || targetDistance < 30 / SURFACE_SCALE || agent.retargetIn <= 0) {
    agent.target = choosePlanterTarget(agent);
    agent.retargetIn = 0.5;
  }
  if (!agent.target) {
    const harvester = [mower, ...offspring].find((worker) => !["planter", "chainsaw", "bucket", "miner"].includes(worker.workerType));
    if (!harvester) return { steer: 0.4, drive: 0.42 };
    const desired = Math.atan2(harvester.y - agent.y, worldDeltaX(harvester.x, agent.x));
    return { steer: Math.max(-1, Math.min(1, angleDifference(desired, agent.angle) * 1.6)), drive: 0.55 };
  }
  const desired = Math.atan2(agent.target.y - agent.y, worldDeltaX(agent.target.x, agent.x));
  const probeDistance = 62 / SURFACE_SCALE;
  const blocked = pointIsBlocked(
    agent.x + Math.cos(agent.angle) * probeDistance,
    agent.y + Math.sin(agent.angle) * probeDistance,
    agent.clearance,
  );
  if (blocked) {
    agent.recovery = 0.48;
    agent.recoverySteer *= -1;
    agent.target = null;
    return { steer: agent.recoverySteer, drive: -0.68 };
  }
  const difference = angleDifference(desired, agent.angle);
  return {
    steer: Math.max(-1, Math.min(1, difference * 1.75)),
    drive: Math.abs(difference) > 1.8 ? 0.3 : 0.88,
  };
}

function updatePlanterAgent(agent, dt) {
  const controls = getPlanterControls(agent, dt);
  const fireSlow = (agent.burningUntil > elapsed ? 0.46 : 1) * (agent.arrowStaggerUntil > elapsed ? 0.42 : 1);
  const workerSpeed = 145 * workerLevelSpeedMultiplier(agent);
  const targetSpeed = controls.drive >= 0
    ? workerSpeed * SPEED_SCALE * controls.drive * fireSlow
    : 82 * SPEED_SCALE * controls.drive;
  agent.speed += (targetSpeed - agent.speed) * Math.min(1, dt * 3);
  const speedRatio = Math.min(1, Math.abs(agent.speed) / (145 * SPEED_SCALE));
  agent.angle += controls.steer * 2.15 * dt * (0.28 + speedRatio * 0.72) * (agent.speed < 0 ? -1 : 1);
  const previousX = agent.x;
  const previousY = agent.y;
  agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
  agent.y += Math.sin(agent.angle) * agent.speed * dt;
  const collision = insideObstacle(agent.x, agent.y, agent.clearance);
  if (collision || agent.y < agent.clearance || agent.y > FIELD_H - agent.clearance) {
    agent.x = previousX;
    agent.y = previousY;
    agent.speed *= -0.2;
    agent.angle += agent.recoverySteer * 0.7;
    agent.recovery = 0.6;
    agent.recoverySteer *= -1;
    agent.target = null;
  }
  plantCrops(agent);
  return 0;
}

function getColonyControls(agent, dt) {
  if (agent.recovery > 0) {
    agent.recovery -= dt;
    return { steer: agent.recoverySteer, drive: -0.62 };
  }

  if (grainHoldIsFull(agent)) agent.returningToGranary = true;
  if (agent.returningToGranary && grainCargoKg(agent) > 0.001) {
    if (isAtGranary(agent)) return { steer: 0, drive: 0 };
    const desired = Math.atan2(granary.y - agent.y, worldDeltaX(granary.x, agent.x));
    const probeDistance = 78 / SURFACE_SCALE;
    const blocked = pointIsBlocked(
      agent.x + Math.cos(agent.angle) * probeDistance,
      agent.y + Math.sin(agent.angle) * probeDistance,
      agent.clearance || MOWER_CLEARANCE,
    );
    if (blocked) {
      agent.recovery = 0.48;
      agent.recoverySteer *= -1;
      return { steer: agent.recoverySteer, drive: -0.7 };
    }
    const difference = angleDifference(desired, agent.angle);
    return {
      steer: Math.max(-1, Math.min(1, difference * 1.72)),
      drive: Math.abs(difference) > 1.8 ? 0.3 : 0.84,
    };
  }

  agent.retargetIn -= dt;
  const targetDistance = agent.target
    ? Math.hypot(worldDeltaX(agent.target.x, agent.x), agent.target.y - agent.y)
    : Infinity;
  if (!targetStillNeedsMowing(agent.target) || targetDistance < MODEL_DECK_RADIUS / SURFACE_SCALE || agent.retargetIn <= 0) {
    agent.target = chooseColonyTarget(agent);
    agent.retargetIn = 0.7 + hash(agent.searchCursor, agent.id, seed) * 0.45;
  }
  if (!agent.target) return { steer: 0.45, drive: 0.45 };

  const desired = Math.atan2(agent.target.y - agent.y, worldDeltaX(agent.target.x, agent.x));
  const probeDistance = 78 / SURFACE_SCALE;
  const blocked = pointIsBlocked(
    agent.x + Math.cos(agent.angle) * probeDistance,
    agent.y + Math.sin(agent.angle) * probeDistance,
    agent.clearance || MOWER_CLEARANCE,
  );
  if (blocked) {
    agent.recovery = 0.48;
    agent.recoverySteer *= -1;
    agent.target = null;
    return { steer: agent.recoverySteer, drive: -0.7 };
  }

  const difference = angleDifference(desired, agent.angle);
  return {
    steer: Math.max(-1, Math.min(1, difference * 1.72)),
    drive: Math.abs(difference) > 1.8 ? 0.3 : 0.84,
  };
}

function updateColonyAgent(agent, dt) {
  if (agent.workerType === "chainsaw") return updateChainsawAgent(agent, dt);
  if (agent.workerType === "bucket") return updateBucketTruckAgent(agent, dt);
  if (agent.workerType === "miner") return updateMinerAgent(agent, dt);
  if (agent.workerType === "planter") return updatePlanterAgent(agent, dt);
  tryUnloadGrain(agent);
  const controls = getColonyControls(agent, dt);
  const fireSlow = agent.burningUntil > elapsed ? 0.46 : 1;
  const workerSpeed = (agent.workerType === "trimmer" ? 150 : 205) * workerLevelSpeedMultiplier(agent);
  const targetSpeed = controls.drive >= 0
    ? workerSpeed * SPEED_SCALE * controls.drive * fireSlow
    : 88 * SPEED_SCALE * controls.drive;
  const deltaSpeed = targetSpeed - agent.speed;
  agent.speed += Math.sign(deltaSpeed) * Math.min(Math.abs(deltaSpeed), workerSpeed * SPEED_SCALE * dt);
  const speedRatio = Math.min(1, Math.abs(agent.speed) / (165 * SPEED_SCALE));
  agent.angle += controls.steer * 2.2 * dt * (0.24 + speedRatio * 0.76) * (agent.speed < 0 ? -1 : 1);

  const previousX = agent.x;
  const previousY = agent.y;
  agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
  agent.y += Math.sin(agent.angle) * agent.speed * dt;
  const clearance = agent.clearance || MOWER_CLEARANCE;
  const collision = insideObstacle(agent.x, agent.y, clearance);
  const out = agent.y < clearance || agent.y > FIELD_H - clearance;
  if (collision || out) {
    agent.x = previousX;
    agent.y = previousY;
    agent.speed *= -0.2;
    agent.angle += agent.recoverySteer * 0.7;
    agent.recovery = 0.65;
    agent.recoverySteer *= -1;
    agent.target = null;
  }
  return cutGrass(agent, false);
}

function chooseTreeTarget(agent) {
  return obstacles.reduce((best, tree) => {
    if (tree.id !== "tree" || tree.growth < 0.72) return best;
    const distance = Math.hypot(worldDeltaX(tree.x, agent.x), tree.y - agent.y);
    const claimed = offspring.some((other) => other !== agent && other.treeTarget === tree) ? 220 : 0;
    const score = distance + claimed;
    return !best || score < best.score ? { tree, score } : best;
  }, null)?.tree || null;
}

function fellTree(agent, tree) {
  if (!tree || tree.growth < 0.5) return;
  tree.growth = 0;
  tree.growthLevel = 0;
  tree.regrowAt = elapsed + TREE_REGROW_DELAY;
  tree.nextGrowthAt = tree.regrowAt;
  treeVisualsDirty = true;
  treesCut += 1;
  const timberYield = 1 + stronghold.lumberyard * 0.4 + villageSkills.forestry * 0.14;
  timberStock += timberYield;
  const forestryReward = Math.ceil(TREE_REWARD_CELLS * (1 + villageSkills.forestry * 0.12));
  agent.mowedCells += forestryReward;
  agent.reproductionProgress += forestryReward;
  agent.treeTarget = null;
  agent.sawProgress = 0;
  agent.sawing = false;
  processWorkerLeveling(agent);
  announceAttack(`Chainsaw ${agent.id} felled a tree · +${timberYield.toFixed(1)} timber`);
}

function updateChainsawAgent(agent, dt) {
  let tree = agent.treeTarget;
  if (!tree || tree.growth < 0.72) {
    tree = chooseTreeTarget(agent);
    agent.treeTarget = tree;
    agent.sawProgress = 0;
  }

  if (!tree) {
    agent.sawing = false;
    const controls = getColonyControls(agent, dt);
    agent.angle += controls.steer * 1.7 * dt;
    const patrolSpeed = 105 * SPEED_SCALE * controls.drive;
    agent.speed += (patrolSpeed - agent.speed) * Math.min(1, dt * 2.5);
    agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
    agent.y = Math.max(agent.clearance, Math.min(FIELD_H - agent.clearance, agent.y + Math.sin(agent.angle) * agent.speed * dt));
    return 0;
  }

  const dx = worldDeltaX(tree.x, agent.x);
  const dy = tree.y - agent.y;
  const distance = Math.hypot(dx, dy);
  const cuttingDistance = tree.r * Math.max(0.2, tree.growth) + agent.clearance + 5;
  if (distance <= cuttingDistance) {
    agent.speed *= Math.max(0, 1 - dt * 8);
    agent.sawing = true;
    agent.sawProgress = (agent.sawProgress || 0) + dt * (1 + ((agent.level || 1) - 1) * 0.12);
    if (agent.sawProgress >= 1.7) fellTree(agent, tree);
    return 0;
  }

  agent.sawing = false;
  const desired = Math.atan2(dy, dx);
  const difference = angleDifference(desired, agent.angle);
  const levelSpeed = 135 * workerLevelSpeedMultiplier(agent) * SPEED_SCALE;
  const targetSpeed = levelSpeed * (Math.abs(difference) > 1.8 ? 0.3 : 0.86);
  agent.speed += (targetSpeed - agent.speed) * Math.min(1, dt * 2.8);
  agent.angle += Math.max(-1, Math.min(1, difference * 1.65)) * 2 * dt;
  const previousX = agent.x;
  const previousY = agent.y;
  agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
  agent.y += Math.sin(agent.angle) * agent.speed * dt;
  const collision = insideObstacle(agent.x, agent.y, agent.clearance);
  if ((collision && collision !== tree) || agent.y < agent.clearance || agent.y > FIELD_H - agent.clearance) {
    agent.x = previousX;
    agent.y = previousY;
    agent.angle += agent.recoverySteer * 0.72;
    agent.recoverySteer *= -1;
    agent.speed *= -0.18;
  } else if (collision === tree) {
    agent.x = previousX;
    agent.y = previousY;
    agent.speed = 0;
  }
  return 0;
}

function chooseTrimTreeTarget(agent) {
  return obstacles.reduce((best, tree) => {
    if (tree.id !== "tree" || tree.growth < 0.92) return best;
    const distance = Math.hypot(worldDeltaX(tree.x, agent.x), tree.y - agent.y);
    const claimed = offspring.some((other) => other !== agent && other.treeTarget === tree) ? 260 : 0;
    const score = distance + claimed;
    return !best || score < best.score ? { tree, score } : best;
  }, null)?.tree || null;
}

function trimTree(agent, tree) {
  if (!tree || tree.growth < 0.86) return;
  tree.growthLevel = Math.max(1, Math.floor(TREE_GROW_LEVELS * 0.68));
  tree.growth = tree.growthLevel / TREE_GROW_LEVELS;
  tree.regrowAt = elapsed + 6;
  tree.nextGrowthAt = tree.regrowAt;
  treeVisualsDirty = true;
  treesTrimmed += 1;
  const reward = Math.ceil(TREE_REWARD_CELLS * 0.48 * (1 + villageSkills.forestry * 0.1));
  agent.mowedCells += reward;
  agent.reproductionProgress += reward;
  agent.treeTarget = null;
  agent.trimProgress = 0;
  agent.trimming = false;
  processWorkerLeveling(agent);
  announceAttack(`Bucket truck ${agent.id} trimmed a tree crown`);
}

function updateBucketTruckAgent(agent, dt) {
  let tree = agent.treeTarget;
  if (!tree || tree.growth < 0.92) {
    tree = chooseTrimTreeTarget(agent);
    agent.treeTarget = tree;
    agent.trimProgress = 0;
  }

  if (!tree) {
    agent.trimming = false;
    const controls = getColonyControls(agent, dt);
    agent.angle += controls.steer * 1.55 * dt;
    const patrolSpeed = 112 * SPEED_SCALE * controls.drive;
    agent.speed += (patrolSpeed - agent.speed) * Math.min(1, dt * 2.3);
    agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
    agent.y = Math.max(agent.clearance, Math.min(FIELD_H - agent.clearance, agent.y + Math.sin(agent.angle) * agent.speed * dt));
    return 0;
  }

  const dx = worldDeltaX(tree.x, agent.x);
  const dy = tree.y - agent.y;
  const distance = Math.hypot(dx, dy);
  const workingDistance = tree.r * Math.max(0.4, tree.growth) + agent.clearance + 15;
  if (distance <= workingDistance) {
    agent.speed *= Math.max(0, 1 - dt * 7);
    agent.angle += angleDifference(Math.atan2(dy, dx), agent.angle) * Math.min(1, dt * 2.8);
    agent.trimming = true;
    agent.trimProgress = (agent.trimProgress || 0) + dt * (1 + ((agent.level || 1) - 1) * 0.1);
    if (agent.trimProgress >= 3.4) trimTree(agent, tree);
    return 0;
  }

  agent.trimming = false;
  const desired = Math.atan2(dy, dx);
  const difference = angleDifference(desired, agent.angle);
  const levelSpeed = 145 * workerLevelSpeedMultiplier(agent) * SPEED_SCALE;
  const targetSpeed = levelSpeed * (Math.abs(difference) > 1.8 ? 0.28 : 0.82);
  agent.speed += (targetSpeed - agent.speed) * Math.min(1, dt * 2.4);
  agent.angle += Math.max(-1, Math.min(1, difference * 1.5)) * 1.75 * dt;
  const previousX = agent.x;
  const previousY = agent.y;
  agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
  agent.y += Math.sin(agent.angle) * agent.speed * dt;
  const collision = insideObstacle(agent.x, agent.y, agent.clearance);
  if ((collision && collision !== tree) || agent.y < agent.clearance || agent.y > FIELD_H - agent.clearance) {
    agent.x = previousX;
    agent.y = previousY;
    agent.angle += agent.recoverySteer * 0.72;
    agent.recoverySteer *= -1;
    agent.speed *= -0.18;
  } else if (collision === tree) {
    agent.x = previousX;
    agent.y = previousY;
    agent.speed = 0;
  }
  return 0;
}

function chooseStoneTarget(agent) {
  return obstacles.reduce((best, stone) => {
    if (stone.id !== "stone" || (stone.quarriedUntil || 0) > elapsed) return best;
    const distance = Math.hypot(worldDeltaX(stone.x, agent.x), stone.y - agent.y);
    const claimed = offspring.some((other) => other !== agent && other.stoneTarget === stone) ? 240 : 0;
    const score = distance + claimed;
    return !best || score < best.score ? { stone, score } : best;
  }, null)?.stone || null;
}

function mineStone(agent, stone) {
  if (!stone || (stone.quarriedUntil || 0) > elapsed) return;
  const stoneYield = 1 + villageSkills.machinery * 0.12;
  stoneStock += stoneYield;
  stone.quarriedUntil = elapsed + 24;
  agent.mowedCells += Math.ceil(TREE_REWARD_CELLS * 0.75);
  agent.reproductionProgress += Math.ceil(TREE_REWARD_CELLS * 0.75);
  agent.stoneTarget = null;
  agent.miningProgress = 0;
  agent.mining = false;
  processWorkerLeveling(agent);
  announceAttack(`Miner ${agent.id} quarried +${stoneYield.toFixed(1)} stone`);
}

function updateMinerAgent(agent, dt) {
  let stone = agent.stoneTarget;
  if (!stone || (stone.quarriedUntil || 0) > elapsed) {
    stone = chooseStoneTarget(agent);
    agent.stoneTarget = stone;
    agent.miningProgress = 0;
  }
  if (!stone) {
    agent.mining = false;
    const controls = getColonyControls(agent, dt);
    agent.angle += controls.steer * 1.6 * dt;
    agent.speed += (90 * SPEED_SCALE * controls.drive - agent.speed) * Math.min(1, dt * 2.4);
    agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
    agent.y = Math.max(agent.clearance, Math.min(FIELD_H - agent.clearance, agent.y + Math.sin(agent.angle) * agent.speed * dt));
    return 0;
  }
  const dx = worldDeltaX(stone.x, agent.x);
  const dy = stone.y - agent.y;
  const distance = Math.hypot(dx, dy);
  const workingDistance = stone.r + agent.clearance + 5;
  if (distance <= workingDistance) {
    agent.speed *= Math.max(0, 1 - dt * 8);
    agent.mining = true;
    agent.miningProgress = (agent.miningProgress || 0) + dt * workerLevelSpeedMultiplier(agent);
    if (agent.miningProgress >= 2.1) mineStone(agent, stone);
    return 0;
  }
  agent.mining = false;
  const desired = Math.atan2(dy, dx);
  const difference = angleDifference(desired, agent.angle);
  const targetSpeed = 120 * workerLevelSpeedMultiplier(agent) * SPEED_SCALE * (Math.abs(difference) > 1.8 ? 0.3 : 0.86);
  agent.speed += (targetSpeed - agent.speed) * Math.min(1, dt * 2.8);
  agent.angle += Math.max(-1, Math.min(1, difference * 1.65)) * 2 * dt;
  const previousX = agent.x;
  const previousY = agent.y;
  agent.x = wrapX(agent.x + Math.cos(agent.angle) * agent.speed * dt);
  agent.y += Math.sin(agent.angle) * agent.speed * dt;
  const collision = insideObstacle(agent.x, agent.y, agent.clearance);
  if ((collision && collision !== stone) || agent.y < agent.clearance || agent.y > FIELD_H - agent.clearance) {
    agent.x = previousX;
    agent.y = previousY;
    agent.angle += agent.recoverySteer * 0.72;
    agent.recoverySteer *= -1;
    agent.speed *= -0.18;
  } else if (collision === stone) {
    agent.x = previousX;
    agent.y = previousY;
    agent.speed = 0;
  }
  return 0;
}

function spawnOffspring(parent) {
  if (1 + offspring.length >= colonyCapacity() || !planetRoot) return null;
  const childId = nextMowerId++;
  const workerSequence = ["planter", "trimmer", "chainsaw", "bucket", "miner", "mower"];
  const workerType = workerSequence[(childId - 2) % workerSequence.length];
  const clearance = workerType === "bucket" ? 46 / SURFACE_SCALE : ["trimmer", "planter"].includes(workerType) ? 12 / SURFACE_SCALE : ["chainsaw", "miner"].includes(workerType) ? 14 / SURFACE_SCALE : MOWER_CLEARANCE;
  let spawnX = parent.x;
  let spawnY = parent.y;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = parent.angle + Math.PI * (0.45 + attempt * 0.37);
    const distance = 18 + attempt * 2;
    const candidateX = wrapX(parent.x + Math.cos(angle) * distance);
    const candidateY = Math.max(clearance, Math.min(FIELD_H - clearance, parent.y + Math.sin(angle) * distance));
    if (!pointIsBlocked(candidateX, candidateY, clearance)) {
      spawnX = candidateX;
      spawnY = candidateY;
      break;
    }
  }

  const child = {
    id: childId,
    workerType,
    generation: parent.generation + 1,
    level: 1,
    levelBoostUntil: 0,
    baseDeckRadius: workerType === "trimmer" ? 34 / SURFACE_SCALE : workerType === "planter" ? 44 / SURFACE_SCALE : workerType === "bucket" ? 38 / SURFACE_SCALE : ["chainsaw", "miner"].includes(workerType) ? 18 / SURFACE_SCALE : DECK_RADIUS,
    deckRadius: workerType === "trimmer" ? 34 / SURFACE_SCALE : workerType === "planter" ? 44 / SURFACE_SCALE : workerType === "bucket" ? 38 / SURFACE_SCALE : ["chainsaw", "miner"].includes(workerType) ? 18 / SURFACE_SCALE : DECK_RADIUS,
    clearance,
    x: spawnX,
    y: spawnY,
    angle: parent.angle + Math.PI * 0.62,
    speed: 45 * SPEED_SCALE,
    battery: 100,
    mowedCells: 0,
    reproductionProgress: 0,
    grainCargoCells: 0,
    returningToGranary: false,
    burningUntil: 0,
    arrowStaggerUntil: 0,
    disabledUntil: 0,
    protectedUntil: elapsed + 12,
    target: null,
    retargetIn: 0,
    recovery: 0,
    recoverySteer: parent.id % 2 ? 1 : -1,
    searchCursor: parent.id * 997 + nextMowerId * 131,
    treeTarget: null,
    sawProgress: 0,
    sawing: false,
    trimProgress: 0,
    trimming: false,
    stoneTarget: null,
    miningProgress: 0,
    mining: false,
    plantedCells: 0,
    model: workerType === "trimmer"
      ? createWeedWhackerModel(parent.generation + 1)
      : workerType === "planter"
        ? createPlanterModel(parent.generation + 1)
      : workerType === "chainsaw"
        ? createChainsawModel(parent.generation + 1)
      : workerType === "bucket"
        ? createBucketTruckModel(parent.generation + 1)
      : workerType === "miner"
        ? createMinerModel(parent.generation + 1)
      : createMowerModel(parent.generation + 1),
  };
  child.model.name = `${workerType}-${child.id}-generation-${child.generation}`;
  planetRoot.add(child.model);
  offspring.push(child);
  const arrivalMessage = workerType === "trimmer"
    ? `Weed-whacker ${child.id} joined · generation ${child.generation}`
    : workerType === "planter"
      ? `Planter ${child.id} joined · sowing four crop varieties`
    : workerType === "chainsaw"
      ? `Chainsaw ${child.id} joined · generation ${child.generation}`
    : workerType === "bucket"
      ? `Tree-trimmer truck ${child.id} joined · bucket boom ready`
    : workerType === "miner"
      ? `Miner ${child.id} joined · quarrying stronghold stone`
    : `Mower rider ${child.id} hatched · generation ${child.generation}`;
  announceAttack(arrivalMessage);
  return child;
}

function processReproduction() {
  if (1 + offspring.length >= colonyCapacity()) return;
  const parents = [mower, ...offspring];
  for (const parent of parents) {
    if (parent.reproductionProgress < REPRODUCTION_CELLS) continue;
    parent.reproductionProgress -= REPRODUCTION_CELLS;
    spawnOffspring(parent);
    if (1 + offspring.length >= colonyCapacity()) break;
  }
}

function processWorkerLeveling(agent) {
  const currentLevel = agent.level || 1;
  const earnedLevel = Math.min(MAX_WORKER_LEVEL, 1 + Math.floor((agent.mowedCells || 0) / LEVEL_CELLS));
  if (earnedLevel <= currentLevel) return;
  agent.level = earnedLevel;
  agent.levelBoostUntil = elapsed + LEVEL_BOOST_SECONDS;
  agent.baseDeckRadius ||= agent.deckRadius || DECK_RADIUS;
  agent.deckRadius = agent.baseDeckRadius * (1 + (earnedLevel - 1) * 0.1);
  const workerName = agent === mower
    ? "Founder"
    : agent.workerType === "planter"
      ? `Planter ${agent.id}`
    : agent.workerType === "trimmer"
      ? `Weed-whacker ${agent.id}`
      : agent.workerType === "chainsaw"
        ? `Chainsaw ${agent.id}`
      : agent.workerType === "bucket"
        ? `Bucket truck ${agent.id}`
      : agent.workerType === "miner"
        ? `Miner ${agent.id}`
      : `Mower ${agent.id}`;
  announceAttack(`${workerName} leveled up · level ${earnedLevel}`);
}

function workerLevelSpeedMultiplier(agent) {
  const permanentGain = 1 + ((agent.level || 1) - 1) * 0.1;
  const temporaryBoost = agent.levelBoostUntil > elapsed ? LEVEL_BOOST_MULTIPLIER : 1;
  return permanentGain * temporaryBoost * (1 + villageSkills.machinery * 0.06) * (1 + stronghold.smithy * 0.05);
}

function initializeDragons() {
  if (!planetRoot || dragons.length) return;
  for (let index = 0; index < DRAGON_COUNT; index += 1) {
    const model = createDragonModel(index);
    const flame = createDragonFlame();
    planetRoot.add(model, flame);
    dragons.push({
      id: index + 1,
      x: mower.x,
      y: mower.y,
      angle: 0,
      speed: 0,
      altitude: 165 + index * 24,
      targetId: null,
      fireTargetId: null,
      fireUntil: 0,
      fireWindupUntil: 0,
      fireWindupTargetId: null,
      fireCooldownUntil: 4 + index * 1.8,
      satedUntil: 0,
      bank: 0,
      generation: 1,
      meals: 0,
      age: 999,
      birthScale: 1,
      model,
      flame,
    });
  }
  resetDragons();
}

function resetDragons() {
  if (!dragons.length) return;
  while (dragons.length > DRAGON_COUNT) {
    const dragon = dragons.pop();
    for (const object of [dragon.model, dragon.flame]) {
      object?.removeFromParent();
      object?.traverse((part) => {
        part.geometry?.dispose?.();
        if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose?.());
        else part.material?.dispose?.();
      });
    }
  }
  dragons.forEach((dragon, index) => {
    const spawnAngle = mower.angle + 0.8 + index * (Math.PI * 2 / DRAGON_COUNT);
    const spawnDistance = 420 + index * 150;
    dragon.x = wrapX(mower.x + Math.cos(spawnAngle) * spawnDistance);
    dragon.y = Math.max(80, Math.min(FIELD_H - 80, mower.y + Math.sin(spawnAngle) * spawnDistance));
    dragon.angle = Math.atan2(mower.y - dragon.y, worldDeltaX(mower.x, dragon.x));
    dragon.speed = 185 * SPEED_SCALE;
    dragon.altitude = 165 + index * 24;
    dragon.targetId = null;
    dragon.fireTargetId = null;
    dragon.fireUntil = 0;
    dragon.fireWindupUntil = 0;
    dragon.fireWindupTargetId = null;
    dragon.fireCooldownUntil = elapsed + 16 + index * 3;
    dragon.satedUntil = elapsed + 12 + index * 2;
    dragon.bank = 0;
    dragon.generation = 1;
    dragon.meals = 0;
    dragon.age = 999;
    dragon.birthScale = 1;
    dragon.flame.visible = false;
    dragon.model.visible = true;
    dragon.model.scale.setScalar(1);
  });
}

function hatchDragon(parent) {
  if (!planetRoot) return null;
  const id = dragons.reduce((highest, dragon) => Math.max(highest, dragon.id), 0) + 1;
  const useLowDetail = dragons.length >= FULL_DETAIL_DRAGONS;
  const model = useLowDetail ? createLowDetailDragonModel(id - 1) : createDragonModel(id - 1);
  const flame = createDragonFlame(!useLowDetail, useLowDetail ? 3 : 10);
  const hatchling = {
    id,
    x: wrapX(parent.x - Math.cos(parent.angle) * 35),
    y: Math.max(60, Math.min(FIELD_H - 60, parent.y - Math.sin(parent.angle) * 35)),
    angle: parent.angle + Math.PI * 0.8,
    speed: 135 * SPEED_SCALE,
    altitude: parent.altitude + 45,
    targetId: null,
    fireTargetId: null,
    fireUntil: 0,
    fireWindupUntil: 0,
    fireWindupTargetId: null,
    fireCooldownUntil: elapsed + 18,
    satedUntil: elapsed + 14,
    bank: 0,
    generation: parent.generation + 1,
    meals: 0,
    age: 0,
    birthScale: 0.58,
    model,
    flame,
  };
  model.scale.setScalar(hatchling.birthScale);
  flame.visible = false;
  planetRoot.add(model, flame);
  dragons.push(hatchling);
  announceAttack(`Dragon ${parent.id} hatched dragon ${id} · generation ${hatchling.generation}`);
  return hatchling;
}

function mowerById(id) {
  if (id === mower.id) return mower;
  return offspring.find((child) => child.id === id) || null;
}

function availablePrey() {
  return [mower, ...offspring].filter((agent) => (
    !(agent.disabledUntil > elapsed) && !(agent.protectedUntil > elapsed)
  ));
}

function chooseDragonTarget(dragon) {
  const prey = availablePrey();
  if (!prey.length) return null;
  return prey.reduce((best, agent) => {
    const distance = Math.hypot(worldDeltaX(agent.x, dragon.x), agent.y - dragon.y);
    const score = distance + ((agent.id + dragon.id) % prey.length) * 18;
    return !best || score < best.score ? { agent, score } : best;
  }, null)?.agent || null;
}

function announceAttack(message) {
  ui.status.textContent = message;
}

function igniteMower(agent, dragon) {
  if (!agent || agent.disabledUntil > elapsed) return;
  const fireProtection = Math.min(0.72, stronghold.guardTower * 0.06 + villageSkills.defense * 0.045);
  agent.burningUntil = Math.max(agent.burningUntil || 0, elapsed + 5.2 * (1 - fireProtection));
  if (agent === mower) {
    mower.battery = Math.max(0, mower.battery - 18 * (1 - fireProtection));
    damage += 4 * (1 - fireProtection);
  } else {
    agent.target = null;
    agent.recovery = Math.max(agent.recovery, 0.7);
  }
  const workerLabel = agent === mower ? "founder" : agent.workerType;
  announceAttack(`Dragon ${dragon.id} set ${workerLabel} ${agent.id} on fire`);
}

function modelForWorker(agent) {
  return agent === mower ? mowerModel : agent?.model;
}

function chooseBarbarianTarget() {
  return availablePrey().reduce((best, agent) => {
    const distance = Math.hypot(worldDeltaX(agent.x, barbarianSite.x), agent.y - barbarianSite.y);
    if (distance > 235) return best;
    return !best || distance < best.distance ? { agent, distance } : best;
  }, null)?.agent || null;
}

function shootBarbarianArrow(bowman, target) {
  if (!planetRoot || !bowman?.model || !target) return;
  barbarianVillage.model.updateWorldMatrix(true, true);
  const targetModel = modelForWorker(target);
  targetModel?.updateWorldMatrix(true, false);
  const startWorld = bowman.model.localToWorld(new THREE.Vector3(20, 43, 0));
  const endWorld = targetModel
    ? targetModel.localToWorld(new THREE.Vector3(0, 38, 0))
    : planetFrame(target.x, target.y).normal.multiplyScalar(PLANET_RADIUS + terrainHeightAt(target.x, target.y) + 35);
  const start = planetRoot.worldToLocal(startWorld.clone());
  const end = planetRoot.worldToLocal(endWorld.clone());
  const model = createBarbarianArrowModel();
  model.position.copy(start);
  planetRoot.add(model);
  barbarianArrows.push({
    model,
    start,
    end,
    target,
    progress: 0,
    duration: THREE.MathUtils.clamp(start.distanceTo(end) / 720, 0.72, 1.28),
    previous: start.clone(),
  });
  bowman.draw = 1;
  bowman.targetId = target.id;
}

function hitWorkerWithArrow(agent) {
  if (!agent || agent.disabledUntil > elapsed || agent.protectedUntil > elapsed) return;
  const protection = Math.min(0.68, stronghold.guardTower * 0.055 + villageSkills.defense * 0.05);
  agent.speed *= 0.28;
  agent.arrowStaggerUntil = elapsed + 1.1 * (1 - protection);
  if (agent === mower) {
    mower.battery = Math.max(0, mower.battery - 6.5 * (1 - protection));
    damage += 1.2 * (1 - protection);
  } else {
    agent.target = null;
    agent.recovery = Math.max(agent.recovery || 0, 0.75);
  }
  barbarianArrowHits += 1;
  const label = agent === mower ? "founder" : `${agent.workerType} ${agent.id}`;
  announceAttack(`Barbarian bowmen struck ${label} · ${barbarianArrowHits} arrow hits`);
}

function updateBarbarianVillage(dt) {
  if (!barbarianVillage) return;
  const target = chooseBarbarianTarget();
  barbarianVillage.bowmen.forEach((bowman, index) => {
    bowman.draw += (0 - bowman.draw) * Math.min(1, dt * 4.2);
    if (!target) {
      bowman.nextShot = Math.max(bowman.nextShot, elapsed + 0.35 + index * 0.13);
      bowman.targetId = null;
      return;
    }
    if (elapsed < bowman.nextShot) return;
    shootBarbarianArrow(bowman, target);
    bowman.nextShot = elapsed + 3.1 + index * 0.11 + planetNoise(index + Math.floor(elapsed), 88) * 0.9;
  });

  for (let index = barbarianArrows.length - 1; index >= 0; index -= 1) {
    const arrow = barbarianArrows[index];
    arrow.progress += dt / arrow.duration;
    const amount = Math.min(1, arrow.progress);
    const movingTargetModel = modelForWorker(arrow.target);
    if (movingTargetModel && amount < 0.88) {
      const targetWorld = movingTargetModel.getWorldPosition(new THREE.Vector3());
      arrow.end.lerp(planetRoot.worldToLocal(targetWorld), Math.min(1, dt * 4));
    }
    const middle = arrow.start.clone().add(arrow.end).multiplyScalar(0.5);
    const surfaceRadius = (arrow.start.length() + arrow.end.length()) * 0.5 + 105;
    middle.normalize().multiplyScalar(surfaceRadius);
    const inverse = 1 - amount;
    const position = arrow.start.clone().multiplyScalar(inverse * inverse)
      .addScaledVector(middle, 2 * inverse * amount)
      .addScaledVector(arrow.end, amount * amount);
    const direction = position.clone().sub(arrow.previous).normalize();
    if (direction.lengthSq() > 0.001) arrow.model.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    arrow.model.position.copy(position);
    arrow.previous.copy(position);
    if (amount < 1) continue;
    hitWorkerWithArrow(arrow.target);
    arrow.model.removeFromParent();
    barbarianArrows.splice(index, 1);
  }
}

function removeOffspring(child) {
  const index = offspring.indexOf(child);
  if (index < 0) return;
  offspring.splice(index, 1);
  child.model?.removeFromParent();
  child.model?.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
}

function eatMower(agent, dragon) {
  if (!agent || agent.disabledUntil > elapsed || agent.protectedUntil > elapsed) return;
  mowersLost += 1;
  dragon.satedUntil = elapsed + 11;
  dragon.targetId = null;
  dragon.fireTargetId = null;
  dragon.fireUntil = 0;
  dragon.fireWindupUntil = 0;
  dragon.fireWindupTargetId = null;
  dragon.flame.visible = false;

  if (agent === mower) {
    const pad = nearestChargePad();
    mower.x = pad.x;
    mower.y = pad.y;
    mower.speed = 0;
    mower.battery = 100;
    mower.burningUntil = 0;
    mower.boosting = false;
    mower.disabledUntil = elapsed + 4.5;
    mower.protectedUntil = elapsed + 13;
    mower.reproductionProgress *= 0.5;
    mower.grainCargoCells = 0;
    mower.returningToGranary = false;
    mowerModel.visible = false;
    autoTarget = null;
    announceAttack("Founder eaten · replacement inbound");
  } else {
    removeOffspring(agent);
    announceAttack(`Dragon ${dragon.id} ate rider ${agent.id}`);
  }
  dragon.meals = (dragon.meals || 0) + 1;
  if (dragon.meals >= DRAGON_BROOD_MEALS) {
    dragon.meals -= DRAGON_BROOD_MEALS;
    hatchDragon(dragon);
  }
}

function castleOuterRadiusField(castle) {
  const radiusWorld = castle.level >= 6 ? 455 : castle.level >= 4 ? 305 : 170;
  return radiusWorld * 0.9 / SURFACE_SCALE;
}

function updateCastlePortcullises(dt) {
  if (!castles.length) return;
  const workers = [mower, ...offspring];
  for (const castle of castles) {
    const ringRadii = castle.model?.userData?.ringRadii || [170];
    const fieldRadii = ringRadii.map((radius) => radius * 0.9 / SURFACE_SCALE);
    const shouldOpen = workers.some((worker) => {
      if (!worker || worker.disabledUntil > elapsed) return false;
      const dx = worldDeltaX(worker.x, castle.x);
      const dy = worker.y - castle.y;
      if (Math.abs(dy) > 20) return false;
      return fieldRadii.some((radius) => Math.abs(dx - radius) < 31);
    });
    castle.gateOpen = shouldOpen;
    for (const portcullis of castle.model?.userData?.portcullises || []) {
      const target = shouldOpen ? 1 : 0;
      const current = portcullis.userData.openAmount || 0;
      const speed = shouldOpen ? 3.2 : 1.7;
      const next = current + (target - current) * Math.min(1, dt * speed);
      portcullis.userData.openAmount = next;
      const eased = next * next * (3 - 2 * next);
      portcullis.position.y = THREE.MathUtils.lerp(portcullis.userData.closedY, portcullis.userData.openY, eased);
    }
  }
}

function updateCastleDragonDefenses(dt) {
  if (!castles.length || !dragons.length) return;
  for (const castle of castles) {
    if (castle.level < 2) continue;
    castle.nextDefenseShotAt ||= elapsed + 0.6;
    if (elapsed < castle.nextDefenseShotAt) continue;
    const range = 82 + castle.level * 19 + villageSkills.defense * 5;
    const target = dragons.reduce((best, dragon) => {
      const distance = Math.hypot(worldDeltaX(dragon.x, castle.x), dragon.y - castle.y);
      if (distance > range) return best;
      return !best || distance < best.distance ? { dragon, distance } : best;
    }, null)?.dragon;
    if (!target) continue;

    const cadence = Math.max(0.52, 2.55 - castle.level * 0.22 - villageSkills.defense * 0.08);
    castle.nextDefenseShotAt = elapsed + cadence;
    const impact = 0.9 + castle.level * 0.38 + villageSkills.defense * 0.16;
    target.castleDefenseDamage = (target.castleDefenseDamage || 0) + impact;
    target.fireCooldownUntil = Math.max(target.fireCooldownUntil || 0, elapsed + 0.45);
    target.bank += (hash(target.id, castle.level, seed) - 0.5) * 0.2;
    const durability = 7 + (target.generation || 1) * 1.7;
    if (target.castleDefenseDamage < durability) continue;
    const dragonId = target.id;
    if (removeDragon(target)) {
      announceAttack(`Castle level ${castle.level} archers brought down dragon ${dragonId}`);
    }
  }
}

function updateDragons(dt) {
  for (const dragon of dragons) {
    dragon.age = (dragon.age || 0) + dt;
    let target = mowerById(dragon.targetId);
    if (!target || target.disabledUntil > elapsed || target.protectedUntil > elapsed || elapsed < dragon.satedUntil) {
      target = elapsed >= dragon.satedUntil ? chooseDragonTarget(dragon) : null;
      dragon.targetId = target?.id || null;
    }

    let desired = dragon.angle + 0.35;
    if (target) desired = Math.atan2(target.y - dragon.y, worldDeltaX(target.x, dragon.x));
    const turn = Math.max(-1, Math.min(1, angleDifference(desired, dragon.angle) * 1.35));
    dragon.angle += turn * dt * 1.7;
    dragon.bank += ((-turn * 0.52) - dragon.bank) * Math.min(1, dt * 4.5);
    const desiredSpeed = (target ? 265 : 175) * SPEED_SCALE;
    dragon.speed += (desiredSpeed - dragon.speed) * Math.min(1, dt * 1.8);
    dragon.x = wrapX(dragon.x + Math.cos(dragon.angle) * dragon.speed * dt);
    dragon.y += Math.sin(dragon.angle) * dragon.speed * dt;
    if (dragon.y < 45 || dragon.y > FIELD_H - 45) {
      dragon.y = Math.max(45, Math.min(FIELD_H - 45, dragon.y));
      dragon.angle *= -1;
    }

    if (!target) {
      dragon.altitude += (195 - dragon.altitude) * Math.min(1, dt * 1.4);
      continue;
    }
    const distance = Math.hypot(worldDeltaX(target.x, dragon.x), target.y - dragon.y);
    const attackAltitude = 72 + Math.min(115, distance * 0.34);
    dragon.altitude += (attackAltitude - dragon.altitude) * Math.min(1, dt * 1.8);
    const windupTarget = mowerById(dragon.fireWindupTargetId);
    if (dragon.fireWindupUntil > 0) {
      const windupDistance = windupTarget
        ? Math.hypot(worldDeltaX(windupTarget.x, dragon.x), windupTarget.y - dragon.y)
        : Infinity;
      if (!windupTarget || windupTarget.protectedUntil > elapsed || windupDistance > 125) {
        dragon.fireWindupUntil = 0;
        dragon.fireWindupTargetId = null;
        dragon.fireCooldownUntil = elapsed + 2.5;
      } else if (elapsed >= dragon.fireWindupUntil) {
        dragon.fireTargetId = windupTarget.id;
        dragon.fireUntil = elapsed + 1.05;
        dragon.fireWindupUntil = 0;
        dragon.fireWindupTargetId = null;
        dragon.fireCooldownUntil = elapsed + 8.5 + dragon.id * 0.8;
        igniteMower(windupTarget, dragon);
      }
    } else if (distance < 78 && elapsed >= dragon.fireCooldownUntil) {
      dragon.fireWindupTargetId = target.id;
      dragon.fireWindupUntil = elapsed + 1.5;
    }
    if (distance < 13) eatMower(target, dragon);
  }
}

function dragonById(id) {
  return dragons.find((dragon) => dragon.id === id) || null;
}

function removeDragon(dragon) {
  const index = dragons.indexOf(dragon);
  if (index < 0) return false;
  dragons.splice(index, 1);
  for (const object of [dragon.model, dragon.flame]) {
    object?.removeFromParent();
    object?.traverse((part) => {
      part.geometry?.dispose?.();
      if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose?.());
      else part.material?.dispose?.();
    });
  }
  for (const roc of rocs) {
    if (roc.targetDragonId === dragon.id) roc.targetDragonId = null;
  }
  return true;
}

function chooseRocTarget(roc) {
  return dragons.reduce((best, dragon) => {
    const distance = Math.hypot(worldDeltaX(dragon.x, roc.x), dragon.y - roc.y);
    const claimed = rocs.some((other) => other !== roc && other.targetDragonId === dragon.id) ? 260 : 0;
    const score = distance + claimed + dragon.altitude * 0.08;
    return !best || score < best.score ? { dragon, score } : best;
  }, null)?.dragon || null;
}

function spawnRoc(castle) {
  if (!castle || !planetRoot) return null;
  const model = createRocModel(nextRocId);
  const roc = {
    id: nextRocId++,
    nestCastleId: castle.id,
    x: castle.x,
    y: castle.y,
    angle: castle.id * 0.91,
    speed: 175 * SPEED_SCALE,
    altitude: 245,
    bank: 0,
    targetDragonId: null,
    retargetAt: elapsed + 1.2,
    carryingUntil: 0,
    kills: 0,
    model,
  };
  planetRoot.add(model);
  rocs.push(roc);
  announceAttack(`A giant roc nested at Castle ${castle.id}`);
  return roc;
}

function ensureRocPopulation() {
  if (rocs.length) clearRocs();
}

function updateRocs(dt) {
  ensureRocPopulation();
  for (const roc of rocs) {
    const nest = castles.find((castle) => castle.id === roc.nestCastleId) || castles[0];
    let target = dragonById(roc.targetDragonId);
    const carrying = elapsed < roc.carryingUntil;
    if (!carrying && (!target || elapsed >= roc.retargetAt)) {
      target = chooseRocTarget(roc);
      roc.targetDragonId = target?.id || null;
      roc.retargetAt = elapsed + 2.2;
    }

    let targetX = nest?.x ?? roc.x;
    let targetY = nest?.y ?? roc.y;
    let desiredAltitude = 255;
    if (carrying) {
      targetX = nest?.x ?? roc.x;
      targetY = nest?.y ?? roc.y;
      desiredAltitude = 285;
    } else if (target) {
      targetX = target.x;
      targetY = target.y;
      const horizontalDistance = Math.hypot(worldDeltaX(target.x, roc.x), target.y - roc.y);
      desiredAltitude = target.altitude + Math.min(115, horizontalDistance * 0.2);
    } else if (nest) {
      const orbit = elapsed * 0.14 + roc.id * 2.1;
      targetX = wrapX(nest.x + Math.cos(orbit) * 170);
      targetY = Math.max(90, Math.min(FIELD_H - 90, nest.y + Math.sin(orbit) * 120));
    }

    const desired = Math.atan2(targetY - roc.y, worldDeltaX(targetX, roc.x));
    const turn = Math.max(-1, Math.min(1, angleDifference(desired, roc.angle) * 1.55));
    roc.angle += turn * dt * 1.9;
    roc.bank += ((-turn * 0.68) - roc.bank) * Math.min(1, dt * 4.2);
    const defenseSpeed = 1 + villageSkills.defense * 0.08;
    const desiredSpeed = (target && !carrying ? 350 : carrying ? 285 : 205) * SPEED_SCALE * defenseSpeed;
    roc.speed += (desiredSpeed - roc.speed) * Math.min(1, dt * 1.7);
    roc.x = wrapX(roc.x + Math.cos(roc.angle) * roc.speed * dt);
    roc.y += Math.sin(roc.angle) * roc.speed * dt;
    if (roc.y < 55 || roc.y > FIELD_H - 55) {
      roc.y = Math.max(55, Math.min(FIELD_H - 55, roc.y));
      roc.angle *= -1;
    }
    roc.altitude += (desiredAltitude - roc.altitude) * Math.min(1, dt * (target ? 2.4 : 1.2));

    if (target && !carrying) {
      const distance = Math.hypot(worldDeltaX(target.x, roc.x), target.y - roc.y);
      if (distance < 17 && Math.abs(roc.altitude - target.altitude) < 62 && removeDragon(target)) {
        roc.kills += 1;
        dragonsTakenByRocs += 1;
        roc.targetDragonId = null;
        roc.carryingUntil = elapsed + 4.5;
        announceAttack(`Roc ${roc.id} seized dragon ${target.id} and carried it away`);
      }
    }
  }
}

function removeRoc(roc) {
  const index = rocs.indexOf(roc);
  if (index < 0) return false;
  rocs.splice(index, 1);
  roc.model?.removeFromParent();
  roc.model?.traverse((part) => {
    part.geometry?.dispose?.();
    if (Array.isArray(part.material)) part.material.forEach((material) => material.dispose?.());
    else part.material?.dispose?.();
  });
  rocRespawnBlockedUntil = elapsed + 12;
  return true;
}

function initializeApexCat() {
  if (!planetRoot || apexCat) return;
  const model = createApexCatModel();
  planetRoot.add(model);
  apexCat = {
    x: wrapX(granary.x + 95),
    y: Math.max(70, Math.min(FIELD_H - 70, granary.y + 55)),
    angle: 0.8,
    speed: 0,
    altitude: 10,
    targetKey: null,
    retargetAt: 0,
    satedUntil: 20,
    napUntil: 20,
    meals: 0,
    leaping: false,
    model,
  };
}

function resetApexCat() {
  if (!apexCat) return;
  apexCat.x = wrapX(granary.x + 95);
  apexCat.y = Math.max(70, Math.min(FIELD_H - 70, granary.y + 55));
  apexCat.angle = 0.8;
  apexCat.speed = 0;
  apexCat.altitude = 10;
  apexCat.targetKey = null;
  apexCat.retargetAt = 0;
  apexCat.satedUntil = 20;
  apexCat.napUntil = 20;
  apexCat.meals = 0;
  apexCat.leaping = false;
  apexCat.model.visible = true;
}

function catTargetDescriptor(kind, creature) {
  return {
    key: `${kind}:${creature.id}`,
    kind,
    creature,
    x: creature.x,
    y: creature.y,
    altitude: kind === "dragon" || kind === "roc" ? creature.altitude : 12,
  };
}

function catTargets() {
  const targets = [];
  if (!(mower.disabledUntil > elapsed)) targets.push(catTargetDescriptor("worker", mower));
  for (const worker of offspring) targets.push(catTargetDescriptor("worker", worker));
  for (const dragon of dragons) targets.push(catTargetDescriptor("dragon", dragon));
  for (const roc of rocs) targets.push(catTargetDescriptor("roc", roc));
  return targets;
}

function catTargetByKey(key) {
  if (!key) return null;
  return catTargets().find((target) => target.key === key) || null;
}

function chooseCatTarget() {
  if (!apexCat) return null;
  return catTargets().reduce((best, target) => {
    const distance = Math.hypot(worldDeltaX(target.x, apexCat.x), target.y - apexCat.y);
    const airbornePenalty = target.altitude * 0.06;
    const variety = hash(target.creature.id * 73, councilRound + apexCat.meals * 17, seed) * 45;
    const score = distance + airbornePenalty + variety;
    return !best || score < best.score ? { target, score } : best;
  }, null)?.target || null;
}

function catEatWorker(worker) {
  if (!worker || worker.disabledUntil > elapsed) return false;
  mowersLost += 1;
  if (worker === mower) {
    const pad = nearestChargePad();
    mower.x = pad.x;
    mower.y = pad.y;
    mower.speed = 0;
    mower.battery = 100;
    mower.burningUntil = 0;
    mower.boosting = false;
    mower.disabledUntil = elapsed + 5.5;
    mower.protectedUntil = elapsed + 10;
    mower.reproductionProgress *= 0.5;
    mower.grainCargoCells = 0;
    mower.returningToGranary = false;
    mowerModel.visible = false;
    autoTarget = null;
  } else {
    removeOffspring(worker);
  }
  return true;
}

function apexCatEat(target) {
  if (!apexCat || !target) return false;
  let eaten = false;
  if (target.kind === "worker") eaten = catEatWorker(target.creature);
  else if (target.kind === "dragon") eaten = removeDragon(target.creature);
  else if (target.kind === "roc") eaten = removeRoc(target.creature);
  if (!eaten) return false;
  apexCat.meals += 1;
  creaturesEatenByCat += 1;
  apexCat.targetKey = null;
  apexCat.satedUntil = elapsed + 8.5;
  apexCat.napUntil = elapsed + 6.5;
  apexCat.leaping = false;
  const label = target.kind === "worker"
    ? target.creature === mower ? "the founder mower" : `${target.creature.workerType} ${target.creature.id}`
    : `${target.kind} ${target.creature.id}`;
  announceAttack(`The cat ate ${label} · meal ${apexCat.meals}`);
  return true;
}

function updateApexCat(dt) {
  if (!apexCat) return;
  const napping = elapsed < apexCat.napUntil;
  let target = catTargetByKey(apexCat.targetKey);
  if (!napping && elapsed >= apexCat.satedUntil && (!target || elapsed >= apexCat.retargetAt)) {
    target = chooseCatTarget();
    apexCat.targetKey = target?.key || null;
    apexCat.retargetAt = elapsed + 2.4;
  }
  if (napping) {
    apexCat.speed += (0 - apexCat.speed) * Math.min(1, dt * 5);
    apexCat.altitude += (7 - apexCat.altitude) * Math.min(1, dt * 4);
    apexCat.leaping = false;
    return;
  }

  let desired = apexCat.angle + 0.24;
  let desiredAltitude = 9;
  if (target && elapsed >= apexCat.satedUntil) {
    desired = Math.atan2(target.y - apexCat.y, worldDeltaX(target.x, apexCat.x));
    const distance = Math.hypot(worldDeltaX(target.x, apexCat.x), target.y - apexCat.y);
    apexCat.leaping = target.altitude > 35 && distance < 240;
    desiredAltitude = apexCat.leaping ? target.altitude : 9;
  } else {
    apexCat.leaping = false;
  }
  const turn = Math.max(-1, Math.min(1, angleDifference(desired, apexCat.angle) * 1.7));
  apexCat.angle += turn * dt * 2.05;
  const huntSpeed = apexCat.leaping ? 520 : target ? 335 : 105;
  const desiredSpeed = huntSpeed * SPEED_SCALE;
  apexCat.speed += (desiredSpeed - apexCat.speed) * Math.min(1, dt * 2.4);
  apexCat.x = wrapX(apexCat.x + Math.cos(apexCat.angle) * apexCat.speed * dt);
  apexCat.y += Math.sin(apexCat.angle) * apexCat.speed * dt;
  if (apexCat.y < 48 || apexCat.y > FIELD_H - 48) {
    apexCat.y = Math.max(48, Math.min(FIELD_H - 48, apexCat.y));
    apexCat.angle *= -1;
  }
  apexCat.altitude += (desiredAltitude - apexCat.altitude) * Math.min(1, dt * (apexCat.leaping ? 4.5 : 2.8));
  if (target && elapsed >= apexCat.satedUntil) {
    const distance = Math.hypot(worldDeltaX(target.x, apexCat.x), target.y - apexCat.y);
    if (distance < 19 && Math.abs(apexCat.altitude - target.altitude) < 78) apexCatEat(target);
  }
}

function earnedPoints() {
  const castleScore = castles.reduce((total, castle) => total + castle.level * 2200, 0);
  const wallScore = villageWallLevel * 1900;
  const skillScore = Object.values(villageSkills).reduce((total, level) => total + level * 1750, 0);
  const treasuryScore = silverCoins * 25 + goldCoins * 3000;
  const strongholdScore = Object.values(stronghold).reduce((total, level) => total + level * 2400, 0) + timberStock * 120 + stoneStock * 180;
  return Math.round(cutCount * 10 + grainDeliveredKg * 250 + castleScore + wallScore + skillScore + strongholdScore + treasuryScore + dragonsTakenByRocs * 1800 + treesCut * 400 + treesTrimmed * 180 + offspring.length * 1500);
}

function liveScore() {
  // The HUD is a spendable points balance. Damage and mower losses belong in
  // the final performance score; they must not silently erase earned currency.
  return Math.max(0, earnedPoints() - upgradeSpent);
}

function upgradeFounderToTractor() {
  if (mower.workerType === "tractor") return;
  if (liveScore() < TRACTOR_COST) {
    announceAttack(`${(TRACTOR_COST - liveScore()).toLocaleString()} more points for tractor`);
    return;
  }
  upgradeSpent += TRACTOR_COST;
  const oldModel = mowerModel;
  mowerModel = createTractorModel();
  mowerModel.visible = !(mower.disabledUntil > elapsed);
  planetRoot.add(mowerModel);
  oldModel?.removeFromParent();
  oldModel?.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose?.());
    else object.material?.dispose?.();
  });
  mower.workerType = "tractor";
  mower.baseDeckRadius = 82 / SURFACE_SCALE;
  mower.deckRadius = mower.baseDeckRadius * (1 + ((mower.level || 1) - 1) * 0.1);
  mower.clearance = 42 / SURFACE_SCALE;
  mower.width = 158;
  mower.length = 176;
  announceAttack("Tractor and wide deck deployed");
}

function update(dt) {
  if (!running || finished) {
    updateAudio();
    return;
  }

  elapsed += dt;
  updateCastlePortcullises(dt);
  updateTrees(dt);
  updateGrassRegrowth();
  tryUnloadGrain(mower);
  textureRefreshIn -= dt;
  if (mower.disabledUntil && elapsed >= mower.disabledUntil) {
    mower.disabledUntil = 0;
    mowerModel.visible = true;
    announceAttack("Replacement rider deployed");
  }
  const founderDisabled = mower.disabledUntil > elapsed;
  let steer = Number(input.right) - Number(input.left);
  let drive = Number(input.forward) - Number(input.reverse);

  if (autoMode) {
    const automatic = getAutoControls(dt);
    steer = automatic.steer;
    drive = automatic.drive;
  }

  if (!autoMode && pointerDrive.active) {
    const desired = Math.atan2(pointerDrive.y - mower.y, pointerDrive.x - mower.x);
    const difference = angleDifference(desired, mower.angle);
    steer = Math.max(-1, Math.min(1, difference * 1.8));
    drive = Math.abs(difference) > 2.35 ? 0.25 : 1;
  }

  if (founderDisabled) {
    steer = 0;
    drive = 0;
  }

  const reserveMode = mower.battery <= 0;
  const fireSlow = (mower.burningUntil > elapsed ? 0.42 : 1) * (mower.arrowStaggerUntil > elapsed ? 0.42 : 1);
  mower.boosting = !founderDisabled && drive > 0 && boostHeld && mower.boostFuel > 0;
  const boostMultiplier = mower.boosting
    ? (mower.workerType === "tractor" ? 1.62 : 1.9)
    : 1;
  const forwardSpeed = (mower.workerType === "tractor" ? 190 : 225) * workerLevelSpeedMultiplier(mower);
  const targetSpeed = drive > 0
    ? (reserveMode ? 42 : forwardSpeed) * SPEED_SCALE * drive * fireSlow * boostMultiplier * (eBrakeHeld ? 0.62 : 1)
    : drive < 0
      ? (reserveMode ? 28 : 92) * SPEED_SCALE * drive
      : 0;
  const acceleration = (eBrakeHeld ? 330 : drive === 0 ? 260 : 210) * SPEED_SCALE;
  const deltaSpeed = targetSpeed - mower.speed;
  mower.speed += Math.sign(deltaSpeed) * Math.min(Math.abs(deltaSpeed), acceleration * dt);

  const speedRatio = Math.min(1, Math.abs(mower.speed) / (170 * SPEED_SCALE));
  const steeringRate = eBrakeHeld ? 4.15 : 2.25;
  mower.angle += steer * steeringRate * dt * (0.22 + speedRatio * 0.78) * (mower.speed < 0 ? -1 : 1);
  const desiredVelocityX = Math.cos(mower.angle) * mower.speed;
  const desiredVelocityY = Math.sin(mower.angle) * mower.speed;
  const traction = eBrakeHeld ? 0.72 : 6.5;
  const tractionBlend = Math.min(1, dt * traction);
  mower.velocityX += (desiredVelocityX - mower.velocityX) * tractionBlend;
  mower.velocityY += (desiredVelocityY - mower.velocityY) * tractionBlend;
  const previousX = mower.x;
  const previousY = mower.y;
  mower.x += mower.velocityX * dt;
  mower.y += mower.velocityY * dt;
  mower.x = wrapX(mower.x);

  const boundary = mower.clearance || MOWER_CLEARANCE;
  const collision = insideObstacle(mower.x, mower.y, boundary);
  const out = mower.y < boundary || mower.y > FIELD_H - boundary;
  if (collision || out) {
    mower.x = previousX;
    mower.y = previousY;
    mower.speed *= -0.18;
    mower.velocityX *= -0.18;
    mower.velocityY *= -0.18;
    if (autoMode) {
      autoRecovery = 0.62;
      autoRecoverySteer = hash(Math.floor(mower.x), Math.floor(mower.y), Math.floor(elapsed * 10)) > 0.5 ? 1 : -1;
      autoTarget = null;
    }
    if (elapsed - lastImpact > 0.8) {
      damage += collision?.id === "flowers" ? 6 : 1;
      lastImpact = elapsed;
      ui.status.textContent = collision?.id === "flowers" ? "Mind the flower bed" : "Deck obstruction";
    }
  }

  let newlyCut = cutGrass();
  for (const child of offspring) newlyCut += updateColonyAgent(child, dt);
  updateDragons(dt);
  updateCastleDragonDefenses(dt);
  updateRocs(dt);
  updateApexCat(dt);
  updateBarbarianVillage(dt);
  processReproduction();
  processVillageCouncil();
  updateCivilization();
  if (newlyCut > 0) lawnTextureDirty = true;
  if (lawnTextureDirty && lawnTexture && textureRefreshIn <= 0) {
    lawnTexture.needsUpdate = true;
    lawnTextureDirty = false;
    textureRefreshIn = 0.24;
  }
  const moving = Math.abs(mower.speed) > 4 * SPEED_SCALE;
  if (moving && !founderDisabled) mower.battery = Math.max(0, mower.battery - dt * (0.12 + speedRatio * 0.09) * SPEED_SCALE);
  const parkedAtCharger = isOnChargePad() && Math.abs(mower.speed) < 12 * SPEED_SCALE;
  if (parkedAtCharger) mower.battery = Math.min(100, mower.battery + dt * 16);
  if (mower.boosting) mower.boostFuel = Math.max(0, mower.boostFuel - dt * 24);
  else mower.boostFuel = Math.min(100, mower.boostFuel + dt * (parkedAtCharger ? 34 : 1.5));
  if (mower.boostFuel <= 0) mower.boosting = false;

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }

  const completion = currentCutCount / Math.max(1, totalCuttable);
  if (completion >= FINISH_THRESHOLD) finishJob();
  if (birthToastUntil && elapsed >= birthToastUntil) {
    ui.birthToast.classList.remove("is-visible");
    birthToastUntil = 0;
  }
  updateUI();
  updateAudio();
}

function finishJob() {
  finished = true;
  mower.speed = 0;
  for (const child of offspring) child.speed = 0;
  for (const dragon of dragons) {
    dragon.speed = 0;
    dragon.flame.visible = false;
  }
  for (const roc of rocs) roc.speed = 0;
  const castleScore = castles.reduce((total, castle) => total + castle.level * 2200, 0);
  const wallScore = villageWallLevel * 1900;
  const skillScore = Object.values(villageSkills).reduce((total, level) => total + level * 1750, 0);
  const treasuryScore = silverCoins * 25 + goldCoins * 3000;
  const finalScore = Math.max(0, Math.round(cutCount * 10 + grainDeliveredKg * 250 + castleScore + wallScore + skillScore + treasuryScore + dragonsTakenByRocs * 1800 + treesCut * 400 + treesTrimmed * 180 + offspring.length * 1500 - damage * 250 - mowersLost * 1000 - upgradeSpent - elapsed * 2));
  ui.finishScore.textContent = `${finalScore.toLocaleString()} pts`;
  ui.finishDetail.textContent = `${formatTime(elapsed)} · castle level ${castles[0]?.level || 0} · walls level ${villageWallLevel} · ${goldCoins} gold · ${silverCoins} silver · cat ate ${creaturesEatenByCat} creatures`;
  ui.status.textContent = `Planet mastered · ${finalScore.toLocaleString()} points`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function updateUI() {
  const completion = currentCutCount / Math.max(1, totalCuttable);
  const completionDigits = completion < 0.01 ? 2 : 1;
  ui.cut.textContent = `${(completion * 100).toFixed(completionDigits)}%`;
  ui.battery.textContent = `${Math.round(mower.battery)}%`;
  ui.battery.classList.toggle("is-low", mower.battery < 20);
  ui.time.textContent = formatTime(elapsed);
  const nextBuildCost = villageWallLevel < MAX_VILLAGE_WALL_LEVEL ? villageWallCost() : 0;
  const constructionProgress = villageWallLevel < MAX_VILLAGE_WALL_LEVEL
    ? `${Math.max(0, nextBuildCost - grainStoredKg).toFixed(1)} kg to wall ${villageWallLevel + 1}`
    : "village walls complete";
  ui.clippings.textContent = `${grainStoredKg.toFixed(1)} kg crop stored · ${constructionProgress}`;
  ui.planetProgress.textContent = `${(completion * 100).toFixed(completionDigits)}% of planet`;
  const terrainSample = scientificWorld.sample(mower.x, mower.y);
  ui.terrainReadout.textContent = `${terrainSample.biome} · ${Math.round(terrainHeightAt(mower.x, mower.y))} m`;
  ui.planetDot.style.left = `${8 + (mower.x / FIELD_W) * 84}%`;
  ui.planetDot.style.top = `${8 + (mower.y / FIELD_H) * 84}%`;
  ui.granaryDot.style.left = `${8 + (granary.x / FIELD_W) * 84}%`;
  ui.granaryDot.style.top = `${8 + (granary.y / FIELD_H) * 84}%`;
  ui.barbarianDot.style.left = `${8 + (barbarianSite.x / FIELD_W) * 84}%`;
  ui.barbarianDot.style.top = `${8 + (barbarianSite.y / FIELD_H) * 84}%`;
  if (granaryGrainPile) {
    const pileScale = Math.min(1.8, 0.35 + Math.sqrt(grainStoredKg) * 0.18);
    granaryGrainPile.visible = grainStoredKg > 0.01;
    granaryGrainPile.scale.set(pileScale, Math.min(2.2, pileScale * 1.18), pileScale);
  }
  if (camera) {
    const cameraRelativeToPlanet = camera.position.clone();
    if (planetRoot) cameraRelativeToPlanet.applyQuaternion(planetRoot.quaternion.clone().invert());
    const cameraCoordinates = worldVectorToCoordinates(cameraRelativeToPlanet);
    ui.cameraDot.style.left = `${8 + (cameraCoordinates.x / FIELD_W) * 84}%`;
    ui.cameraDot.style.top = `${8 + (cameraCoordinates.y / FIELD_H) * 84}%`;
  }

  const colony = [mower, ...offspring];
  const closestToHatching = colony.reduce((closest, member) => Math.max(closest, member.reproductionProgress || 0), 0);
  const hatchRatio = Math.min(1, closestToHatching / REPRODUCTION_CELLS);
  const remainingKg = Math.max(0, (REPRODUCTION_CELLS - closestToHatching) * CLIPPINGS_PER_CELL);
  const scoreNow = liveScore();
  const capacity = colonyCapacity();
  ui.crew.textContent = `${colony.length} / ${capacity}`;
  ui.generation.textContent = civilizationNames[civilizationLevel];
  ui.level.textContent = `Lv ${mower.level || 1}`;
  ui.score.textContent = scoreNow.toLocaleString();
  ui.threat.textContent = `${dragons.length} dragons · cat · ${barbarianVillage?.bowmen.length || 8} bowmen`;
  const trees = obstacles.filter((shape) => shape.id === "tree");
  const youngestTreeLevel = trees.reduce((youngest, tree) => Math.min(youngest, tree.growthLevel ?? TREE_GROW_LEVELS), TREE_GROW_LEVELS);
  ui.councilStatus.textContent = lastCouncilResult;
  ui.councilSkills.textContent = `Castle ${castles[0]?.level || 0}/7 · Walls ${villageWallLevel}/7 · Farm ${villageSkills.agriculture} · Machines ${villageSkills.machinery} · Forest ${villageSkills.forestry} · Defense ${villageSkills.defense} · Tree ${youngestTreeLevel}/77`;
  ui.councilBallot.textContent = lastBallot || `Next ballot in ${Math.max(0, Math.ceil(nextCouncilAt - elapsed))}s`;
  ui.stockpileStatus.textContent = `${grainStoredKg.toFixed(1)} grain · ${timberStock.toFixed(1)} timber · ${stoneStock.toFixed(1)} stone`;
  ui.buildingStatus.textContent = `House L${stronghold.housing} · Mill L${stronghold.mill} · Smith L${stronghold.smithy} · Yard L${stronghold.lumberyard} · Tower L${stronghold.guardTower}`;
  ui.treasury.textContent = `${silverCoins} silver · ${goldCoins} gold`;
  ui.mintSilver.disabled = grainStoredKg + 0.0001 < SILVER_GRAIN_COST;
  ui.mintGold.disabled = silverCoins < SILVER_PER_GOLD;
  ui.hatchProgress.style.width = `${hatchRatio * 100}%`;
  ui.hatchLabel.textContent = colony.length >= capacity
    ? (capacity >= MAX_COLONY ? "Stronghold at maximum capacity" : "Council needs more housing")
    : `Next hatch · ${remainingKg.toFixed(1)} kg`;
  ui.nitro.textContent = `NITRO ${Math.round(mower.boostFuel)}%`;
  ui.nitro.classList.toggle("is-active", mower.boosting);
  ui.nitro.disabled = mower.disabledUntil > elapsed;
  const tractorUnlocked = mower.workerType === "tractor";
  ui.tractorUpgrade.textContent = tractorUnlocked ? "TRACTOR ✓" : "TRACTOR · 5,000 PTS";
  ui.tractorUpgrade.classList.toggle("is-unlocked", tractorUnlocked || scoreNow >= TRACTOR_COST);
  ui.tractorUpgrade.disabled = tractorUnlocked;

  if (mower.disabledUntil > elapsed) {
    ui.batteryLabel.textContent = "Redeploy";
    ui.status.textContent = `Founder eaten · replacement in ${(mower.disabledUntil - elapsed).toFixed(1)}s`;
  } else if (mower.boosting) {
    ui.batteryLabel.textContent = "Battery";
    ui.status.textContent = mower.workerType === "tractor" ? "Tractor boost engaged" : "Nitro engaged";
  } else if (eBrakeHeld && Math.abs(mower.speed) > 18 * SPEED_SCALE) {
    ui.batteryLabel.textContent = "E-brake";
    ui.status.textContent = "Space held · drifting with low traction";
  } else if (mower.levelBoostUntil > elapsed) {
    ui.batteryLabel.textContent = "Battery";
    ui.status.textContent = `Level boost · ${LEVEL_BOOST_MULTIPLIER.toFixed(2)}× speed`;
  } else if (birthToastUntil > elapsed) {
    ui.batteryLabel.textContent = "Battery";
    ui.status.textContent = ui.birthToast.textContent;
  } else if (isOnChargePad() && Math.abs(mower.speed) < 12 * SPEED_SCALE && mower.battery < 99.8) {
    ui.batteryLabel.textContent = "Charging";
    ui.status.textContent = "Auto · charging at a field station";
  } else {
    ui.batteryLabel.textContent = "Battery";
    if (mower.battery <= 0) ui.status.textContent = "Emergency crawl · return to the shed";
    else if (autoMode && autoCharging) ui.status.textContent = "Auto · returning to charge";
    else if (autoMode && mower.returningToGranary) ui.status.textContent = `Auto · hauling ${grainCargoKg(mower).toFixed(1)} kg crop to granary`;
    else if (autoMode) ui.status.textContent = "Auto · harvesting the next field";
    else if (Math.abs(mower.speed) > 8 * SPEED_SCALE) ui.status.textContent = cutCount ? "Harvester engaged" : "Crossing the field";
    else if (running) ui.status.textContent = "Engine idling";
  }
}

function resize() {
  if (!renderer || !camera) return;
  renderer.setPixelRatio(renderPixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / Math.max(1, innerHeight);
  camera.updateProjectionMatrix();
  cameraControls?.handleResize?.();
}

function updateAdaptiveQuality(dt) {
  if (!renderer) return;
  performanceWindowTime += dt;
  performanceWindowFrames += 1;
  if (performanceWindowTime < 2.5) return;
  const averageFrameTime = performanceWindowTime / Math.max(1, performanceWindowFrames);
  let nextRatio = renderPixelRatio;
  if (averageFrameTime > 0.027) nextRatio -= 0.1;
  else if (averageFrameTime < 0.019) nextRatio += 0.05;
  nextRatio = Math.max(0.68, Math.min(MAX_DEVICE_PIXEL_RATIO, nextRatio));
  if (Math.abs(nextRatio - renderPixelRatio) >= 0.04) {
    renderPixelRatio = nextRatio;
    renderer.setPixelRatio(renderPixelRatio);
    renderer.setSize(innerWidth, innerHeight, false);
  }
  const allowShadows = (!MOBILE_RENDERING || surfaceView) && renderPixelRatio >= 0.82 && dragons.length < (MOBILE_RENDERING ? 22 : 36);
  renderer.shadowMap.enabled = allowShadows;
  if (sun) sun.castShadow = allowShadows;
  performanceWindowTime = 0;
  performanceWindowFrames = 0;
}

function addInstances(geometry, material, transforms) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const dummy = new THREE.Object3D();
  transforms.forEach((item, index) => {
    dummy.position.set(item.x, item.y, item.z);
    if (item.quaternion) dummy.quaternion.copy(item.quaternion);
    else dummy.rotation.set(0, item.rotation || 0, 0);
    dummy.scale.set(item.sx, item.sy, item.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  (planetRoot || scene).add(mesh);
  return mesh;
}

function applyInstanceTransform(mesh, index, transform, scale = 1) {
  if (!mesh || !transform) return;
  const dummy = new THREE.Object3D();
  dummy.position.set(transform.x, transform.y, transform.z);
  dummy.quaternion.copy(transform.quaternion);
  dummy.scale.set(transform.sx * scale, transform.sy * scale, transform.sz * scale);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function refreshTreeInstances() {
  if (!treeTrunkInstances || !treeCrownInstances) return;
  for (const tree of obstacles.filter((shape) => shape.id === "tree")) {
    const trunkScale = tree.growth <= 0.02 ? 0.001 : Math.max(0.12, tree.growth);
    const crownScale = tree.growth < 0.18 ? 0.001 : (tree.growth - 0.12) / 0.88;
    applyInstanceTransform(treeTrunkInstances, tree.treeIndex, tree.trunkTransform, trunkScale);
    applyInstanceTransform(treeCrownInstances, tree.treeIndex, tree.crownTransform, crownScale);
  }
  treeTrunkInstances.instanceMatrix.needsUpdate = true;
  treeCrownInstances.instanceMatrix.needsUpdate = true;
  treeVisualsDirty = false;
}

function updateTrees(dt) {
  treeVisualRefreshIn -= dt;
  let changed = treeVisualsDirty;
  const forestrySpeed = 1 + villageSkills.forestry * 0.16;
  const stageSeconds = TREE_GROW_SECONDS / TREE_GROW_LEVELS / forestrySpeed;
  for (const tree of obstacles) {
    if (tree.id !== "tree" || (tree.growthLevel ?? TREE_GROW_LEVELS) >= TREE_GROW_LEVELS || elapsed < tree.regrowAt) continue;
    tree.nextGrowthAt ||= tree.regrowAt;
    let advanced = false;
    while (tree.growthLevel < TREE_GROW_LEVELS && elapsed >= tree.nextGrowthAt) {
      tree.growthLevel += 1;
      tree.nextGrowthAt += stageSeconds;
      advanced = true;
    }
    if (!advanced) continue;
    tree.growth = tree.growthLevel / TREE_GROW_LEVELS;
    changed = true;
  }
  if (changed && treeVisualRefreshIn <= 0) {
    refreshTreeInstances();
    treeVisualRefreshIn = 0.12;
  }
}

function updateGrassRegrowth() {
  let changed = 0;
  while (cropSproutHead < cropSproutQueue.length) {
    const entry = cropSproutQueue[cropSproutHead];
    if (entry.growAt > elapsed) break;
    cropSproutHead += 1;
    if (!cut[entry.index] || cropStage[entry.index] !== 1) continue;
    cropStage[entry.index] = 2;
    const row = Math.floor(entry.index / COLS);
    const col = entry.index - row * COLS;
    renderGrassCell(col, row, true);
    changed += 1;
  }
  while (cropYoungHead < cropYoungQueue.length) {
    const entry = cropYoungQueue[cropYoungHead];
    if (entry.growAt > elapsed) break;
    cropYoungHead += 1;
    if (!cut[entry.index] || cropStage[entry.index] < 2) continue;
    cropStage[entry.index] = 3;
    const row = Math.floor(entry.index / COLS);
    const col = entry.index - row * COLS;
    renderGrassCell(col, row, true);
    changed += 1;
  }
  if (changed > 0) lawnTextureDirty = true;
  if (cropSproutHead > 10000 && cropSproutHead > cropSproutQueue.length / 2) {
    cropSproutQueue.splice(0, cropSproutHead);
    cropSproutHead = 0;
  }
  if (cropYoungHead > 10000 && cropYoungHead > cropYoungQueue.length / 2) {
    cropYoungQueue.splice(0, cropYoungHead);
    cropYoungHead = 0;
  }
  return changed;
}

function addWorldScenery() {
  lawnTexture = new THREE.CanvasTexture(lawnLayer);
  lawnTexture.colorSpace = THREE.SRGBColorSpace;
  // Proper minification keeps narrow streams and crop marks from turning into
  // flashing cyan/green scanlines when the camera pulls back.
  lawnTexture.generateMipmaps = true;
  lawnTexture.minFilter = THREE.LinearMipmapLinearFilter;
  lawnTexture.magFilter = THREE.LinearFilter;
  lawnTexture.anisotropy = Math.min(MOBILE_RENDERING ? 2 : 4, renderer.capabilities.getMaxAnisotropy());
  lawnTexture.wrapS = THREE.RepeatWrapping;
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: lawnTexture,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
  });
  const ground = new THREE.Mesh(createTerrainGeometry(), groundMaterial);
  ground.receiveShadow = true;
  planetRoot.add(ground);
  const ocean = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS - 20, MOBILE_RENDERING ? 128 : 192, MOBILE_RENDERING ? 72 : 112),
    new THREE.MeshStandardMaterial({
      color: 0x174f61,
      emissive: 0x041820,
      emissiveIntensity: 0.05,
      roughness: 0.62,
      metalness: 0.02,
      depthWrite: true,
    }),
  );
  ocean.name = "scientific-ocean-surface";
  ocean.receiveShadow = true;
  planetRoot.add(ocean);

  const tangentQuaternion = (frame, spin = 0) => {
    const basis = new THREE.Matrix4().makeBasis(
      frame.east,
      frame.normal,
      frame.east.clone().cross(frame.normal).normalize(),
    );
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
    if (spin) quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
    return quaternion;
  };
  const surfaceTransform = (x, y, altitude, sx, sy, sz, spin = 0) => {
    const frame = planetFrame(x, y);
    const position = frame.normal.clone().multiplyScalar(PLANET_RADIUS + terrainHeightAt(x, y) + altitude);
    return { x: position.x, y: position.y, z: position.z, sx, sy, sz, quaternion: tangentQuaternion(frame, spin) };
  };

  const treeTrunks = [];
  const treeCrowns = [];
  const stones = [];
  const ponds = [];
  const flowerBeds = [];
  const flowerBlooms = [];
  for (const shape of obstacles) {
    const spin = planetNoise(Math.floor(shape.x), 8) * Math.PI;
    if (shape.id === "tree") {
      const radius = shape.r * SURFACE_SCALE;
      shape.treeIndex = treeTrunks.length;
      shape.trunkTransform = surfaceTransform(shape.x, shape.y, radius * 0.48, radius * 0.2, radius * 0.96, radius * 0.2, spin);
      shape.crownTransform = surfaceTransform(shape.x, shape.y, radius * 1.2, radius * 0.76, radius * 0.78, radius * 0.76, spin);
      treeTrunks.push(shape.trunkTransform);
      treeCrowns.push(shape.crownTransform);
    } else if (shape.id === "stone") {
      const radius = shape.r * SURFACE_SCALE;
      stones.push(surfaceTransform(shape.x, shape.y, radius * 0.42, radius, radius * 0.62, radius * 0.84, spin));
    } else if (shape.id === "pond") {
      ponds.push(surfaceTransform(shape.x, shape.y, 1, shape.rx * SURFACE_SCALE, 2.2, shape.ry * SURFACE_SCALE, -0.08));
    } else if (shape.id === "flowers") {
      const radius = shape.r * SURFACE_SCALE;
      flowerBeds.push(surfaceTransform(shape.x, shape.y, 2, radius, 4, radius, spin));
      flowerBlooms.push(surfaceTransform(shape.x, shape.y, 12, radius * 0.82, 13, radius * 0.82, spin));
    }
  }

  treeTrunkInstances = addInstances(new THREE.CylinderGeometry(1, 1.15, 1, 8), new THREE.MeshStandardMaterial({ color: 0x604832, roughness: 1 }), treeTrunks);
  treeCrownInstances = addInstances(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x315c42, roughness: 0.95 }), treeCrowns);
  addInstances(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x77766d, roughness: 1 }), stones);
  addInstances(new THREE.CylinderGeometry(1, 1, 1, 32), new THREE.MeshStandardMaterial({ color: 0x315f64, roughness: 0.35, metalness: 0.08 }), ponds);
  addInstances(new THREE.CylinderGeometry(1, 1, 1, 18), new THREE.MeshStandardMaterial({ color: 0x483526, roughness: 1 }), flowerBeds);
  addInstances(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xc97b70, roughness: 0.9 }), flowerBlooms);

  const padMaterial = new THREE.MeshStandardMaterial({ color: 0x17211d, roughness: 0.72, metalness: 0.28 });
  const railMaterial = new THREE.MeshStandardMaterial({ color: 0xd0a05b, emissive: 0x5d3a13, emissiveIntensity: 0.7 });
  for (const pad of chargePads) {
    const frame = planetFrame(pad.x, pad.y);
    const station = new THREE.Group();
    station.position.copy(frame.normal).multiplyScalar(PLANET_RADIUS + terrainHeightAt(pad.x, pad.y) + 2);
    station.quaternion.copy(tangentQuaternion(frame));
    const base = new THREE.Mesh(new THREE.BoxGeometry(140, 6, 110), padMaterial);
    base.position.y = 1;
    base.receiveShadow = true;
    station.add(base);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(48, 3, 6, 24), railMaterial);
    rail.rotation.x = Math.PI / 2;
    rail.scale.z = 0.72;
    rail.position.y = 6;
    station.add(rail);
    planetRoot.add(station);
  }

  const granaryFrame = planetFrame(granary.x, granary.y);
  const granaryGroup = new THREE.Group();
  granaryGroup.name = "grain-granary";
  granaryGroup.position.copy(granaryFrame.normal).multiplyScalar(PLANET_RADIUS + terrainHeightAt(granary.x, granary.y) + 3);
  granaryGroup.quaternion.copy(tangentQuaternion(granaryFrame));
  const granaryGold = new THREE.MeshStandardMaterial({ color: 0xd5a33f, emissive: 0x5a3510, emissiveIntensity: 0.22, roughness: 0.66, metalness: 0.08 });
  const granaryRed = new THREE.MeshStandardMaterial({ color: 0x783d2b, roughness: 0.88 });
  const granaryRoof = new THREE.MeshStandardMaterial({ color: 0x2b302b, roughness: 0.72, metalness: 0.2 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0xaaa591, roughness: 0.96 });
  const unloadRing = new THREE.Mesh(new THREE.TorusGeometry(58, 5, 8, 36), granaryGold);
  unloadRing.rotation.x = Math.PI / 2;
  unloadRing.position.y = 6;
  granaryGroup.add(unloadRing);
  const unloadFloor = new THREE.Mesh(new THREE.CylinderGeometry(54, 54, 5, 32), concrete);
  unloadFloor.position.y = 2;
  unloadFloor.receiveShadow = true;
  granaryGroup.add(unloadFloor);
  const barn = new THREE.Mesh(new THREE.BoxGeometry(104, 62, 72), granaryRed);
  barn.position.set(-48, 34, 126);
  barn.castShadow = true;
  granaryGroup.add(barn);
  const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(68, 34, 4), granaryRoof);
  barnRoof.position.set(-48, 81, 126);
  barnRoof.rotation.y = Math.PI / 4;
  barnRoof.scale.z = 0.7;
  barnRoof.castShadow = true;
  granaryGroup.add(barnRoof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(6, 42, 34), granaryRoof);
  door.position.set(5, 25, 126);
  granaryGroup.add(door);
  for (const [x, z, radius, height] of [[46, 105, 28, 78], [76, 145, 22, 65]]) {
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 18), concrete);
    silo.position.set(x, height / 2, z);
    silo.castShadow = true;
    granaryGroup.add(silo);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(radius + 4, 23, 18), granaryRoof);
    roof.position.set(x, height + 11, z);
    roof.castShadow = true;
    granaryGroup.add(roof);
  }
  const beaconPost = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 92, 8), granaryRoof);
  beaconPost.position.set(-66, 49, 72);
  granaryGroup.add(beaconPost);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffcf5b }));
  beacon.position.set(-66, 99, 72);
  granaryGroup.add(beacon);
  granaryGrainPile = new THREE.Mesh(new THREE.ConeGeometry(30, 25, 12), granaryGold);
  granaryGrainPile.position.set(35, 13, 52);
  granaryGrainPile.scale.setScalar(0.25);
  granaryGrainPile.visible = false;
  granaryGroup.add(granaryGrainPile);
  planetRoot.add(granaryGroup);
}

function box(parent, size, color, position, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? 0.72, metalness: options.metalness ?? 0.08 }),
  );
  mesh.position.copy(position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function limb(parent, start, end, radius, material) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function createRiderBurnEffect() {
  const effect = new THREE.Group();
  effect.name = "rider-burn-effect";
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4a0a,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd34d,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flameSpots = [
    [-2, 67, -12], [2, 76, 11], [4, 90, -4], [13, 61, 2],
  ];
  const flames = flameSpots.map(([x, y, z], index) => {
    const tongue = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(6.5, 27, 9, 1, true), outerMaterial);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(3.1, 19, 8, 1, true), innerMaterial);
    inner.position.y = -2;
    tongue.position.set(x, y, z);
    tongue.add(outer, inner);
    tongue.userData.base = new THREE.Vector3(x, y, z);
    tongue.userData.phase = index * 1.73;
    effect.add(tongue);
    return tongue;
  });

  const smokeGeometry = new THREE.IcosahedronGeometry(1, 1);
  const smoke = [];
  for (let index = 0; index < 4; index += 1) {
    const puff = new THREE.Mesh(
      smokeGeometry,
      new THREE.MeshBasicMaterial({ color: 0x1b201d, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    puff.userData.offset = index / 4;
    effect.add(puff);
    smoke.push(puff);
  }

  const emberPositions = new Float32Array(24);
  const emberGeometry = new THREE.BufferGeometry();
  emberGeometry.setAttribute("position", new THREE.BufferAttribute(emberPositions, 3));
  const embers = new THREE.Points(
    emberGeometry,
    new THREE.PointsMaterial({ color: 0xffb12b, size: 4.5, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  effect.add(embers);
  effect.userData = { flames, smoke, embers, emberPositions };
  effect.visible = false;
  return effect;
}

function createBoostEffect(exhaustX = -42, exhaustY = 22, spacing = 20) {
  const effect = new THREE.Group();
  const outerMaterial = new THREE.MeshBasicMaterial({ color: 0xff4f13, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xb8edff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const jets = [];
  for (const side of [-1, 1]) {
    const jet = new THREE.Group();
    jet.position.set(exhaustX, exhaustY, side * spacing);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(6, 32, 10, 1, true), outerMaterial);
    const core = new THREE.Mesh(new THREE.ConeGeometry(2.6, 22, 8, 1, true), coreMaterial);
    outer.rotation.z = -Math.PI / 2;
    core.rotation.z = -Math.PI / 2;
    core.position.x = 3;
    jet.add(outer, core);
    jet.userData.phase = side > 0 ? 1.7 : 0;
    effect.add(jet);
    jets.push(jet);
  }
  effect.userData.jets = jets;
  effect.visible = false;
  return effect;
}

function createMowerModel(generation = 1) {
  const group = new THREE.Group();
  const bodyColor = generation === 1
    ? new THREE.Color(0xd0a05b)
    : new THREE.Color().setHSL((0.08 + generation * 0.11) % 1, 0.48, 0.56);
  const riderColor = generation === 1
    ? new THREE.Color(0x527a68)
    : new THREE.Color().setHSL((0.34 + generation * 0.075) % 1, 0.32, 0.46);
  const dark = new THREE.MeshStandardMaterial({ color: 0x141a17, roughness: 0.82 });
  const jade = new THREE.MeshStandardMaterial({ color: riderColor, roughness: 0.86 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97957, roughness: 0.9 });

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(MODEL_DECK_RADIUS, MODEL_DECK_RADIUS + 3, 12, 24), new THREE.MeshStandardMaterial({ color: 0x263b32, roughness: 0.78, metalness: 0.16 }));
  deck.position.set(-14, 8, 0);
  deck.castShadow = true;
  group.add(deck);
  box(group, new THREE.Vector3(67, 27, 54), bodyColor, new THREE.Vector3(16, 25, 0), { roughness: 0.52, metalness: 0.16 });
  box(group, new THREE.Vector3(27, 34, 38), 0x171d1a, new THREE.Vector3(2, 47, 0));

  const wheelGeometry = new THREE.CylinderGeometry(11, 11, 9, 12);
  for (const x of [-20, 37]) {
    for (const z of [-32, 32]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 14, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  box(group, new THREE.Vector3(26, 30, 31), riderColor, new THREE.Vector3(-2, 69, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), skin);
  head.position.set(4, 91, 0);
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(10.7, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), jade);
  cap.position.set(4, 94, 0);
  cap.castShadow = true;
  group.add(cap);
  box(group, new THREE.Vector3(11, 3, 23), 0x78a88f, new THREE.Vector3(13, 94, 0));

  const leftHand = new THREE.Vector3(31, 54, -17);
  const rightHand = new THREE.Vector3(31, 54, 17);
  limb(group, new THREE.Vector3(2, 76, -12), leftHand, 4, jade);
  limb(group, new THREE.Vector3(2, 76, 12), rightHand, 4, jade);
  const steering = new THREE.Mesh(new THREE.TorusGeometry(17, 2.4, 7, 22), dark);
  steering.rotation.y = Math.PI / 2;
  steering.position.set(32, 53, 0);
  group.add(steering);
  for (const hand of [leftHand, rightHand]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(4.5, 10, 8), skin);
    mesh.position.copy(hand);
    mesh.castShadow = true;
    group.add(mesh);
  }
  const burnEffect = createRiderBurnEffect();
  group.add(burnEffect);
  group.userData.burnEffect = burnEffect;
  const boostEffect = createBoostEffect();
  group.add(boostEffect);
  group.userData.boostEffect = boostEffect;
  group.userData.workerType = "mower";
  group.userData.povHidden = [head, cap];
  return group;
}

function createWeedWhackerModel(generation = 1) {
  const group = new THREE.Group();
  group.name = "weed-whacker-worker";
  const shirtColor = new THREE.Color().setHSL((0.31 + generation * 0.08) % 1, 0.36, 0.48);
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.88 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x202a26, roughness: 0.94 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97957, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141a17, roughness: 0.82 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8b9991, roughness: 0.42, metalness: 0.5 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xd0a05b, roughness: 0.58, metalness: 0.12 });

  const leftLeg = limb(group, new THREE.Vector3(-5, 35, -7), new THREE.Vector3(-4, 9, -8), 5.6, trousers);
  const rightLeg = limb(group, new THREE.Vector3(-5, 35, 7), new THREE.Vector3(4, 9, 8), 5.6, trousers);
  leftLeg.userData.restQuaternion = leftLeg.quaternion.clone();
  rightLeg.userData.restQuaternion = rightLeg.quaternion.clone();
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(3, 5, -8));
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(11, 5, 8));
  box(group, new THREE.Vector3(23, 34, 25), shirtColor, new THREE.Vector3(-3, 51, 0));

  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), skin);
  head.position.set(1, 78, 0);
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(10.8, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), accent);
  cap.position.set(1, 82, 0);
  cap.castShadow = true;
  group.add(cap);
  box(group, new THREE.Vector3(12, 3, 23), 0xd0a05b, new THREE.Vector3(10, 82, 0));

  const handleLeft = new THREE.Vector3(19, 47, -10);
  const handleRight = new THREE.Vector3(19, 47, 10);
  limb(group, new THREE.Vector3(-2, 62, -10), handleLeft, 4.2, shirt);
  limb(group, new THREE.Vector3(-2, 62, 10), handleRight, 4.2, shirt);
  for (const handPosition of [handleLeft, handleRight]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(4.4, 10, 8), skin);
    hand.position.copy(handPosition);
    hand.castShadow = true;
    group.add(hand);
  }

  limb(group, new THREE.Vector3(13, 49, 0), new THREE.Vector3(58, 10, 0), 2.7, metal);
  box(group, new THREE.Vector3(17, 14, 18), 0xd0a05b, new THREE.Vector3(6, 39, 0), { roughness: 0.58, metalness: 0.12 });
  const cutterRotor = new THREE.Group();
  cutterRotor.position.set(60, 7, 0);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(11, 2.2, 7, 20), dark);
  guard.rotation.x = Math.PI / 2;
  cutterRotor.add(guard);
  const bladeA = box(cutterRotor, new THREE.Vector3(30, 1.2, 2.2), 0x9cc7b0, new THREE.Vector3());
  const bladeB = box(cutterRotor, new THREE.Vector3(2.2, 1.2, 30), 0x9cc7b0, new THREE.Vector3());
  bladeA.castShadow = false;
  bladeB.castShadow = false;
  group.add(cutterRotor);

  const burnEffect = createRiderBurnEffect();
  burnEffect.position.y = -5;
  group.add(burnEffect);
  group.userData.burnEffect = burnEffect;
  group.userData.workerType = "trimmer";
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.cutterRotor = cutterRotor;
  return group;
}

function createPlanterModel(generation = 1) {
  const group = new THREE.Group();
  group.name = "crop-planter-worker";
  const coatColor = new THREE.Color().setHSL((0.22 + generation * 0.047) % 1, 0.42, 0.45);
  const coat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.9 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x292c27, roughness: 0.96 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97957, roughness: 0.9 });
  const soil = new THREE.MeshStandardMaterial({ color: 0x4b3425, roughness: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x89938c, roughness: 0.5, metalness: 0.42 });
  const seedGold = new THREE.MeshStandardMaterial({ color: 0xd4a448, roughness: 0.72, metalness: 0.08 });

  const leftLeg = limb(group, new THREE.Vector3(-8, 35, -7), new THREE.Vector3(-6, 9, -8), 5.5, trousers);
  const rightLeg = limb(group, new THREE.Vector3(-8, 35, 7), new THREE.Vector3(3, 9, 8), 5.5, trousers);
  leftLeg.userData.restQuaternion = leftLeg.quaternion.clone();
  rightLeg.userData.restQuaternion = rightLeg.quaternion.clone();
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(1, 5, -8));
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(10, 5, 8));
  box(group, new THREE.Vector3(25, 35, 27), coatColor, new THREE.Vector3(-5, 52, 0));

  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 14, 10), skin);
  head.position.set(-1, 79, 0);
  head.castShadow = true;
  group.add(head);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(17, 14, 12), seedGold);
  hat.position.set(-1, 91, 0);
  hat.castShadow = true;
  group.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 3, 16), seedGold);
  brim.position.set(-1, 84, 0);
  group.add(brim);

  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(13, 18, 31, 10), seedGold);
  hopper.position.set(-22, 55, 0);
  hopper.castShadow = true;
  group.add(hopper);
  const hopperLid = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 3, 10), metal);
  hopperLid.position.set(-22, 72, 0);
  group.add(hopperLid);

  const leftHand = new THREE.Vector3(26, 47, -13);
  const rightHand = new THREE.Vector3(26, 47, 13);
  limb(group, new THREE.Vector3(-2, 64, -10), leftHand, 4, coat);
  limb(group, new THREE.Vector3(-2, 64, 10), rightHand, 4, coat);
  limb(group, leftHand, new THREE.Vector3(55, 23, -17), 2.3, metal);
  limb(group, rightHand, new THREE.Vector3(55, 23, 17), 2.3, metal);
  for (const handPosition of [leftHand, rightHand]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(4.2, 9, 7), skin);
    hand.position.copy(handPosition);
    group.add(hand);
  }

  const drill = new THREE.Group();
  drill.position.set(62, 14, 0);
  box(drill, new THREE.Vector3(35, 18, 58), 0x526b42, new THREE.Vector3(0, 10, 0), { roughness: 0.82 });
  const planterWheels = [];
  for (const z of [-34, 34]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 7, 12), soil);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(1, 4, z);
    wheel.castShadow = true;
    drill.add(wheel);
    planterWheels.push(wheel);
  }
  for (const z of [-21, -7, 7, 21]) {
    const seedTube = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 19, 7), metal);
    seedTube.position.set(10, -1, z);
    drill.add(seedTube);
    const opener = new THREE.Mesh(new THREE.ConeGeometry(4, 12, 6), soil);
    opener.position.set(10, -12, z);
    drill.add(opener);
  }
  group.add(drill);

  const burnEffect = createRiderBurnEffect();
  burnEffect.position.y = -5;
  group.add(burnEffect);
  group.userData.burnEffect = burnEffect;
  group.userData.workerType = "planter";
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.planterWheels = planterWheels;
  return group;
}

function createChainsawModel(generation = 1) {
  const group = new THREE.Group();
  group.name = "chainsaw-worker";
  const jacketColor = new THREE.Color().setHSL((0.055 + generation * 0.035) % 1, 0.72, 0.54);
  const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.82 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x252c29, roughness: 0.94 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97957, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb6c0bb, roughness: 0.34, metalness: 0.66 });

  const leftLeg = limb(group, new THREE.Vector3(-5, 35, -7), new THREE.Vector3(-4, 9, -8), 5.8, trousers);
  const rightLeg = limb(group, new THREE.Vector3(-5, 35, 7), new THREE.Vector3(4, 9, 8), 5.8, trousers);
  leftLeg.userData.restQuaternion = leftLeg.quaternion.clone();
  rightLeg.userData.restQuaternion = rightLeg.quaternion.clone();
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(3, 5, -8));
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(11, 5, 8));
  box(group, new THREE.Vector3(25, 35, 27), jacketColor, new THREE.Vector3(-3, 52, 0));

  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), skin);
  head.position.set(1, 79, 0);
  head.castShadow = true;
  group.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(11, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0xf28b32, roughness: 0.68 }),
  );
  helmet.position.set(1, 83, 0);
  group.add(helmet);
  box(group, new THREE.Vector3(3, 18, 25), 0xc8d5ce, new THREE.Vector3(11, 75, 0), { roughness: 0.3, metalness: 0.25 });

  const leftHand = new THREE.Vector3(22, 48, -11);
  const rightHand = new THREE.Vector3(30, 43, 11);
  limb(group, new THREE.Vector3(-2, 64, -11), leftHand, 4.2, jacket);
  limb(group, new THREE.Vector3(-2, 64, 11), rightHand, 4.2, jacket);
  for (const handPosition of [leftHand, rightHand]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(4.4, 10, 8), skin);
    hand.position.copy(handPosition);
    group.add(hand);
  }

  const sawGroup = new THREE.Group();
  sawGroup.position.set(28, 38, 0);
  box(sawGroup, new THREE.Vector3(24, 18, 22), 0xe27a2d, new THREE.Vector3(0, 0, 0), { roughness: 0.56, metalness: 0.12 });
  box(sawGroup, new THREE.Vector3(57, 8, 4), 0xb6c0bb, new THREE.Vector3(37, -3, 0), { roughness: 0.34, metalness: 0.66 });
  const chain = new THREE.Mesh(new THREE.TorusGeometry(26, 1.7, 6, 30), steel);
  chain.scale.y = 0.14;
  chain.position.set(37, -3, 0);
  chain.rotation.x = Math.PI / 2;
  sawGroup.add(chain);
  group.add(sawGroup);

  const burnEffect = createRiderBurnEffect();
  burnEffect.position.y = -5;
  group.add(burnEffect);
  group.userData.burnEffect = burnEffect;
  group.userData.workerType = "chainsaw";
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.sawGroup = sawGroup;
  group.userData.chain = chain;
  return group;
}

function createBucketTruckModel(generation = 1) {
  const group = new THREE.Group();
  group.name = "tree-trimmer-bucket-truck";
  const truckColor = new THREE.Color().setHSL((0.11 + generation * 0.027) % 1, 0.7, 0.56);
  const dark = new THREE.MeshStandardMaterial({ color: 0x141a17, roughness: 0.84 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x87938d, roughness: 0.4, metalness: 0.58 });
  const safety = new THREE.MeshStandardMaterial({ color: 0xf1a83a, roughness: 0.62, metalness: 0.08 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97957, roughness: 0.9 });

  box(group, new THREE.Vector3(104, 25, 56), truckColor, new THREE.Vector3(-2, 25, 0), { roughness: 0.58, metalness: 0.15 });
  box(group, new THREE.Vector3(43, 43, 54), truckColor, new THREE.Vector3(31, 52, 0), { roughness: 0.58, metalness: 0.15 });
  box(group, new THREE.Vector3(4, 25, 44), 0x8eb8b1, new THREE.Vector3(53, 57, 0), { roughness: 0.24, metalness: 0.12 });
  box(group, new THREE.Vector3(47, 7, 58), 0x202b27, new THREE.Vector3(-31, 43, 0));
  box(group, new THREE.Vector3(32, 9, 50), 0xb9c2bd, new THREE.Vector3(-31, 50, 0), { roughness: 0.42, metalness: 0.42 });

  const wheelGeometry = new THREE.CylinderGeometry(15, 15, 10, 14);
  for (const x of [-34, 34]) {
    for (const z of [-34, 34]) {
      const wheel = new THREE.Mesh(wheelGeometry, dark);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 14, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  }

  const boomPivot = new THREE.Group();
  boomPivot.position.set(-42, 54, 0);
  const pivotDrum = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 20, 14), steel);
  pivotDrum.rotation.x = Math.PI / 2;
  boomPivot.add(pivotDrum);
  box(boomPivot, new THREE.Vector3(72, 10, 12), 0xf1a83a, new THREE.Vector3(36, 0, 0), { roughness: 0.62, metalness: 0.08 });

  const boomExtension = new THREE.Group();
  boomExtension.position.set(45, 0, 0);
  box(boomExtension, new THREE.Vector3(58, 7, 9), 0xd9dfdb, new THREE.Vector3(29, 0, 0), { roughness: 0.42, metalness: 0.45 });
  const bucket = new THREE.Group();
  bucket.position.set(61, 0, 0);
  box(bucket, new THREE.Vector3(28, 8, 30), 0xf1a83a, new THREE.Vector3(0, -2, 0), { roughness: 0.62, metalness: 0.08 });
  for (const z of [-13, 13]) {
    box(bucket, new THREE.Vector3(4, 29, 4), 0xf1a83a, new THREE.Vector3(-11, 12, z), { roughness: 0.62, metalness: 0.08 });
    box(bucket, new THREE.Vector3(4, 29, 4), 0xf1a83a, new THREE.Vector3(11, 12, z), { roughness: 0.62, metalness: 0.08 });
  }
  box(bucket, new THREE.Vector3(27, 4, 4), 0xf1a83a, new THREE.Vector3(0, 26, -13), { roughness: 0.62, metalness: 0.08 });
  box(bucket, new THREE.Vector3(27, 4, 4), 0xf1a83a, new THREE.Vector3(0, 26, 13), { roughness: 0.62, metalness: 0.08 });

  box(bucket, new THREE.Vector3(16, 24, 20), 0x527a68, new THREE.Vector3(0, 18, 0));
  const workerHead = new THREE.Mesh(new THREE.SphereGeometry(7.5, 14, 10), skin);
  workerHead.position.set(2, 36, 0);
  bucket.add(workerHead);
  const workerHelmet = new THREE.Mesh(new THREE.SphereGeometry(8.3, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), safety);
  workerHelmet.position.set(2, 39, 0);
  bucket.add(workerHelmet);
  const pruningSaw = new THREE.Group();
  pruningSaw.position.set(14, 24, -14);
  box(pruningSaw, new THREE.Vector3(31, 4, 4), 0x87938d, new THREE.Vector3(15, 0, 0), { roughness: 0.4, metalness: 0.58 });
  const cutter = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 2.5, 14), steel);
  cutter.rotation.x = Math.PI / 2;
  cutter.position.set(31, 0, 0);
  pruningSaw.add(cutter);
  bucket.add(pruningSaw);

  boomExtension.add(bucket);
  boomPivot.add(boomExtension);
  group.add(boomPivot);

  const burnEffect = createRiderBurnEffect();
  burnEffect.position.set(-15, -5, 0);
  group.add(burnEffect);
  group.userData.burnEffect = burnEffect;
  group.userData.workerType = "bucket";
  group.userData.boomPivot = boomPivot;
  group.userData.boomExtension = boomExtension;
  group.userData.bucket = bucket;
  group.userData.pruningCutter = cutter;
  group.userData.boomDeploy = 0;
  return group;
}

function createBarbarianBowmanModel(index = 0) {
  const group = new THREE.Group();
  group.name = `barbarian-bowman-${index + 1}`;
  const hide = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x6b3526 : 0x75422c, roughness: 0.96 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xa85f3d, roughness: 0.92 });
  const fur = new THREE.MeshStandardMaterial({ color: 0x33251d, roughness: 0.98 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a6536, roughness: 0.88 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x7f8781, roughness: 0.38, metalness: 0.55 });

  box(group, new THREE.Vector3(17, 30, 20), index % 2 ? 0x6b3526 : 0x75422c, new THREE.Vector3(0, 33, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(8.5, 12, 9), skin);
  head.position.set(1, 57, 0);
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(9.2, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55), fur);
  hair.position.set(0, 61, 0);
  group.add(hair);
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(3, 13, 7), iron);
    horn.position.set(0, 64, side * 9);
    horn.rotation.x = side * 0.55;
    group.add(horn);
  }
  limb(group, new THREE.Vector3(0, 46, -8), new THREE.Vector3(15, 37, -14), 3.2, hide);
  const drawArm = limb(group, new THREE.Vector3(0, 46, 8), new THREE.Vector3(10, 42, 17), 3.2, hide);
  drawArm.userData.restQuaternion = drawArm.quaternion.clone();
  limb(group, new THREE.Vector3(-4, 19, -6), new THREE.Vector3(-3, 3, -7), 4, hide);
  limb(group, new THREE.Vector3(5, 19, 6), new THREE.Vector3(6, 3, 7), 4, hide);

  const bow = new THREE.Mesh(new THREE.TorusGeometry(18, 1.8, 6, 22, Math.PI * 1.2), wood);
  bow.position.set(18, 39, -16);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = -Math.PI * 0.6;
  group.add(bow);
  const bowString = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(18, 22, -16), new THREE.Vector3(10, 39, 17), new THREE.Vector3(18, 56, -16)]),
    new THREE.LineBasicMaterial({ color: 0xd8c49b }),
  );
  group.add(bowString);
  const nockedArrow = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 37, 6), iron);
  nockedArrow.position.set(21, 40, 0);
  nockedArrow.rotation.z = Math.PI / 2;
  group.add(nockedArrow);
  group.userData.drawArm = drawArm;
  group.userData.bow = bow;
  return group;
}

function createBarbarianVillage() {
  if (!planetRoot || barbarianVillage) return barbarianVillage;
  const group = new THREE.Group();
  group.name = "antipodal-barbarian-village";
  const frame = planetFrame(barbarianSite.x, barbarianSite.y);
  group.position.copy(frame.normal).multiplyScalar(PLANET_RADIUS + terrainHeightAt(barbarianSite.x, barbarianSite.y) + 3);
  group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    frame.east,
    frame.normal,
    frame.east.clone().cross(frame.normal).normalize(),
  ));

  const timber = new THREE.MeshStandardMaterial({ color: 0x51321f, roughness: 0.97 });
  const darkTimber = new THREE.MeshStandardMaterial({ color: 0x291b14, roughness: 0.98 });
  const hide = new THREE.MeshStandardMaterial({ color: 0x7e3d29, roughness: 0.94 });
  const bone = new THREE.MeshStandardMaterial({ color: 0xd2c49e, roughness: 0.88 });
  const bowmen = [];
  const fireFlames = [];

  const ground = new THREE.Mesh(new THREE.CylinderGeometry(225, 235, 7, 32), new THREE.MeshStandardMaterial({ color: 0x493522, roughness: 1 }));
  ground.position.y = 1;
  ground.receiveShadow = true;
  group.add(ground);

  const palisadeRadius = 205;
  for (let index = 0; index < 34; index += 1) {
    const angle = (index / 34) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < 0.2) continue;
    const height = 64 + (index % 3) * 7;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, height, 7), timber);
    log.position.set(Math.cos(angle) * palisadeRadius, height / 2, Math.sin(angle) * palisadeRadius);
    log.rotation.y = angle;
    log.castShadow = true;
    group.add(log);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(9, 20, 7), timber);
    spike.position.set(log.position.x, height + 8, log.position.z);
    group.add(spike);
  }
  for (const side of [-1, 1]) {
    box(group, new THREE.Vector3(17, 100, 17), 0x51321f, new THREE.Vector3(194, 50, side * 34));
    const skull = new THREE.Mesh(new THREE.SphereGeometry(9, 9, 7), bone);
    skull.position.set(194, 106, side * 34);
    group.add(skull);
  }

  for (let index = 0; index < 5; index += 1) {
    const angle = 0.55 + index * 1.18;
    const radius = index === 0 ? 38 : 105 + (index % 2) * 18;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const hut = new THREE.Group();
    hut.position.set(x, 0, z);
    hut.rotation.y = -angle;
    const walls = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, 42, 9), darkTimber);
    walls.position.y = 22;
    walls.castShadow = true;
    hut.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(43, 39, 9), hide);
    roof.position.y = 60;
    roof.castShadow = true;
    hut.add(roof);
    box(hut, new THREE.Vector3(5, 30, 22), 0x140e0a, new THREE.Vector3(31, 18, 0));
    group.add(hut);
  }

  for (let index = 0; index < 4; index += 1) {
    const angle = Math.PI * 0.25 + index * Math.PI * 0.5;
    const x = Math.cos(angle) * 155;
    const z = Math.sin(angle) * 155;
    const towerHeight = 96;
    for (const ox of [-19, 19]) for (const oz of [-19, 19]) {
      box(group, new THREE.Vector3(9, towerHeight, 9), 0x51321f, new THREE.Vector3(x + ox, towerHeight / 2, z + oz));
    }
    box(group, new THREE.Vector3(54, 8, 54), 0x291b14, new THREE.Vector3(x, towerHeight, z));
    const bowmanModel = createBarbarianBowmanModel(index);
    bowmanModel.position.set(x, towerHeight + 4, z);
    bowmanModel.rotation.y = -angle;
    group.add(bowmanModel);
    bowmen.push({ model: bowmanModel, nextShot: 16 + index * 0.55, draw: 0, targetId: null });
  }
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI * 0.5;
    const bowmanModel = createBarbarianBowmanModel(index + 4);
    bowmanModel.scale.setScalar(0.92);
    bowmanModel.position.set(Math.cos(angle) * 178, 70, Math.sin(angle) * 178);
    bowmanModel.rotation.y = -angle;
    group.add(bowmanModel);
    bowmen.push({ model: bowmanModel, nextShot: 18.2 + index * 0.55, draw: 0, targetId: null });
  }

  const fireBase = new THREE.Mesh(new THREE.TorusGeometry(25, 6, 8, 18), new THREE.MeshStandardMaterial({ color: 0x37332e, roughness: 0.82 }));
  fireBase.rotation.x = Math.PI / 2;
  fireBase.position.y = 8;
  group.add(fireBase);
  for (let index = 0; index < 3; index += 1) {
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(9 - index * 1.8, 34 - index * 5, 8),
      new THREE.MeshBasicMaterial({ color: [0xff5824, 0xffa52e, 0xffe08a][index], transparent: true, opacity: 0.82 }),
    );
    flame.position.set((index - 1) * 4, 25 - index * 2, (index % 2) * 4);
    group.add(flame);
    fireFlames.push(flame);
  }
  const fireLight = new THREE.PointLight(0xff6a28, MOBILE_RENDERING ? 1.2 : 2.3, 460, 2);
  fireLight.position.set(0, 55, 0);
  group.add(fireLight);

  const bannerPole = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 145, 8), darkTimber);
  bannerPole.position.set(-55, 75, -15);
  group.add(bannerPole);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(58, 42), new THREE.MeshStandardMaterial({ color: 0x8f2f22, side: THREE.DoubleSide, roughness: 0.88 }));
  banner.position.set(-25, 115, -14);
  banner.rotation.y = Math.PI / 2;
  group.add(banner);

  planetRoot.add(group);
  barbarianVillage = { x: barbarianSite.x, y: barbarianSite.y, model: group, bowmen, fireFlames, fireLight };
  return barbarianVillage;
}

function createBarbarianArrowModel() {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 46, 7), new THREE.MeshStandardMaterial({ color: 0xe0bd78, emissive: 0x3a2108, emissiveIntensity: 0.16, roughness: 0.72 }));
  group.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(5, 13, 7), new THREE.MeshStandardMaterial({ color: 0xcbd1cd, roughness: 0.28, metalness: 0.68 }));
  head.position.y = 29;
  group.add(head);
  for (const side of [-1, 1]) {
    const feather = new THREE.Mesh(new THREE.PlaneGeometry(13, 9), new THREE.MeshBasicMaterial({ color: 0xe04c35, side: THREE.DoubleSide }));
    feather.position.set(side * 3, -22, 0);
    feather.rotation.y = side * 0.5;
    group.add(feather);
  }
  return group;
}

function createMinerModel(generation = 1) {
  const group = new THREE.Group();
  group.name = "stone-miner";
  const jacketColor = new THREE.Color().setHSL((0.1 + generation * 0.025) % 1, 0.44, 0.44);
  const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.9 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x252725, roughness: 0.96 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97957, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9da7a4, roughness: 0.36, metalness: 0.7 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x6d4a2d, roughness: 0.92 });
  const leftLeg = limb(group, new THREE.Vector3(-4, 35, -7), new THREE.Vector3(-4, 9, -8), 5.8, trousers);
  const rightLeg = limb(group, new THREE.Vector3(-4, 35, 7), new THREE.Vector3(4, 9, 8), 5.8, trousers);
  leftLeg.userData.restQuaternion = leftLeg.quaternion.clone();
  rightLeg.userData.restQuaternion = rightLeg.quaternion.clone();
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(3, 5, -8));
  box(group, new THREE.Vector3(18, 8, 13), 0x111714, new THREE.Vector3(11, 5, 8));
  box(group, new THREE.Vector3(25, 35, 27), jacketColor, new THREE.Vector3(-3, 52, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), skin);
  head.position.set(1, 79, 0);
  head.castShadow = true;
  group.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0xe0ad45, roughness: 0.7 }));
  helmet.position.set(1, 83, 0);
  group.add(helmet);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.2, 9, 7), new THREE.MeshStandardMaterial({ color: 0xffe69b, emissive: 0xe9a23c, emissiveIntensity: 1.4 }));
  lamp.position.set(11, 86, 0);
  group.add(lamp);
  limb(group, new THREE.Vector3(-2, 64, -11), new THREE.Vector3(18, 48, -9), 4.2, jacket);
  limb(group, new THREE.Vector3(-2, 64, 11), new THREE.Vector3(20, 45, 9), 4.2, jacket);
  const pickaxe = new THREE.Group();
  pickaxe.position.set(24, 43, 0);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 76, 8), timber);
  handle.rotation.z = Math.PI / 2;
  pickaxe.add(handle);
  const headBar = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 54), steel);
  headBar.position.x = 34;
  pickaxe.add(headBar);
  group.add(pickaxe);
  const burnEffect = createRiderBurnEffect();
  burnEffect.position.y = -5;
  group.add(burnEffect);
  group.userData.burnEffect = burnEffect;
  group.userData.workerType = "miner";
  group.userData.leftLeg = leftLeg;
  group.userData.rightLeg = rightLeg;
  group.userData.pickaxe = pickaxe;
  return group;
}

function createTractorModel() {
  const group = new THREE.Group();
  group.name = "tractor-pulled-mower";
  const green = new THREE.MeshStandardMaterial({ color: 0x3f7653, roughness: 0.58, metalness: 0.16 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x121815, roughness: 0.86 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd0a05b, roughness: 0.55, metalness: 0.18 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x7f8b85, roughness: 0.46, metalness: 0.48 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb97957, roughness: 0.9 });

  box(group, new THREE.Vector3(76, 42, 66), 0x3f7653, new THREE.Vector3(25, 40, 0), { roughness: 0.58, metalness: 0.16 });
  box(group, new THREE.Vector3(52, 32, 54), 0x17201c, new THREE.Vector3(-18, 55, 0));
  box(group, new THREE.Vector3(8, 64, 8), 0x7f8b85, new THREE.Vector3(37, 89, -22), { roughness: 0.46, metalness: 0.48 });
  const exhaustCap = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 7, 10), dark);
  exhaustCap.position.set(37, 123, -22);
  group.add(exhaustCap);

  const wheelGeometry = new THREE.CylinderGeometry(25, 25, 14, 16);
  for (const z of [-40, 40]) {
    const rearWheel = new THREE.Mesh(wheelGeometry, dark);
    rearWheel.rotation.x = Math.PI / 2;
    rearWheel.position.set(-18, 27, z);
    rearWheel.castShadow = true;
    group.add(rearWheel);
    const frontWheel = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 12, 14), dark);
    frontWheel.rotation.x = Math.PI / 2;
    frontWheel.position.set(50, 20, z * 0.82);
    frontWheel.castShadow = true;
    group.add(frontWheel);
  }

  box(group, new THREE.Vector3(67, 8, 10), 0x7f8b85, new THREE.Vector3(-72, 20, 0), { roughness: 0.46, metalness: 0.48 });
  const pulledDeck = box(group, new THREE.Vector3(58, 13, 158), 0xd0a05b, new THREE.Vector3(-118, 13, 0), { roughness: 0.55, metalness: 0.18 });
  pulledDeck.castShadow = true;
  for (const z of [-69, 69]) {
    const gaugeWheel = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 8, 12), dark);
    gaugeWheel.rotation.x = Math.PI / 2;
    gaugeWheel.position.set(-132, 10, z);
    group.add(gaugeWheel);
  }

  box(group, new THREE.Vector3(28, 33, 31), 0x527a68, new THREE.Vector3(-13, 87, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 12), skin);
  head.position.set(-7, 110, 0);
  head.castShadow = true;
  group.add(head);
  const steering = new THREE.Mesh(new THREE.TorusGeometry(18, 2.5, 8, 24), dark);
  steering.rotation.y = Math.PI / 2;
  steering.position.set(12, 75, 0);
  group.add(steering);

  const burnEffect = createRiderBurnEffect();
  burnEffect.position.set(-16, 18, 0);
  group.add(burnEffect);
  const boostEffect = createBoostEffect(-57, 31, 27);
  group.add(boostEffect);
  group.userData.burnEffect = burnEffect;
  group.userData.boostEffect = boostEffect;
  group.userData.workerType = "tractor";
  group.userData.pulledDeck = pulledDeck;
  group.userData.povHidden = [head];
  return group;
}

function createApexCatModel() {
  const group = new THREE.Group();
  group.name = "apex-everything-cat";
  const fur = new THREE.MeshStandardMaterial({ color: 0x373733, roughness: 0.96 });
  const stripe = new THREE.MeshStandardMaterial({ color: 0x171916, roughness: 0.98 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xc9b895, roughness: 0.94 });
  const nose = new THREE.MeshStandardMaterial({ color: 0x9d645e, roughness: 0.86 });
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xcaff52 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), fur);
  body.scale.set(72, 38, 36);
  body.position.set(-12, 48, 0);
  body.castShadow = true;
  group.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), pale);
  chest.scale.set(31, 37, 28);
  chest.position.set(43, 49, 0);
  chest.castShadow = true;
  group.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fur);
  head.scale.set(41, 38, 39);
  head.position.set(65, 78, 0);
  head.castShadow = true;
  group.add(head);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(18, 41, 5), fur);
    ear.position.set(55, 116, side * 25);
    ear.rotation.z = -0.16;
    ear.castShadow = true;
    group.add(ear);
    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(9, 25, 5), nose);
    innerEar.position.set(58, 117, side * 26);
    innerEar.rotation.z = -0.16;
    group.add(innerEar);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 7), eyeMaterial);
    eye.scale.set(0.58, 1, 1);
    eye.position.set(92, 87, side * 20);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(3.3, 8, 6), stripe);
    pupil.scale.set(0.45, 1.2, 0.8);
    pupil.position.set(96, 87, side * 20);
    group.add(pupil);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 9), pale);
  muzzle.scale.set(27, 18, 26);
  muzzle.position.set(98, 66, 0);
  muzzle.castShadow = true;
  group.add(muzzle);
  const noseMesh = new THREE.Mesh(new THREE.ConeGeometry(9, 10, 3), nose);
  noseMesh.rotation.z = -Math.PI / 2;
  noseMesh.position.set(121, 72, 0);
  group.add(noseMesh);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(25, 7, 30), stripe);
  jaw.position.set(102, 53, 0);
  jaw.rotation.z = -0.08;
  group.add(jaw);
  for (const side of [-1, 1]) {
    for (let whisker = -1; whisker <= 1; whisker += 1) {
      const start = new THREE.Vector3(106, 66 + whisker * 5, side * 17);
      const end = new THREE.Vector3(142, 65 + whisker * 8, side * (29 + Math.abs(whisker) * 4));
      limb(group, start, end, 0.75, pale);
    }
  }

  const legs = [];
  for (const x of [-46, 34]) {
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(x, 40, side * 25);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(10, 9, 39, 9), fur);
      upper.position.y = -17;
      upper.castShadow = true;
      leg.add(upper);
      const paw = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), pale);
      paw.scale.set(18, 8, 13);
      paw.position.set(9, -38, 0);
      paw.castShadow = true;
      leg.add(paw);
      leg.userData.restQuaternion = leg.quaternion.clone();
      group.add(leg);
      legs.push(leg);
    }
  }

  const tail = new THREE.Group();
  tail.position.set(-72, 59, 0);
  const tailSegments = [];
  let previous = new THREE.Vector3(0, 0, 0);
  for (let segment = 0; segment < 6; segment += 1) {
    const next = new THREE.Vector3(-25 - segment * 7, 10 + segment * 10, (segment % 2 ? 1 : -1) * 7);
    const piece = limb(tail, previous, next, 8 - segment * 0.75, segment % 2 ? stripe : fur);
    piece.userData.baseQuaternion = piece.quaternion.clone();
    tailSegments.push(piece);
    previous = next;
  }
  group.add(tail);
  group.userData.legs = legs;
  group.userData.tail = tail;
  group.userData.tailSegments = tailSegments;
  group.userData.jaw = jaw;
  group.scale.setScalar(0.82);
  return group;
}

function createRocModel(index) {
  const group = new THREE.Group();
  group.name = `giant-roc-${index}`;
  const featherHue = (0.075 + index * 0.017) % 1;
  const featherColor = new THREE.Color().setHSL(featherHue, 0.33, 0.24);
  const feather = new THREE.MeshStandardMaterial({ color: featherColor, roughness: 0.92, side: THREE.DoubleSide });
  const flightFeather = new THREE.MeshStandardMaterial({ color: 0x24251f, roughness: 0.96, side: THREE.DoubleSide });
  const pale = new THREE.MeshStandardMaterial({ color: 0xd7c79a, roughness: 0.9 });
  const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xd6a33f, roughness: 0.68, metalness: 0.04 });
  const talonMaterial = new THREE.MeshStandardMaterial({ color: 0xa98432, roughness: 0.72 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), feather);
  body.scale.set(55, 29, 28);
  body.position.y = 12;
  body.castShadow = true;
  group.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), pale);
  chest.scale.set(29, 24, 23);
  chest.position.set(28, 8, 0);
  chest.castShadow = true;
  group.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(18, 14, 10), pale);
  head.position.set(58, 24, 0);
  head.castShadow = true;
  group.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(10, 32, 6), beakMaterial);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(82, 20, 0);
  beak.castShadow = true;
  group.add(beak);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(3.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd253 }));
    eye.position.set(67, 30, side * 14);
    group.add(eye);
    const leg = limb(group, new THREE.Vector3(4, -3, side * 13), new THREE.Vector3(12, -31, side * 17), 4.5, talonMaterial);
    leg.castShadow = true;
    for (const spread of [-1, 0, 1]) {
      const claw = limb(group, new THREE.Vector3(12, -30, side * 17), new THREE.Vector3(28, -38, side * (17 + spread * 5)), 1.6, talonMaterial);
      claw.castShadow = true;
    }
  }

  const createWing = (side) => {
    const wing = new THREE.Group();
    wing.position.set(0, 20, side * 18);
    const vertices = new Float32Array([
      0, 0, 0,
      -20, 5, side * 65,
      -58, -2, side * 158,
      26, -5, side * 112,
      40, 0, side * 46,
    ]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex([0, 1, 4, 1, 3, 4, 1, 2, 3]);
    geometry.computeVertexNormals();
    const membrane = new THREE.Mesh(geometry, feather);
    membrane.castShadow = true;
    wing.add(membrane);
    for (let featherIndex = 0; featherIndex < 5; featherIndex += 1) {
      const plume = new THREE.Mesh(new THREE.ConeGeometry(9 - featherIndex * 0.7, 70 + featherIndex * 12, 5), flightFeather);
      plume.rotation.z = Math.PI / 2;
      plume.rotation.x = side * Math.PI / 2;
      plume.position.set(-35 + featherIndex * 14, -4, side * (92 + featherIndex * 11));
      plume.castShadow = true;
      wing.add(plume);
    }
    group.add(wing);
    return wing;
  };
  const leftWing = createWing(-1);
  const rightWing = createWing(1);

  const tail = new THREE.Group();
  tail.position.set(-45, 10, 0);
  for (const side of [-1, 0, 1]) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(11, 88, 6), flightFeather);
    plume.rotation.z = Math.PI / 2;
    plume.position.set(-38, -3, side * 18);
    plume.castShadow = true;
    tail.add(plume);
  }
  group.add(tail);

  const carryBundle = new THREE.Group();
  carryBundle.position.set(5, -53, 0);
  const captive = new THREE.Mesh(new THREE.IcosahedronGeometry(17, 0), new THREE.MeshStandardMaterial({ color: 0x4d2b50, roughness: 0.82 }));
  captive.scale.set(1.8, 0.75, 0.75);
  carryBundle.add(captive);
  const captiveWingA = new THREE.Mesh(new THREE.ConeGeometry(12, 45, 4), new THREE.MeshStandardMaterial({ color: 0x302036, roughness: 0.9 }));
  captiveWingA.rotation.x = Math.PI / 2;
  captiveWingA.position.z = 20;
  carryBundle.add(captiveWingA);
  const captiveWingB = captiveWingA.clone();
  captiveWingB.position.z = -20;
  carryBundle.add(captiveWingB);
  carryBundle.visible = false;
  group.add(carryBundle);
  group.userData.leftWing = leftWing;
  group.userData.rightWing = rightWing;
  group.userData.carryBundle = carryBundle;
  group.scale.setScalar(0.82);
  return group;
}

function createDragonModel(index) {
  const group = new THREE.Group();
  const hideColor = new THREE.Color().setHSL((0.76 + index * 0.09) % 1, 0.54, 0.27);
  const bellyColor = hideColor.clone().offsetHSL(-0.02, -0.18, 0.16);
  const wingColor = hideColor.clone().offsetHSL(0.025, -0.05, 0.12);
  const hide = new THREE.MeshStandardMaterial({ color: hideColor, roughness: 0.66, metalness: 0.12 });
  const belly = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.78 });
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: wingColor,
    emissive: hideColor,
    emissiveIntensity: 0.12,
    roughness: 0.76,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const boneMaterial = new THREE.MeshStandardMaterial({ color: hideColor.clone().multiplyScalar(0.62), roughness: 0.84 });
  const hornMaterial = new THREE.MeshStandardMaterial({ color: 0xc7b995, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14), hide);
  body.scale.set(48, 21, 23);
  body.castShadow = true;
  group.add(body);
  const bellyPlate = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10), belly);
  bellyPlate.position.set(10, -10, 0);
  bellyPlate.scale.set(35, 10, 18);
  group.add(bellyPlate);

  for (let segment = 0; segment < 3; segment += 1) {
    const neck = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hide);
    neck.position.set(31 + segment * 13, 5 + segment * 4, 0);
    neck.scale.set(17 - segment * 2, 15 - segment, 16 - segment);
    neck.castShadow = true;
    group.add(neck);
  }
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), hide);
  head.position.set(65, 15, 0);
  head.scale.set(22, 18, 19);
  head.castShadow = true;
  group.add(head);
  box(group, new THREE.Vector3(30, 11, 18), hideColor, new THREE.Vector3(79, 7, 0));
  box(group, new THREE.Vector3(25, 6, 16), bellyColor, new THREE.Vector3(78, -1, 0));

  const mouthGlow = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.8 }),
  );
  mouthGlow.position.set(94, 5, 0);
  group.add(mouthGlow);

  for (let segment = 0; segment < 4; segment += 1) {
    const tailSegment = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hide);
    tailSegment.position.set(-42 - segment * 22, 1 + segment * 1.5, 0);
    tailSegment.scale.set(26 - segment * 4, 14 - segment * 2.2, 15 - segment * 2.2);
    tailSegment.castShadow = true;
    group.add(tailSegment);
  }
  const tailTip = new THREE.Mesh(new THREE.ConeGeometry(7, 45, 9), hide);
  tailTip.position.set(-126, 6, 0);
  tailTip.rotation.z = Math.PI / 2;
  tailTip.castShadow = true;
  group.add(tailTip);

  const createWing = (side) => {
    const wing = new THREE.Group();
    wing.position.set(-7, 12, 0);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      0, 0, side * 12,
      -16, 14, side * 52,
      -41, 8, side * 118,
      17, -3, side * 86,
      38, -9, side * 34,
    ], 3));
    geometry.setIndex([0, 1, 4, 1, 3, 4, 1, 2, 3]);
    geometry.computeVertexNormals();
    const membrane = new THREE.Mesh(geometry, wingMaterial);
    membrane.castShadow = true;
    wing.add(membrane);
    limb(wing, new THREE.Vector3(0, 0, side * 12), new THREE.Vector3(-16, 14, side * 52), 3.2, boneMaterial);
    limb(wing, new THREE.Vector3(-16, 14, side * 52), new THREE.Vector3(-41, 8, side * 118), 2.5, boneMaterial);
    limb(wing, new THREE.Vector3(-16, 14, side * 52), new THREE.Vector3(17, -3, side * 86), 2.3, boneMaterial);
    return wing;
  };
  const leftWing = createWing(1);
  const rightWing = createWing(-1);
  group.add(leftWing, rightWing);

  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(4, 25, 8), hornMaterial);
    horn.position.set(59, 34, side * 10);
    horn.rotation.z = -0.42;
    group.add(horn);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(3.3, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd45a }),
    );
    eye.position.set(75, 20, side * 15.6);
    group.add(eye);

    limb(group, new THREE.Vector3(18, -8, side * 15), new THREE.Vector3(26, -31, side * 25), 5.2, hide);
    limb(group, new THREE.Vector3(26, -31, side * 25), new THREE.Vector3(45, -39, side * 28), 4.1, hide);
    for (let claw = -1; claw <= 1; claw += 1) {
      const talon = new THREE.Mesh(new THREE.ConeGeometry(1.8, 13, 6), hornMaterial);
      talon.position.set(51, -42, side * 28 + claw * 4);
      talon.rotation.z = -Math.PI / 2;
      group.add(talon);
    }
  }

  for (let x = -55; x <= 30; x += 17) {
    const spine = new THREE.Mesh(new THREE.ConeGeometry(3.8, 17, 7), hornMaterial);
    spine.position.set(x, 24 - Math.abs(x) * 0.08, 0);
    group.add(spine);
  }

  group.userData.leftWing = leftWing;
  group.userData.rightWing = rightWing;
  group.userData.mouthGlow = mouthGlow;
  return group;
}

function createLowDetailDragonModel(index) {
  const group = new THREE.Group();
  group.name = "dragon-low-detail";
  group.userData.lowDetail = true;
  const hideColor = new THREE.Color().setHSL((0.76 + index * 0.09) % 1, 0.5, 0.3);
  const hide = new THREE.MeshStandardMaterial({ color: hideColor, roughness: 0.74, flatShading: true });
  const wingMaterial = new THREE.MeshBasicMaterial({ color: hideColor.clone().offsetHSL(0.03, -0.05, 0.14), side: THREE.DoubleSide, transparent: true, opacity: 0.86 });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hide);
  body.scale.set(50, 21, 23);
  group.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), hide);
  head.position.set(57, 9, 0);
  head.scale.set(22, 16, 17);
  group.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(9, 72, 7), hide);
  tail.position.set(-66, 1, 0);
  tail.rotation.z = Math.PI / 2;
  group.add(tail);

  const createWing = (side) => {
    const wing = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -4, 8, side * 10,
      -28, 18, side * 96,
      22, -5, side * 68,
    ], 3));
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    wing.add(new THREE.Mesh(geometry, wingMaterial));
    return wing;
  };
  const leftWing = createWing(1);
  const rightWing = createWing(-1);
  group.add(leftWing, rightWing);

  const mouthGlow = new THREE.Mesh(
    new THREE.SphereGeometry(5, 7, 5),
    new THREE.MeshBasicMaterial({ color: 0xff7a20, transparent: true, opacity: 0.7 }),
  );
  mouthGlow.position.set(76, 5, 0);
  group.add(mouthGlow);
  group.userData.leftWing = leftWing;
  group.userData.rightWing = rightWing;
  group.userData.mouthGlow = mouthGlow;
  return group;
}

function createDragonFlame(withLight = true, sparkCount = 10) {
  const flame = new THREE.Group();
  const radialSegments = withLight ? 18 : 8;
  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, radialSegments, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff4a0a,
      transparent: true,
      opacity: 0.74,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const inner = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 0.82, withLight ? 16 : 7, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffa51f, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  inner.position.y = 0.09;
  const core = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.58, withLight ? 12 : 6, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff0a3, transparent: true, opacity: 0.94, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  core.position.y = 0.2;
  const heatRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.07, 8, 20),
    new THREE.MeshBasicMaterial({ color: 0xffb22c, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  heatRing.position.y = 0.45;
  heatRing.rotation.x = Math.PI / 2;
  const impactGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.56, 14, 9),
    new THREE.MeshBasicMaterial({ color: 0xff7a12, transparent: true, opacity: 0.74, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  impactGlow.position.y = -0.46;
  const impactRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.1, 8, 22),
    new THREE.MeshBasicMaterial({ color: 0xffd052, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  impactRing.position.y = -0.47;
  impactRing.rotation.x = Math.PI / 2;
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffc044, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const sparks = [];
  for (let index = 0; index < sparkCount; index += 1) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), sparkMaterial.clone());
    spark.userData.offset = index / Math.max(1, sparkCount);
    spark.userData.phase = index * 2.37;
    sparks.push(spark);
    flame.add(spark);
  }
  const light = withLight ? new THREE.PointLight(0xff6b1a, 0, 620, 2) : { intensity: 0 };
  if (withLight) {
    light.position.y = 0.35;
    flame.add(outer, inner, core, heatRing, impactGlow, impactRing, light);
  } else {
    flame.add(outer, inner, core, heatRing, impactGlow, impactRing);
  }
  flame.userData = { outer, inner, core, heatRing, impactGlow, impactRing, sparks, light };
  flame.visible = false;
  return flame;
}

function createCloudTexture() {
  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = 1024;
  cloudCanvas.height = 512;
  const cloudContext = cloudCanvas.getContext("2d");
  cloudContext.clearRect(0, 0, cloudCanvas.width, cloudCanvas.height);
  for (let index = 0; index < 150; index += 1) {
    const x = planetNoise(index, 31) * cloudCanvas.width;
    const y = planetNoise(index, 32) * cloudCanvas.height;
    const radius = 15 + planetNoise(index, 33) * 55;
    const gradient = cloudContext.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(230, 240, 233, ${0.13 + planetNoise(index, 34) * 0.2})`);
    gradient.addColorStop(0.55, "rgba(220, 235, 226, 0.1)");
    gradient.addColorStop(1, "rgba(220, 235, 226, 0)");
    cloudContext.fillStyle = gradient;
    cloudContext.save();
    cloudContext.translate(x, y);
    cloudContext.scale(1.8 + planetNoise(index, 35), 0.55 + planetNoise(index, 36) * 0.45);
    cloudContext.beginPath();
    cloudContext.arc(0, 0, radius, 0, Math.PI * 2);
    cloudContext.fill();
    cloudContext.restore();
  }
  const texture = new THREE.CanvasTexture(cloudCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function init3D() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = !MOBILE_RENDERING;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  scene = new THREE.Scene();
  // Preserve the directional sun for depth, but keep the far hemisphere readable.
  const globeSkyFill = new THREE.HemisphereLight(0xdcebe3, 0x263b35, 1.35);
  const globeAmbientFill = new THREE.AmbientLight(0xffffff, 0.38);
  scene.add(globeSkyFill, globeAmbientFill);
  scene.background = new THREE.Color(0x07100e);
  scene.fog = new THREE.Fog(0x07100e, 1250, 3200);
  planetRoot = new THREE.Group();
  planetRoot.name = "planet-root";
  scene.add(planetRoot);
  camera = new THREE.PerspectiveCamera(50, 1, 1, PLANET_RADIUS * 7);
  const initialFrame = planetFrame(mower.x, mower.y);
  // Start with enough altitude to understand the terrain and steer the view.
  // The old 350-unit offset put the camera almost on the mower's roof.
  camera.position.copy(initialFrame.normal).multiplyScalar(PLANET_RADIUS + 1150);
  camera.up.set(0, 1, 0);
  cameraControls = new OrbitControls(camera, canvas);
  cameraControls.target.set(0, 0, 0);
  cameraControls.enableDamping = true;
  cameraControls.dampingFactor = 0.11;
  cameraControls.enablePan = false;
  cameraControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  cameraControls.mouseButtons.MIDDLE = -1;
  cameraControls.mouseButtons.RIGHT = -1;
  cameraControls.rotateSpeed = 0.8;
  cameraControls.zoomSpeed = 1;
  cameraControls.zoomToCursor = true;
  cameraControls.minDistance = PLANET_RADIUS + 260;
  cameraControls.maxDistance = PLANET_RADIUS * 3.35;
  cameraControls.update();

  const starPositions = [];
  for (let index = 0; index < (MOBILE_RENDERING ? 360 : 650); index += 1) {
    const longitude = planetNoise(index, 20) * Math.PI * 2;
    const latitude = Math.asin(planetNoise(index, 21) * 2 - 1);
    const radius = PLANET_RADIUS * (3.8 + planetNoise(index, 22) * 0.7);
    starPositions.push(
      Math.cos(latitude) * Math.cos(longitude) * radius,
      Math.sin(latitude) * radius,
      Math.cos(latitude) * Math.sin(longitude) * radius,
    );
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xd7e2dc, size: 4, sizeAttenuation: true, fog: false })));

  scene.add(new THREE.HemisphereLight(0xdcebdc, 0x23352c, 2.25));
  sun = new THREE.DirectionalLight(0xffe4b5, 2.5);
  sun.castShadow = !MOBILE_RENDERING;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -360, right: 360, top: 360, bottom: -360, near: 30, far: 950 });
  sun.shadow.camera.updateProjectionMatrix();
  sunTarget = new THREE.Object3D();
  planetRoot.add(sun, sunTarget);
  sun.target = sunTarget;

  addWorldScenery();
  createBarbarianVillage();
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS + TERRAIN_AMPLITUDE + 18, MOBILE_RENDERING ? 64 : 128, MOBILE_RENDERING ? 40 : 80),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - worldPosition.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 2.5);
          gl_FragColor = vec4(0.34, 0.72, 0.58, rim * 0.52);
        }
      `,
    }),
  );
  planetRoot.add(atmosphere);
  cloudLayer = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_RADIUS + TERRAIN_AMPLITUDE + 48, MOBILE_RENDERING ? 64 : 128, MOBILE_RENDERING ? 40 : 80),
    new THREE.MeshBasicMaterial({
      map: createCloudTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  planetRoot.add(cloudLayer);
  mowerModel = createMowerModel();
  planetRoot.add(mowerModel);
  initializeDragons();
  initializeApexCat();
  resize();
}

function drawRoundedRect(context, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  context.beginPath();
  context.roundRect(x, y, w, h, r);
}

function drawObstacle(shape) {
  ctx.save();
  if (shape.id === "garage") {
    ctx.fillStyle = "#332f29";
    drawRoundedRect(ctx, shape.x, shape.y, shape.w, shape.h, 12);
    ctx.fill();
    ctx.fillStyle = "#4a4439";
    ctx.fillRect(shape.x + 18, shape.y + 30, shape.w - 36, shape.h - 30);
    ctx.fillStyle = "#d0a05b";
    ctx.globalAlpha = 0.7;
    ctx.fillRect(300, 255, 118, 92);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#181d1a";
    ctx.font = "700 20px system-ui";
    ctx.fillText("CHARGE", 314, 310);
  } else if (shape.id === "path") {
    ctx.fillStyle = "#786f61";
    drawRoundedRect(ctx, shape.x, shape.y, shape.w, shape.h, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 3;
    for (let y = shape.y + 18; y < shape.y + shape.h; y += 38) {
      ctx.beginPath(); ctx.moveTo(shape.x + 8, y); ctx.lineTo(shape.x + shape.w - 8, y + 4); ctx.stroke();
    }
  } else if (shape.id === "pond") {
    const gradient = ctx.createRadialGradient(shape.x - 35, shape.y - 25, 10, shape.x, shape.y, shape.rx);
    gradient.addColorStop(0, "#4e8075");
    gradient.addColorStop(1, "#213f3d");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(shape.x, shape.y, shape.rx, shape.ry, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(151,196,177,.24)";
    ctx.lineWidth = 5;
    ctx.stroke();
  } else if (shape.id === "flowers") {
    ctx.fillStyle = "#382d23";
    ctx.beginPath(); ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 34; i += 1) {
      const a = hash(i, 4) * Math.PI * 2;
      const r = Math.sqrt(hash(i, 9)) * (shape.r - 10);
      ctx.fillStyle = ["#d0a05b", "#d77f6f", "#b89ac9", "#e6d7a5"][i % 4];
      ctx.beginPath(); ctx.arc(shape.x + Math.cos(a) * r, shape.y + Math.sin(a) * r, 5 + hash(i, 12) * 4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (shape.id === "tree") {
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.ellipse(shape.x + 12, shape.y + 17, shape.r * 0.9, shape.r * 0.64, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2c4938";
    ctx.beginPath(); ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#41634e";
    ctx.beginPath(); ctx.arc(shape.x - shape.r * 0.23, shape.y - shape.r * 0.22, shape.r * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#64513a";
    ctx.beginPath(); ctx.arc(shape.x, shape.y, 9, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = "#736f64";
    ctx.beginPath(); ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.1)";
    ctx.beginPath(); ctx.arc(shape.x - 6, shape.y - 7, shape.r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawChargePad(pad) {
  ctx.save();
  ctx.translate(pad.x, pad.y);
  ctx.fillStyle = "rgba(13, 20, 17, 0.92)";
  drawRoundedRect(ctx, -70, -55, 140, 110, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(208, 160, 91, 0.72)";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#d0a05b";
  ctx.font = "800 17px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("CHARGE", 0, 6);
  ctx.fillStyle = "rgba(156, 199, 176, 0.55)";
  ctx.fillRect(-35, 19, 70, 5);
  ctx.restore();
}

function drawMower() {
  ctx.save();
  ctx.translate(mower.x, mower.y);
  ctx.rotate(mower.angle);

  ctx.fillStyle = "rgba(0,0,0,.24)";
  ctx.beginPath(); ctx.ellipse(-6, 8, 47, 32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#24352d";
  ctx.beginPath(); ctx.ellipse(-15, 0, DECK_RADIUS + 3, DECK_RADIUS - 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#78a88f";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = "#0d1210";
  ctx.fillRect(-25, -34, 17, 12);
  ctx.fillRect(-25, 22, 17, 12);
  ctx.fillRect(17, -30, 16, 10);
  ctx.fillRect(17, 20, 16, 10);

  ctx.fillStyle = "#d0a05b";
  drawRoundedRect(ctx, -10, -26, 55, 52, 12);
  ctx.fill();
  ctx.fillStyle = "#171d1a";
  drawRoundedRect(ctx, 4, -19, 27, 38, 8);
  ctx.fill();

  // Rider, viewed from above.
  ctx.fillStyle = "#101613";
  drawRoundedRect(ctx, -3, -17, 24, 34, 9);
  ctx.fill();
  ctx.fillStyle = "#527a68";
  drawRoundedRect(ctx, 0, -14, 20, 28, 8);
  ctx.fill();
  ctx.strokeStyle = "#527a68";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(9, -10); ctx.lineTo(27, -16);
  ctx.moveTo(9, 10); ctx.lineTo(27, 16);
  ctx.stroke();
  ctx.fillStyle = "#b97957";
  ctx.beginPath(); ctx.arc(29, -16, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(29, 16, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#8e9b93";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(28, -18); ctx.lineTo(28, 18); ctx.stroke();
  ctx.fillStyle = "#c58a68";
  ctx.beginPath(); ctx.arc(13, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#263b33";
  ctx.beginPath(); ctx.arc(15, 0, 9, Math.PI * 0.55, Math.PI * 1.45); ctx.fill();
  ctx.fillRect(13, -10, 8, 20);
  ctx.fillStyle = "#78a88f";
  ctx.fillRect(19, -8, 5, 16);

  ctx.fillStyle = "#f0f4f1";
  ctx.fillRect(34, -13, 5, 9);
  ctx.fillRect(34, 4, 5, 9);
  ctx.restore();
}

function updateRiderBurnEffect(agent, model) {
  const effect = model.userData.burnEffect;
  if (!effect) return;
  const active = agent.burningUntil > elapsed && !(agent.disabledUntil > elapsed);
  effect.visible = active;
  if (!active) return;

  const burn = effect.userData;
  for (const tongue of burn.flames) {
    const wave = elapsed * 18 + tongue.userData.phase + agent.id * 0.7;
    const flicker = 0.78 + Math.sin(wave) * 0.18 + Math.sin(wave * 1.73) * 0.08;
    tongue.position.copy(tongue.userData.base);
    tongue.position.x += Math.sin(wave * 0.63) * 2.5;
    tongue.position.z += Math.cos(wave * 0.77) * 2.2;
    tongue.position.y += Math.sin(wave * 0.91) * 2.4;
    tongue.scale.set(0.82 + flicker * 0.28, flicker, 0.82 + flicker * 0.28);
    tongue.rotation.z = Math.sin(wave * 0.48) * 0.16;
  }

  for (const puff of burn.smoke) {
    const travel = (elapsed * 0.72 + puff.userData.offset + agent.id * 0.11) % 1;
    puff.position.set(
      3 + Math.sin(travel * 8 + puff.userData.offset * 11) * 9,
      97 + travel * 54,
      Math.cos(travel * 7 + puff.userData.offset * 13) * 8,
    );
    puff.scale.setScalar(5 + travel * 13);
    puff.material.opacity = (1 - travel) * 0.34;
  }

  for (let index = 0; index < burn.emberPositions.length / 3; index += 1) {
    const travel = (elapsed * 1.45 + index / 8 + agent.id * 0.07) % 1;
    const phase = index * 2.19 + elapsed * 6;
    burn.emberPositions[index * 3] = 3 + Math.sin(phase) * (5 + travel * 9);
    burn.emberPositions[index * 3 + 1] = 58 + travel * 78;
    burn.emberPositions[index * 3 + 2] = Math.cos(phase * 1.17) * (5 + travel * 8);
  }
  burn.embers.geometry.attributes.position.needsUpdate = true;
}

function updateBoostEffect(agent, model) {
  const effect = model.userData.boostEffect;
  if (!effect) return;
  const levelBoosting = agent.levelBoostUntil > elapsed;
  effect.visible = Boolean(((agent.boosting && agent.boostFuel > 0) || levelBoosting) && !(agent.disabledUntil > elapsed));
  if (!effect.visible) return;
  for (const jet of effect.userData.jets) {
    const wave = elapsed * 32 + jet.userData.phase;
    jet.scale.set(0.82 + Math.sin(wave * 0.71) * 0.12, 0.78 + Math.sin(wave) * 0.2, 0.82 + Math.cos(wave * 0.63) * 0.12);
  }
}

function updateLevelAura(agent, model) {
  let aura = model.userData.levelAura;
  if (!aura) {
    const radius = model.userData.workerType === "tractor" ? 84 : model.userData.workerType === "bucket" ? 64 : ["trimmer", "chainsaw", "planter", "miner"].includes(model.userData.workerType) ? 30 : 43;
    aura = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 2.2, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x9cc7b0, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 4;
    model.add(aura);
    model.userData.levelAura = aura;
  }
  const level = agent.level || 1;
  const levelBoosting = agent.levelBoostUntil > elapsed;
  aura.visible = level > 1 && !(agent.disabledUntil > elapsed);
  if (!aura.visible) return;
  aura.material.color.setHSL(0.28 - level * 0.025, 0.58, 0.66);
  aura.material.opacity = (levelBoosting ? 0.75 : 0.48) + Math.sin(elapsed * (levelBoosting ? 12 : 5) + agent.id) * 0.18;
  const pulse = 1 + Math.sin(elapsed * (levelBoosting ? 9 : 3.5) + agent.id) * (levelBoosting ? 0.1 : 0.045);
  aura.scale.setScalar(pulse);
}

function updateGrainLoadVisual(agent, model) {
  if (["chainsaw", "bucket", "planter", "miner"].includes(agent.workerType)) return;
  let load = model.userData.grainLoad;
  if (!load) {
    load = new THREE.Group();
    const sackMaterial = new THREE.MeshStandardMaterial({ color: 0x8b6339, roughness: 0.95 });
    const grainMaterial = new THREE.MeshStandardMaterial({ color: 0xe0ad43, emissive: 0x4d2d08, emissiveIntensity: 0.12, roughness: 0.88 });
    const sack = new THREE.Mesh(new THREE.BoxGeometry(34, 20, 42), sackMaterial);
    sack.position.y = 5;
    sack.castShadow = true;
    load.add(sack);
    for (const [x, y, z, scale] of [[-11, 13, -10, 1], [8, 15, -8, 1.1], [-5, 18, 9, 1.2], [12, 13, 11, 0.9]]) {
      const grain = new THREE.Mesh(new THREE.IcosahedronGeometry(8, 0), grainMaterial);
      grain.position.set(x, y, z);
      grain.scale.set(scale, scale * 0.7, scale);
      grain.castShadow = true;
      load.add(grain);
    }
    if (agent.workerType === "tractor") load.position.set(-82, 45, 0);
    else if (agent.workerType === "trimmer") load.position.set(-19, 53, 0);
    else load.position.set(-31, 42, 0);
    model.add(load);
    model.userData.grainLoad = load;
  }
  const capacity = Math.max(0.01, grainCapacityKg(agent));
  const fill = Math.min(1.15, grainCargoKg(agent) / capacity);
  load.visible = fill > 0.02 && !(agent.disabledUntil > elapsed);
  if (!load.visible) return;
  const base = agent.workerType === "tractor" ? 1.35 : agent.workerType === "trimmer" ? 0.62 : 0.82;
  const fullness = 0.55 + fill * 0.45;
  load.scale.set(base * fullness, base * (0.45 + fill * 0.55), base * fullness);
}

function positionMowerModel(agent, model) {
  const frame = planetFrame(agent.x, agent.y);
  const forward = frame.east.clone().multiplyScalar(Math.cos(agent.angle))
    .addScaledVector(frame.south, Math.sin(agent.angle)).normalize();
  const mowerBasis = new THREE.Matrix4().makeBasis(
    forward,
    frame.normal,
    forward.clone().cross(frame.normal).normalize(),
  );
  model.position.copy(frame.normal).multiplyScalar(
    PLANET_RADIUS + terrainHeightAt(agent.x, agent.y) + 2 + Math.min(1.4, Math.abs(agent.speed) * 0.004),
  );
  model.quaternion.setFromRotationMatrix(mowerBasis);
  if (["trimmer", "chainsaw", "planter", "miner"].includes(model.userData.workerType)) {
    const walkingSpeed = model.userData.workerType === "trimmer" ? 150 : model.userData.workerType === "planter" ? 145 : 135;
    const pace = Math.min(1, Math.abs(agent.speed) / (walkingSpeed * SPEED_SCALE));
    const stride = Math.sin(elapsed * 10.5 + agent.id) * 0.48 * pace;
    const legAxis = new THREE.Vector3(0, 0, 1);
    model.userData.leftLeg.quaternion.copy(model.userData.leftLeg.userData.restQuaternion);
    model.userData.rightLeg.quaternion.copy(model.userData.rightLeg.userData.restQuaternion);
    model.userData.leftLeg.rotateOnAxis(legAxis, stride);
    model.userData.rightLeg.rotateOnAxis(legAxis, -stride);
    if (model.userData.cutterRotor) model.userData.cutterRotor.rotation.y = elapsed * 31 + agent.id;
    if (model.userData.planterWheels) {
      for (const wheel of model.userData.planterWheels) wheel.rotation.z = elapsed * 7 + agent.id;
    }
    if (model.userData.sawGroup) {
      const vibration = agent.sawing ? Math.sin(elapsed * 58 + agent.id) * 1.8 : 0;
      model.userData.sawGroup.position.y = 38 + vibration;
      model.userData.chain.rotation.z = agent.sawing ? elapsed * 24 : 0;
    }
    if (model.userData.pickaxe) {
      model.userData.pickaxe.rotation.z = agent.mining ? -0.55 + Math.sin(elapsed * 13 + agent.id) * 0.75 : -0.12;
    }
    model.position.addScaledVector(frame.normal, Math.abs(Math.sin(elapsed * 10.5 + agent.id)) * 2.2 * pace);
  }
  if (model.userData.workerType === "bucket") {
    const targetDeploy = agent.trimming ? 1 : 0;
    model.userData.boomDeploy += (targetDeploy - model.userData.boomDeploy) * Math.min(1, 2.2 / 60 + Math.abs(targetDeploy - model.userData.boomDeploy) * 0.08);
    const deploy = THREE.MathUtils.smoothstep(model.userData.boomDeploy, 0, 1);
    const boomAngle = THREE.MathUtils.lerp(0.08, 0.72, deploy);
    model.userData.boomPivot.rotation.z = boomAngle;
    model.userData.boomExtension.position.x = THREE.MathUtils.lerp(45, 62, deploy);
    model.userData.bucket.rotation.z = -boomAngle;
    model.userData.bucket.position.y = Math.sin(elapsed * 4.2 + agent.id) * deploy * 1.8;
    model.userData.pruningCutter.rotation.y = agent.trimming ? elapsed * 34 : 0;
  }
  updateRiderBurnEffect(agent, model);
  updateBoostEffect(agent, model);
  updateLevelAura(agent, model);
  updateGrainLoadVisual(agent, model);
  return frame;
}

function positionDragonModel(dragon) {
  const frame = planetFrame(dragon.x, dragon.y);
  const cameraFacing = frame.normal.dot(cameraNormalScratch);
  if (cameraFacing < -0.1) {
    dragon.model.visible = false;
    dragon.flame.visible = false;
    dragon.flame.userData.light.intensity = 0;
    return frame;
  }
  dragon.model.visible = true;
  const forward = frame.east.clone().multiplyScalar(Math.cos(dragon.angle))
    .addScaledVector(frame.south, Math.sin(dragon.angle)).normalize();
  const side = forward.clone().cross(frame.normal).normalize();
  const flightHeight = dragon.altitude + Math.sin(elapsed * 2.2 + dragon.id * 1.7) * 18;
  dragon.model.position.copy(frame.normal).multiplyScalar(
    PLANET_RADIUS + terrainHeightAt(dragon.x, dragon.y) + flightHeight,
  );
  dragon.model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, frame.normal, side));
  dragon.model.rotateX(dragon.bank);
  const dragonScale = Math.min(1, dragon.birthScale + dragon.age * 0.012);
  dragon.model.scale.setScalar(dragonScale);
  const flap = Math.sin(elapsed * 7.4 + dragon.id) * 0.38;
  dragon.model.userData.leftWing.rotation.x = flap;
  dragon.model.userData.rightWing.rotation.x = -flap;
  const mouthGlow = dragon.model.userData.mouthGlow;
  const breathingFire = elapsed < dragon.fireUntil;
  const windingUp = elapsed < dragon.fireWindupUntil;
  const chargedScale = windingUp ? 1.05 + Math.sin(elapsed * 34) * 0.32 : 0;
  mouthGlow.scale.setScalar(breathingFire
    ? 1.25 + Math.sin(elapsed * 26) * 0.18
    : windingUp
      ? chargedScale
      : 0.72 + Math.sin(elapsed * 4 + dragon.id) * 0.08);
  mouthGlow.material.opacity = breathingFire ? 0.95 : windingUp ? 0.82 : 0.48;

  const fireTarget = mowerById(dragon.fireTargetId);
  if (elapsed < dragon.fireUntil && fireTarget) {
    const targetFrame = planetFrame(fireTarget.x, fireTarget.y);
    const targetPosition = targetFrame.normal.clone().multiplyScalar(
      PLANET_RADIUS + terrainHeightAt(fireTarget.x, fireTarget.y) + 28,
    );
    const mouth = dragon.model.position.clone().addScaledVector(forward, 68).addScaledVector(frame.normal, 2);
    const direction = targetPosition.clone().sub(mouth);
    const length = direction.length();
    dragon.flame.visible = true;
    dragon.flame.position.copy(mouth).addScaledVector(direction, 0.5);
    dragon.flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize().negate());
    const flicker = 0.86 + Math.sin(elapsed * 31 + dragon.id) * 0.12;
    const fireRadius = Math.min(88, length * 0.24) * flicker;
    dragon.flame.scale.set(fireRadius, length, fireRadius);
    const fire = dragon.flame.userData;
    fire.outer.material.opacity = 0.68 + Math.sin(elapsed * 24 + dragon.id) * 0.1;
    fire.inner.material.opacity = 0.76 + Math.sin(elapsed * 31) * 0.12;
    fire.core.material.opacity = 0.9 + Math.sin(elapsed * 37 + 1.2) * 0.08;
    fire.heatRing.scale.setScalar(0.86 + Math.sin(elapsed * 28) * 0.2);
    fire.heatRing.material.opacity = 0.5 + Math.sin(elapsed * 20) * 0.16;
    const impactPulse = 0.82 + Math.sin(elapsed * 35 + dragon.id) * 0.18;
    fire.impactGlow.scale.set(impactPulse, (fireRadius / length) * impactPulse, impactPulse);
    fire.impactGlow.material.opacity = 0.62 + Math.sin(elapsed * 32) * 0.18;
    const impactCycle = (elapsed * 3.4) % 1;
    fire.impactRing.scale.setScalar(0.8 + impactCycle * 0.45);
    fire.impactRing.material.opacity = 0.9 - impactCycle * 0.55;
    fire.light.intensity = 180 + Math.sin(elapsed * 29 + dragon.id) * 55;
    for (const spark of fire.sparks) {
      const travel = (elapsed * 1.8 + spark.userData.offset) % 1;
      const radius = 0.1 + travel * 0.48;
      spark.position.set(
        Math.sin(spark.userData.phase + elapsed * 13) * radius,
        0.46 - travel * 0.92,
        Math.cos(spark.userData.phase + elapsed * 11) * radius,
      );
      spark.scale.setScalar(0.55 + (1 - travel) * 0.9);
      spark.material.opacity = 0.9 - travel * 0.64;
    }
  } else {
    dragon.flame.userData.light.intensity = 0;
    dragon.flame.visible = false;
  }
}

function positionRocModel(roc) {
  const frame = planetFrame(roc.x, roc.y);
  const cameraFacing = frame.normal.dot(cameraNormalScratch);
  if (cameraFacing < -0.12) {
    roc.model.visible = false;
    return frame;
  }
  roc.model.visible = true;
  const forward = frame.east.clone().multiplyScalar(Math.cos(roc.angle))
    .addScaledVector(frame.south, Math.sin(roc.angle)).normalize();
  const side = forward.clone().cross(frame.normal).normalize();
  const flightHeight = roc.altitude + Math.sin(elapsed * 1.8 + roc.id * 1.31) * 12;
  roc.model.position.copy(frame.normal).multiplyScalar(
    PLANET_RADIUS + terrainHeightAt(roc.x, roc.y) + flightHeight,
  );
  roc.model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, frame.normal, side));
  roc.model.rotateX(roc.bank);
  const hunting = Boolean(dragonById(roc.targetDragonId));
  const flapSpeed = hunting ? 9.4 : 5.2;
  const flapDepth = hunting ? 0.62 : 0.36;
  const flap = Math.sin(elapsed * flapSpeed + roc.id * 1.9) * flapDepth;
  roc.model.userData.leftWing.rotation.x = flap;
  roc.model.userData.rightWing.rotation.x = -flap;
  roc.model.userData.carryBundle.visible = elapsed < roc.carryingUntil;
  if (roc.model.userData.carryBundle.visible) {
    roc.model.userData.carryBundle.rotation.y = Math.sin(elapsed * 7 + roc.id) * 0.12;
  }
  return frame;
}

function positionApexCatModel() {
  if (!apexCat?.model) return null;
  const frame = planetFrame(apexCat.x, apexCat.y);
  const cameraFacing = frame.normal.dot(cameraNormalScratch);
  if (cameraFacing < -0.16) {
    apexCat.model.visible = false;
    return frame;
  }
  apexCat.model.visible = true;
  const forward = frame.east.clone().multiplyScalar(Math.cos(apexCat.angle))
    .addScaledVector(frame.south, Math.sin(apexCat.angle)).normalize();
  const side = forward.clone().cross(frame.normal).normalize();
  apexCat.model.position.copy(frame.normal).multiplyScalar(
    PLANET_RADIUS + terrainHeightAt(apexCat.x, apexCat.y) + apexCat.altitude,
  );
  apexCat.model.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, frame.normal, side));
  const napping = elapsed < apexCat.napUntil;
  const pace = Math.min(1, Math.abs(apexCat.speed) / (335 * SPEED_SCALE));
  const stride = Math.sin(elapsed * (apexCat.leaping ? 13 : 8.5)) * 0.55 * pace;
  apexCat.model.userData.legs.forEach((leg, index) => {
    leg.quaternion.copy(leg.userData.restQuaternion);
    leg.rotateZ(napping ? 0.82 : stride * (index % 2 ? -1 : 1));
  });
  apexCat.model.userData.tail.rotation.x = napping ? 1.1 : Math.sin(elapsed * 2.8) * 0.28;
  apexCat.model.userData.tail.rotation.z = napping ? -0.65 : Math.cos(elapsed * 2.1) * 0.18;
  const target = catTargetByKey(apexCat.targetKey);
  const closeToPrey = target && Math.hypot(worldDeltaX(target.x, apexCat.x), target.y - apexCat.y) < 80;
  apexCat.model.userData.jaw.rotation.z = closeToPrey ? -0.42 + Math.sin(elapsed * 17) * 0.1 : -0.08;
  apexCat.model.scale.set(0.82, napping ? 0.64 : apexCat.leaping ? 0.9 : 0.82, 0.82);
  return frame;
}

function draw(dt) {
  if (!renderer || !scene || !camera || !mowerModel) return;
  if (USE_CUSTOM_CAMERA_CONTROLS && !viewDrag.active && touchPoints.size < 2) {
    rotateFreeCamera(cameraSpin.yaw * dt, cameraSpin.pitch * dt);
    const spinDecay = Math.exp(-dt * 2.6);
    cameraSpin.yaw *= spinDecay;
    cameraSpin.pitch *= spinDecay;
  }
  const frame = positionMowerModel(mower, mowerModel);
  if (surfaceView) {
    updateFounderSurfaceCamera();
  } else if (cameraHoldActive && heldCameraPose) {
    camera.position.copy(heldCameraPose.position);
    camera.fov = heldCameraPose.fov;
    camera.updateProjectionMatrix();
  } else {
    cameraControls?.update();
  }
  for (const child of offspring) positionMowerModel(child, child.model);
  cameraNormalScratch.copy(camera.position).normalize();
  for (const dragon of dragons) positionDragonModel(dragon);
  for (const roc of rocs) positionRocModel(roc);
  positionApexCatModel();
  for (const wheel of strongholdMillWheels) wheel.rotation.z = elapsed * 0.65;
  if (barbarianVillage) {
    const villageNormal = planetFrame(barbarianSite.x, barbarianSite.y).normal;
    barbarianVillage.model.visible = villageNormal.dot(cameraNormalScratch) > -0.28;
    if (barbarianVillage.model.visible) {
      for (const [index, bowman] of barbarianVillage.bowmen.entries()) {
        const pulse = bowman.draw * (0.72 + Math.sin(elapsed * 18 + index) * 0.1);
        bowman.model.userData.drawArm.quaternion.copy(bowman.model.userData.drawArm.userData.restQuaternion);
        bowman.model.userData.drawArm.rotateZ(-pulse * 0.58);
        bowman.model.userData.bow.rotation.y = Math.sin(elapsed * 1.7 + index) * 0.05 + pulse * 0.12;
      }
      for (const [index, flame] of barbarianVillage.fireFlames.entries()) {
        flame.scale.set(0.85 + Math.sin(elapsed * 12 + index) * 0.15, 0.88 + Math.sin(elapsed * 15 + index * 2) * 0.22, 0.85 + Math.cos(elapsed * 11 + index) * 0.14);
      }
      barbarianVillage.fireLight.intensity = (MOBILE_RENDERING ? 1.2 : 2.3) * (0.78 + Math.sin(elapsed * 14) * 0.18);
    }
  }

  const altitude = Math.max(0, camera.position.length() - PLANET_RADIUS);
  const globeBlend = Math.max(0, Math.min(1, (altitude - 450) / (PLANET_RADIUS * 1.35)));
  scene.fog.near = THREE.MathUtils.lerp(1250, PLANET_RADIUS * 2.45, globeBlend);
  scene.fog.far = THREE.MathUtils.lerp(3200, PLANET_RADIUS * 4.1, globeBlend);

  if (cloudLayer) {
    cloudLayer.rotation.y = elapsed * 0.0018;
    cloudLayer.material.opacity = globeBlend * 0.3;
  }

  sunTarget.position.copy(frame.position);
  sun.position.copy(frame.position)
    .addScaledVector(frame.normal, 610)
    .addScaledVector(frame.east, -330)
    .addScaledVector(frame.south, -260);
  sunTarget.updateMatrixWorld();
  renderer.render(scene, camera);
}

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - previous) / 1000 || 0);
  previous = now;
  update(dt * SIMULATION_SPEED);
  draw(dt);
  updateAdaptiveQuality(dt);
  requestAnimationFrame(frame);
}

function worldFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  const intersection = new THREE.Vector3();
  if (!raycaster.ray.intersectSphere(planetRaySphere, intersection)) return { x: mower.x, y: mower.y };
  const normal = intersection.normalize();
  let longitude = Math.atan2(normal.z, -normal.x);
  if (longitude < 0) longitude += Math.PI * 2;
  const latitude = Math.asin(Math.max(-1, Math.min(1, normal.y)));
  return {
    x: (longitude / (Math.PI * 2)) * FIELD_W,
    y: ((Math.PI / 2 - latitude) / Math.PI) * FIELD_H,
  };
}

function setCameraZoom(value) {
  cameraZoom = Math.max(0.44, Math.min(1.8, value));
  if (camera) {
    camera.fov = 50 * cameraZoom;
    camera.updateProjectionMatrix();
  }
}

function rotateFreeCamera(yaw, pitch) {
  if (!camera || (!yaw && !pitch)) return;
  camera.rotateY(yaw);
  camera.rotateX(pitch);
  camera.quaternion.normalize();
}

function toggleGlobeView() {
  if (cameraHoldActive) return;
  if (surfaceView) leaveSurfaceView();
  cameraSpin.yaw = 0;
  cameraSpin.pitch = 0;
  if (!globeView) {
    savedCameraPose = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      zoom: cameraZoom,
      target: cameraControls.target.clone(),
    };
    const outward = camera.position.clone().normalize();
    camera.position.copy(outward).multiplyScalar(PLANET_RADIUS * 2.8);
    cameraControls.target.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    setCameraZoom(1);
    globeView = true;
  } else if (savedCameraPose) {
    camera.position.copy(savedCameraPose.position);
    camera.quaternion.copy(savedCameraPose.quaternion);
    cameraControls.target.copy(savedCameraPose.target);
    setCameraZoom(savedCameraPose.zoom);
    globeView = false;
  }
  ui.zoomGlobe.classList.toggle("is-on", globeView);
  ui.zoomGlobe.setAttribute("aria-label", globeView ? "Return to free camera" : "Show whole planet");
  ui.zoomGlobe.textContent = globeView ? "RETURN" : "PLANET";
  cameraControls.update();
}

function enterSurfaceView(mode = "pov") {
  if (!camera || !cameraControls || !planetRoot || cameraHoldActive) return;
  if (!surfaceView) {
    clearOrbitMomentum();
    savedSurfacePose = {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      up: camera.up.clone(),
      target: cameraControls.target.clone(),
      minDistance: cameraControls.minDistance,
      maxDistance: cameraControls.maxDistance,
      rotateSpeed: cameraControls.rotateSpeed,
      zoomSpeed: cameraControls.zoomSpeed,
      zoom: cameraZoom,
    };
    cameraControls.enabled = false;
    surfaceView = true;
    globeView = false;
    ui.zoomGlobe.classList.remove("is-on");
    ui.zoomGlobe.textContent = "PLANET";
    ui.zoomGlobe.setAttribute("aria-label", "Show whole planet");
  }
  surfaceCameraMode = mode;
  surfaceLookYaw = 0;
  surfaceLookPitch = mode === "pov" ? -0.08 : 0;
  surfaceChaseDistance = 480;
  surfacePointers.clear();
  surfaceLookPointerId = null;
  for (const object of mowerModel?.userData.povHidden || []) object.visible = mode !== "pov";
  setCameraZoom(mode === "pov" ? 0.88 : 0.96);
  updateSurfaceViewButtons();
  ui.hint.textContent = mode === "pov"
    ? "Cockpit camera: drag to look · scroll or pinch to zoom · tap Exit to leave"
    : "Follow camera: drag to orbit · scroll or pinch for distance · tap Exit to leave";
  updateFounderSurfaceCamera();
}

function updateSurfaceViewButtons() {
  const povActive = surfaceView && surfaceCameraMode === "pov";
  const chaseActive = surfaceView && surfaceCameraMode === "chase";
  ui.surfaceView.classList.toggle("is-on", povActive);
  ui.surfaceView.setAttribute("aria-pressed", String(povActive));
  ui.surfaceView.setAttribute("aria-label", povActive ? "Exit cockpit view" : "Enter mower cockpit view");
  ui.surfaceView.textContent = povActive ? "EXIT" : "COCKPIT";
  ui.chaseView.classList.toggle("is-on", chaseActive);
  ui.chaseView.setAttribute("aria-pressed", String(chaseActive));
  ui.chaseView.setAttribute("aria-label", chaseActive ? "Exit follow view" : "Follow behind the mower");
  ui.chaseView.textContent = chaseActive ? "EXIT" : "FOLLOW";
}

function updateFounderSurfaceCamera() {
  if (!surfaceView || !camera || !mowerModel || !planetRoot) return;
  for (const object of mowerModel.userData.povHidden || []) object.visible = surfaceCameraMode !== "pov";
  mowerModel.updateWorldMatrix(true, false);
  const tractor = mower.workerType === "tractor";
  const modelRotation = mowerModel.getWorldQuaternion(new THREE.Quaternion());
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(modelRotation).normalize();
  const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(modelRotation).normalize();
  direction.applyAxisAngle(up, surfaceLookYaw).normalize();
  const lookSide = direction.clone().cross(up).normalize();
  camera.up.copy(up);
  if (surfaceCameraMode === "chase") {
    const target = mowerModel.localToWorld(new THREE.Vector3(tractor ? 12 : 10, tractor ? 72 : 58, 0));
    const elevation = THREE.MathUtils.clamp(0.48 + surfaceLookPitch, 0.12, 1.15);
    camera.position.copy(target)
      .addScaledVector(direction, -Math.cos(elevation) * surfaceChaseDistance)
      .addScaledVector(up, Math.sin(elevation) * surfaceChaseDistance);
    camera.lookAt(target.clone().addScaledVector(direction, 75));
    return;
  }
  const eye = mowerModel.localToWorld(new THREE.Vector3(tractor ? 15 : 26, tractor ? 111 : 91, 0));
  direction.applyAxisAngle(lookSide, surfaceLookPitch).normalize();
  camera.position.copy(eye);
  camera.lookAt(eye.clone().addScaledVector(direction, 500));
}

function leaveSurfaceView() {
  if (!surfaceView || !savedSurfacePose || !camera || !cameraControls) return;
  clearOrbitMomentum();
  camera.position.copy(savedSurfacePose.position);
  camera.quaternion.copy(savedSurfacePose.quaternion);
  camera.up.copy(savedSurfacePose.up);
  cameraControls.target.copy(savedSurfacePose.target);
  cameraControls.minDistance = savedSurfacePose.minDistance;
  cameraControls.maxDistance = savedSurfacePose.maxDistance;
  cameraControls.rotateSpeed = savedSurfacePose.rotateSpeed;
  cameraControls.zoomSpeed = savedSurfacePose.zoomSpeed;
  cameraControls.enabled = true;
  setCameraZoom(savedSurfacePose.zoom);
  surfaceView = false;
  savedSurfacePose = null;
  surfacePointers.clear();
  surfaceLookPointerId = null;
  for (const object of mowerModel?.userData.povHidden || []) object.visible = true;
  updateSurfaceViewButtons();
  ui.hint.textContent = "Camera: drag to orbit · scroll or pinch to zoom · Planet, Follow, or Cockpit";
  cameraControls.update();
}

function toggleSurfaceView() {
  if (surfaceView && surfaceCameraMode === "pov") leaveSurfaceView();
  else enterSurfaceView("pov");
}

function toggleChaseView() {
  if (surfaceView && surfaceCameraMode === "chase") leaveSurfaceView();
  else enterSurfaceView("chase");
}

function touchDistance() {
  const points = [...touchPoints.values()];
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function surfacePointerDistance() {
  const points = [...surfacePointers.values()];
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function beginSurfaceLook(event) {
  if (!surfaceView || event.button > 0) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  surfacePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (surfacePointers.size === 1) {
    surfaceLookPointerId = event.pointerId;
    surfaceLookX = event.clientX;
    surfaceLookY = event.clientY;
  } else if (surfacePointers.size === 2) {
    surfacePinchDistance = surfacePointerDistance();
    surfacePinchZoom = cameraZoom;
    surfacePinchChaseDistance = surfaceChaseDistance;
    surfaceLookPointerId = null;
  }
  canvas.setPointerCapture?.(event.pointerId);
}

function moveSurfaceLook(event) {
  if (!surfaceView || !surfacePointers.has(event.pointerId)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  surfacePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (surfacePointers.size >= 2) {
    const distance = surfacePointerDistance();
    if (surfacePinchDistance > 0) {
      if (surfaceCameraMode === "chase") {
        surfaceChaseDistance = THREE.MathUtils.clamp(
          surfacePinchChaseDistance * surfacePinchDistance / Math.max(1, distance),
          240,
          1100,
        );
      } else {
        setCameraZoom(surfacePinchZoom * surfacePinchDistance / Math.max(1, distance));
      }
    }
    return;
  }
  if (surfaceLookPointerId !== event.pointerId) return;
  const dx = event.clientX - surfaceLookX;
  const dy = event.clientY - surfaceLookY;
  surfaceLookYaw -= dx * 0.0048;
  surfaceLookPitch = THREE.MathUtils.clamp(surfaceLookPitch - dy * 0.0042, -1.05, 0.78);
  surfaceLookX = event.clientX;
  surfaceLookY = event.clientY;
}

function endSurfaceLook(event) {
  if (!surfacePointers.has(event.pointerId)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  surfacePointers.delete(event.pointerId);
  if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  surfacePinchDistance = 0;
  const remaining = [...surfacePointers.entries()][0];
  if (remaining) {
    surfaceLookPointerId = remaining[0];
    surfaceLookX = remaining[1].x;
    surfaceLookY = remaining[1].y;
  } else {
    surfaceLookPointerId = null;
  }
}

function clearOrbitMomentum() {
  cameraControls?._sphericalDelta?.set(0, 0, 0);
  cameraControls?._panOffset?.set(0, 0, 0);
  if (cameraControls) cameraControls._scale = 1;
}

function globeNormalFromPointer(event, target) {
  if (!camera) return false;
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointerNdc, camera);
  if (!raycaster.ray.intersectSphere(planetRaySphere, target)) return false;
  target.normalize();
  return true;
}

function beginGlobeDrag(event) {
  if (event.pointerType === "touch" || event.button !== 0 || cameraHoldActive || surfaceView || !planetRoot) return;
  const normal = new THREE.Vector3();
  if (!globeNormalFromPointer(event, normal)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  clearOrbitMomentum();
  globeDrag.active = true;
  globeDrag.pointerId = event.pointerId;
  globeDrag.normal.copy(normal);
  canvas.setPointerCapture?.(event.pointerId);
  canvas.classList.add("is-globe-dragging");
}

function spinGlobe(event) {
  if (!globeDrag.active || event.pointerId !== globeDrag.pointerId || !planetRoot) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const nextNormal = new THREE.Vector3();
  if (!globeNormalFromPointer(event, nextNormal)) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(globeDrag.normal, nextNormal);
  planetRoot.quaternion.premultiply(delta).normalize();
  globeDrag.normal.copy(nextNormal);
}

function endGlobeDrag(event) {
  if (!globeDrag.active || (event && event.pointerId !== globeDrag.pointerId)) return;
  event?.preventDefault();
  event?.stopImmediatePropagation();
  if (event && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  globeDrag.active = false;
  globeDrag.pointerId = null;
  canvas.classList.remove("is-globe-dragging");
}

function holdCamera(event) {
  if (surfaceView || (event.button !== 1 && event.button !== 2) || !camera || !cameraControls) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  clearOrbitMomentum();
  heldCameraPose = {
    position: camera.position.clone(),
    fov: camera.fov,
    target: cameraControls.target.clone(),
    targetDistance: camera.position.distanceTo(cameraControls.target),
    pointerId: event.pointerId,
    button: event.button,
    x: event.clientX,
    y: event.clientY,
  };
  cameraHoldActive = true;
  cameraControls.enabled = false;
  canvas.classList.add("is-camera-held");
}

function pivotHeldCamera(event) {
  if (!cameraHoldActive || !heldCameraPose || event.pointerId !== heldCameraPose.pointerId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const dx = event.clientX - heldCameraPose.x;
  const dy = event.clientY - heldCameraPose.y;
  rotateFreeCamera(-dx * 0.0052, -dy * 0.0046);
  heldCameraPose.x = event.clientX;
  heldCameraPose.y = event.clientY;
}

function releaseCameraHold(event) {
  if (!cameraHoldActive) return;
  if (event && event.pointerId !== heldCameraPose?.pointerId) return;
  if (event?.type === "pointerup" && event.button !== heldCameraPose?.button) return;
  event?.preventDefault();
  event?.stopImmediatePropagation();
  const forward = camera.getWorldDirection(new THREE.Vector3());
  const preservedTarget = camera.position.clone().addScaledVector(forward, heldCameraPose.targetDistance);
  cameraHoldActive = false;
  clearOrbitMomentum();
  if (cameraControls) {
    cameraControls.target.copy(preservedTarget);
    cameraControls.enabled = true;
    cameraControls.update();
  }
  heldCameraPose = null;
  canvas.classList.remove("is-camera-held");
}

function releaseControls() {
  for (const key of Object.keys(input)) input[key] = false;
  boostHeld = false;
  eBrakeHeld = false;
  mower.boosting = false;
  pointerDrive.active = false;
  document.querySelectorAll(".control-button").forEach((button) => button.classList.remove("is-active"));
  ui.nitro?.classList.remove("is-active");
}

const keyMap = {
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  ArrowUp: "forward", w: "forward", W: "forward",
  ArrowDown: "reverse", s: "reverse", S: "reverse",
};

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    if (autoMode) setAutoMode(false);
    eBrakeHeld = true;
    event.preventDefault();
    return;
  }
  if (event.key === "Shift") {
    boostHeld = true;
    event.preventDefault();
    return;
  }
  const control = keyMap[event.key];
  if (control) { if (autoMode) setAutoMode(false); input[control] = true; event.preventDefault(); }
});
window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    eBrakeHeld = false;
    event.preventDefault();
    return;
  }
  if (event.key === "Shift") {
    boostHeld = false;
    event.preventDefault();
    return;
  }
  const control = keyMap[event.key];
  if (control) { input[control] = false; event.preventDefault(); }
});
window.addEventListener("blur", releaseControls);

for (const button of document.querySelectorAll("[data-control]")) {
  const control = button.dataset.control;
  const activate = (event) => {
    event.preventDefault();
    if (autoMode) setAutoMode(false);
    input[control] = true;
    button.classList.add("is-active");
  };
  const deactivate = (event) => {
    event.preventDefault();
    input[control] = false;
    button.classList.remove("is-active");
  };
  button.addEventListener("pointerdown", activate);
  button.addEventListener("pointerup", deactivate);
  button.addEventListener("pointercancel", deactivate);
  button.addEventListener("pointerleave", deactivate);
}

const activateNitro = (event) => {
  if (!running || finished || mower.disabledUntil > elapsed) return;
  event.preventDefault();
  boostHeld = true;
  ui.nitro.setPointerCapture?.(event.pointerId);
};
const deactivateNitro = (event) => {
  event?.preventDefault();
  boostHeld = false;
  mower.boosting = false;
  if (event?.pointerId !== undefined && ui.nitro.hasPointerCapture?.(event.pointerId)) {
    ui.nitro.releasePointerCapture(event.pointerId);
  }
};
ui.nitro.addEventListener("pointerdown", activateNitro);
ui.nitro.addEventListener("pointerup", deactivateNitro);
ui.nitro.addEventListener("pointercancel", deactivateNitro);
ui.tractorUpgrade.addEventListener("click", () => {
  if (!running || finished) return;
  upgradeFounderToTractor();
  updateUI();
});
ui.mintSilver.addEventListener("click", () => {
  if (!running || finished) return;
  mintSilver();
  updateUI();
});
ui.mintGold.addEventListener("click", () => {
  if (!running || finished) return;
  mintGold();
  updateUI();
});

if (USE_CUSTOM_CAMERA_CONTROLS) {
canvas.addEventListener("pointerdown", (event) => {
  if (!running || finished) return;
  if (event.pointerType === "touch") {
    if (touchPoints.size === 0) autoBeforeTouch = autoMode;
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPoints.size === 2) {
      pinchStartDistance = touchDistance();
      pinchStartZoom = cameraZoom;
      pointerDrive.active = false;
      viewDrag.active = false;
      cameraSpin.yaw = 0;
      cameraSpin.pitch = 0;
      if (autoBeforeTouch && !autoMode) setAutoMode(true);
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
  }
  viewDrag.active = true;
  viewDrag.pointerId = event.pointerId;
  viewDrag.x = event.clientX;
  viewDrag.y = event.clientY;
  cameraSpin.yaw = 0;
  cameraSpin.pitch = 0;
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
});
canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" && touchPoints.has(event.pointerId)) {
    touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touchPoints.size >= 2 && pinchStartDistance > 0) {
      setCameraZoom(pinchStartZoom * (pinchStartDistance / Math.max(1, touchDistance())));
      pointerDrive.active = false;
      event.preventDefault();
      return;
    }
  }
  if (viewDrag.active && viewDrag.pointerId === event.pointerId) {
    const dx = event.clientX - viewDrag.x;
    const dy = event.clientY - viewDrag.y;
    const yaw = -dx * 0.0052;
    const pitch = -dy * 0.0046;
    rotateFreeCamera(yaw, pitch);
    cameraSpin.yaw = yaw * 18;
    cameraSpin.pitch = pitch * 18;
    viewDrag.x = event.clientX;
    viewDrag.y = event.clientY;
    event.preventDefault();
    return;
  }
  if (!pointerDrive.active) return;
  const point = worldFromPointer(event);
  pointerDrive.x = point.x;
  pointerDrive.y = point.y;
});
const endCanvasPointer = (event) => {
  touchPoints.delete(event.pointerId);
  if (touchPoints.size < 2) pinchStartDistance = 0;
  if (viewDrag.pointerId === event.pointerId) viewDrag.active = false;
  pointerDrive.active = false;
};
canvas.addEventListener("pointerup", endCanvasPointer);
canvas.addEventListener("pointercancel", endCanvasPointer);
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  setCameraZoom(cameraZoom * Math.exp(event.deltaY * 0.0012));
}, { passive: false });
}

canvas.addEventListener("pointerdown", holdCamera, { capture: true });
window.addEventListener("pointermove", pivotHeldCamera, { capture: true });
window.addEventListener("pointerup", releaseCameraHold, { capture: true });
window.addEventListener("pointercancel", releaseCameraHold, { capture: true });
canvas.addEventListener("pointerdown", beginSurfaceLook, { capture: true });
window.addEventListener("pointermove", moveSurfaceLook, { capture: true });
window.addEventListener("pointerup", endSurfaceLook, { capture: true });
window.addEventListener("pointercancel", endSurfaceLook, { capture: true });
canvas.addEventListener("wheel", (event) => {
  if (!surfaceView) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (surfaceCameraMode === "chase") {
    surfaceChaseDistance = THREE.MathUtils.clamp(surfaceChaseDistance * Math.exp(event.deltaY * 0.0012), 240, 1100);
  } else {
    setCameraZoom(cameraZoom * Math.exp(event.deltaY * 0.0012));
  }
}, { capture: true, passive: false });
window.addEventListener("blur", () => {
  endGlobeDrag();
  releaseCameraHold();
  surfacePointers.clear();
  surfaceLookPointerId = null;
});
canvas.addEventListener("auxclick", (event) => {
  if (event.button === 1) event.preventDefault();
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

document.querySelector("#start-button").addEventListener("click", () => {
  initAudio();
  audio?.context.resume();
  ui.startModal.classList.remove("modal--open");
  running = true;
  ui.sound.classList.toggle("is-on", soundOn);
  updateUI();
});

document.querySelector("#new-lawn-button").addEventListener("click", resetLawn);
ui.zoomGlobe.addEventListener("click", toggleGlobeView);
ui.surfaceView.addEventListener("click", toggleSurfaceView);
ui.chaseView.addEventListener("click", toggleChaseView);
ui.auto.addEventListener("click", () => {
  if (!running || finished) return;
  setAutoMode(!autoMode);
});
ui.sound.addEventListener("click", () => {
  initAudio();
  audio?.context.resume();
  soundOn = !soundOn;
  ui.sound.classList.toggle("is-on", soundOn);
  updateAudio();
});

window.addEventListener("resize", resize);
generateLawn();
init3D();
updateUI();
setAutoMode(true);
requestAnimationFrame(frame);
