import { createRuntimeFoundation } from "./runtime/foundation.js";

export const runtimeFoundation = globalThis.__mowRuntimeFoundation
  || createRuntimeFoundation({ seed: 7319, clock: { stepSeconds: 1 / 60, maxStepsPerFrame: 16, maxAccumulatedSeconds: 0.5 } });

globalThis.__mowRuntimeFoundation = runtimeFoundation;
globalThis.__mowRuntimeFoundationReady = true;

const diagnostics = globalThis.__mowRuntimeFoundationDiagnostics ||= {
  version: runtimeFoundation.version,
  clockPatched: false,
  worldPatched: false,
  warnings: [],
};

function warn(message) {
  diagnostics.warnings.push(message);
  console.warn(`[runtime foundation] ${message}`);
}

function patchWorldContract(source) {
  const anchor = "let previous = performance.now();";
  if (!source.includes(anchor)) {
    warn("authoritative-world anchor not found; game will continue without the read-only world contract");
    return source;
  }

  const binding = String.raw`const mowAuthoritativeWorld = globalThis.__mowRuntimeFoundation?.world;
if (mowAuthoritativeWorld && !mowAuthoritativeWorld.isBound()) {
  mowAuthoritativeWorld.bindSnapshotProvider(() => ({
    id: "mow-main",
    version: 1,
    seed: seed >>> 0,
    elapsed,
    running,
    finished,
    simulationSpeed: SIMULATION_SPEED,
    timeScale: Math.max(0, globalThis.__mowTimeScale ?? 1),
    mower: {
      id: mower.id,
      x: mower.x,
      y: mower.y,
      angle: mower.angle,
      battery: mower.battery,
      level: mower.level,
      workerType: mower.workerType,
    },
    populations: {
      workers: 1 + offspring.length,
      dragons: dragons.length,
      rocs: rocs.length,
    },
    progress: {
      cuttableCells: totalCuttable,
      currentlyCutCells: currentCutCount,
      mowedFraction: totalCuttable > 0 ? currentCutCount / totalCuttable : 0,
    },
    resources: {
      grainKg: grainStoredKg,
      timber: timberStock,
      stone: stoneStock,
      silver: silverCoins,
      gold: goldCoins,
    },
    settlement: {
      castleLevel: castles[0]?.level || 0,
      wallLevel: villageWallLevel,
      skills: { ...villageSkills },
      stronghold: { ...stronghold },
    },
  }));
}`;

  diagnostics.worldPatched = true;
  return source.replace(anchor, `${binding}\n\n${anchor}`);
}

function patchFixedStepClock(source) {
  const frameHeader = `let previous = performance.now();\nfunction frame(now) {\n  const dt = Math.min(0.033, (now - previous) / 1000 || 0);\n  previous = now;`;
  if (!source.includes(frameHeader)) {
    warn("frame-loop anchor not found; game will keep its existing variable-step simulation clock");
    return source;
  }

  const scaledUpdate = "  update(dt * SIMULATION_SPEED * Math.max(0, globalThis.__mowTimeScale ?? 1));";
  const baseUpdate = "  update(dt * SIMULATION_SPEED);";
  const updateLine = source.includes(scaledUpdate) ? scaledUpdate : source.includes(baseUpdate) ? baseUpdate : null;
  if (!updateLine) {
    warn("simulation-update anchor not found; game will keep its existing variable-step simulation clock");
    return source;
  }

  const replacement = String.raw`  const timeScale = Math.max(0, globalThis.__mowTimeScale ?? 1);
  const authoritativeClock = globalThis.__mowRuntimeFoundation?.clock;
  if (authoritativeClock) {
    const tick = authoritativeClock.advance(dt * SIMULATION_SPEED * timeScale);
    for (let runtimeStep = 0; runtimeStep < tick.steps; runtimeStep += 1) update(tick.stepSeconds);
  } else {
    update(dt * SIMULATION_SPEED * timeScale);
  }`;

  diagnostics.clockPatched = true;
  return source.replace(updateLine, replacement);
}

export function patchRuntimeCoreSource(input) {
  let source = String(input);
  source = patchWorldContract(source);
  source = patchFixedStepClock(source);
  return source;
}

let hooksInstalled = false;

export function installRuntimeFoundationHooks() {
  if (hooksInstalled) return runtimeFoundation;
  hooksInstalled = true;

  const previousPostPatch = globalThis.__mowPostPatchGameSource;
  globalThis.__mowPostPatchGameSource = (input) => {
    const source = typeof previousPostPatch === "function" ? previousPostPatch(input) : input;
    return patchRuntimeCoreSource(source);
  };

  return runtimeFoundation;
}

if (typeof window !== "undefined") {
  window.dispatchEvent(new CustomEvent("mow-runtime-foundation-ready", { detail: { version: runtimeFoundation.version } }));
}
