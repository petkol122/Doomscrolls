import { makeInteractiveAndStopWorldInput } from "./worldSessionPointerEvents";

// ---------------------------------------------------------------------------
// Core 0.1 UI Overhaul Phase 2 -- shared chrome for every floating modal
// window (Inventory, Character, Skill Tree, Vendor, Stash): a title bar
// with a drag handle and a close button, click-anywhere-to-focus
// z-ordering, and the same world-input isolation every other overlay
// panel already uses.
// ---------------------------------------------------------------------------

let zIndexCounter = 20000;

/** Raises `root` above every other open window. Called on every
 *  pointerdown inside a window (not just the title bar), so clicking
 *  anywhere in a window brings it to front. */
export function bringWindowToFront(root: HTMLElement): void {
  zIndexCounter += 1;
  root.style.zIndex = String(zIndexCounter);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Wires `handle` (typically the window's title bar) to drag `root`
 *  around the viewport, and brings `root` to front on any pointerdown
 *  inside it. `root` must be `position: fixed`.
 *
 * Both behaviors live in ONE capture-phase pointerdown listener attached
 * directly to `root` (rather than a separate listener on `handle`)
 * because `makeInteractiveAndStopWorldInput(root)` already attaches its
 * own capture-phase pointerdown stopper to `root` that calls
 * `stopPropagation()` -- which would prevent the event from ever
 * reaching a descendant's own listener at all. Two listeners on the
 * *same* node/phase don't block each other (only propagation to
 * *other* nodes is stopped), so both run here. This is the same
 * stop/prevent idiom every other panel already uses, and coexists with
 * the native HTML5 item drag-and-drop these windows host
 * (worldSessionItemDragDrop.ts) exactly as it already does today. */
export function makeWindowDraggable(root: HTMLElement, handle: HTMLElement): void {
  makeInteractiveAndStopWorldInput(root);
  handle.style.cursor = "move";
  handle.style.userSelect = "none";

  let dragPointerId: number | null = null;
  let startClientX = 0;
  let startClientY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== dragPointerId) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const nextLeft = clamp(startLeft + (event.clientX - startClientX), 0, window.innerWidth - rect.width);
    const nextTop = clamp(startTop + (event.clientY - startClientY), 0, window.innerHeight - rect.height);
    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
    root.style.right = "auto";
    root.style.bottom = "auto";
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== dragPointerId) {
      return;
    }
    dragPointerId = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  root.addEventListener("pointerdown", (event) => {
    bringWindowToFront(root);
    if (!(event.target instanceof Node) || !handle.contains(event.target)) {
      return;
    }
    // Some callers center `root` with `transform: translate(...)` instead
    // of explicit left/top (e.g. a modal card centered in its backdrop).
    // Clear that before measuring, or the first pixel-based left/top this
    // drag sets would double up with the still-active transform offset.
    root.style.transform = "none";
    const rect = root.getBoundingClientRect();
    dragPointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, { capture: true });
}

/** Wires `grip` (typically a small corner handle) to resize `root` by
 *  dragging, and brings `root` to front on any pointerdown inside it
 *  (via the SAME capture-phase listener idiom `makeWindowDraggable`
 *  uses -- see its own doc comment: a plain `grip.addEventListener`
 *  would never fire here, since `makeInteractiveAndStopWorldInput`
 *  already stops pointerdown from propagating past `root` in capture
 *  phase before it could ever reach a descendant. Attaching directly
 *  to `root` itself, alongside the drag listener, sidesteps that).
 *  `root` must be `position: fixed` with an explicit pixel `width`.
 *
 *  `measureMinSize` is called fresh at the start of every resize
 *  gesture (not just once) so the floor tracks the window's CURRENT
 *  content -- e.g. the Inventory grid's fixed pixel size -- instead of
 *  a stale value from whenever the window was first built. Without
 *  this, dragging the grip could shrink the window below its own
 *  content, clipping the grid/buttons with no way to reach them. */
export function makeWindowResizable(
  root: HTMLElement,
  grip: HTMLElement,
  measureMinSize: () => { readonly minWidth: number; readonly minHeight: number },
): void {
  grip.style.cursor = "nwse-resize";
  grip.style.userSelect = "none";

  let resizePointerId: number | null = null;
  let startClientX = 0;
  let startClientY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let minWidth = 0;
  let minHeight = 0;

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== resizePointerId) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const maxWidth = window.innerWidth - rect.left;
    const maxHeight = window.innerHeight - rect.top;
    const nextWidth = clamp(startWidth + (event.clientX - startClientX), minWidth, maxWidth);
    const nextHeight = clamp(startHeight + (event.clientY - startClientY), minHeight, maxHeight);
    root.style.width = `${nextWidth}px`;
    root.style.height = `${nextHeight}px`;
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== resizePointerId) {
      return;
    }
    resizePointerId = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };

  root.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Node) || !grip.contains(event.target)) {
      return;
    }
    bringWindowToFront(root);
    // Height starts as `auto` (sized by content, capped by `maxHeight`)
    // until the first resize -- measure the box's current rendered
    // size before switching to an explicit pixel height so the window
    // doesn't jump.
    const rect = root.getBoundingClientRect();
    const measured = measureMinSize();
    minWidth = measured.minWidth;
    minHeight = measured.minHeight;
    resizePointerId = event.pointerId;
    startClientX = event.clientX;
    startClientY = event.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    root.style.height = `${rect.height}px`;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, { capture: true });
}

export interface WindowChrome {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  readonly setTitle: (title: string) => void;
  /** Shows `root`. Must be used instead of clearing `root.hidden`
   *  directly -- `root` also carries an inline `display: flex` (needed so
   *  its flex-column layout applies while visible), and an inline style
   *  always wins over the UA stylesheet's `[hidden] { display: none }`
   *  rule. Toggling only `root.hidden` therefore has no visual effect. */
  readonly setVisible: (visible: boolean) => void;
}

/** Builds one floating window's chrome: an opaque (non-transparent),
 *  bordered frame with a draggable title bar + working close button,
 *  and a scrollable body the caller fills with its own content.
 *  Positioned/sized by the caller via `left`/`top`/`width`. */
export function createWindowChrome(options: {
  readonly title: string;
  readonly onClose: () => void;
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly minWidth?: number;
  readonly minHeight?: number;
}): WindowChrome {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.left = options.left;
  root.style.top = options.top;
  root.style.width = options.width;
  root.style.maxWidth = "calc(100vw - 24px)";
  root.style.maxHeight = "calc(100vh - 24px)";
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.border = "1px solid #4d3f2a";
  root.style.borderRadius = "10px";
  root.style.background = "rgba(12, 10, 8, 0.97)";
  root.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.55)";
  root.style.overflow = "hidden";
  root.style.fontFamily = "Arial, sans-serif";
  root.style.boxSizing = "border-box";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "10px";
  header.style.padding = "7px 10px";
  header.style.background = "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)";
  header.style.borderBottom = "1px solid #4d3f2a";
  header.style.flex = "0 0 auto";

  const titleEl = document.createElement("div");
  titleEl.textContent = options.title;
  titleEl.style.color = "#f0dec0";
  titleEl.style.fontWeight = "bold";
  titleEl.style.fontSize = "13px";
  titleEl.style.whiteSpace = "nowrap";
  titleEl.style.overflow = "hidden";
  titleEl.style.textOverflow = "ellipsis";
  header.appendChild(titleEl);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "✕";
  closeButton.title = "Close";
  closeButton.style.flex = "0 0 auto";
  closeButton.style.border = "1px solid #6b5738";
  closeButton.style.borderRadius = "4px";
  closeButton.style.background = "rgba(14, 11, 8, 0.85)";
  closeButton.style.color = "#e0c88a";
  closeButton.style.fontSize = "11px";
  closeButton.style.lineHeight = "1";
  closeButton.style.padding = "4px 8px";
  closeButton.style.cursor = "pointer";
  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    options.onClose();
  });
  header.appendChild(closeButton);

  const body = document.createElement("div");
  body.style.padding = "8px";
  body.style.overflowY = "auto";
  body.style.overflowX = "hidden";
  body.style.boxSizing = "border-box";
  body.style.flex = "1 1 auto";
  body.style.color = "#d8c6a3";
  body.style.minHeight = "0";

  const resizeGrip = document.createElement("div");
  resizeGrip.title = "Drag to resize";
  resizeGrip.style.position = "absolute";
  resizeGrip.style.right = "0";
  resizeGrip.style.bottom = "0";
  resizeGrip.style.width = "16px";
  resizeGrip.style.height = "16px";
  resizeGrip.style.opacity = "0.85";
  resizeGrip.style.background = "repeating-linear-gradient(135deg, transparent 0px 3px, #8a7550 3px 4px)";
  resizeGrip.style.clipPath = "polygon(100% 0, 100% 100%, 0 100%)";

  root.append(header, body, resizeGrip);
  makeWindowDraggable(root, header);
  makeWindowResizable(root, resizeGrip, () => ({
    // `scrollWidth`/`scrollHeight` report an element's true content
    // extent even while it's currently clipping/scrolling that content
    // (e.g. `body`'s own `overflow-y: auto`), so this floor always
    // reflects the real content -- a fixed-size grid, a button row,
    // whatever the caller put in `body` right now -- not a fixed
    // number that goes stale the moment that content changes.
    minWidth: Math.max(options.minWidth ?? 0, header.scrollWidth, body.scrollWidth),
    minHeight: Math.max(options.minHeight ?? 0, header.offsetHeight + body.scrollHeight),
  }));

  const setVisible = (visible: boolean): void => {
    root.hidden = !visible;
    root.style.display = visible ? "flex" : "none";
  };

  return {
    root,
    body,
    setTitle: (title: string) => {
      titleEl.textContent = title;
    },
    setVisible,
  };
}
