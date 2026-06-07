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
