import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// This module is intentionally idempotent because game-bootstrap.js may import
// it under an older cache key after game-loader.js has already preloaded it.
if (!globalThis.__mowPlanetCameraControllerInstalled) {
  globalThis.__mowPlanetCameraControllerInstalled = true;

  const originalOrbitUpdate = OrbitControls.prototype.update;
  let orbitControls = null;
  const configuredControls = new WeakSet();

  function configureOrbitControls(controls) {
    if (!controls || configuredControls.has(controls)) return;
    configuredControls.add(controls);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.rotateSpeed = 0.64;
    controls.zoomSpeed = 0.78;
    controls.zoomToCursor = true;
    controls.minPolarAngle = 0.025;
    controls.maxPolarAngle = Math.PI - 0.025;
  }

  OrbitControls.prototype.update = function patchedOrbitUpdate(...args) {
    orbitControls = this;
    configureOrbitControls(this);
    return originalOrbitUpdate.apply(this, args);
  };

  const arrowState = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
  };

  const controllerKeyState = new Map();
  const controllerButtonState = new Map();
  let orbitVelocityX = 0;
  let orbitVelocityY = 0;
  let surfacePointerActive = false;
  let surfacePointerX = 0;
  let surfacePointerY = 0;
  let activeGamepadIndex = null;
  let controllerStatus = null;
  let controllerHintBase = null;
  const SURFACE_POINTER_ID = 90210;

  function planetViewActive() {
    return document.querySelector("#zoom-globe")?.classList.contains("is-on") === true;
  }

  function cockpitViewActive() {
    return document.querySelector("#surface-view")?.getAttribute("aria-pressed") === "true";
  }

  function chaseViewActive() {
    return document.querySelector("#chase-view")?.getAttribute("aria-pressed") === "true";
  }

  function surfaceViewActive() {
    return cockpitViewActive() || chaseViewActive();
  }

  function isArrowKey(key) {
    return Object.prototype.hasOwnProperty.call(arrowState, key);
  }

  function handleArrow(event, pressed) {
    if (!isArrowKey(event.key)) return;

    // In planet view arrows orbit the world. In all other views the game's
    // existing mower controls keep receiving them.
    if (!planetViewActive() && !arrowState[event.key]) return;

    arrowState[event.key] = pressed;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  window.addEventListener("keydown", (event) => handleArrow(event, true), true);
  window.addEventListener("keyup", (event) => handleArrow(event, false), true);

  function deadzone(value, size = 0.18) {
    const magnitude = Math.abs(value || 0);
    if (magnitude <= size) return 0;
    return Math.sign(value) * Math.min(1, (magnitude - size) / (1 - size));
  }

  function gamepadButton(pad, index) {
    const button = pad?.buttons?.[index];
    if (!button) return 0;
    return typeof button.value === "number" ? button.value : Number(button.pressed);
  }

  function dispatchKey(key, code, pressed) {
    const signature = `${key}|${code}`;
    if (controllerKeyState.get(signature) === pressed) return;
    controllerKeyState.set(signature, pressed);
    window.dispatchEvent(new KeyboardEvent(pressed ? "keydown" : "keyup", {
      key,
      code,
      bubbles: true,
      cancelable: true,
    }));
  }

  function releaseControllerKeys() {
    dispatchKey("a", "KeyA", false);
    dispatchKey("d", "KeyD", false);
    dispatchKey("w", "KeyW", false);
    dispatchKey("s", "KeyS", false);
    dispatchKey("Shift", "ShiftLeft", false);
    dispatchKey(" ", "Space", false);
  }

  function buttonPressedOnce(pad, index, action) {
    const pressed = gamepadButton(pad, index) > 0.55;
    const wasPressed = controllerButtonState.get(index) === true;
    controllerButtonState.set(index, pressed);
    if (pressed && !wasPressed) action();
  }

  function exitSpecialCamera() {
    if (planetViewActive()) document.querySelector("#zoom-globe")?.click();
    if (cockpitViewActive()) document.querySelector("#surface-view")?.click();
    if (chaseViewActive()) document.querySelector("#chase-view")?.click();
  }

  function selectCamera(mode) {
    if (mode === "orbit") {
      exitSpecialCamera();
      return;
    }
    if (mode === "planet") {
      if (planetViewActive()) return;
      exitSpecialCamera();
      document.querySelector("#zoom-globe")?.click();
      return;
    }
    if (mode === "cockpit") {
      if (cockpitViewActive()) return;
      exitSpecialCamera();
      document.querySelector("#surface-view")?.click();
      return;
    }
    if (mode === "chase") {
      if (chaseViewActive()) return;
      exitSpecialCamera();
      document.querySelector("#chase-view")?.click();
    }
  }

  function cycleCamera() {
    if (planetViewActive()) return selectCamera("orbit");
    if (cockpitViewActive()) return selectCamera("planet");
    if (chaseViewActive()) return selectCamera("cockpit");
    return selectCamera("chase");
  }

  function dispatchSurfacePointer(type, x, y) {
    const target = type === "pointerdown" ? document.querySelector("#sim") : window;
    if (!target || typeof PointerEvent === "undefined") return;
    target.dispatchEvent(new PointerEvent(type, {
      pointerId: SURFACE_POINTER_ID,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    }));
  }

  function endSurfacePointer() {
    if (!surfacePointerActive) return;
    dispatchSurfacePointer("pointerup", surfacePointerX, surfacePointerY);
    surfacePointerActive = false;
  }

  function applySurfaceStick(x, y, dt) {
    const strength = Math.max(Math.abs(x), Math.abs(y));
    if (!surfaceViewActive() || strength < 0.04) {
      endSurfacePointer();
      return;
    }

    if (!surfacePointerActive) {
      surfacePointerX = window.innerWidth * 0.5;
      surfacePointerY = window.innerHeight * 0.5;
      dispatchSurfacePointer("pointerdown", surfacePointerX, surfacePointerY);
      surfacePointerActive = true;
    }

    surfacePointerX += x * 880 * dt;
    surfacePointerY += y * 760 * dt;
    dispatchSurfacePointer("pointermove", surfacePointerX, surfacePointerY);

    if (Math.abs(surfacePointerX) > 12000 || Math.abs(surfacePointerY) > 12000) {
      endSurfacePointer();
    }
  }

  function dispatchWheel(amount) {
    const canvas = document.querySelector("#sim");
    if (!canvas || Math.abs(amount) < 0.01) return;
    canvas.dispatchEvent(new WheelEvent("wheel", {
      deltaY: amount,
      deltaMode: WheelEvent.DOM_DELTA_PIXEL,
      bubbles: true,
      cancelable: true,
    }));
  }

  function controllerStatusElement() {
    if (controllerStatus?.isConnected) return controllerStatus;
    controllerStatus = document.createElement("div");
    controllerStatus.id = "controller-status";
    controllerStatus.style.cssText = "position:fixed;z-index:12;left:calc(12px + var(--safe-left));bottom:calc(12px + var(--safe-bottom));padding:6px 9px;border:1px solid rgba(120,168,143,.38);border-radius:10px;background:rgba(11,15,14,.82);color:var(--jade);font:800 8px/1.2 system-ui,sans-serif;letter-spacing:.08em;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .2s,transform .2s";
    controllerStatus.textContent = "CONTROLLER CONNECTED";
    document.body.append(controllerStatus);
    return controllerStatus;
  }

  function showControllerStatus(connected, name = "") {
    const status = controllerStatusElement();
    status.textContent = connected ? `CONTROLLER · ${String(name || "GAMEPAD").replace(/\s*\([^)]*\)\s*/g, " ").trim().slice(0, 28)}` : "CONTROLLER DISCONNECTED";
    status.style.opacity = "1";
    status.style.transform = "translateY(0)";
    clearTimeout(showControllerStatus.timer);
    showControllerStatus.timer = setTimeout(() => {
      status.style.opacity = "0";
      status.style.transform = "translateY(4px)";
    }, connected ? 3600 : 1800);

    const hint = document.querySelector("#hint");
    if (hint) {
      controllerHintBase ??= hint.textContent;
      hint.textContent = connected
        ? `${controllerHintBase} · Controller: RT/LT drive · LS steer · RS camera · A boost · B brake · X auto · Y camera`
        : controllerHintBase;
    }
  }

  window.addEventListener("gamepadconnected", (event) => {
    activeGamepadIndex = event.gamepad.index;
    showControllerStatus(true, event.gamepad.id);
  });

  window.addEventListener("gamepaddisconnected", (event) => {
    if (activeGamepadIndex === event.gamepad.index) activeGamepadIndex = null;
    controllerButtonState.clear();
    releaseControllerKeys();
    endSurfacePointer();
    showControllerStatus(false);
  });

  function currentGamepad() {
    const pads = navigator.getGamepads?.() || [];
    if (activeGamepadIndex !== null && pads[activeGamepadIndex]?.connected) return pads[activeGamepadIndex];
    const pad = Array.from(pads).find((candidate) => candidate?.connected);
    if (pad) activeGamepadIndex = pad.index;
    return pad || null;
  }

  function updateGamepad(dt) {
    const pad = currentGamepad();
    if (!pad) {
      releaseControllerKeys();
      endSurfacePointer();
      return { cameraX: 0, cameraY: 0 };
    }

    const steer = deadzone(pad.axes?.[0], 0.16);
    const leftY = deadzone(pad.axes?.[1], 0.2);
    const cameraX = deadzone(pad.axes?.[2], 0.14);
    const cameraY = deadzone(pad.axes?.[3], 0.14);
    const leftTrigger = gamepadButton(pad, 6);
    const rightTrigger = gamepadButton(pad, 7);

    // Triggers are the primary throttle controls; left-stick Y remains a
    // convenient fallback for controllers whose triggers do not expose analog values.
    const forward = Math.max(rightTrigger, leftTrigger < 0.12 ? Math.max(0, -leftY) : 0);
    const reverse = Math.max(leftTrigger, rightTrigger < 0.12 ? Math.max(0, leftY) : 0);

    dispatchKey("a", "KeyA", steer < -0.16);
    dispatchKey("d", "KeyD", steer > 0.16);
    dispatchKey("w", "KeyW", forward > 0.16 && reverse < 0.72);
    dispatchKey("s", "KeyS", reverse > 0.16 && forward < 0.72);
    dispatchKey("Shift", "ShiftLeft", gamepadButton(pad, 0) > 0.45); // A / Cross: boost
    dispatchKey(" ", "Space", gamepadButton(pad, 1) > 0.45); // B / Circle: e-brake

    buttonPressedOnce(pad, 2, () => document.querySelector("#auto-toggle")?.click()); // X / Square
    buttonPressedOnce(pad, 3, cycleCamera); // Y / Triangle
    buttonPressedOnce(pad, 12, () => selectCamera("planet"));
    buttonPressedOnce(pad, 13, () => selectCamera("cockpit"));
    buttonPressedOnce(pad, 14, () => selectCamera("orbit"));
    buttonPressedOnce(pad, 15, () => selectCamera("chase"));

    // Bumpers zoom in every camera mode, including cockpit/follow where the
    // main game owns the camera and listens for wheel input itself.
    const zoom = gamepadButton(pad, 4) - gamepadButton(pad, 5);
    if (Math.abs(zoom) > 0.2) dispatchWheel(zoom * 520 * dt);

    applySurfaceStick(cameraX, cameraY, dt);
    return { cameraX: surfaceViewActive() ? 0 : cameraX, cameraY: surfaceViewActive() ? 0 : cameraY };
  }

  let previousTime = performance.now();
  function updateCameraAndController(now) {
    const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;

    const gamepad = updateGamepad(dt);
    const keyboardX = planetViewActive() ? Number(arrowState.ArrowLeft) - Number(arrowState.ArrowRight) : 0;
    const keyboardY = planetViewActive() ? Number(arrowState.ArrowUp) - Number(arrowState.ArrowDown) : 0;
    const desiredX = keyboardX - gamepad.cameraX;
    const desiredY = keyboardY - gamepad.cameraY;
    const smoothing = 1 - Math.exp(-12 * dt);
    orbitVelocityX += (desiredX - orbitVelocityX) * smoothing;
    orbitVelocityY += (desiredY - orbitVelocityY) * smoothing;

    if (orbitControls?.enabled) {
      configureOrbitControls(orbitControls);
      orbitControls.zoomToCursor = !planetViewActive();
      if (Math.abs(orbitVelocityX) > 0.002) orbitControls.rotateLeft(orbitVelocityX * 1.18 * dt);
      if (Math.abs(orbitVelocityY) > 0.002) orbitControls.rotateUp(orbitVelocityY * 0.96 * dt);
    } else {
      orbitVelocityX *= Math.exp(-14 * dt);
      orbitVelocityY *= Math.exp(-14 * dt);
    }

    if (!planetViewActive()) {
      for (const key of Object.keys(arrowState)) arrowState[key] = false;
    }

    requestAnimationFrame(updateCameraAndController);
  }

  window.addEventListener("blur", () => {
    for (const key of Object.keys(arrowState)) arrowState[key] = false;
    releaseControllerKeys();
    endSurfacePointer();
  });

  requestAnimationFrame(updateCameraAndController);
}
