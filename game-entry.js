// Load input/camera enhancements before the simulation creates OrbitControls.
await import("./planet-keyboard-camera.js?v=camera-controller2");

// Give each fresh world a modest starter stockpile so early settlement
// progression does not deadlock before specialist workers come online.
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  const url = new URL(rawUrl || response.url, location.href);
  if (!url.pathname.endsWith("/game.js") || !response.ok) return response;

  let source = await response.text();
  source = source.replace("let grainStoredKg = 0;", "let grainStoredKg = 1.5;");
  source = source.replace("let timberStock = 0;", "let timberStock = 2;");
  source = source.replace("let stoneStock = 0;", "let stoneStock = 2;");
  source = source.replace(
    "  grainStoredKg = 0;\n  grainLoadsDelivered = 0;\n  grainDeliveredKg = 0;\n  timberStock = 0;\n  stoneStock = 0;",
    "  grainStoredKg = 1.5;\n  grainLoadsDelivered = 0;\n  grainDeliveredKg = 0;\n  timberStock = 2;\n  stoneStock = 2;",
  );

  return new Response(source, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

try {
  await import("./game-loader.js?v=castle-visible2-resources1-stones1-autostart2-progression1-starter1");
} finally {
  window.fetch = nativeFetch;
}
