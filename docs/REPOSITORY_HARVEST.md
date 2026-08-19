# Ancient Pagoda repository harvest

This document records the useful behavior that should survive from every repository currently owned by `ancientpagoda-rgb` while `mow-the-planet` becomes the integration target.

The rule is **harvest capabilities, not breakage**. Source repositories remain untouched. A feature is not copied into the live MOW runtime merely because it existed elsewhere; it must preserve the current MOW experience and pass focused validation first.

The machine-readable source of truth is [`heritage/repositories.js`](../heritage/repositories.js). `npm run check:heritage` fails if a known repository silently disappears from the registry.

## Non-regression rules

1. Keep one authoritative simulation clock. Imported simulation systems consume that clock instead of starting hidden competing loops.
2. Keep one authoritative world state for the active MOW route. Renderers, inspectors, audio and UI should read that state rather than create unrelated copies.
3. Preserve deterministic seeds/named random streams where replay or scientific comparison matters.
4. Preserve scientific and reconstruction provenance. Data needs a source, transformation history, and a clear distinction between observed/source-constrained, model-derived, provisional or candidate values.
5. Preserve touch-first operation and adaptive rendering. Desktop-only improvements cannot regress iPhone/mobile boot or controls.
6. Large scientific assets should be manifest-driven, compacted before browser delivery, and optional when possible.
7. External live-data inputs need smoothing, failure handling and a fallback state rather than taking the experience down.
8. Promote harvested code incrementally behind focused checks. Do not port entire old runtimes wholesale.

## What survives from each repository

| Repository | Keep | Integration role |
| --- | --- | --- |
| `predictorjesus-site` | Repository is empty | provenance only |
| `backup-hardening-landing` | tiny static landing/page delivery pattern | archive/reference |
| `borg-backup-kit` | encrypted scheduled backups, retention, failure notification, restore drills | project operations |
| `virtual-plant` | localStorage persistence, elapsed-time growth, hydration/health dynamics, deterministic organism rendering | organism persistence library |
| `world-at-a-glance` | scheduled daily refresh, build-time data generation, choropleth presentation | optional real-data layers |
| `universe-dashboard` | scheduled astronomy data refresh and static generated data | optional astronomy data pipeline |
| `cosmic-clock` | Astronomy Engine positions, Sun direction, sidereal Earth rotation, time-aware scale views | physical sky/space state |
| `brain-wiring-atlas` | manifest-driven heavy data packs, derived-vs-schematic labeling, licensing/source provenance | scientific asset architecture |
| `planetary-signal` | no-key data adapters, EMA smoothing, graceful fallback, layered Web Audio | ambient/data/audio subsystem |
| `reality-engine` | one shared world state, regime inertia, event log, audio+visual mappings from the same state | state/renderer architecture |
| `ancientpagoda-rgb.github.io` | demo hub and archive routing | navigation/provenance |
| `reality-sandbox` | fixed authoritative clock, coupled living-planet state, regional inspector, single renderer ownership, desktop/mobile gates | core architecture |
| `reality-forest-3d` | Repository is empty | provenance only |
| `extinct` | Repository is empty | provenance only |
| `reality-sandbox-extinct` | Repository is empty | provenance only |
| `world-timeline-sim` | historical anchor interpolation, time scrubber, uncertainty notes, Shannon diversity, map focus card | future history/society layer |
| `-` | Placeholder repository is empty | provenance only |
| `world` | live globe shell, weather/celestial context, country briefings, language-aware IPA, resilient runtime patch fallback | globe/briefing UI library |
| `earth-in-universe` | nested navigation from Earth to the observable universe | scale-navigation reference |
| `universe` | catalog-backed point clouds and sampled/streamed scientific datasets | large-point-cloud rendering/data ingestion |
| `marchwarden` | strategy/RPG dual view, shared WebSocket world, durable Postgres state, settlement resources/raids | future society/persistence layer |
| `epic-evolution-sim` | deterministic streams, fixed-step clock, WebGPU→WebGL2 fallback, floating origin, hierarchical local frames, inherited state across scales | multi-scale simulation architecture |
| `cosmic-ecology-sandbox` | causal hydrology→ecology→evolution chain, single manually ticked renderer, trait inheritance/speciation, state inspector, scope gates | living-planet/ecology architecture |
| `mow-the-planet` | touch-first globe, adaptive resolution, terrain/hydrology, persistent mowing, autonomous workers, camera modes, mobile guards | current baseline/core |
| `earth-777` | checksum-pinned ingestion, source ledger, provenance classes, compact scientific layers, deterministic branches, water conservation, adaptive fidelity, scientific tests | scientific-data architecture |
| `lego-sim` | deterministic transform/inventory ledger, provenance gates, exact-vs-candidate distinction, integrity checks, breakable connection graph, camera modes | reconstruction/confidence architecture |

## Promotion order

The safest integration order is architectural before cosmetic:

### 1. Guardrails and reproducibility

- Keep the current MOW runtime as the baseline.
- Add the repository registry/audit.
- Adopt named deterministic streams for new procedural subsystems.
- Add provenance/confidence tags to imported scientific or reconstructed data.

### 2. Runtime resilience

- Reuse Reality Sandbox's single-clock/single-world discipline.
- Reuse World's progressive boot/fallback pattern.
- Reuse Epic Evolution's renderer fallback and hierarchical frame ideas only where the current Three.js path benefits.
- Keep current mobile adaptive-resolution behavior as a hard regression boundary.

### 3. Living-world depth

- Fold in hydrology/ecology/evolution concepts from Cosmic Ecology and Reality Sandbox as MOW-native systems, not as separate canvases.
- Reuse Virtual Plant's elapsed-time persistence for organisms/resources that should continue evolving across visits.
- Use Earth 777's conservation/provenance discipline when a subsystem claims scientific grounding.

### 4. Scale and context

- Use Cosmic Clock for actual astronomical orientation.
- Use Earth in the Universe and Epic Evolution for continuous scale transitions and floating-origin/local-frame patterns.
- Use Universe's point-cloud approach only at scales where individual catalog points are useful.

### 5. Information and sound

- Add World-style country/language/IPA context as an optional inspection layer.
- Add Planetary Signal/Reality Engine sonification as an optional renderer of the same authoritative world/real-data state.
- Keep heavy datasets manifest-driven like Brain Wiring Atlas.

### 6. History, society and exact reconstruction

- Use World Timeline's anchored timeline method for explicitly coarse historical overlays.
- Use Marchwarden's shared-state/persistence model when settlements become multiplayer or durable.
- Use LEGO Sim's exact/candidate/provenance ledger whenever geometry or reconstruction confidence matters.

## Definition of "kept"

A repository's useful contribution is considered kept when at least one of the following is true:

- the capability is active in the MOW runtime and covered by a focused test;
- the reusable implementation has been ported into a MOW library/module without changing behavior;
- the source technique is represented by an explicit architecture rule and a queued integration item;
- the repository is intentionally classified as archive/tooling/hub and remains preserved as provenance;
- the repository is empty and is explicitly recorded as such.

This avoids the failure mode where old experimental code is blindly merged into the current runtime and reintroduces duplicate loops, renderers, stale data, broken mobile behavior or untraceable scientific claims.
