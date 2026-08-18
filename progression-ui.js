const previousPostPatch = globalThis.__mowPostPatchGameSource;

globalThis.__mowPostPatchGameSource = (input) => {
  let source = typeof previousPostPatch === "function" ? previousPostPatch(input) : input;
  const anchor = "  getScore: () => liveScore(),";
  if (!source.includes(anchor)) {
    console.warn("[progression ui] runtime API anchor not found");
    return source;
  }

  const progressionApi = String.raw`
  getProgression() {
    const castle = castles[0] || null;
    const castleCost = castle ? CASTLE_UPGRADE_COST * castle.level : FIRST_CASTLE_COST;
    const prerequisites = { agriculture: "mill", machinery: "smithy", forestry: "lumberyard", defense: "guardTower" };
    const skills = {};
    for (const key of Object.keys(villageSkills)) {
      const prerequisite = prerequisites[key];
      skills[key] = {
        level: villageSkills[key],
        max: MAX_VILLAGE_SKILL,
        cost: villageSkillCost(key),
        prerequisite,
        available: Boolean(stronghold[prerequisite]),
      };
    }
    return {
      grain: grainStoredKg,
      castle: {
        exists: Boolean(castle),
        level: castle?.level || 0,
        max: MAX_CASTLE_LEVEL,
        cost: castleCost,
      },
      skills,
      stronghold: { ...stronghold },
    };
  },
  upgradeCastleNow() {
    const ok = castles.length ? upgradeCastle(castles[0]) : foundCastle();
    updateUI();
    return ok;
  },
  upgradeVillageSkillNow(skill) {
    const prerequisites = { agriculture: "mill", machinery: "smithy", forestry: "lumberyard", defense: "guardTower" };
    if (!Object.prototype.hasOwnProperty.call(villageSkills, skill)) return false;
    if (villageSkills[skill] >= MAX_VILLAGE_SKILL) return false;
    const prerequisite = prerequisites[skill];
    if (!stronghold[prerequisite]) return false;
    const cost = villageSkillCost(skill);
    if (grainStoredKg < cost) return false;
    grainStoredKg -= cost;
    villageSkills[skill] += 1;
    updateUI();
    return true;
  },`;

  source = source.replace(anchor, `${anchor}${progressionApi}`);
  return source;
};

let panel = null;
let castleSummary = null;
let castleAction = null;
let castleFocus = null;
let skillGrid = null;
let launchers = null;
let started = false;

const SKILL_META = {
  agriculture: { label: "Agriculture", prerequisite: "Mill" },
  machinery: { label: "Machinery", prerequisite: "Smithy" },
  forestry: { label: "Forestry", prerequisite: "Lumberyard" },
  defense: { label: "Sky defense", prerequisite: "Watchtower" },
};

function injectProgressionStyles() {
  if (document.querySelector("#progression-ui-styles")) return;
  const style = document.createElement("style");
  style.id = "progression-ui-styles";
  style.textContent = `
    .progression-launchers{position:fixed;z-index:20;left:50%;top:calc(76px + var(--safe-top));transform:translateX(-50%);display:flex;gap:5px;padding:5px;border:1px solid rgba(120,168,143,.28);border-radius:12px;background:rgba(8,13,11,.86);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.26)}
    .progression-launchers button{min-height:31px;padding:0 10px;border:1px solid rgba(120,168,143,.3);border-radius:8px;background:rgba(20,29,25,.94);color:var(--text);font:900 8px/1 system-ui,sans-serif;letter-spacing:.08em;white-space:nowrap}
    .progression-launchers button:hover,.progression-launchers button:focus-visible{border-color:rgba(208,160,91,.7);color:var(--amber)}
    .progression-panel{position:fixed;z-index:30;left:50%;top:50%;width:min(760px,calc(100vw - 20px));max-height:min(720px,calc(100vh - 24px));transform:translate(-50%,-50%);overflow:auto;padding:14px;border:1px solid rgba(120,168,143,.4);border-radius:18px;background:rgba(8,13,11,.97);box-shadow:0 28px 90px rgba(0,0,0,.62);backdrop-filter:blur(18px)}
    .progression-panel[hidden]{display:none}
    .progression-head{position:sticky;top:-14px;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 2px 10px;background:linear-gradient(rgba(8,13,11,.99) 78%,rgba(8,13,11,0))}
    .progression-head h2{margin:0;color:var(--text-strong);font:900 18px/1 system-ui,sans-serif;letter-spacing:.04em}
    .progression-head small{display:block;margin-top:4px;color:var(--amber);font:800 9px/1.2 system-ui,sans-serif}
    .progression-head button,.progression-panel button{border:1px solid rgba(120,168,143,.3);border-radius:9px;background:rgba(20,29,25,.94);color:var(--text);font:800 9px/1.1 system-ui,sans-serif;padding:9px 11px}
    .progression-head button{border-color:rgba(255,255,255,.18)}
    .progression-panel button:disabled{opacity:.42;cursor:default}
    .progression-panel button:not(:disabled):hover,.progression-panel button:not(:disabled):focus-visible{border-color:rgba(208,160,91,.72);color:var(--amber)}
    .progression-section{display:grid;gap:9px;margin:8px 0 14px;padding:12px;border:1px solid rgba(120,168,143,.18);border-radius:13px;background:rgba(255,255,255,.025)}
    .progression-section>strong{color:var(--jade);font:900 9px/1.2 system-ui,sans-serif;letter-spacing:.13em}
    .castle-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .castle-row div{display:grid;gap:4px}.castle-row b{color:var(--text-strong);font:900 16px/1.1 system-ui,sans-serif}.castle-row span{color:var(--muted);font:700 9px/1.25 system-ui,sans-serif}
    .castle-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
    .skill-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .skill-card{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:center;padding:9px;border:1px solid rgba(120,168,143,.17);border-radius:10px;background:rgba(18,27,23,.78)}
    .skill-card strong{color:var(--text-strong);font:900 10px/1.1 system-ui,sans-serif}.skill-card small{grid-column:1;color:var(--muted);font:700 8px/1.3 system-ui,sans-serif}.skill-card button{grid-column:2;grid-row:1 / span 2;min-width:90px}
    .progression-tech-link{width:100%;border-color:rgba(208,160,91,.42)!important;color:var(--amber)!important}
    @media(max-width:720px){.progression-launchers{top:calc(68px + var(--safe-top));max-width:calc(100vw - 14px);overflow:auto}.progression-launchers button{min-height:29px;padding:0 8px;font-size:7px}.progression-panel{padding:10px}.progression-head{top:-10px}.skill-grid{grid-template-columns:1fr}.castle-row{align-items:flex-start;flex-direction:column}.castle-actions{justify-content:flex-start;width:100%}.castle-actions button{flex:1}.skill-card button{min-width:84px}}
  `;
  document.head.append(style);
}

function openTechTree() {
  if (panel) panel.hidden = true;
  const techToggle = document.querySelector("#tech-toggle");
  if (techToggle) techToggle.click();
}

function buildProgressionUi() {
  if (started) return;
  started = true;
  injectProgressionStyles();

  const oldTechButton = document.querySelector("#tech-toggle");
  if (oldTechButton) oldTechButton.textContent = "TECH TREE";

  launchers = document.createElement("nav");
  launchers.className = "progression-launchers";
  launchers.setAttribute("aria-label", "Progression menus");
  launchers.innerHTML = `<button type="button" id="castle-menu-button">CASTLE</button><button type="button" id="skills-menu-button">SKILLS</button><button type="button" id="tech-tree-button">TECH TREE</button>`;
  document.body.append(launchers);

  panel = document.createElement("section");
  panel.className = "progression-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Castle and village skills");
  panel.innerHTML = `
    <div class="progression-head"><div><h2>Castle & Skills</h2><small id="progression-grain">0.0 kg grain available</small></div><button type="button" id="progression-close">CLOSE</button></div>
    <section class="progression-section" id="castle-section"><strong>CASTLE LEVELING</strong><div class="castle-row"><div><b id="castle-summary">No castle yet</b><span id="castle-detail">Build the first citadel from stored grain.</span></div><div class="castle-actions"><button type="button" id="castle-focus">FOCUS CASTLE</button><button type="button" id="castle-action">BUILD CASTLE</button></div></div></section>
    <section class="progression-section" id="skills-section"><strong>VILLAGE SKILLS</strong><div class="skill-grid" id="skill-grid"></div></section>
    <button type="button" class="progression-tech-link" id="progression-tech">OPEN TECHNOLOGY TREE</button>
  `;
  document.body.append(panel);

  castleSummary = panel.querySelector("#castle-summary");
  castleAction = panel.querySelector("#castle-action");
  castleFocus = panel.querySelector("#castle-focus");
  skillGrid = panel.querySelector("#skill-grid");

  for (const [key, meta] of Object.entries(SKILL_META)) {
    const card = document.createElement("div");
    card.className = "skill-card";
    card.dataset.skillCard = key;
    card.innerHTML = `<strong>${meta.label}</strong><small></small><button type="button" data-upgrade-skill="${key}">UPGRADE</button>`;
    skillGrid.append(card);
  }

  const openPanel = (sectionId) => {
    panel.hidden = false;
    renderProgression();
    requestAnimationFrame(() => panel.querySelector(sectionId)?.scrollIntoView({ block: "nearest" }));
  };
  launchers.querySelector("#castle-menu-button").addEventListener("click", () => openPanel("#castle-section"));
  launchers.querySelector("#skills-menu-button").addEventListener("click", () => openPanel("#skills-section"));
  launchers.querySelector("#tech-tree-button").addEventListener("click", openTechTree);
  panel.querySelector("#progression-close").addEventListener("click", () => { panel.hidden = true; });
  panel.querySelector("#progression-tech").addEventListener("click", openTechTree);
  castleAction.addEventListener("click", () => { globalThis.__mowRuntime?.upgradeCastleNow?.(); renderProgression(); });
  castleFocus.addEventListener("click", () => { panel.hidden = true; globalThis.__mowRuntime?.focus?.("castle"); });
  skillGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-upgrade-skill]");
    if (!button) return;
    globalThis.__mowRuntime?.upgradeVillageSkillNow?.(button.dataset.upgradeSkill);
    renderProgression();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel && !panel.hidden) panel.hidden = true;
  });

  renderProgression();
  setInterval(renderProgression, 600);
}

function renderProgression() {
  if (!panel || !globalThis.__mowRuntime?.getProgression) return;
  const data = globalThis.__mowRuntime.getProgression();
  if (!data) return;
  panel.querySelector("#progression-grain").textContent = `${Number(data.grain || 0).toFixed(1)} kg grain available`;

  const castle = data.castle;
  const castleMaxed = castle.level >= castle.max;
  castleSummary.textContent = castle.exists ? `Citadel level ${castle.level} / ${castle.max}` : "No castle yet";
  panel.querySelector("#castle-detail").textContent = castleMaxed
    ? "Maximum castle level reached."
    : `${castle.exists ? `Upgrade to level ${castle.level + 1}` : "Build level 1"} · ${Number(castle.cost).toFixed(1)} kg grain`;
  castleAction.textContent = castleMaxed ? "MAX LEVEL" : castle.exists ? `LEVEL ${castle.level + 1}` : "BUILD CASTLE";
  castleAction.disabled = castleMaxed || Number(data.grain || 0) < Number(castle.cost || 0);
  castleFocus.disabled = !castle.exists;

  for (const [key, meta] of Object.entries(SKILL_META)) {
    const state = data.skills?.[key];
    const card = skillGrid.querySelector(`[data-skill-card="${key}"]`);
    if (!state || !card) continue;
    const maxed = state.level >= state.max;
    card.querySelector("strong").textContent = `${meta.label} · ${state.level}/${state.max}`;
    card.querySelector("small").textContent = maxed
      ? "Maximum skill level reached"
      : state.available
        ? `Next level costs ${Number(state.cost).toFixed(2)} kg grain`
        : `Requires ${meta.prerequisite} level 1`;
    const button = card.querySelector("button");
    button.textContent = maxed ? "MAX" : `LEVEL ${state.level + 1}`;
    button.disabled = maxed || !state.available || Number(data.grain || 0) < Number(state.cost || 0);
  }
}

if (globalThis.__mowRuntimeReady) buildProgressionUi();
else window.addEventListener("mow-runtime-ready", buildProgressionUi, { once: true });
