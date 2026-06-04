// Tiny helpers to keep pointer-events rules consistent across the
// WorldSession overlay.
//
// Rule of thumb:
//   - The root overlay + visual wrappers stay `pointer-events: none` so the
//     Phaser canvas can still receive ground clicks through the empty space.
//   - Every interactive control (buttons, <details>/<summary>, inputs, list
//     items) opts back in via `pointer-events: auto`.
//
// Centralising this avoids the recurring "some UI buttons don't work" bug
// where one panel rebuild forgets to re-enable pointer-events on a child.

export function makeInteractive<T extends HTMLElement>(element: T): T {
  element.style.pointerEvents = "auto";
  return element;
}

export function makePassive<T extends HTMLElement>(element: T): T {
  element.style.pointerEvents = "none";
  return element;
}
