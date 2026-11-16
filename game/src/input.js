// Keyboard and pointer input. Held keys give a steering direction and the aim comes
// from the mouse; one-shot presses (start or restart, pause, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never lost and
// never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter']);
const FIRE = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;

  function keydown(event) {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (FIRE.has(event.code)) {
      // Space fires — and on the title / end screens it also starts the game.
      keys.add(event.code);
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  }

  function keyup(event) {
    keys.delete(event.code);
  }

  function pointermove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  }

  function pointerdown(event) {
    pointermove(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  }

  function pointerup() {
    mouseDown = false;
  }

  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', pointermove);
  canvas.addEventListener('pointerdown', pointerdown);
  window.addEventListener('pointerup', pointerup);

  return {
    /** Move direction, each component -1, 0 or 1, normalised by the world. */
    move() {
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const y = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      return { x, y };
    },
    /** Whether the player is holding fire (mouse button or Space). */
    firing() {
      return mouseDown || keys.has('Space');
    },
    /** The mouse position in canvas CSS pixels, or null before the mouse moves. */
    mouse() {
      return mouseSeen ? { x: mouseX, y: mouseY } : null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
