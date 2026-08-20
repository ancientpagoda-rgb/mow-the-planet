const bootDiagnostics = globalThis.__mowBootDiagnostics ||= {
  startedAt: Date.now(),
  completedAt: null,
  state: "booting",
  warnings: [],
  fatal: null,
};

function bootWarning(label, error) {
  const message = error?.message || String(error);
  bootDiagnostics.warnings.push({ label, message });
  console.warn(`[mow boot] ${label} unavailable; continuing with fallback`, error);
}

async function loadOptional(specifier, label) {
  try {
    return await import(specifier);
  } catch (error) {
    bootWarning(label, error);
    return null;
  }
}

// Install the shared deterministic runtime object early, but delay its source
// hook until the existing tech/progression hooks have registered.
const foundationModule = await loadOptional("./runtime-install.js?v=foundation1", "runtime foundation");

// Input/camera enhancements are optional: base OrbitControls must still boot if
// an enhancement regresses on a particular browser/device.
await loadOptional("./planet-keyboard-camera.js?v=camera-controller3", "keyboard/camera enhancement");
await loadOptional("./camera-stability.js?v=camera-stability1", "camera stability enhancement");

// Technology, direct progression controls, autosave, performance controls and
// post-loader simulation hooks. Each layer degrades independently.
await loadOptional("./tech-tree.js?v=tech2", "technology tree");
await loadOptional("./progression-ui.js?v=progression-ui1", "progression UI");
await loadOptional("./controller-drive.js?v=analog1", "controller driving");
await loadOptional("./systems-controller.js?v=systems3", "systems controller");
await loadOptional("./performance-boost.js?v=perf1", "performance enhancement");

try {
  foundationModule?.installRuntimeFoundationHooks?.();
} catch (error) {
  bootWarning("runtime foundation source hook", error);
}

// Keep the new systems dock above the existing touch/power controls on phones.
const systemsLayout = document.createElement("style");
systemsLayout.textContent = '.systems-dock{bottom:calc(108px + var(--safe-bottom))!important}@media(min-width:900px){.systems-dock{bottom:calc(108px + var(--safe-bottom))!important}}';
document.head.append(systemsLayout);

// Starter resources, mixed castle construction costs and sanctuary behavior are
// useful enhancements, but failure to install their fetch patch must not block
// the underlying simulation from loading.
const runtimePatchModule = await loadOptional("./runtime-patches.js?v=defense3", "runtime source patches");
let restoreFetch = () => {};
try {
  if (typeof runtimePatchModule?.installRuntimeSourcePatches === "function") {
    restoreFetch = runtimePatchModule.installRuntimeSourcePatches();
  }
} catch (error) {
  bootWarning("runtime source patch installation", error);
  restoreFetch = () => {};
}

try {
  await import("./game-loader.js?v=castle-visible2-resources1-stones1-autostart2-progression2-tech3-controller1-camera4-foundation1");
  bootDiagnostics.state = "running";
  bootDiagnostics.completedAt = Date.now();
} catch (error) {
  bootDiagnostics.state = "failed";
  bootDiagnostics.fatal = error?.message || String(error);
  const hint = document.querySelector("#hint");
  if (hint) hint.textContent = "Simulation failed to start. Reload to retry the base runtime.";
  console.error("[mow boot] required game loader failed", error);
  throw error;
} finally {
  try {
    restoreFetch();
  } catch (error) {
    bootWarning("runtime source patch cleanup", error);
  }
}
