import { MOWER_UPGRADE_MAX, MOWER_UPGRADE_SPECS } from "./mower-upgrades.js";

// Load the camera helper before the main game so it can capture OrbitControls.
await import("./planet-keyboard-camera.js?v=planet-arrows1");

const coreUrl = new URL("./game.js?v=founder-upgrades1-points4", import.meta.url);
const scientificWorldUrl = new URL("./scientific-world.js", import.meta.url).href;
const response = await fetch(coreUrl, { cache: "no-cache" });
if (!response.ok) throw new Error(`Unable to load game core (${response.status})`);
let source = await response.text();

function replaceOnce(label, before, after) {
  if (!source.includes(before)) throw new Error(`Upgrade integration could not find ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  "scientific world import",
  'import { createScientificWorld } from "./scientific-world.js";',
  `import { createScientificWorld } from ${JSON.stringify(scientificWorldUrl)};`,
);

replaceOnce("dragon ecology constants", "const DRAGON_BROOD_MEALS = 3;\n", "const DRAGON_BROOD_MEALS = 3;\nconst DRAGON_MATURITY_SECONDS = 42;\nconst DRAGON_BROOD_COOLDOWN = 58;\n");
replaceOnce("starting dragon ecology", "      generation: 1,\n      meals: 0,\n      age: 999,\n      birthScale: 1,", "      generation: 1,\n      meals: 0,\n      broodEnergy: 0,\n      nextBroodAt: 20 + index * 6,\n      age: 999,\n      birthScale: 1,");
replaceOnce("hatchling dragon ecology", "    generation: parent.generation + 1,\n    meals: 0,\n    age: 0,\n    birthScale: 0.58,", "    generation: parent.generation + 1,\n    meals: 0,\n    broodEnergy: 0,\n    nextBroodAt: elapsed + DRAGON_MATURITY_SECONDS + 12 + (id % 4) * 4,\n    age: 0,\n    birthScale: 0.58,");
replaceOnce("dragon meal reproduction", "  dragon.meals = (dragon.meals || 0) + 1;\n  if (dragon.meals >= DRAGON_BROOD_MEALS) {\n    dragon.meals -= DRAGON_BROOD_MEALS;\n    hatchDragon(dragon);\n  }", "  dragon.meals = (dragon.meals || 0) + 1;\n  dragon.broodEnergy = Math.min(DRAGON_BROOD_MEALS, (dragon.broodEnergy || 0) + 1);\n  dragon.nextBroodAt = Math.min(dragon.nextBroodAt || (elapsed + DRAGON_BROOD_COOLDOWN), elapsed + 22);");
replaceOnce("natural dragon reproduction", "function updateDragons(dt) {\n  for (const dragon of dragons) {\n    dragon.age = (dragon.age || 0) + dt;", "function updateDragons(dt) {\n  for (const dragon of dragons) {\n    dragon.age = (dragon.age || 0) + dt;\n    const preyAvailability = Math.min(1, (1 + offspring.length) / 4);\n    dragon.broodEnergy = Math.min(DRAGON_BROOD_MEALS, (dragon.broodEnergy || 0) + dt * 0.02 * preyAvailability);\n    dragon.nextBroodAt ??= elapsed + DRAGON_BROOD_COOLDOWN + ((dragon.id * 11) % 17);\n    const hasMatureMate = dragon.age >= DRAGON_MATURITY_SECONDS && dragons.some((mate) => mate !== dragon && (mate.age || 0) >= DRAGON_MATURITY_SECONDS);\n    if (hasMatureMate && dragon.broodEnergy >= 1 && elapsed >= dragon.nextBroodAt) {\n      const broodSize = Math.min(3, Math.max(1, Math.floor(dragon.broodEnergy)));\n      dragon.broodEnergy = Math.max(0, dragon.broodEnergy - broodSize);\n      dragon.nextBroodAt = elapsed + DRAGON_BROOD_COOLDOWN + ((dragon.id * 13 + dragon.generation * 7) % 17);\n      for (let hatch = 0; hatch < broodSize; hatch += 1) hatchDragon(dragon);\n    }");
replaceOnce("remove apex cat initialization", "  initializeApexCat();\n", "");
replaceOnce("remove apex cat reset", "  resetApexCat();\n", "");
replaceOnce("remove apex cat simulation", "  updateApexCat(dt);\n", "");
replaceOnce("remove apex cat rendering", "  positionApexCatModel();\n", "");
replaceOnce("remove apex cat threat label", '  ui.threat.textContent = `${dragons.length} dragons · cat · ${barbarianVillage?.bowmen.length || 8} bowmen`;', '  ui.threat.textContent = `${dragons.length} dragons · ${barbarianVillage?.bowmen.length || 8} bowmen`;');
replaceOnce("remove apex cat finish stat", " · cat ate ${creaturesEatenByCat} creatures", "");

const specsJson = JSON.stringify(MOWER_UPGRADE_SPECS);
replaceOnce(
  "upgrade state",
  "let soundOn = true;\n",
  `let soundOn = true;

const FOUNDER_UPGRADE_MAX = ${MOWER_UPGRADE_MAX};
const founderUpgradeSpecs = ${specsJson};
const founderUpgrades = { deck: 0, battery: 0, hopper: 0, traction: 0, armor: 0, scanner: 0 };

function founderUpgradeCost(key) {
  const spec = founderUpgradeSpecs[key];
  const level = founderUpgrades[key] || 0;
  if (!spec) return Infinity;
  return Math.round(spec.baseCost * Math.pow(1.55, Math.max(0, level)) / 25) * 25;
}
function founderBatteryFactor() { return 1 + founderUpgrades.battery * 0.32; }
function founderChargeFactor() { return 1 + founderUpgrades.battery * 0.16; }
function founderHopperFactor() { return 1 + founderUpgrades.hopper * 0.35; }
function founderTractionFactor() { return 1 + founderUpgrades.traction * 0.18; }
function founderArmorProtection() { return Math.min(0.58, founderUpgrades.armor * 0.11); }
function founderScannerCandidateCount() { return 18 + founderUpgrades.scanner * 6; }
function founderScannerRetargetSeconds() { return 0.28 / (1 + founderUpgrades.scanner * 0.28); }

function applyFounderUpgradeStats() {
  const levelFactor = 1 + ((mower.level || 1) - 1) * 0.1;
  const deckFactor = 1 + founderUpgrades.deck * 0.12;
  mower.deckRadius = mower.baseDeckRadius * deckFactor * levelFactor;
  if (mowerModel?.userData.mowerDeck) mowerModel.userData.mowerDeck.scale.z = deckFactor;
  if (mowerModel?.userData.pulledDeck) mowerModel.userData.pulledDeck.scale.z = deckFactor;
}

function buyFounderUpgrade(key) {
  const spec = founderUpgradeSpecs[key];
  if (!spec || !running || finished) return false;
  const currentLevel = founderUpgrades[key] || 0;
  if (currentLevel >= FOUNDER_UPGRADE_MAX) {
    announceAttack(spec.label + " already at maximum level");
    return false;
  }
  const cost = founderUpgradeCost(key);
  const available = liveScore();
  if (available < cost) {
    announceAttack((cost - available).toLocaleString() + " more points for " + spec.label.toLowerCase());
    return false;
  }
  upgradeSpent += cost;
  founderUpgrades[key] = currentLevel + 1;
  applyFounderUpgradeStats();
  autoTarget = null;
  autoRetargetIn = 0;
  announceAttack(spec.label + " upgraded to level " + founderUpgrades[key] + " · " + cost.toLocaleString() + " pts");
  updateUI();
  return true;
}

function ensureFounderUpgradePanel() {
  if (document.querySelector("#founder-upgrades")) return;
  const panel = document.createElement("aside");
  panel.id = "founder-upgrades";
  panel.className = "founder-upgrades is-collapsed";
  panel.setAttribute("aria-label", "Founder mower upgrades");
  const buttons = Object.entries(founderUpgradeSpecs).map(([key, spec]) =>
    '<button type="button" data-founder-upgrade="' + key + '"><strong>' + spec.label + '</strong><small></small></button>'
  ).join("");
  panel.innerHTML = '<button id="founder-upgrade-toggle" type="button" aria-expanded="false">MOWER UPGRADES</button><div class="founder-upgrade-grid">' + buttons + '</div>';
  document.querySelector(".sim-shell")?.append(panel);
  panel.querySelector("#founder-upgrade-toggle")?.addEventListener("click", () => {
    const collapsed = panel.classList.toggle("is-collapsed");
    panel.querySelector("#founder-upgrade-toggle")?.setAttribute("aria-expanded", String(!collapsed));
  });
  panel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-founder-upgrade]");
    if (button) buyFounderUpgrade(button.dataset.founderUpgrade);
  });
  const style = document.createElement("style");
  style.textContent =
    '.founder-upgrades{position:fixed;z-index:9;top:calc(330px + var(--safe-top));left:calc(12px + var(--safe-left));width:238px;padding:7px;border:1px solid rgba(120,168,143,.28);border-radius:14px;background:rgba(11,17,15,.86);box-shadow:0 12px 30px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}' +
    '#founder-upgrade-toggle{width:100%;min-height:32px;border:1px solid rgba(208,160,91,.42);border-radius:9px;color:var(--amber);background:rgba(11,15,14,.78);font-size:9px;font-weight:850;letter-spacing:.08em}' +
    '.founder-upgrade-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}' +
    '.founder-upgrade-grid button{min-width:0;min-height:46px;display:grid;align-content:center;gap:2px;border:1px solid rgba(120,168,143,.2);border-radius:9px;padding:5px 6px;color:var(--text);background:rgba(18,26,23,.82);text-align:left}' +
    '.founder-upgrade-grid button.is-affordable{border-color:rgba(208,160,91,.62);color:var(--text-strong)}' +
    '.founder-upgrade-grid button:disabled{opacity:.5}.founder-upgrade-grid strong{overflow:hidden;font-size:9px;line-height:1.1;text-overflow:ellipsis;white-space:nowrap}.founder-upgrade-grid small{color:var(--muted);font-size:7px;line-height:1.2}' +
    '.founder-upgrades.is-collapsed{width:126px;padding:5px;background:rgba(11,17,15,.72)}.founder-upgrades.is-collapsed .founder-upgrade-grid{display:none}' +
    '@media(max-width:620px){.founder-upgrades{top:calc(300px + var(--safe-top));width:212px}.founder-upgrades.is-collapsed{width:116px}#founder-upgrade-toggle{min-height:29px;font-size:8px}.founder-upgrade-grid button{min-height:42px;padding:4px 5px}}';
  document.head.append(style);
}

function updateFounderUpgradePanel(scoreNow) {
  ensureFounderUpgradePanel();
  const panel = document.querySelector("#founder-upgrades");
  if (!panel) return;
  const keys = Object.keys(founderUpgradeSpecs);
  const signature = String(running) + '|' + String(finished) + '|' + keys.map((key) => {
    const level = founderUpgrades[key] || 0;
    if (level >= FOUNDER_UPGRADE_MAX) return key + ':M';
    return key + ':' + level + ':' + (scoreNow >= founderUpgradeCost(key) ? '1' : '0');
  }).join('|');
  if (panel.dataset.signature === signature) return;
  panel.dataset.signature = signature;
  for (const [key, spec] of Object.entries(founderUpgradeSpecs)) {
    const button = panel.querySelector('[data-founder-upgrade="' + key + '"]');
    if (!button) continue;
    const level = founderUpgrades[key] || 0;
    const maxed = level >= FOUNDER_UPGRADE_MAX;
    const cost = maxed ? 0 : founderUpgradeCost(key);
    button.querySelector("strong").textContent = spec.label + " · L" + level + "/" + FOUNDER_UPGRADE_MAX;
    button.querySelector("small").textContent = maxed ? "MAX" : cost.toLocaleString() + " pts · " + spec.detail;
    button.disabled = maxed || !running || finished;
    button.classList.toggle("is-affordable", !maxed && running && !finished && scoreNow >= cost);
  }
}
`,
);

replaceOnce("hopper capacity", "  return baseCapacity * (1 + ((agent.level || 1) - 1) * 0.12) * (1 + villageSkills.machinery * 0.1);", "  const founderCapacityFactor = agent === mower ? founderHopperFactor() : 1;\n  return baseCapacity * (1 + ((agent.level || 1) - 1) * 0.12) * (1 + villageSkills.machinery * 0.1) * founderCapacityFactor;");
replaceOnce("deck level scaling", "  agent.deckRadius = agent.baseDeckRadius * (1 + (earnedLevel - 1) * 0.1);", "  if (agent === mower) applyFounderUpgradeStats();\n  else agent.deckRadius = agent.baseDeckRadius * (1 + (earnedLevel - 1) * 0.1);");
replaceOnce("reset deck upgrade", "  mower.deckRadius = mower.baseDeckRadius;\n  mower.reproductionProgress = 0;", "  applyFounderUpgradeStats();\n  mower.reproductionProgress = 0;");
replaceOnce("mower deck visual", "  deck.castShadow = true;\n  group.add(deck);\n  box(group, new THREE.Vector3(67, 27, 54), bodyColor, new THREE.Vector3(16, 25, 0), { roughness: 0.52, metalness: 0.16 });", "  deck.castShadow = true;\n  group.add(deck);\n  group.userData.mowerDeck = deck;\n  box(group, new THREE.Vector3(67, 27, 54), bodyColor, new THREE.Vector3(16, 25, 0), { roughness: 0.52, metalness: 0.16 });");
replaceOnce("tractor deck upgrade", "  mower.baseDeckRadius = 82 / SURFACE_SCALE;\n  mower.deckRadius = mower.baseDeckRadius * (1 + ((mower.level || 1) - 1) * 0.1);", "  mower.baseDeckRadius = 82 / SURFACE_SCALE;\n  applyFounderUpgradeStats();");
replaceOnce("dragon fire armor", "  const fireProtection = Math.min(0.72, stronghold.guardTower * 0.06 + villageSkills.defense * 0.045);", "  const baseFireProtection = Math.min(0.72, stronghold.guardTower * 0.06 + villageSkills.defense * 0.045);\n  const fireProtection = agent === mower ? Math.min(0.86, 1 - (1 - baseFireProtection) * (1 - founderArmorProtection())) : baseFireProtection;");
replaceOnce("arrow armor", "  const protection = Math.min(0.68, stronghold.guardTower * 0.055 + villageSkills.defense * 0.05);", "  const baseProtection = Math.min(0.68, stronghold.guardTower * 0.055 + villageSkills.defense * 0.05);\n  const protection = agent === mower ? Math.min(0.84, 1 - (1 - baseProtection) * (1 - founderArmorProtection())) : baseProtection;");
replaceOnce("collision armor", '      damage += collision?.id === "flowers" ? 6 : 1;', '      damage += (collision?.id === "flowers" ? 6 : 1) * (1 - founderArmorProtection());');
replaceOnce("traction", "  const traction = eBrakeHeld ? 0.72 : 6.5;", "  const traction = eBrakeHeld ? 0.72 : 6.5 * founderTractionFactor();");
replaceOnce("cutting battery", "    if (mowingAgent === mower) mower.battery = Math.max(0, mower.battery - workedCells * 0.00045);", "    if (mowingAgent === mower) mower.battery = Math.max(0, mower.battery - (workedCells * 0.00045) / founderBatteryFactor());");
replaceOnce("driving battery", "  if (moving && !founderDisabled) mower.battery = Math.max(0, mower.battery - dt * (0.12 + speedRatio * 0.09) * SPEED_SCALE);", "  if (moving && !founderDisabled) mower.battery = Math.max(0, mower.battery - (dt * (0.12 + speedRatio * 0.09) * SPEED_SCALE) / founderBatteryFactor());");
replaceOnce("charging", "  if (parkedAtCharger) mower.battery = Math.min(100, mower.battery + dt * 16);", "  if (parkedAtCharger) mower.battery = Math.min(100, mower.battery + dt * 16 * founderChargeFactor());");
replaceOnce("scanner candidate low", "      if (candidates.length < 18 || baseScore < candidates[candidates.length - 1].baseScore) {", "      if (candidates.length < founderScannerCandidateCount() || baseScore < candidates[candidates.length - 1].baseScore) {");
replaceOnce("scanner candidate high", "        if (candidates.length > 18) candidates.pop();", "        if (candidates.length > founderScannerCandidateCount()) candidates.pop();");
replaceOnce("scanner retarget", "    autoRetargetIn = 0.28;", "    autoRetargetIn = founderScannerRetargetSeconds();");
replaceOnce("scanner probe", "  const probeDistance = 78 / SURFACE_SCALE;", "  const probeDistance = (78 + founderUpgrades.scanner * 18) / SURFACE_SCALE;");
replaceOnce("upgrade panel refresh", "  ui.tractorUpgrade.disabled = tractorUnlocked;", "  ui.tractorUpgrade.disabled = tractorUnlocked;\n  updateFounderUpgradePanel(scoreNow);");
replaceOnce("initial upgrade stats", "  mowerModel = createMowerModel();\n  planetRoot.add(mowerModel);", "  mowerModel = createMowerModel();\n  planetRoot.add(mowerModel);\n  applyFounderUpgradeStats();");

source += "\n//# sourceURL=mow-the-planet-game-extended.js\n";
const moduleUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
