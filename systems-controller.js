// Controller/keyboard shortcuts for the systems dock. Kept separate from the
// driving camera helper so new simulation UI does not couple to mower input.
const pressed = new Map();

function buttonDown(pad, index) {
  const button = pad?.buttons?.[index];
  return Boolean(button && (button.pressed || button.value > 0.55));
}

function once(pad, index, action) {
  const down = buttonDown(pad, index);
  const wasDown = pressed.get(index) === true;
  pressed.set(index, down);
  if (down && !wasDown) action();
}

function togglePause() {
  const paused = (globalThis.__mowTimeScale ?? 1) === 0;
  document.querySelector(`[data-sim-speed="${paused ? 1 : 0}"]`)?.click();
}

function openTech() {
  document.querySelector("#tech-toggle")?.click();
}

function poll() {
  const pad = Array.from(navigator.getGamepads?.() || []).find((candidate) => candidate?.connected);
  if (pad) {
    once(pad, 8, openTech);    // Back / Share / Create
    once(pad, 9, togglePause); // Start / Options
  } else {
    pressed.clear();
  }
  requestAnimationFrame(poll);
}

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
  if (event.key === "p" || event.key === "P") {
    togglePause();
    event.preventDefault();
  } else if (event.key === "t" || event.key === "T") {
    openTech();
    event.preventDefault();
  }
});

requestAnimationFrame(poll);
