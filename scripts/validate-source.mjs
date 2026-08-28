import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const game = read("game.js");
const loader = read("game-loader.js");
const entry = read("game-entry.js");
const tech = read("tech-tree.js");
const patches = read("runtime-patches.js");

function requireText(source, label, text) {
  if (!source.includes(text)) throw new Error(`${label}: expected source marker is missing: ${text}`);
}

// Raw game markers used by runtime-patches.js.
for (const [label, text] of [
  ["starter grain", "let grainStoredKg = 0;"],
  ["starter timber", "let timberStock = 0;"],
  ["starter stone", "let stoneStock = 0;"],
  ["castle radius", "function castleOuterRadiusField(castle) {"],
  ["dragon prey", "function availablePrey() {"],
  ["dragon update", "function updateDragons(dt) {"],
  ["dragon ignition", "function igniteMower(agent, dragon) {"],
  ["dragon eating", "function eatMower(agent, dragon) {"],
]) requireText(game, label, text);

// Raw/loader markers consumed by the technology post-patcher.
for (const [label, text] of [
  ["spawn worker", "function spawnOffspring(parent) {"],
  ["grain yield", "const milled = delivered * (1 + stronghold.mill * 0.12);"],
  ["timber yield", "const timberYield = 1 + stronghold.lumberyard * 0.4 + villageSkills.forestry * 0.14;"],
  ["stone yield", "const stoneYield = 1 + villageSkills.machinery * 0.12;"],
  ["worker speed", "return permanentGain * temporaryBoost * (1 + villageSkills.machinery * 0.06) * (1 + stronghold.smithy * 0.05);"],
  ["crop growth", "const cropSpeed = 1 + villageSkills.agriculture * 0.12;"],
  ["crop harvest points", "harvestedCropCells += 1;\n        // Mature crops are productive harvesting too. Keep them in the\n        // lifetime work total so every completed harvest earns points.\n        cutCount += 1;"],
  ["spendable points", "return Math.max(0, earnedPoints() - upgradeSpent);"],
  ["reproduction", "if (parent.reproductionProgress < REPRODUCTION_CELLS) continue;"],
  ["capacity", "return Math.min(MAX_COLONY, BASE_COLONY_CAP + stronghold.housing + (stronghold.housing >= MAX_STRONGHOLD_LEVEL ? 1 : 0));"],
  ["council cadence", "nextCouncilAt = elapsed + COUNCIL_INTERVAL;"],
  ["castle range", "const range = 82 + castle.level * 19 + villageSkills.defense * 5;"],
  ["castle cadence", "const cadence = Math.max(0.52, 2.55 - castle.level * 0.22 - villageSkills.defense * 0.08);"],
  ["castle damage", "const impact = 0.9 + castle.level * 0.38 + villageSkills.defense * 0.16;"],
  ["frame speed", "update(dt * SIMULATION_SPEED);"],
]) requireText(game, label, text);

requireText(loader, "post-patch hook", "__mowPostPatchGameSource");
requireText(loader, "resource worker sequence", '["planter", "chainsaw", "miner", "trimmer", "bucket", "mower"]');
requireText(entry, "technology import", "./tech-tree.js");
requireText(entry, "runtime patch module", "./runtime-patches.js");
if (entry.includes("points-fix.js")) throw new Error("points scoring must come from game.js, not a runtime source patch");
requireText(tech, "runtime API", "globalThis.__mowRuntime");
requireText(tech, "technology effects", "globalThis.__mowTechEffects");
requireText(tech, "points ledger snapshot", "version: 3, savedAt: Date.now(), seed, elapsed, cutCount, grainDeliveredKg");
requireText(tech, "legacy points migration", "upgradeSpent = legacyScoreSave ? 0");
requireText(patches, "sanctuary function", "castleProtectsAgent");

console.log("Source transform markers validated.");
