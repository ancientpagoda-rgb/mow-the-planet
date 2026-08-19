export const repositoryHeritage = [
  {
    repo: "predictorjesus-site",
    status: "empty",
    keep: [],
    note: "No repository runtime to harvest; preserve the name as provenance only."
  },
  {
    repo: "backup-hardening-landing",
    status: "archive",
    keep: ["small static landing-page pattern", "simple Pages-friendly delivery"],
    note: "Keep as a lightweight publishing/offer-page reference; do not mix sales UI into the simulation runtime."
  },
  {
    repo: "borg-backup-kit",
    status: "tooling",
    keep: ["encrypted Borg-over-SSH backups", "systemd scheduling", "retention policy", "failure notifications", "restore drill"],
    note: "Operational reliability pattern for project infrastructure, not browser gameplay."
  },
  {
    repo: "virtual-plant",
    status: "library",
    keep: ["localStorage persistence", "offline elapsed-time progression", "hydration/health growth model", "deterministic per-entity rendering"],
    note: "Useful for persistent organisms and low-cost background growth."
  },
  {
    repo: "world-at-a-glance",
    status: "library",
    keep: ["scheduled daily data refresh", "build-time data compaction", "country choropleth dashboard pattern"],
    note: "Reusable for optional real-world dashboard/data layers."
  },
  {
    repo: "universe-dashboard",
    status: "library",
    keep: ["scheduled astronomy data refresh", "static generated dashboard data"],
    note: "Reuse data-build separation where live APIs would hurt runtime reliability."
  },
  {
    repo: "cosmic-clock",
    status: "core-candidate",
    keep: ["Astronomy Engine Sun direction", "heliocentric planet positions", "sidereal Earth rotation", "time-zone-safe clocking", "scale transitions"],
    note: "Prefer physical astronomical state over decorative sky motion."
  },
  {
    repo: "brain-wiring-atlas",
    status: "library",
    keep: ["manifest-driven heavy data packs", "browser-light asset loading", "source/licensing provenance", "derived-vs-schematic labeling"],
    note: "Strong pattern for large optional scientific layers without bloating the base app."
  },
  {
    repo: "planetary-signal",
    status: "core-candidate",
    keep: ["no-key public data adapters", "EMA smoothing", "graceful synthetic fallback", "Web Audio layered sonification", "autoplay-safe audio start"],
    note: "Reusable ambient/audio and resilient external-data pattern."
  },
  {
    repo: "reality-engine",
    status: "core-candidate",
    keep: ["single shared world state", "regime detector with inertia", "audio and visuals driven by the same state", "event logging", "presets"],
    note: "Keep the one-state-many-renderers idea; avoid independent visual/audio simulations."
  },
  {
    repo: "ancientpagoda-rgb.github.io",
    status: "hub",
    keep: ["suite landing hub", "archive routing", "clear separation of current demos and older experiments"],
    note: "Preserve as navigation/provenance rather than embedding the whole hub into MOW."
  },
  {
    repo: "reality-sandbox",
    status: "core-candidate",
    keep: ["one authoritative fixed simulation clock", "coupled terrain-water-climate-vegetation-animal state", "single renderer ownership", "regional inspector", "desktop/mobile smoke gates"],
    note: "This is the strongest no-regression architecture rule for the living-planet runtime."
  },
  {
    repo: "reality-forest-3d",
    status: "empty",
    keep: [],
    note: "No repository runtime to harvest."
  },
  {
    repo: "extinct",
    status: "empty",
    keep: [],
    note: "No repository runtime to harvest."
  },
  {
    repo: "reality-sandbox-extinct",
    status: "empty",
    keep: [],
    note: "No repository runtime to harvest."
  },
  {
    repo: "world-timeline-sim",
    status: "library",
    keep: ["historical anchor interpolation", "time scrubber", "explicit uncertainty/coverage notes", "normalized Shannon diversity", "map focus card"],
    note: "Useful model for historical/civilization overlays when they are explicitly labeled as coarse proxies."
  },
  {
    repo: "-",
    status: "empty",
    keep: [],
    note: "Placeholder repository; no runtime to harvest."
  },
  {
    repo: "world",
    status: "core-candidate",
    keep: ["live globe shell", "weather/celestial context", "country briefings", "language-aware IPA", "progressive runtime patch fallbacks", "mobile-safe globe boot"],
    note: "Harvest resilient boot/fallback behavior and the language/briefing layer independently from MOW core simulation state."
  },
  {
    repo: "earth-in-universe",
    status: "core-candidate",
    keep: ["nested scale navigation from Earth to observable universe", "Three.js scale-context presentation"],
    note: "Use as a navigation/continuity reference, not as a second disconnected universe runtime."
  },
  {
    repo: "universe",
    status: "library",
    keep: ["catalog-backed 3D point clouds", "streamed/sample scientific datasets", "desktop background viewer pattern"],
    note: "Reuse catalog ingestion and point-cloud rendering techniques where appropriate."
  },
  {
    repo: "marchwarden",
    status: "core-candidate",
    keep: ["strategy/RPG dual-view continuity", "shared WebSocket world state", "durable Postgres persistence", "resource/raid simulation", "direct character control"],
    note: "Useful future society/settlement layer; keep server-state architecture separate from static Pages assumptions."
  },
  {
    repo: "epic-evolution-sim",
    status: "core-candidate",
    keep: ["deterministic named random streams", "fixed-step clock", "WebGPU with WebGL2 fallback", "hierarchical local frames", "floating origin", "parent-child continuity anchors", "inherited state across cosmic-to-biological scales"],
    note: "Primary reference for multi-scale continuity without resetting the simulation at each zoom level."
  },
  {
    repo: "cosmic-ecology-sandbox",
    status: "core-candidate",
    keep: ["causal hydrology/ecology/evolution chain", "one PixiJS renderer with manual ticking", "seasonal resources", "trait inheritance/speciation", "regional state inspector", "strict scope freeze until checks pass"],
    note: "Reuse causal coupling and validation discipline; do not add a second clock or duplicate world state."
  },
  {
    repo: "mow-the-planet",
    status: "current-core",
    keep: ["touch-first globe controls", "adaptive internal resolution", "procedural terrain/hydrology", "persistent cut cells", "autonomous workers", "terrain-aware placement", "camera modes", "mobile performance guards", "renewable regrowth loop"],
    note: "Current integration target and baseline behavior that imports must not regress."
  },
  {
    repo: "earth-777",
    status: "core-candidate",
    keep: ["source ledger", "checksum-pinned ingestion", "compact browser datasets", "study/model/prior provenance classes", "deterministic replayable branches", "mass-conserving hydrology", "adaptive fidelity", "multiscale time controls", "scientific regression tests"],
    note: "Primary reference for scientific data provenance and reproducible browser simulation."
  },
  {
    repo: "lego-sim",
    status: "library",
    keep: ["deterministic inventory/transform ledger", "instruction-page provenance gate", "exact-vs-candidate distinction", "source-integrity checks", "breakable connection graph", "orbit/ground/overhead cameras"],
    note: "Strong general pattern for exact reconstruction, provenance, and confidence-tagged geometry."
  }
];

export const expectedAncientPagodaRepositories = repositoryHeritage.map((entry) => entry.repo);

export const heritageRules = Object.freeze({
  authoritativeClock: "A harvested simulation feature must use the existing authoritative MOW clock unless intentionally isolated behind a route.",
  authoritativeWorld: "A harvested renderer or inspector must read MOW world state instead of creating a competing hidden simulation.",
  provenance: "Scientific or reconstruction data must retain source, confidence/provenance class, and transformation history.",
  deterministic: "Procedural systems should use named deterministic random streams when replay matters.",
  mobileFirst: "Imports must preserve touch controls, adaptive rendering, and mobile boot reliability.",
  gatedPromotion: "Harvested code is promoted into the live runtime only after syntax/build checks and a focused behavior test pass.",
  sourcePreservation: "Source repositories remain untouched; MOW records provenance instead of replacing or deleting them."
});
