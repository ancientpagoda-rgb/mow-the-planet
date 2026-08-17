// Lightweight runtime optimizations for auxiliary UI systems. Gameplay and
// simulation timing stay untouched.
const RESOURCE_CACHE_MS = 320;

function installRuntimeCaching() {
  const runtime = globalThis.__mowRuntime;
  if (!runtime || runtime.__performanceBoostInstalled) return;

  const getResourceMarkers = runtime.getResourceMarkers?.bind(runtime);
  if (getResourceMarkers) {
    let lastResourceScan = -Infinity;
    let lastLimit = 0;
    let cachedMarkers = [];

    runtime.getResourceMarkers = (limit = 6) => {
      const now = performance.now();
      if (limit !== lastLimit || now - lastResourceScan >= RESOURCE_CACHE_MS) {
        cachedMarkers = getResourceMarkers(limit);
        lastResourceScan = now;
        lastLimit = limit;
      }
      return cachedMarkers;
    };
  }

  runtime.__performanceBoostInstalled = true;
}

if (globalThis.__mowRuntimeReady) installRuntimeCaching();
else window.addEventListener("mow-runtime-ready", installRuntimeCaching, { once: true });
