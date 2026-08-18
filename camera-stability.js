import { OrbitControls } from "three/addons/controls/OrbitControls.js";

if (!globalThis.__mowCameraStabilityInstalled) {
  globalThis.__mowCameraStabilityInstalled = true;

  const previousUpdate = OrbitControls.prototype.update;
  const cameraState = new WeakMap();

  function planetViewActive() {
    return document.querySelector("#zoom-globe")?.classList.contains("is-on") === true;
  }

  function surfaceViewActive() {
    return document.querySelector("#surface-view")?.getAttribute("aria-pressed") === "true"
      || document.querySelector("#chase-view")?.getAttribute("aria-pressed") === "true";
  }

  OrbitControls.prototype.update = function stableCameraUpdate(...args) {
    let state = cameraState.get(this);
    if (!state) {
      state = {
        planetMinDistance: this.minDistance,
        planetMaxDistance: this.maxDistance,
      };
      cameraState.set(this, state);
    }

    globalThis.__mowOrbitControls = this;
    if (this.enabled && !surfaceViewActive()) {
      if (planetViewActive()) {
        this.minDistance = state.planetMinDistance;
        this.maxDistance = state.planetMaxDistance;
      } else {
        // Free orbit targets an object on the surface, not the planet center.
        // A planet-radius minDistance here forces every focus action far away.
        this.minDistance = 90;
        this.maxDistance = state.planetMaxDistance;
      }
      this.enablePan = false;
      this.zoomToCursor = false;
      this.enableDamping = true;
      this.dampingFactor = Math.min(0.1, Math.max(0.065, this.dampingFactor || 0.08));
    }

    const result = previousUpdate.apply(this, args);
    // The older camera controller turns zoom-to-cursor back on every frame.
    // Disable it after the wrapped update to prevent large target jumps.
    if (this.enabled && !surfaceViewActive()) this.zoomToCursor = false;
    return result;
  };

  function afterFrames(callback, frames = 2) {
    const step = () => {
      if (frames-- <= 0) callback();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function focusMower() {
    if (!globalThis.__mowRuntime?.focus) return;
    afterFrames(() => globalThis.__mowRuntime?.focus?.("worker"), 1);
  }

  function exitSpecialCameraAndFocus() {
    const planet = document.querySelector("#zoom-globe");
    const cockpit = document.querySelector("#surface-view");
    const chase = document.querySelector("#chase-view");
    if (planet?.classList.contains("is-on")) planet.click();
    if (cockpit?.getAttribute("aria-pressed") === "true") cockpit.click();
    if (chase?.getAttribute("aria-pressed") === "true") chase.click();
    focusMower();
  }

  function installCameraUi() {
    const nav = document.querySelector(".zoom-controls");
    if (!nav || document.querySelector("#camera-reset")) return;

    const reset = document.createElement("button");
    reset.id = "camera-reset";
    reset.type = "button";
    reset.textContent = "MOWER";
    reset.setAttribute("aria-label", "Reset camera to the mower");
    nav.insertBefore(reset, nav.querySelector("#zoom-globe"));
    reset.addEventListener("click", exitSpecialCameraAndFocus);

    const planet = document.querySelector("#zoom-globe");
    const cockpit = document.querySelector("#surface-view");
    const chase = document.querySelector("#chase-view");

    planet?.addEventListener("click", () => {
      afterFrames(() => {
        if (!planet.classList.contains("is-on")) focusMower();
      }, 1);
    });
    cockpit?.addEventListener("click", () => {
      afterFrames(() => {
        if (cockpit.getAttribute("aria-pressed") !== "true") focusMower();
      }, 1);
    });
    chase?.addEventListener("click", () => {
      afterFrames(() => {
        if (chase.getAttribute("aria-pressed") !== "true") focusMower();
      }, 1);
    });

    document.querySelector("#start-button")?.addEventListener("click", () => afterFrames(focusMower, 3));
    const hint = document.querySelector("#hint");
    if (hint) hint.textContent = "Camera: drag to orbit · wheel or pinch to zoom · MOWER resets the view";

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (planet?.classList.contains("is-on") || cockpit?.getAttribute("aria-pressed") === "true" || chase?.getAttribute("aria-pressed") === "true") {
        exitSpecialCameraAndFocus();
      }
    });

    focusMower();
  }

  if (globalThis.__mowRuntimeReady) installCameraUi();
  else window.addEventListener("mow-runtime-ready", installCameraUi, { once: true });
}
