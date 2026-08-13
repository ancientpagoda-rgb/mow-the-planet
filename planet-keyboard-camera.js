import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Capture the OrbitControls instance created by game.js without coupling this
// helper to the rest of the simulation's module-scoped camera state.
const originalOrbitUpdate = OrbitControls.prototype.update;
let orbitControls = null;

OrbitControls.prototype.update = function patchedOrbitUpdate(...args) {
  orbitControls = this;
  return originalOrbitUpdate.apply(this, args);
};

const arrowState = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
};

function planetViewActive() {
  return document.querySelector("#zoom-globe")?.classList.contains("is-on") === true;
}

function isArrowKey(key) {
  return Object.prototype.hasOwnProperty.call(arrowState, key);
}

function handleArrow(event, pressed) {
  if (!isArrowKey(event.key)) return;

  // Outside whole-planet view, leave arrow keys alone so the existing mower
  // controls keep working exactly as before.
  if (!planetViewActive() && !arrowState[event.key]) return;

  arrowState[event.key] = pressed;
  event.preventDefault();
  event.stopImmediatePropagation();
}

window.addEventListener("keydown", (event) => handleArrow(event, true), true);
window.addEventListener("keyup", (event) => handleArrow(event, false), true);
window.addEventListener("blur", () => {
  for (const key of Object.keys(arrowState)) arrowState[key] = false;
});

let previousTime = performance.now();
function updatePlanetKeyboardCamera(now) {
  const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;

  if (planetViewActive() && orbitControls?.enabled) {
    const horizontal = Number(arrowState.ArrowLeft) - Number(arrowState.ArrowRight);
    const vertical = Number(arrowState.ArrowUp) - Number(arrowState.ArrowDown);

    if (horizontal) orbitControls.rotateLeft(horizontal * 0.82 * dt);
    if (vertical) orbitControls.rotateUp(vertical * 0.68 * dt);
  } else {
    for (const key of Object.keys(arrowState)) arrowState[key] = false;
  }

  requestAnimationFrame(updatePlanetKeyboardCamera);
}

requestAnimationFrame(updatePlanetKeyboardCamera);
