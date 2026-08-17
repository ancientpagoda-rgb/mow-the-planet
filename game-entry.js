// Load input/camera enhancements before the simulation creates OrbitControls.
await import("./planet-keyboard-camera.js?v=camera-controller2");

// Technology, autosave, performance controls and post-loader simulation hooks.
await import("./tech-tree.js?v=tech2");

// Starter resources and castle sanctuary behavior live in their own patch module
// instead of growing this entrypoint into another source-rewrite stack.
const { installRuntimeSourcePatches } = await import("./runtime-patches.js?v=defense2");
const restoreFetch = installRuntimeSourcePatches();

try {
  await import("./game-loader.js?v=castle-visible2-resources1-stones1-autostart2-progression1-tech2");
} finally {
  restoreFetch();
}
