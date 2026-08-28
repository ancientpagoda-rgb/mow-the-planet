const TECH_STORAGE_KEY = "mow-the-planet-tech-v2";
const SAVE_STORAGE_KEY = "mow-the-planet-settlement-v2";

const TECHS = [
  { id: "soil-science", branch: "AGRICULTURE", label: "Soil science", cost: 450, detail: "+15% grain delivered", effects: { grainYield: 1.15 } },
  { id: "crop-rotation", branch: "AGRICULTURE", label: "Crop rotation", cost: 950, requires: ["soil-science"], detail: "+25% crop growth", effects: { cropGrowth: 1.25 } },
  { id: "selective-breeding", branch: "AGRICULTURE", label: "Selective breeding", cost: 1800, requires: ["crop-rotation"], detail: "15% faster population growth", effects: { reproductionCost: 0.85 } },

  { id: "steel-saws", branch: "RESOURCES", label: "Steel saws", cost: 550, detail: "+25% timber yield", effects: { timberYield: 1.25 } },
  { id: "quarrying", branch: "RESOURCES", label: "Quarrying", cost: 650, detail: "+30% stone yield", effects: { stoneYield: 1.30 } },
  { id: "silviculture", branch: "RESOURCES", label: "Silviculture", cost: 1350, requires: ["steel-saws"], detail: "+35% tree recovery", effects: { treeGrowth: 1.35 } },
  { id: "metallurgy", branch: "RESOURCES", label: "Metallurgy", cost: 1900, requires: ["quarrying"], detail: "+15% stone · +8% worker speed", effects: { stoneYield: 1.15, workerSpeed: 1.08 } },

  { id: "mechanization", branch: "ENGINEERING", label: "Mechanization", cost: 700, detail: "+12% worker speed", effects: { workerSpeed: 1.12 } },
  { id: "logistics", branch: "ENGINEERING", label: "Logistics", cost: 1450, requires: ["mechanization"], detail: "+2 settlement capacity", effects: { colonyCapacityBonus: 2 } },
  { id: "automation", branch: "ENGINEERING", label: "Adaptive automation", cost: 2600, requires: ["logistics"], detail: "Spawn workers for current shortages", effects: { adaptiveWorkers: true, councilSpeed: 1.15 } },

  { id: "masonry", branch: "DEFENSE", label: "Fortified masonry", cost: 800, detail: "+20% castle defense range", effects: { castleRange: 1.20 } },
  { id: "ballistics", branch: "DEFENSE", label: "Ballistics", cost: 1650, requires: ["masonry"], detail: "+35% castle damage", effects: { castleDamage: 1.35 } },
  { id: "repeating-bows", branch: "DEFENSE", label: "Repeating defenses", cost: 3100, requires: ["ballistics"], detail: "+40% castle fire rate", effects: { castleCadence: 1.40 } },

  { id: "civic-planning", branch: "CIVIC", label: "Civic planning", cost: 600, detail: "+25% council speed", effects: { councilSpeed: 1.25 } },
  { id: "urbanism", branch: "CIVIC", label: "Urbanism", cost: 1550, requires: ["civic-planning"], detail: "+3 settlement capacity", effects: { colonyCapacityBonus: 3 } },
  { id: "planetary-network", branch: "CIVIC", label: "Planetary network", cost: 4200, requires: ["urbanism", "automation", "repeating-bows"], detail: "+10% workers · +20% council speed", effects: { workerSpeed: 1.10, councilSpeed: 1.20 } },
];

function safeParse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

const storedTech = safeParse(localStorage.getItem(TECH_STORAGE_KEY), { unlocked: [] });
const unlocked = new Set(Array.isArray(storedTech?.unlocked) ? storedTech.unlocked : []);
const techById = new Map(TECHS.map((tech) => [tech.id, tech]));

function recomputeEffects() {
  const effects = {
    grainYield: 1, cropGrowth: 1, reproductionCost: 1, timberYield: 1, stoneYield: 1,
    treeGrowth: 1, workerSpeed: 1, colonyCapacityBonus: 0, adaptiveWorkers: false,
    castleRange: 1, castleDamage: 1, castleCadence: 1, councilSpeed: 1,
  };
  for (const id of unlocked) {
    const tech = techById.get(id);
    if (!tech) continue;
    for (const [key, value] of Object.entries(tech.effects || {})) {
      if (typeof value === "boolean") effects[key] ||= value;
      else if (key === "colonyCapacityBonus") effects[key] += value;
      else effects[key] *= value;
    }
  }
  globalThis.__mowTechEffects = effects;
  return effects;
}

function saveTech() {
  localStorage.setItem(TECH_STORAGE_KEY, JSON.stringify({ unlocked: [...unlocked] }));
}

recomputeEffects();
globalThis.__mowTimeScale ??= 1;

function replaceOnce(source, label, before, after) {
  if (!source.includes(before)) {
    console.warn(`[tech tree] skipped ${label}: source marker not found`);
    return source;
  }
  return source.replace(before, after);
}

globalThis.__mowPostPatchGameSource = (input) => {
  let source = input;

  source = replaceOnce(source, "adaptive worker selection",
    `function spawnOffspring(parent) {\n  if (1 + offspring.length >= colonyCapacity() || !planetRoot) return null;\n  const childId = nextMowerId++;\n  const workerSequence = ["planter", "chainsaw", "miner", "trimmer", "bucket", "mower"];\n  const workerType = workerSequence[(childId - 2) % workerSequence.length];`,
    `function spawnOffspring(parent, forcedWorkerType = null) {\n  if (1 + offspring.length >= colonyCapacity() || !planetRoot) return null;\n  const childId = nextMowerId++;\n  const workerSequence = ["planter", "chainsaw", "miner", "trimmer", "bucket", "mower"];\n  const counts = Object.fromEntries(workerSequence.map((type) => [type, offspring.filter((worker) => worker.workerType === type).length]));\n  let workerType = forcedWorkerType;\n  if (!workerType && globalThis.__mowTechEffects?.adaptiveWorkers) {\n    if (timberStock < 3 && counts.chainsaw < 2) workerType = "chainsaw";\n    else if (stoneStock < 3 && counts.miner < 2) workerType = "miner";\n    else if (unplantedHarvestCells.length > 180 && counts.planter < 2) workerType = "planter";\n    else if (treesTrimmed < Math.max(1, treesCut * 0.22) && counts.bucket < 2) workerType = "bucket";\n    else workerType = workerSequence.reduce((best, type) => counts[type] < counts[best] ? type : best, workerSequence[0]);\n  }\n  workerType ||= workerSequence[(childId - 2) % workerSequence.length];`);

  source = replaceOnce(source, "grain research yield", "  const milled = delivered * (1 + stronghold.mill * 0.12);", "  const milled = delivered * (1 + stronghold.mill * 0.12) * (globalThis.__mowTechEffects?.grainYield || 1);");
  source = replaceOnce(source, "timber research yield", "  const timberYield = 1 + stronghold.lumberyard * 0.4 + villageSkills.forestry * 0.14;", "  const timberYield = (1 + stronghold.lumberyard * 0.4 + villageSkills.forestry * 0.14) * (globalThis.__mowTechEffects?.timberYield || 1);");
  source = replaceOnce(source, "stone research yield", "  const stoneYield = 1 + villageSkills.machinery * 0.12;", "  const stoneYield = (1 + villageSkills.machinery * 0.12) * (globalThis.__mowTechEffects?.stoneYield || 1);");
  source = replaceOnce(source, "worker speed research", "  return permanentGain * temporaryBoost * (1 + villageSkills.machinery * 0.06) * (1 + stronghold.smithy * 0.05);", "  return permanentGain * temporaryBoost * (1 + villageSkills.machinery * 0.06) * (1 + stronghold.smithy * 0.05) * (globalThis.__mowTechEffects?.workerSpeed || 1);");
  source = replaceOnce(source, "crop growth research", "      const cropSpeed = 1 + villageSkills.agriculture * 0.12;", "      const cropSpeed = (1 + villageSkills.agriculture * 0.12) * (globalThis.__mowTechEffects?.cropGrowth || 1);");
  source = replaceOnce(source, "tree recovery research", "  tree.regrowAt = elapsed + TREE_REGROW_DELAY;", "  tree.regrowAt = elapsed + TREE_REGROW_DELAY / (globalThis.__mowTechEffects?.treeGrowth || 1);");
  source = replaceOnce(source, "population research", "    if (parent.reproductionProgress < REPRODUCTION_CELLS) continue;\n    parent.reproductionProgress -= REPRODUCTION_CELLS;", "    const reproductionCellsNeeded = Math.max(1, Math.ceil(REPRODUCTION_CELLS * (globalThis.__mowTechEffects?.reproductionCost || 1)));\n    if (parent.reproductionProgress < reproductionCellsNeeded) continue;\n    parent.reproductionProgress -= reproductionCellsNeeded;");
  source = replaceOnce(source, "population capacity research", "  return Math.min(MAX_COLONY, BASE_COLONY_CAP + stronghold.housing + (stronghold.housing >= MAX_STRONGHOLD_LEVEL ? 1 : 0));", "  const techCapacity = globalThis.__mowTechEffects?.colonyCapacityBonus || 0;\n  return Math.min(MAX_COLONY + techCapacity, BASE_COLONY_CAP + stronghold.housing + (stronghold.housing >= MAX_STRONGHOLD_LEVEL ? 1 : 0) + techCapacity);");
  source = replaceOnce(source, "council research speed", "  nextCouncilAt = elapsed + COUNCIL_INTERVAL;", "  nextCouncilAt = elapsed + COUNCIL_INTERVAL / (globalThis.__mowTechEffects?.councilSpeed || 1);");
  source = replaceOnce(source, "castle range research", "    const range = 82 + castle.level * 19 + villageSkills.defense * 5;", "    const range = (82 + castle.level * 19 + villageSkills.defense * 5) * (globalThis.__mowTechEffects?.castleRange || 1);");
  source = replaceOnce(source, "castle cadence research", "    const cadence = Math.max(0.52, 2.55 - castle.level * 0.22 - villageSkills.defense * 0.08);", "    const cadence = Math.max(0.36, (2.55 - castle.level * 0.22 - villageSkills.defense * 0.08) / (globalThis.__mowTechEffects?.castleCadence || 1));");
  source = replaceOnce(source, "castle damage research", "    const impact = 0.9 + castle.level * 0.38 + villageSkills.defense * 0.16;", "    const impact = (0.9 + castle.level * 0.38 + villageSkills.defense * 0.16) * (globalThis.__mowTechEffects?.castleDamage || 1);");
  source = replaceOnce(source, "simulation time controls", "  update(dt * SIMULATION_SPEED);", "  update(dt * SIMULATION_SPEED * Math.max(0, globalThis.__mowTimeScale ?? 1));");

  const runtimeApi = `\nglobalThis.__mowRuntime = {\n  getScore: () => liveScore(),\n  spendResearch(points) { const cost = Math.max(0, Math.round(points || 0)); if (liveScore() < cost) return false; upgradeSpent += cost; updateUI(); return true; },\n  getStats() { return { score: liveScore(), elapsed, running, finished, timeScale: globalThis.__mowTimeScale ?? 1, fpsQuality: renderPixelRatio, calls: renderer?.info?.render?.calls || 0, triangles: renderer?.info?.render?.triangles || 0, workers: 1 + offspring.length, dragons: dragons.length, rocs: rocs.length, castleLevel: castles[0]?.level || 0, grain: grainStoredKg, timber: timberStock, stone: stoneStock, founderSheltered: typeof castleProtectsAgent === "function" ? castleProtectsAgent(mower) : false }; },\n  focus(kind) {\n    if (!camera || !cameraControls) return false; let targetEntity = null;\n    if (kind === "castle") targetEntity = castles[0] || null; else if (kind === "dragon") targetEntity = dragons[0] || null; else if (kind === "worker") targetEntity = offspring[0] || mower; else if (kind === "enemy") targetEntity = barbarianSite; else targetEntity = mower;\n    if (!targetEntity) return false; if (surfaceView) leaveSurfaceView(); globeView = false;\n    const focusFrame = planetFrame(targetEntity.x, targetEntity.y); const targetRadius = PLANET_RADIUS + terrainHeightAt(targetEntity.x, targetEntity.y) + 45; const target = focusFrame.normal.clone().multiplyScalar(targetRadius);\n    cameraControls.enabled = true; cameraControls.target.copy(target); camera.position.copy(focusFrame.normal).multiplyScalar(PLANET_RADIUS + 880).addScaledVector(focusFrame.east, -420); camera.up.copy(focusFrame.normal); camera.lookAt(target); cameraControls.update(); return true;\n  },\n  getResourceMarkers(limit = 6) { const max = Math.max(1, Math.min(12, limit)); const candidates = obstacles.filter((shape) => (shape.id === "stone" && (shape.quarriedUntil || 0) <= elapsed) || (shape.id === "tree" && (shape.growthLevel ?? TREE_GROW_LEVELS) >= TREE_GROW_LEVELS)); return candidates.map((shape) => ({ shape, d: Math.hypot(worldDeltaX(shape.x, mower.x), shape.y - mower.y) })).sort((a, b) => a.d - b.d).slice(0, max).map(({ shape }) => ({ id: shape.id, x: shape.x, y: shape.y })); },\n  project(x, y) { if (!camera || !planetRoot) return null; const pFrame = planetFrame(x, y); const local = pFrame.normal.clone().multiplyScalar(PLANET_RADIUS + terrainHeightAt(x, y) + 55); const world = planetRoot.localToWorld(local); const projected = world.clone().project(camera); if (projected.z < -1 || projected.z > 1) return null; return { x: (projected.x * 0.5 + 0.5) * innerWidth, y: (-projected.y * 0.5 + 0.5) * innerHeight, visible: projected.x > -1.2 && projected.x < 1.2 && projected.y > -1.2 && projected.y < 1.2 }; },\n  snapshot() { return { version: 2, savedAt: Date.now(), seed, elapsed, grainStoredKg, timberStock, stoneStock, silverCoins, goldCoins, upgradeSpent, villageSkills: { ...villageSkills }, stronghold: { ...stronghold }, villageWallLevel, castleLevel: castles[0]?.level || 1, civilizationLevel, founderUpgrades: typeof founderUpgrades !== "undefined" ? { ...founderUpgrades } : null, mower: { x: mower.x, y: mower.y, angle: mower.angle, battery: mower.battery, level: mower.level, mowedCells: mower.mowedCells, workerType: mower.workerType }, workers: offspring.map((worker) => ({ workerType: worker.workerType, level: worker.level || 1, mowedCells: worker.mowedCells || 0 })) }; },\n  restore(data) {\n    if (!data || data.version !== 2 || !planetRoot) return false; grainStoredKg = Math.max(0, Number(data.grainStoredKg) || 0); timberStock = Math.max(0, Number(data.timberStock) || 0); stoneStock = Math.max(0, Number(data.stoneStock) || 0); silverCoins = Math.max(0, Math.round(Number(data.silverCoins) || 0)); goldCoins = Math.max(0, Math.round(Number(data.goldCoins) || 0)); upgradeSpent = Math.max(0, Math.round(Number(data.upgradeSpent) || 0)); Object.assign(villageSkills, data.villageSkills || {}); Object.assign(stronghold, data.stronghold || {}); civilizationLevel = Math.max(0, Math.min(5, Number(data.civilizationLevel) || 0)); refreshStrongholdModel();\n    const wantedWall = Math.max(0, Math.min(MAX_VILLAGE_WALL_LEVEL, Number(data.villageWallLevel) || 0)); villageWallModel?.removeFromParent(); villageWallLevel = wantedWall; if (wantedWall > 0) { villageWallModel = createVillageWallModel(wantedWall); planetRoot.add(villageWallModel); }\n    if (!castles.length) foundCastle(true); const castle = castles[0]; if (castle) { castle.level = Math.max(1, Math.min(MAX_CASTLE_LEVEL, Number(data.castleLevel) || 1)); castle.collision.r = 9 + castle.level * 0.8; castle.model?.removeFromParent(); castle.model = createCastleModel(castle); planetRoot.add(castle.model); }\n    if (data.founderUpgrades && typeof founderUpgrades !== "undefined") { Object.assign(founderUpgrades, data.founderUpgrades); applyFounderUpgradeStats?.(); }\n    if (data.mower) { mower.x = wrapX(Number(data.mower.x) || mower.x); mower.y = Math.max(0, Math.min(FIELD_H, Number(data.mower.y) || mower.y)); mower.angle = Number(data.mower.angle) || mower.angle; mower.battery = Math.max(0, Math.min(100 * (typeof founderBatteryFactor === "function" ? founderBatteryFactor() : 1), Number(data.mower.battery) || 100)); mower.level = Math.max(1, Math.min(MAX_WORKER_LEVEL, Number(data.mower.level) || 1)); mower.mowedCells = Math.max(0, Number(data.mower.mowedCells) || 0); }\n    clearOffspring(); for (const saved of (Array.isArray(data.workers) ? data.workers : []).slice(0, colonyCapacity() - 1)) { const child = spawnOffspring(mower, saved.workerType); if (!child) break; child.level = Math.max(1, Math.min(MAX_WORKER_LEVEL, Number(saved.level) || 1)); child.mowedCells = Math.max(0, Number(saved.mowedCells) || 0); } updateCivilization(); updateUI(); return true;\n  },\n};\n`;

  // Settlement v2 saved upgrade spending but omitted the counters that earned
  // those points. On reload that restored debt against zero earnings, pinning
  // established settlements at POINTS 0. Version 3 keeps the earning ledger;
  // old saves receive a one-time debt reset because their earnings cannot be
  // reconstructed reliably.
  let migratedRuntimeApi = replaceOnce(
    runtimeApi,
    "points snapshot ledger",
    "snapshot() { return { version: 2, savedAt: Date.now(), seed, elapsed, grainStoredKg",
    "snapshot() { return { version: 3, savedAt: Date.now(), seed, elapsed, cutCount, grainDeliveredKg, treesCut, treesTrimmed, dragonsTakenByRocs, grainStoredKg",
  );
  migratedRuntimeApi = replaceOnce(
    migratedRuntimeApi,
    "points restore versions",
    "restore(data) {\n    if (!data || data.version !== 2 || !planetRoot) return false; grainStoredKg",
    "restore(data) {\n    const legacyScoreSave = data?.version === 2; if (!data || (data.version !== 2 && data.version !== 3) || !planetRoot) return false; cutCount = Math.max(0, Number(data.cutCount) || 0); grainDeliveredKg = Math.max(0, Number(data.grainDeliveredKg) || 0); treesCut = Math.max(0, Number(data.treesCut) || 0); treesTrimmed = Math.max(0, Number(data.treesTrimmed) || 0); dragonsTakenByRocs = Math.max(0, Number(data.dragonsTakenByRocs) || 0); grainStoredKg",
  );
  migratedRuntimeApi = replaceOnce(
    migratedRuntimeApi,
    "legacy points debt reset",
    "upgradeSpent = Math.max(0, Math.round(Number(data.upgradeSpent) || 0));",
    "upgradeSpent = legacyScoreSave ? 0 : Math.max(0, Math.round(Number(data.upgradeSpent) || 0));",
  );

  source = replaceOnce(source, "runtime API", 'window.addEventListener("resize", resize);\ngenerateLawn();', `window.addEventListener("resize", resize);${migratedRuntimeApi}\ngenerateLawn();`);
  source = replaceOnce(source, "runtime ready event", "setAutoMode(true);\nrequestAnimationFrame(frame);", "setAutoMode(true);\nglobalThis.__mowRuntimeReady = true;\nwindow.dispatchEvent(new CustomEvent(\"mow-runtime-ready\"));\nrequestAnimationFrame(frame);");
  return source;
};

function techReady(tech) { return (tech.requires || []).every((id) => unlocked.has(id)); }

let techPanel, techButton, techScore, perfHud, sanctuaryBadge, markerLayer;
let fpsFrames = 0, fpsStarted = performance.now(), fpsValue = 0;

function injectStyles() {
  if (document.querySelector("#systems-ui-styles")) return;
  const style = document.createElement("style");
  style.id = "systems-ui-styles";
  style.textContent = `.systems-dock{position:fixed;z-index:14;left:50%;bottom:calc(10px + var(--safe-bottom));transform:translateX(-50%);display:flex;gap:5px;padding:5px;border:1px solid rgba(120,168,143,.26);border-radius:13px;background:rgba(9,14,12,.82);backdrop-filter:blur(12px);box-shadow:0 10px 28px rgba(0,0,0,.26)}.systems-dock button{min-height:31px;border:1px solid rgba(120,168,143,.28);border-radius:8px;background:rgba(20,29,25,.9);color:var(--text);font:800 8px/1 system-ui,sans-serif;letter-spacing:.06em;padding:0 8px}.systems-dock button.is-on{border-color:rgba(208,160,91,.72);color:var(--amber)}.tech-tree-panel{position:fixed;z-index:22;left:50%;top:50%;width:min(920px,calc(100vw - 22px));max-height:min(760px,calc(100vh - 30px));transform:translate(-50%,-50%);overflow:auto;padding:14px;border:1px solid rgba(120,168,143,.36);border-radius:18px;background:rgba(8,13,11,.96);box-shadow:0 24px 80px rgba(0,0,0,.58);backdrop-filter:blur(18px)}.tech-tree-panel[hidden]{display:none}.tech-tree-head{position:sticky;top:-14px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 2px 10px;background:linear-gradient(rgba(8,13,11,.98) 78%,rgba(8,13,11,0))}.tech-tree-head h2{margin:0;color:var(--text-strong);font:900 18px/1 system-ui,sans-serif;letter-spacing:.05em}.tech-tree-head span{color:var(--amber);font:800 10px/1.2 system-ui,sans-serif}.tech-tree-head button{border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(255,255,255,.04);color:var(--text);padding:7px 10px}.tech-branches{display:grid;grid-template-columns:repeat(5,minmax(145px,1fr));gap:9px}.tech-branch{display:grid;align-content:start;gap:7px;padding:8px;border-radius:12px;background:rgba(255,255,255,.025)}.tech-branch>strong{color:var(--jade);font:900 8px/1.2 system-ui,sans-serif;letter-spacing:.14em}.tech-node{display:grid;gap:3px;min-height:72px;padding:8px;border:1px solid rgba(120,168,143,.18);border-radius:10px;background:rgba(18,27,23,.88);color:var(--text);text-align:left}.tech-node strong{font-size:10px}.tech-node small{color:var(--muted);font-size:8px;line-height:1.25}.tech-node em{color:var(--amber);font:800 8px/1 system-ui,sans-serif;font-style:normal}.tech-node.is-ready{border-color:rgba(208,160,91,.56)}.tech-node.is-unlocked{border-color:rgba(120,168,143,.65);background:rgba(32,58,45,.5)}.tech-node.is-locked{opacity:.46}.tech-node:disabled{cursor:default}.perf-hud{position:fixed;z-index:13;left:calc(10px + var(--safe-left));bottom:calc(54px + var(--safe-bottom));display:grid;gap:2px;min-width:132px;padding:7px 9px;border:1px solid rgba(120,168,143,.3);border-radius:10px;background:rgba(8,13,11,.86);color:var(--muted);font:700 8px/1.25 ui-monospace,monospace;pointer-events:none}.perf-hud b{color:var(--text-strong)}.perf-hud[hidden]{display:none}.sanctuary-badge{position:fixed;z-index:13;left:50%;top:calc(66px + var(--safe-top));transform:translateX(-50%);padding:5px 9px;border:1px solid rgba(120,200,148,.55);border-radius:999px;background:rgba(20,70,43,.72);color:#d8f4e1;font:900 8px/1 system-ui,sans-serif;letter-spacing:.13em;pointer-events:none;opacity:0;transition:opacity .18s}.sanctuary-badge.is-on{opacity:1}.resource-marker-layer{position:fixed;z-index:7;inset:0;pointer-events:none}.resource-marker{position:absolute;transform:translate(-50%,-50%);padding:3px 5px;border-radius:7px;background:rgba(7,11,10,.72);border:1px solid rgba(208,160,91,.32);color:var(--text-strong);font:800 7px/1 system-ui,sans-serif;letter-spacing:.06em;white-space:nowrap}.resource-marker[data-kind="stone"]{border-color:rgba(180,188,190,.44)}@media(max-width:720px){.systems-dock{max-width:calc(100vw - 16px);overflow:auto;left:8px;right:8px;transform:none;justify-content:flex-start}.tech-branches{grid-template-columns:repeat(2,minmax(140px,1fr))}.tech-tree-panel{padding:10px}.tech-tree-head{top:-10px}.resource-marker{font-size:6px}}`;
  document.head.append(style);
}

function renderTechTree() {
  if (!techPanel) return;
  const score = globalThis.__mowRuntime?.getScore?.() ?? 0;
  techScore.textContent = `${Math.floor(score).toLocaleString()} research points available`;
  techButton.textContent = `TECH ${unlocked.size}/${TECHS.length}`;
  for (const button of techPanel.querySelectorAll("[data-tech]")) {
    const tech = techById.get(button.dataset.tech); const isUnlocked = unlocked.has(tech.id); const ready = techReady(tech);
    button.classList.toggle("is-unlocked", isUnlocked); button.classList.toggle("is-ready", ready && !isUnlocked && score >= tech.cost); button.classList.toggle("is-locked", !ready && !isUnlocked); button.disabled = isUnlocked || !ready; button.querySelector("em").textContent = isUnlocked ? "RESEARCHED" : `${tech.cost.toLocaleString()} PTS`;
  }
}

function buildUi() {
  if (document.querySelector("#systems-dock")) return;
  injectStyles();
  const dock = document.createElement("nav"); dock.id = "systems-dock"; dock.className = "systems-dock"; dock.setAttribute("aria-label", "Simulation systems");
  dock.innerHTML = `<button type="button" data-sim-speed="0">PAUSE</button><button type="button" data-sim-speed="1" class="is-on">1×</button><button type="button" data-sim-speed="2">2×</button><button type="button" data-sim-speed="4">4×</button><button type="button" data-focus="castle">CASTLE</button><button type="button" data-focus="dragon">DRAGON</button><button type="button" data-focus="worker">WORKER</button><button type="button" data-focus="enemy">ENEMY</button><button type="button" id="perf-toggle">PERF</button><button type="button" id="tech-toggle">TECH</button>`;
  document.body.append(dock); techButton = dock.querySelector("#tech-toggle");
  techPanel = document.createElement("section"); techPanel.className = "tech-tree-panel"; techPanel.hidden = true; techPanel.setAttribute("aria-label", "Technology tree");
  const branches = [...new Set(TECHS.map((tech) => tech.branch))];
  techPanel.innerHTML = `<div class="tech-tree-head"><div><h2>Technology Tree</h2><span id="tech-score"></span></div><button id="tech-close" type="button">CLOSE</button></div><div class="tech-branches">${branches.map((branch) => `<section class="tech-branch"><strong>${branch}</strong>${TECHS.filter((tech) => tech.branch === branch).map((tech) => `<button class="tech-node" type="button" data-tech="${tech.id}"><strong>${tech.label}</strong><small>${tech.detail}</small><em>${tech.cost.toLocaleString()} PTS</em></button>`).join("")}</section>`).join("")}</div>`;
  document.body.append(techPanel); techScore = techPanel.querySelector("#tech-score");
  perfHud = document.createElement("aside"); perfHud.className = "perf-hud"; perfHud.hidden = true; document.body.append(perfHud);
  sanctuaryBadge = document.createElement("div"); sanctuaryBadge.className = "sanctuary-badge"; sanctuaryBadge.textContent = "CASTLE SANCTUARY"; document.body.append(sanctuaryBadge);
  markerLayer = document.createElement("div"); markerLayer.className = "resource-marker-layer"; document.body.append(markerLayer);

  dock.addEventListener("click", (event) => {
    const speedButton = event.target.closest("[data-sim-speed]"); if (speedButton) { globalThis.__mowTimeScale = Number(speedButton.dataset.simSpeed); dock.querySelectorAll("[data-sim-speed]").forEach((button) => button.classList.toggle("is-on", button === speedButton)); return; }
    const focus = event.target.closest("[data-focus]")?.dataset.focus; if (focus) { globalThis.__mowRuntime?.focus?.(focus); return; }
    if (event.target.closest("#perf-toggle")) { perfHud.hidden = !perfHud.hidden; event.target.closest("#perf-toggle").classList.toggle("is-on", !perfHud.hidden); return; }
    if (event.target.closest("#tech-toggle")) { techPanel.hidden = false; renderTechTree(); }
  });
  techPanel.querySelector("#tech-close").addEventListener("click", () => { techPanel.hidden = true; });
  techPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tech]"); if (!button) return; const tech = techById.get(button.dataset.tech); if (!tech || unlocked.has(tech.id) || !techReady(tech)) return;
    if (!globalThis.__mowRuntime?.spendResearch?.(tech.cost)) return; unlocked.add(tech.id); saveTech(); recomputeEffects(); renderTechTree();
  });
}

function saveSettlement() { const snapshot = globalThis.__mowRuntime?.snapshot?.(); if (!snapshot) return; try { localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(snapshot)); } catch (error) { console.warn("Settlement autosave failed", error); } }
function restoreSettlement() { const snapshot = safeParse(localStorage.getItem(SAVE_STORAGE_KEY), null); if (snapshot?.version === 2 || snapshot?.version === 3) globalThis.__mowRuntime?.restore?.(snapshot); }

function updateResourceMarkers() {
  if (!markerLayer || !globalThis.__mowRuntime) return;
  const markers = globalThis.__mowRuntime.getResourceMarkers?.(6) || [];
  while (markerLayer.children.length < markers.length) { const marker = document.createElement("span"); marker.className = "resource-marker"; markerLayer.append(marker); }
  [...markerLayer.children].forEach((node, index) => { const marker = markers[index]; if (!marker) { node.hidden = true; return; } const p = globalThis.__mowRuntime.project?.(marker.x, marker.y); node.hidden = !p?.visible; if (!p?.visible) return; node.dataset.kind = marker.id; node.textContent = marker.id === "stone" ? "STONE" : "TIMBER"; node.style.left = `${p.x}px`; node.style.top = `${p.y}px`; });
}

function uiLoop(now) {
  fpsFrames += 1;
  if (now - fpsStarted >= 500) {
    fpsValue = Math.round((fpsFrames * 1000) / (now - fpsStarted)); fpsFrames = 0; fpsStarted = now;
    const stats = globalThis.__mowRuntime?.getStats?.();
    if (stats) {
      sanctuaryBadge?.classList.toggle("is-on", Boolean(stats.founderSheltered));
      if (perfHud && !perfHud.hidden) perfHud.innerHTML = `<b>${fpsValue} FPS · ${stats.timeScale}×</b><span>${stats.calls} calls · ${Math.round(stats.triangles / 1000)}k tris</span><span>${stats.workers} workers · ${stats.dragons} dragons · ${stats.rocs} rocs</span><span>DPR ${Number(stats.fpsQuality).toFixed(2)} · castle L${stats.castleLevel}</span>`;
      if (!techPanel?.hidden) renderTechTree();
    }
    updateResourceMarkers();
  }
  requestAnimationFrame(uiLoop);
}

function startSystems() { buildUi(); restoreSettlement(); renderTechTree(); saveSettlement(); setInterval(saveSettlement, 12000); window.addEventListener("pagehide", saveSettlement); requestAnimationFrame(uiLoop); }
if (globalThis.__mowRuntimeReady) startSystems(); else window.addEventListener("mow-runtime-ready", startSystems, { once: true });
