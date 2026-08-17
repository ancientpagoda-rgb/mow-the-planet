// Small pre-bootstrap source patcher. The existing game-bootstrap.js already
// transforms game.js at runtime; this keeps castle/resource/world fixes isolated.
const nativeFetch = window.fetch.bind(window);

function patchGameSource(source) {
  const replaceOnce = (label, before, after) => {
    if (!source.includes(before)) throw new Error(`Castle integration could not find ${label}`);
    source = source.replace(before, after);
  };

  replaceOnce(
    "auto-start simulation",
    "let running = false;",
    "let running = true;",
  );
  replaceOnce(
    "earlier resource workers",
    '  const workerSequence = ["planter", "trimmer", "chainsaw", "bucket", "miner", "mower"];',
    '  const workerSequence = ["planter", "chainsaw", "miner", "trimmer", "bucket", "mower"];',
  );
  replaceOnce(
    "castle savings priority",
    "  const affordable = councilProposals().filter(proposalAffordable);",
    `  const allProposals = councilProposals();
  const priorityCastle = castles[0]?.level < 4 ? allProposals.find((proposal) => proposal.key === "castle") : null;
  const affordable = priorityCastle
    ? (proposalAffordable(priorityCastle) ? [priorityCastle] : [])
    : allProposals.filter(proposalAffordable);`,
  );
  replaceOnce(
    "more world resource nodes",
    "  for (let index = 0; index < 108; index += 1) {",
    "  for (let index = 0; index < 220; index += 1) {",
  );
  replaceOnce(
    "more stone deposits",
    "    } else if (choice < 0.82) {",
    "    } else if (choice < 0.60) {",
  );
  replaceOnce(
    "free castle function",
    "function foundCastle() {",
    "function foundCastle(free = false) {",
  );
  replaceOnce(
    "free castle foundation cost",
    "  const foundationCost = castles.length === 1 ? FIRST_CASTLE_COST : CASTLE_FOUNDATION_COST;",
    "  const foundationCost = free ? 0 : (castles.length === 1 ? FIRST_CASTLE_COST : CASTLE_FOUNDATION_COST);",
  );
  replaceOnce(
    "initial castle spawn",
    "generateLawn();\ninit3D();\nupdateUI();",
    "generateLawn();\ninit3D();\nfoundCastle(true);\nupdateUI();",
  );
  replaceOnce(
    "reset castle spawn",
    "  seed = (seed * 1664525 + 1013904223) >>> 0;\n  generateLawn();\n  mower.x = chargePads[0].x;",
    "  seed = (seed * 1664525 + 1013904223) >>> 0;\n  generateLawn();\n  foundCastle(true);\n  mower.x = chargePads[0].x;",
  );
  replaceOnce(
    "castle council preference",
    "  if (villageWallLevel === 0 && proposal.key === \"walls\") affinity += 4.5;\n  affinity -= proposal.cost * 0.12;",
    "  if (villageWallLevel === 0 && proposal.key === \"walls\") affinity += 4.5;\n  if (proposal.key === \"castle\") affinity += (castles[0]?.level || 0) < 4 ? 6.5 : 3.5;\n  affinity -= proposal.cost * 0.12;",
  );
  replaceOnce(
    "castle HUD",
    "  ui.score.textContent = scoreNow.toLocaleString();\n  ui.threat.textContent =",
    `  ui.score.textContent = scoreNow.toLocaleString();
  let castleHud = document.querySelector("#castle-level-hud");
  if (!castleHud) {
    castleHud = document.createElement("aside");
    castleHud.id = "castle-level-hud";
    castleHud.className = "castle-level-hud";
    castleHud.setAttribute("aria-label", "Spawn castle level");
    castleHud.innerHTML = '<span>CASTLE</span><strong>Lv 1 / 7</strong>';
    document.querySelector(".sim-shell")?.append(castleHud);
    const castleHudStyle = document.createElement("style");
    castleHudStyle.textContent = '.castle-level-hud{position:fixed;z-index:8;top:calc(132px + var(--safe-top));right:calc(14px + var(--safe-right));min-width:112px;display:grid;justify-items:end;gap:1px;padding:7px 12px 8px;border:1px solid rgba(120,168,143,.52);border-radius:13px;background:rgba(11,15,14,.88);box-shadow:0 8px 28px rgba(0,0,0,.32);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);pointer-events:none}.castle-level-hud span{color:var(--jade);font-size:8px;font-weight:900;letter-spacing:.16em}.castle-level-hud strong{color:var(--text-strong);font-size:18px;font-variant-numeric:tabular-nums;line-height:1.05}@media(max-width:700px){.castle-level-hud{top:calc(121px + var(--safe-top));right:calc(8px + var(--safe-right));min-width:92px;padding:6px 9px 7px}.castle-level-hud strong{font-size:15px}}';
    document.head.append(castleHudStyle);
  }
  castleHud.querySelector("strong").textContent = \`Lv \${castles[0]?.level || 0} / \${MAX_CASTLE_LEVEL}\`;
  ui.threat.textContent =`,
  );
  replaceOnce(
    "resource HUD",
    "  ui.treasury.textContent = `${silverCoins} silver · ${goldCoins} gold`;",
    `  ui.treasury.textContent = \`\${silverCoins} silver · \${goldCoins} gold\`;
  let resourceHud = document.querySelector("#resource-hud");
  if (!resourceHud) {
    resourceHud = document.createElement("aside");
    resourceHud.id = "resource-hud";
    resourceHud.className = "resource-hud";
    resourceHud.setAttribute("aria-label", "Settlement resources");
    resourceHud.innerHTML = '<span class="resource-hud__title">RESOURCES</span><div class="resource-hud__grid"><div><small>GRAIN</small><strong data-resource="grain">0.0</strong></div><div><small>TIMBER</small><strong data-resource="timber">0.0</strong></div><div><small>STONE</small><strong data-resource="stone">0.0</strong></div><div><small>SILVER</small><strong data-resource="silver">0</strong></div><div><small>GOLD</small><strong data-resource="gold">0</strong></div></div><small class="resource-hud__castle" data-resource="castle-cost"></small>';
    document.querySelector(".sim-shell")?.append(resourceHud);
    const resourceHudStyle = document.createElement("style");
    resourceHudStyle.textContent = '.resource-hud{position:fixed;z-index:8;top:calc(178px + var(--safe-top));right:calc(14px + var(--safe-right));width:280px;padding:8px 10px 9px;border:1px solid rgba(208,160,91,.38);border-radius:13px;background:rgba(11,15,14,.88);box-shadow:0 8px 28px rgba(0,0,0,.28);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);pointer-events:none}.resource-hud__title{display:block;margin-bottom:5px;color:var(--amber);font-size:8px;font-weight:900;letter-spacing:.16em;text-align:right}.resource-hud__grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.resource-hud__grid div{min-width:0;padding:4px 3px;border-radius:7px;background:rgba(255,255,255,.035);text-align:center}.resource-hud__grid small{display:block;color:var(--muted);font-size:6px;font-weight:800;letter-spacing:.06em}.resource-hud__grid strong{display:block;margin-top:1px;color:var(--text-strong);font-size:12px;font-variant-numeric:tabular-nums}.resource-hud__castle{display:block;margin-top:5px;color:var(--jade);font-size:8px;font-weight:750;text-align:right}@media(max-width:700px){.resource-hud{top:calc(162px + var(--safe-top));right:calc(8px + var(--safe-right));width:242px;padding:6px 7px 7px}.resource-hud__grid{gap:2px}.resource-hud__grid small{font-size:5px}.resource-hud__grid strong{font-size:10px}.resource-hud__castle{font-size:7px}}';
    document.head.append(resourceHudStyle);
  }
  resourceHud.querySelector('[data-resource="grain"]').textContent = grainStoredKg.toFixed(1);
  resourceHud.querySelector('[data-resource="timber"]').textContent = timberStock.toFixed(1);
  resourceHud.querySelector('[data-resource="stone"]').textContent = stoneStock.toFixed(1);
  resourceHud.querySelector('[data-resource="silver"]').textContent = silverCoins.toLocaleString();
  resourceHud.querySelector('[data-resource="gold"]').textContent = goldCoins.toLocaleString();
  const castleLevelNow = castles[0]?.level || 0;
  const nextCastleResources = castles[0] && castleLevelNow < MAX_CASTLE_LEVEL && typeof castleUpgradeResourceCost === "function"
    ? castleUpgradeResourceCost(castles[0])
    : null;
  resourceHud.querySelector('[data-resource="castle-cost"]').textContent = castleLevelNow >= MAX_CASTLE_LEVEL
    ? 'Castle MAX'
    : nextCastleResources
      ? \`Lv \${castleLevelNow + 1}: \${grainStoredKg.toFixed(1)}/\${nextCastleResources.cost.toFixed(1)}g · \${timberStock.toFixed(1)}/\${nextCastleResources.timberCost.toFixed(1)}t · \${stoneStock.toFixed(1)}/\${nextCastleResources.stoneCost.toFixed(1)}s\`
      : 'Castle resources calculating';`,
  );

  if (typeof globalThis.__mowPostPatchGameSource === "function") {
    source = globalThis.__mowPostPatchGameSource(source);
  }
  return source;
}

window.fetch = async (input, init) => {
  const response = await nativeFetch(input, init);
  const rawUrl = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  const url = new URL(rawUrl || response.url, location.href);
  if (!url.pathname.endsWith("/game.js") || !response.ok) return response;
  const source = patchGameSource(await response.text());
  return new Response(source, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};

try {
  await import("./game-bootstrap.js?v=dragon-ecology1-castle-visible2-resources1-stones1-autostart2-progression1-tech3");
} finally {
  window.fetch = nativeFetch;
}
