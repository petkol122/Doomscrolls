import type { EquipmentSlot } from "@doomscrolls/shared";

/**
 * Pointer-driven drag-and-drop for the inventory/equipment panels.
 *
 * This used to be native HTML5 drag-and-drop (`draggable=true` +
 * dragstart/dragover/drop). That mostly worked because a browser's
 * native drag-start detection runs independently of JS event
 * propagation -- but a real `pointerdown`/`pointermove`/`pointerup`
 * implementation does NOT get that for free: every floating panel in
 * this codebase (`draggableWindow.ts`'s `createWindowChrome`, via
 * `makeInteractiveAndStopWorldInput`) attaches a CAPTURE-phase
 * `pointerdown` listener to the panel's root specifically to stop the
 * Phaser world canvas from ever seeing the event. Capture phase runs
 * outermost-node-first, so that root-level stopper fires and halts
 * propagation *before* the event would ever reach a plain listener
 * attached directly to an inventory item button -- a naive
 * `element.addEventListener("pointerdown", ...)` on the item itself
 * would simply never fire inside any of these windows.
 *
 * The fix: register draggable items in a module-level map and start
 * the drag from ONE capture-phase `pointerdown` listener on `window`
 * itself. `window` is the outermost node in the propagation path, so
 * its capture-phase listener always runs first, before any nested
 * panel's own root-level stopper gets a chance to halt propagation.
 * This listener never calls `stopPropagation()`, so the existing
 * per-panel world-input isolation and the item's own "click to select"
 * handler are both untouched for an ordinary (non-drag) click.
 *
 * This module only wires DOM/pointer events and calls the given
 * callbacks -- it never mutates inventory/equipment state itself.
 * Callers (the overlay/equipment views) are responsible for
 * dispatching the actual server request (equip/unequip/move), per the
 * server-authoritative rule -- nothing here assumes success or
 * updates local state.
 */

const DRAG_OVER_HIGHLIGHT = "0 0 0 2px #f0ddbb, 0 0 10px rgba(240, 221, 187, 0.8)";
const DRAG_START_THRESHOLD_PX = 4;

type DragPayload =
  | { readonly kind: "inventory-item"; readonly itemInstanceId: string; readonly allowedEquipmentSlots: readonly EquipmentSlot[] }
  | { readonly kind: "equipped-item"; readonly slot: EquipmentSlot };

interface DropZoneEntry {
  readonly element: HTMLElement;
  readonly accepts: (payload: DragPayload) => boolean;
  readonly onDrop: (payload: DragPayload) => void;
}

interface ActiveDrag {
  readonly pointerId: number;
  readonly payload: DragPayload;
  readonly sourceElement: HTMLElement;
  readonly preview: HTMLElement;
  readonly startClientX: number;
  readonly startClientY: number;
  started: boolean;
  hoveredZone: DropZoneEntry | null;
}

// Item -> payload, so the one window-level pointerdown listener below
// can recognize "this pointerdown landed on/inside a draggable item"
// without needing its own listener on the item (see module doc comment).
const draggableItems = new Map<HTMLElement, DragPayload>();
const dropZones: DropZoneEntry[] = [];

let activeDrag: ActiveDrag | null = null;
// The item a drag just ended on top of, so the browser's own
// subsequent synthetic "click" (fired after pointerup regardless of
// how far the pointer moved) doesn't also re-select/toggle the item.
let suppressNextClickOn: HTMLElement | null = null;

function pruneDisconnected<T extends { readonly element: HTMLElement }>(entries: T[]): void {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry !== undefined && !entry.element.isConnected) {
      entries.splice(i, 1);
    }
  }
}

function createDragPreview(sourceElement: HTMLElement): HTMLElement {
  const rect = sourceElement.getBoundingClientRect();
  const preview = document.createElement("div");
  preview.style.position = "fixed";
  preview.style.left = "0";
  preview.style.top = "0";
  preview.style.zIndex = "100000";
  preview.style.pointerEvents = "none";
  preview.style.width = `${rect.width}px`;
  preview.style.height = `${rect.height}px`;
  preview.style.opacity = "0.85";
  preview.style.borderRadius = "4px";
  preview.style.boxShadow = "0 6px 18px rgba(0, 0, 0, 0.55)";
  preview.style.background = getComputedStyle(sourceElement).backgroundColor;
  preview.innerHTML = sourceElement.innerHTML;
  document.body.appendChild(preview);
  return preview;
}

function positionDragPreview(preview: HTMLElement, clientX: number, clientY: number): void {
  const width = preview.offsetWidth;
  const height = preview.offsetHeight;
  preview.style.transform = `translate(${clientX - width / 2}px, ${clientY - height / 2}px)`;
}

function resolveZoneAtPoint(clientX: number, clientY: number, payload: DragPayload): DropZoneEntry | null {
  const elementUnderPointer = document.elementFromPoint(clientX, clientY);
  if (elementUnderPointer === null) {
    return null;
  }
  for (const zone of dropZones) {
    if (zone.accepts(payload) && zone.element.contains(elementUnderPointer)) {
      return zone;
    }
  }
  return null;
}

function endActiveDrag(dropClientX: number | null, dropClientY: number | null): void {
  if (activeDrag === null) {
    return;
  }
  const drag = activeDrag;
  activeDrag = null;
  window.removeEventListener("pointermove", onActiveDragPointerMove);
  window.removeEventListener("pointerup", onActiveDragPointerUp);
  window.removeEventListener("pointercancel", onActiveDragPointerCancel);
  drag.preview.remove();
  drag.sourceElement.style.opacity = "1";
  if (drag.hoveredZone !== null) {
    drag.hoveredZone.element.style.boxShadow = "none";
  }

  if (!drag.started) {
    return;
  }
  suppressNextClickOn = drag.sourceElement;

  if (dropClientX === null || dropClientY === null) {
    return;
  }
  const targetZone = resolveZoneAtPoint(dropClientX, dropClientY, drag.payload);
  targetZone?.onDrop(drag.payload);
}

function onActiveDragPointerMove(event: PointerEvent): void {
  if (activeDrag === null || event.pointerId !== activeDrag.pointerId) {
    return;
  }
  const drag = activeDrag;

  if (!drag.started) {
    const distance = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
    if (distance < DRAG_START_THRESHOLD_PX) {
      return;
    }
    drag.started = true;
    drag.sourceElement.style.opacity = "0.4";
  }

  positionDragPreview(drag.preview, event.clientX, event.clientY);

  pruneDisconnected(dropZones);
  const zone = resolveZoneAtPoint(event.clientX, event.clientY, drag.payload);
  if (zone !== drag.hoveredZone) {
    if (drag.hoveredZone !== null) {
      drag.hoveredZone.element.style.boxShadow = "none";
    }
    if (zone !== null) {
      zone.element.style.boxShadow = DRAG_OVER_HIGHLIGHT;
    }
    drag.hoveredZone = zone;
  }
}

function onActiveDragPointerUp(event: PointerEvent): void {
  if (activeDrag === null || event.pointerId !== activeDrag.pointerId) {
    return;
  }
  endActiveDrag(event.clientX, event.clientY);
}

function onActiveDragPointerCancel(event: PointerEvent): void {
  if (activeDrag === null || event.pointerId !== activeDrag.pointerId) {
    return;
  }
  endActiveDrag(null, null);
}

function beginDrag(sourceElement: HTMLElement, event: PointerEvent, payload: DragPayload): void {
  if (activeDrag !== null) {
    return;
  }
  activeDrag = {
    pointerId: event.pointerId,
    payload,
    sourceElement,
    preview: createDragPreview(sourceElement),
    startClientX: event.clientX,
    startClientY: event.clientY,
    started: false,
    hoveredZone: null,
  };
  positionDragPreview(activeDrag.preview, event.clientX, event.clientY);
  window.addEventListener("pointermove", onActiveDragPointerMove);
  window.addEventListener("pointerup", onActiveDragPointerUp);
  window.addEventListener("pointercancel", onActiveDragPointerCancel);
}

let globalListenersWired = false;

function ensureGlobalListenersWired(): void {
  if (globalListenersWired) {
    return;
  }
  globalListenersWired = true;

  // Capture phase on `window` -- see module doc comment for why this
  // has to be the outermost listener in the propagation path rather
  // than one attached directly to each item.
  window.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || activeDrag !== null || !(event.target instanceof Node)) {
      return;
    }
    for (const [element, payload] of draggableItems) {
      if (!element.isConnected) {
        draggableItems.delete(element);
        continue;
      }
      if (element.contains(event.target)) {
        beginDrag(element, event, payload);
        return;
      }
    }
  }, { capture: true });

  // The browser fires "click" after "pointerup" regardless of how far
  // the pointer traveled in between; suppress the one click that would
  // otherwise immediately re-toggle selection on the item we just
  // finished dragging.
  window.addEventListener("click", (event) => {
    if (suppressNextClickOn !== null && event.target instanceof Node && suppressNextClickOn.contains(event.target)) {
      event.stopPropagation();
      event.preventDefault();
    }
    suppressNextClickOn = null;
  }, { capture: true });
}

function registerDraggable(element: HTMLElement, payload: DragPayload): void {
  ensureGlobalListenersWired();
  element.style.pointerEvents = "auto";
  element.style.touchAction = "none";
  element.style.userSelect = "none";
  element.style.cursor = "grab";
  draggableItems.set(element, payload);
}

function registerDropZone(entry: DropZoneEntry): void {
  pruneDisconnected(dropZones);
  dropZones.push(entry);
}

/** Makes a bag item's slot element draggable. `allowedEquipmentSlots`
 * lets equipment-slot drop zones decide (during the drag) whether this
 * item can legally land there. */
export function makeInventoryItemDraggable(
  element: HTMLElement,
  itemInstanceId: string,
  allowedEquipmentSlots: readonly EquipmentSlot[] | undefined,
): void {
  registerDraggable(element, {
    kind: "inventory-item",
    itemInstanceId,
    allowedEquipmentSlots: allowedEquipmentSlots ?? [],
  });
}

/** Makes an equipped item's row draggable out of its slot, for
 * drag-to-unequip onto the inventory panel. */
export function makeEquippedItemDraggable(element: HTMLElement, slot: EquipmentSlot): void {
  registerDraggable(element, { kind: "equipped-item", slot });
}

/** Turns an equipment slot row into a drop target for bag items: only
 * accepts a drag whose item declared (via `makeInventoryItemDraggable`)
 * that it allows this slot, and calls `onDropItem` with the dragged
 * item's instance id on drop. */
export function makeEquipmentSlotDropZone(
  element: HTMLElement,
  slot: EquipmentSlot,
  onDropItem: (itemInstanceId: string) => void,
): void {
  registerDropZone({
    element,
    accepts: (payload) => payload.kind === "inventory-item" && payload.allowedEquipmentSlots.includes(slot),
    onDrop: (payload) => {
      if (payload.kind === "inventory-item") {
        onDropItem(payload.itemInstanceId);
      }
    },
  });
}

/** Turns a single inventory grid cell into a drop target for bag items,
 * so dragging an item onto another cell repositions it there. Fires
 * `onDropAtCell` with the dragged item's instance id and this cell's
 * page/x/y; the caller is responsible for sending the server-authoritative
 * `move_inventory_item` request -- nothing here assumes success. */
export function makeInventoryGridCellDropZone(
  element: HTMLElement,
  targetPageIndex: number,
  targetX: number,
  targetY: number,
  onDropAtCell: (itemInstanceId: string, targetPageIndex: number, targetX: number, targetY: number) => void,
): void {
  registerDropZone({
    element,
    accepts: (payload) => payload.kind === "inventory-item",
    onDrop: (payload) => {
      if (payload.kind === "inventory-item") {
        onDropAtCell(payload.itemInstanceId, targetPageIndex, targetX, targetY);
      }
    },
  });
}

/** Turns the inventory grid into a drop target for equipped items,
 * dropped there to unequip them. */
export function makeInventoryDropZone(
  element: HTMLElement,
  onDropEquippedSlot: (slot: EquipmentSlot) => void,
): void {
  registerDropZone({
    element,
    accepts: (payload) => payload.kind === "equipped-item",
    onDrop: (payload) => {
      if (payload.kind === "equipped-item") {
        onDropEquippedSlot(payload.slot);
      }
    },
  });
}
