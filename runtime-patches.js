export function installRuntimeSourcePatches() {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await nativeFetch(input, init);
    const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
    const url = new URL(rawUrl || response.url, location.href);
    if (!url.pathname.endsWith("/game.js") || !response.ok) return response;

    let source = await response.text();

    // Modest starter cache: enough to begin settlement construction without
    // skipping the first meaningful harvest/castle milestone.
    source = source.replace("let grainStoredKg = 0;", "let grainStoredKg = 1.5;");
    source = source.replace("let timberStock = 0;", "let timberStock = 2;");
    source = source.replace("let stoneStock = 0;", "let stoneStock = 2;");
    source = source.replace(
      "  grainStoredKg = 0;\n  grainLoadsDelivered = 0;\n  grainDeliveredKg = 0;\n  timberStock = 0;\n  stoneStock = 0;",
      "  grainStoredKg = 1.5;\n  grainLoadsDelivered = 0;\n  grainDeliveredKg = 0;\n  timberStock = 2;\n  stoneStock = 2;",
    );

    // The spawn castle is a sanctuary rather than decorative scenery.
    source = source.replace(
      `function castleOuterRadiusField(castle) {
  const radiusWorld = castle.level >= 6 ? 455 : castle.level >= 4 ? 305 : 170;
  return radiusWorld * 0.9 / SURFACE_SCALE;
}`,
      `function castleOuterRadiusField(castle) {
  const radiusWorld = castle.level >= 6 ? 455 : castle.level >= 4 ? 305 : 170;
  return radiusWorld * 0.9 / SURFACE_SCALE;
}

function castleProtectsAgent(agent) {
  if (!agent || !castles.length) return false;
  return castles.some((castle) => {
    const radius = castleOuterRadiusField(castle) * 0.92;
    return Math.hypot(worldDeltaX(agent.x, castle.x), agent.y - castle.y) <= radius;
  });
}

function castleThreateningDragon(dragon) {
  if (!dragon || !castles.length) return null;
  return castles.reduce((best, castle) => {
    const distance = Math.hypot(worldDeltaX(dragon.x, castle.x), dragon.y - castle.y);
    const repelRadius = castleOuterRadiusField(castle) * 1.45 + 20;
    if (distance > repelRadius) return best;
    return !best || distance < best.distance ? { castle, distance } : best;
  }, null);
}`,
    );

    source = source.replace(
      `function availablePrey() {
  return [mower, ...offspring].filter((agent) => (
    !(agent.disabledUntil > elapsed) && !(agent.protectedUntil > elapsed)
  ));
}`,
      `function availablePrey() {
  return [mower, ...offspring].filter((agent) => (
    !(agent.disabledUntil > elapsed) && !(agent.protectedUntil > elapsed) && !castleProtectsAgent(agent)
  ));
}`,
    );

    source = source.replace(
      'if (!target || target.disabledUntil > elapsed || target.protectedUntil > elapsed || elapsed < dragon.satedUntil) {',
      'if (!target || target.disabledUntil > elapsed || target.protectedUntil > elapsed || castleProtectsAgent(target) || elapsed < dragon.satedUntil) {',
    );

    source = source.replace(
      `    let desired = dragon.angle + 0.35;
    if (target) desired = Math.atan2(target.y - dragon.y, worldDeltaX(target.x, dragon.x));`,
      `    let desired = dragon.angle + 0.35;
    const castleThreat = castleThreateningDragon(dragon);
    if (castleThreat) {
      const castle = castleThreat.castle;
      desired = Math.atan2(dragon.y - castle.y, worldDeltaX(dragon.x, castle.x));
      dragon.altitude = Math.max(dragon.altitude, 205 + castle.level * 18);
      dragon.targetId = null;
      target = null;
    } else if (target) {
      desired = Math.atan2(target.y - dragon.y, worldDeltaX(target.x, dragon.x));
    }`,
    );

    source = source.replace(
      `function igniteMower(agent, dragon) {
  if (!agent || agent.disabledUntil > elapsed) return;`,
      `function igniteMower(agent, dragon) {
  if (!agent || agent.disabledUntil > elapsed || castleProtectsAgent(agent)) return;`,
    );

    source = source.replace(
      `function eatMower(agent, dragon) {
  if (!agent || agent.disabledUntil > elapsed || agent.protectedUntil > elapsed) return;`,
      `function eatMower(agent, dragon) {
  if (!agent || agent.disabledUntil > elapsed || agent.protectedUntil > elapsed || castleProtectsAgent(agent)) return;`,
    );

    // Basic archers exist at level 1; technology/castle levels improve them.
    source = source.replace("    if (castle.level < 2) continue;", "    if (castle.level < 1) continue;");

    return new Response(source, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };

  return () => {
    window.fetch = nativeFetch;
  };
}
