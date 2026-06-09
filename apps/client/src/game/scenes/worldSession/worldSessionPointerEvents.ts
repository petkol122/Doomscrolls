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

// Task 275 — Fixed capture-phase click/contextmenu handlers that were preventing
// child elements (Leave button, inventory item buttons, unequip buttons) from
// ever receiving their click events. The fix removes capture-phase click and
// contextmenu handlers and replaces them with bubble-phase equivalents.
// pointerdown and mousedown are still stopped in capture phase so the Phaser
// world canvas never receives pointer events from panel elements.
export function makeInteractiveAndStopWorldInput<T extends HTMLElement>(element: T): T {
  element.style.pointerEvents = "auto";

  const stopAndPrevent = (event: Event): void => {
    event.stopPropagation();
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  const stop = (event: Event): void => {
    event.stopPropagation();
  };

  // Capture-phase handlers: stop pointerdown/mousedown before they reach the
  // world canvas input system. This prevents world movement/attack from
  // triggering when the user clicks on a panel.
  element.addEventListener("pointerdown", stopAndPrevent, { capture: true });
  element.addEventListener("mousedown", stopAndPrevent, { capture: true });

  // Bubble-phase handlers: prevent click/contextmenu from propagating past
  // the panel, but only AFTER child elements have received their own click
  // event. Without this fix, capture-phase click stopPropagation was killing
  // clicks on all child buttons (Leave, inventory items, unequip, etc.).
  element.addEventListener("click", stop);
  element.addEventListener("contextmenu", stop);

  return element;
}