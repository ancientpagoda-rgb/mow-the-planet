import assert from "node:assert/strict";
import {
  createFixedStepClock,
  createNamedRandomStreams,
  createRuntimeFoundation,
  createWorldContract,
} from "../runtime/foundation.js";

const first = createNamedRandomStreams(7319);
const firstEcology = Array.from({ length: 6 }, () => first.stream("ecology").next());
const firstWeather = Array.from({ length: 4 }, () => first.stream("weather").next());

const second = createNamedRandomStreams(7319);
const secondWeather = Array.from({ length: 4 }, () => second.stream("weather").next());
const secondEcology = Array.from({ length: 6 }, () => second.stream("ecology").next());

assert.deepEqual(secondEcology, firstEcology, "named streams must not depend on stream access order");
assert.deepEqual(secondWeather, firstWeather, "same seed/name must reproduce the same sequence");
assert.notDeepEqual(firstEcology.slice(0, 4), firstWeather, "different stream names should be decorrelated");

first.reset("ecology");
assert.deepEqual(
  Array.from({ length: 6 }, () => first.stream("ecology").next()),
  firstEcology,
  "reset must replay a named stream exactly",
);

const clock = createFixedStepClock({ stepSeconds: 1 / 60, maxStepsPerFrame: 16, maxAccumulatedSeconds: 0.5 });
const thirtyFpsFrame = clock.advance(1 / 30);
assert.equal(thirtyFpsFrame.steps, 2, "a 30 FPS frame should produce two 60 Hz simulation steps");
assert.equal(clock.advance(0).steps, 0, "a paused/zero-time frame must not advance simulation");

const fastFrame = clock.advance(0.033 * 1.7 * 4);
assert.ok(fastFrame.steps >= 13 && fastFrame.steps <= 14, "4x MOW speed should remain within the fixed-step budget");
assert.ok(clock.snapshot().droppedSeconds < 1e-9, "normal 4x operation should not drop simulation time");

const world = createWorldContract("test-world");
world.bindSnapshotProvider(() => ({ id: "test-world", nested: { value: 42 } }));
const snapshot = world.read();
assert.equal(snapshot.nested.value, 42);
assert.ok(Object.isFrozen(snapshot));
assert.ok(Object.isFrozen(snapshot.nested));
assert.throws(() => world.bindSnapshotProvider(() => ({})), /already bound/, "a second authoritative world must be rejected");

const runtime = createRuntimeFoundation({ seed: "mow-seed" });
assert.equal(runtime.version, 1);
assert.equal(runtime.random.seed, runtime.seed);
assert.equal(runtime.world.id, "mow-main");

const { patchRuntimeCoreSource } = await import("../runtime-install.js");
const syntheticCore = `let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - previous) / 1000 || 0);
  previous = now;
  update(dt * SIMULATION_SPEED * Math.max(0, globalThis.__mowTimeScale ?? 1));
  draw(dt);
  updateAdaptiveQuality(dt);
  requestAnimationFrame(frame);
}`;
const patchedCore = patchRuntimeCoreSource(syntheticCore);
assert.match(patchedCore, /bindSnapshotProvider/, "live source patch must expose the authoritative world snapshot");
assert.match(patchedCore, /authoritativeClock\.advance/, "live source patch must route updates through the fixed-step clock");
assert.match(patchedCore, /for \(let runtimeStep = 0; runtimeStep < tick\.steps;/, "fixed-step integration must execute every accumulated step");
assert.doesNotMatch(
  patchedCore,
  /update\(dt \* SIMULATION_SPEED \* Math\.max\(0, globalThis\.__mowTimeScale \?\? 1\)\);/,
  "variable-step update must be removed when the clock patch applies",
);

console.log("Runtime foundation OK: deterministic streams, fixed-step clock, single-world contract, and live source integration validated.");
