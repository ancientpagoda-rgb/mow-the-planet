// Small pre-bootstrap source patcher. The existing game-bootstrap.js already
// transforms game.js at runtime; this keeps castle-specific fixes isolated.
const nativeFetch = window.fetch.bind(window);

function patchGameSource(source) {
  const replaceOnce = (label, before, after) => {
    if (!source.includes(before)) throw new Error(`Castle integration could not find ${label}`);
    source = source.replace(before, after);
  };

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
  await import("./game-bootstrap.js?v=dragon-ecology1-castle-visible1");
} finally {
  window.fetch = nativeFetch;
}
