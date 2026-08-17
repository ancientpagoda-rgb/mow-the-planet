// Load input/camera enhancements before the simulation creates OrbitControls.
await import("./planet-keyboard-camera.js?v=camera-controller3");

// Technology, autosave, performance controls and post-loader simulation hooks.
await import("./tech-tree.js?v=tech2");
await import("./controller-drive.js?v=analog1");
await import("./systems-controller.js?v=systems3");
await import("./performance-boost.js?v=perf1");

// Keep the new systems dock above the existing touch/power controls on phones.
const systemsLayout = document.createElement("style");
systemsLayout.textContent = '.systems-dock{bottom:calc(108px + var(--safe-bottom))!important}@media(min-width:900px){.systems-dock{bottom:calc(108px + var(--safe-bottom))!important}}';
document.head.append(systemsLayout);

// Starter resources, mixed castle construction costs and sanctuary behavior.
const { installRuntimeSourcePatches } = await import("./runtime-patches.js?v=defense3");
const restoreFetch = installRuntimeSourcePatches();

try {
  await import("./game-loader.js?v=castle-visible2-resources1-stones1-autostart2-progression1-tech3-controller1");
} finally {
  restoreFetch();
}
