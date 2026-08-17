// True analog controller driving for the founder mower. The existing
// planet-keyboard-camera module owns controller buttons and camera input; this
// bridge supplies smooth steering/throttle directly to the simulation instead
// of relying on its synthetic W/A/S/D fallback.
const controllerDrive = globalThis.__mowControllerDrive ??= {
  active: false,
  connected: false,
  steer: 0,
  drive: 0,
};

function deadzone(value, size) {
  const magnitude = Math.abs(value || 0);
  if (magnitude <= size) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - size) / (1 - size));
}

function responseCurve(value, power = 1.35) {
  return Math.sign(value) * Math.pow(Math.abs(value), power);
}

function buttonValue(pad, index) {
  const button = pad?.buttons?.[index];
  if (!button) return 0;
  return typeof button.value === "number" ? button.value : Number(button.pressed);
}

let steerValue = 0;
let driveValue = 0;
let previousTime = performance.now();

function updateAnalogDrive(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - previousTime) / 1000));
  previousTime = now;

  const pad = Array.from(navigator.getGamepads?.() || []).find((candidate) => candidate?.connected);
  if (!pad) {
    const release = 1 - Math.exp(-18 * dt);
    steerValue += (0 - steerValue) * release;
    driveValue += (0 - driveValue) * release;
    controllerDrive.connected = false;
    controllerDrive.active = false;
    controllerDrive.steer = steerValue;
    controllerDrive.drive = driveValue;
    requestAnimationFrame(updateAnalogDrive);
    return;
  }

  const rawSteer = responseCurve(deadzone(pad.axes?.[0], 0.12));
  const stickThrottle = -deadzone(pad.axes?.[1], 0.18);
  const leftTrigger = buttonValue(pad, 6);
  const rightTrigger = buttonValue(pad, 7);
  const triggerThrottle = rightTrigger - leftTrigger;
  const rawDrive = Math.abs(triggerThrottle) > 0.035 ? triggerThrottle : stickThrottle;

  // Fast enough to feel immediate, but removes the abrupt digital snapping the
  // old controller-to-keyboard path produced.
  const steerBlend = 1 - Math.exp(-17 * dt);
  const driveBlend = 1 - Math.exp(-12 * dt);
  steerValue += (rawSteer - steerValue) * steerBlend;
  driveValue += (rawDrive - driveValue) * driveBlend;

  if (Math.abs(rawSteer) < 0.002 && Math.abs(steerValue) < 0.008) steerValue = 0;
  if (Math.abs(rawDrive) < 0.002 && Math.abs(driveValue) < 0.008) driveValue = 0;

  controllerDrive.connected = true;
  controllerDrive.steer = Math.max(-1, Math.min(1, steerValue));
  controllerDrive.drive = Math.max(-1, Math.min(1, driveValue));
  controllerDrive.active = Math.abs(rawSteer) > 0.025 || Math.abs(rawDrive) > 0.025
    || Math.abs(steerValue) > 0.035 || Math.abs(driveValue) > 0.035;

  requestAnimationFrame(updateAnalogDrive);
}

requestAnimationFrame(updateAnalogDrive);

// game-loader calls this hook after its own source transforms. Wrap the tech
// tree hook rather than competing with the fetch patch chain.
const previousPostPatch = globalThis.__mowPostPatchGameSource;
globalThis.__mowPostPatchGameSource = (input) => {
  let source = typeof previousPostPatch === "function" ? previousPostPatch(input) : input;
  const before = `  let steer = Number(input.right) - Number(input.left);\n  let drive = Number(input.forward) - Number(input.reverse);\n\n  if (autoMode) {`;
  const after = `  let steer = Number(input.right) - Number(input.left);\n  let drive = Number(input.forward) - Number(input.reverse);\n\n  const analogController = globalThis.__mowControllerDrive;\n  if (analogController?.active) {\n    if (autoMode) setAutoMode(false);\n    steer = analogController.steer;\n    drive = analogController.drive;\n  }\n\n  if (autoMode) {`;

  if (!source.includes(before)) {
    console.warn("[controller] analog driving source marker not found");
    return source;
  }
  return source.replace(before, after);
};
