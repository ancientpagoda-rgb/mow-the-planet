const UINT32_RANGE = 0x100000000;

function normalizeSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  const text = String(seed ?? "mow-the-planet");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mixSeed(baseSeed, name) {
  let hash = (normalizeSeed(baseSeed) ^ 0x9e3779b9) >>> 0;
  const text = String(name);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 2246822519);
    hash ^= hash >>> 13;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 3266489917);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function createRandomStream(baseSeed, name) {
  const initialState = mixSeed(baseSeed, name) || 0x6d2b79f5;
  let state = initialState;

  const stream = {
    name: String(name),
    seed: initialState,
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
    },
    range(min, max) {
      const low = Number(min);
      const high = Number(max);
      return low + (high - low) * stream.next();
    },
    int(maxExclusive) {
      const max = Math.max(0, Math.floor(Number(maxExclusive) || 0));
      return max > 0 ? Math.floor(stream.next() * max) : 0;
    },
    chance(probability) {
      return stream.next() < Math.max(0, Math.min(1, Number(probability) || 0));
    },
    reset() {
      state = initialState;
    },
    snapshot() {
      return Object.freeze({ name: stream.name, seed: initialState, state: state >>> 0 });
    },
  };

  return Object.freeze(stream);
}

export function createNamedRandomStreams(baseSeed = 7319) {
  const seed = normalizeSeed(baseSeed);
  const streams = new Map();

  return Object.freeze({
    seed,
    stream(name) {
      const key = String(name || "default");
      if (!streams.has(key)) streams.set(key, createRandomStream(seed, key));
      return streams.get(key);
    },
    reset(name) {
      if (name == null) {
        for (const stream of streams.values()) stream.reset();
        return;
      }
      streams.get(String(name))?.reset();
    },
    snapshot() {
      return Object.freeze(Object.fromEntries(
        [...streams.entries()].map(([name, stream]) => [name, stream.snapshot()]),
      ));
    },
  });
}

export function createFixedStepClock({
  stepSeconds = 1 / 60,
  maxStepsPerFrame = 16,
  maxAccumulatedSeconds = 0.5,
} = {}) {
  if (!(stepSeconds > 0)) throw new Error("stepSeconds must be greater than zero");
  if (!(maxStepsPerFrame >= 1)) throw new Error("maxStepsPerFrame must be at least one");
  if (!(maxAccumulatedSeconds >= stepSeconds)) throw new Error("maxAccumulatedSeconds must be at least one step");

  let accumulator = 0;
  let simulationSeconds = 0;
  let totalSteps = 0;
  let droppedSeconds = 0;

  const snapshot = () => Object.freeze({
    stepSeconds,
    accumulator,
    simulationSeconds,
    totalSteps,
    droppedSeconds,
  });

  return Object.freeze({
    stepSeconds,
    advance(deltaSeconds) {
      const incoming = Number.isFinite(deltaSeconds) ? Math.max(0, Number(deltaSeconds)) : 0;
      const room = Math.max(0, maxAccumulatedSeconds - accumulator);
      const accepted = Math.min(room, incoming);
      droppedSeconds += Math.max(0, incoming - accepted);
      accumulator += accepted;

      const availableSteps = Math.floor((accumulator + Number.EPSILON) / stepSeconds);
      const steps = Math.min(availableSteps, maxStepsPerFrame);
      if (steps > 0) {
        const consumed = steps * stepSeconds;
        accumulator = Math.max(0, accumulator - consumed);
        simulationSeconds += consumed;
        totalSteps += steps;
      }

      if (availableSteps > maxStepsPerFrame && accumulator >= stepSeconds) {
        const discard = accumulator - (accumulator % stepSeconds);
        accumulator -= discard;
        droppedSeconds += discard;
      }

      return Object.freeze({
        steps,
        stepSeconds,
        alpha: Math.max(0, Math.min(1, accumulator / stepSeconds)),
        simulationSeconds,
        droppedSeconds,
      });
    },
    reset() {
      accumulator = 0;
      simulationSeconds = 0;
      totalSteps = 0;
      droppedSeconds = 0;
    },
    snapshot,
  });
}

function freezeSnapshot(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeSnapshot(nested);
  return Object.freeze(value);
}

export function createWorldContract(id = "mow-main") {
  let provider = null;

  return Object.freeze({
    id,
    bindSnapshotProvider(nextProvider) {
      if (typeof nextProvider !== "function") throw new TypeError("world snapshot provider must be a function");
      if (provider) throw new Error(`authoritative world ${id} is already bound`);
      provider = nextProvider;
    },
    isBound() {
      return Boolean(provider);
    },
    read() {
      if (!provider) return null;
      const snapshot = provider();
      if (!snapshot || typeof snapshot !== "object") throw new Error(`authoritative world ${id} returned an invalid snapshot`);
      return freezeSnapshot(snapshot);
    },
  });
}

export function createRuntimeFoundation({ seed = 7319, clock = {} } = {}) {
  return Object.freeze({
    version: 1,
    seed: normalizeSeed(seed),
    random: createNamedRandomStreams(seed),
    clock: createFixedStepClock(clock),
    world: createWorldContract("mow-main"),
  });
}
