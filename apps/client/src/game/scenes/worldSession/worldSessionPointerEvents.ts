// Small shared pointer-events convention for DOM overlays:
// - auth/account modal overlays are interactive
// - world root/layout wrappers are passive so canvas clicks still pass through
// - world controls opt back in explicitly

export function makeOverlayInteractive<T extends HTMLElement>(element: T): T {
  element.style.pointerEvents = "auto";
  return element;
}

export function makeOverlayPassive<T extends HTMLElement>(element: T): T {
  element.style.pointerEvents = "none";
  return element;
}

export const makeInteractive = makeOverlayInteractive;
export const makePassive = makeOverlayPassive;

// Task 242 — Shared helper for visible interactive panel roots.
// Using pointer-events: auto alone is not enough to keep click-through
// reliable across browser / Phaser input edge cases. The helper also
// installs pointerdown / mousedown / click capture-phase stoppers so
// that any pointer-down inside a visible panel is consumed before it
// can reach the Phaser world canvas / canvas-level pointer event
// listener. `pointer-events: auto` is still applied so the panel
// actually receives the events in the first place.
export function makeInteractiveAndStopWorldInput<T extends HTMLElement>(element: T): T {
  element.style.pointerEvents = "auto";

  const stop = (event: Event): void => {
    event.stopPropagation();
  };

  const stopAndPrevent = (event: Event): void => {
    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  element.addEventListener("pointerdown", stopAndPrevent, { capture: true });
  element.addEventListener("mousedown", stopAndPrevent, { capture: true });
  element.addEventListener("click", stop, { capture: true });
  element.addEventListener("contextmenu", stop, { capture: true });

  return element;
}
