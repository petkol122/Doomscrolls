import { makeInteractiveAndStopWorldInput, makeOverlayPassive } from "./worldSessionPointerEvents";

export function applyWorldSessionOverlayRootStyles(root: HTMLDivElement): void {
  makeOverlayPassive(root);
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "grid";
  root.style.gridTemplateColumns = "minmax(0, 1fr) auto";
  root.style.gridTemplateRows = "auto minmax(0, 1fr) auto";
  // Core 0.29 -- the middle-left cell was empty ("." in the old
  // template); the chat log docks there, bottom-anchored (see
  // `applyWorldSessionOverlayChatStyles`), sitting directly above the
  // orb cluster and clear of the right-hand dock column entirely.
  //
  // Core 0.4 HUD Overhaul -- the old "utility" column (top-right Micro
  // Menu icon bar) moved down into the bottom HUD dock
  // (`createHudSection` in worldSessionOverlayView.ts); this column is
  // now the persistent, collapsible Quest/Objective Tracker dock (see
  // `applyWorldSessionOverlayQuestStyles`).
  root.style.gridTemplateAreas = '"status quest" "chat quest" "hud hud"';
  root.style.alignItems = "start";
  // Root overlay stays passive so ground clicks still reach the Phaser canvas
  // through empty space. Interactive children opt back in via
  // `makeInteractiveAndStopWorldInput()` from `worldSessionPointerEvents`.
  root.style.fontFamily = "Arial, sans-serif";
  root.style.padding = "8px 10px 10px";
  root.style.gap = "6px";
  root.style.boxSizing = "border-box";
}

/** Core 0.4 HUD Overhaul -- the right-hand Quest/Objective Tracker dock,
 * replacing the old top-right Micro Menu icon column. Spans both the
 * status and chat rows (same grid area used across two template rows),
 * so it reads as one tall panel docked to the right edge. */
export function applyWorldSessionOverlayQuestStyles(panel: HTMLElement): void {
  makeOverlayPassive(panel);
  panel.style.gridArea = "quest";
  panel.style.display = "flex";
  panel.style.flexDirection = "column";
  panel.style.justifySelf = "end";
  panel.style.alignSelf = "start";
  panel.style.width = "min(260px, calc(100vw - 28px))";
  panel.style.maxWidth = "100%";
  panel.style.boxSizing = "border-box";
}

/** Core 0.4 HUD Overhaul -- hosts the Player Unit Frame and, beside it,
 * the Dynamic Target Frame (shown only while an enemy/NPC is
 * hovered/selected). A flex row rather than the old single-child grid
 * so the target frame can sit immediately to the frame's right without
 * needing its own grid column. */
export function applyWorldSessionOverlayStatusStyles(panel: HTMLElement): void {
  makeOverlayPassive(panel);
  panel.style.gridArea = "status";
  panel.style.display = "flex";
  panel.style.flexDirection = "row";
  panel.style.alignItems = "flex-start";
  panel.style.gap = "8px";
  panel.style.justifySelf = "start";
  panel.style.width = "auto";
  panel.style.maxWidth = "calc(100vw - 28px)";
}

/** Core 0.29 -- docks the chat log to the bottom-left, above the orb
 * cluster, clear of the corner-menu column. Persistent (not an
 * icon-flyout toggle, unlike Objectives/Inventory) since a live feed
 * being hideable would need its own unread-state design; sized to a
 * small footprint, `pointer-events` opted back in via
 * `makeInteractiveAndStopWorldInput` (see that function's own doc
 * comment) so typing/scrolling never leaks to the Phaser canvas. */
export function applyWorldSessionOverlayChatStyles(panel: HTMLElement): void {
  makeInteractiveAndStopWorldInput(panel);
  panel.style.gridArea = "chat";
  panel.style.alignSelf = "end";
  panel.style.justifySelf = "start";
  panel.style.width = "min(320px, calc(100vw - 28px))";
  panel.style.maxWidth = "100%";
  panel.style.boxSizing = "border-box";
}

export function applyWorldSessionOverlayHudStyles(panel: HTMLElement): void {
  makeOverlayPassive(panel);
  panel.style.gridArea = "hud";
  panel.style.display = "grid";
  panel.style.alignSelf = "end";
  panel.style.justifySelf = "center";
  // Core 0.21 -- widened for the orb + belt-strip cluster (HP orb, 5
  // belt slots, resource orb) sitting on one row; narrower viewports
  // wrap the cluster via flex-wrap in worldSessionOverlayView.ts.
  panel.style.width = "min(760px, calc(100vw - 32px))";
  panel.style.maxWidth = "100%";
}

export function applyWorldSessionOverlayPanelStyles(panel: HTMLElement): void {
  // Card sections are visible interactive panels. Task 242: combine
  // `pointer-events: auto` with capture-phase pointerdown / mousedown /
  // click / contextmenu stoppers so the panel reliably catches input
  // and never lets a click leak to the Phaser world canvas behind it.
  makeInteractiveAndStopWorldInput(panel);
  panel.style.padding = "6px 8px";
  panel.style.border = "1px solid #4d3f2a";
  panel.style.borderRadius = "12px";
  panel.style.background = "rgba(10, 8, 7, 0.86)";
  panel.style.color = "#d8c6a3";
  panel.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
  // Panels are display containers only; let canvas receive clicks in
  // the panel's empty area. Inner interactive children opt back in via
  // `pointerEvents: "auto"` on themselves (buttons, summaries, rows).
  panel.style.width = "100%";
  panel.style.maxWidth = "100%";
  panel.style.boxSizing = "border-box";
}

export function applyWorldSessionOverlayScrollablePanelStyles(panel: HTMLElement): void {
  // Same as the non-scrollable variant — card panels must stop world
  // input as well as enabling pointer events (see Task 242).
  applyWorldSessionOverlayPanelStyles(panel);
  panel.style.maxHeight = "calc(100vh - 28px)";
  panel.style.overflowY = "auto";
}

/** Core 0.25 -- the bottom HUD (orb cluster/belt/objective trackers)
 * floats directly over the game world with no visible container, matching
 * an ARPG HUD.
 *
 * Core 0.4x -- this wrapper spans the full HUD row width (100%), most of
 * which is transparent empty space over the world. It previously used
 * `makeInteractiveAndStopWorldInput`, which sets `pointer-events: auto`
 * on the *entire* box and stops every pointerdown/mousedown that lands
 * anywhere in it -- including the empty gaps between the HP orb, belt
 * and skill card. That silently ate held-movement drags and clicks the
 * moment the cursor neared the bottom of the screen, even in spots with
 * nothing drawn there. This panel itself must stay passive; only the
 * genuinely interactive descendant (the objective tracker's clear
 * button, via `makeInteractiveAndStopWorldInput` there) opts back in. */
export function applyWorldSessionOverlayFloatingHudStyles(panel: HTMLElement): void {
  makeOverlayPassive(panel);
  panel.style.background = "transparent";
  panel.style.border = "none";
  panel.style.boxShadow = "none";
  panel.style.padding = "0";
  panel.style.width = "100%";
  panel.style.maxWidth = "100%";
  panel.style.boxSizing = "border-box";
}

/** Core 0.26 -- a more ornate frame for the inventory/equipment panels,
 * replacing their previous flat single-color box (`border:1px solid
 * #31271c; background: rgba(12,10,8,0.56)`, same as every other plain
 * `createSectionBlock`). The confirmed art pack (`UI/` — see
 * docs/CORE_BUILD_0_26_PLAN.md) has rarity-colored slot frames but no
 * panel/window-chrome asset, so this is a CSS-only treatment (a
 * gradient ground, a warmer double-line border) rather than a real
 * asset -- not claimed as pack-sourced. Applied on top of whatever
 * `createSectionBlock` already set, same override pattern used
 * elsewhere in this file. */
export function applyWorldSessionOverlayItemPanelStyles(panel: HTMLElement): void {
  panel.style.border = "2px solid #6b5738";
  panel.style.borderRadius = "10px";
  panel.style.background = "linear-gradient(180deg, rgba(28, 22, 16, 0.94) 0%, rgba(14, 11, 8, 0.94) 100%)";
  panel.style.boxShadow = "inset 0 0 0 1px rgba(216, 198, 163, 0.15), 0 6px 16px rgba(0, 0, 0, 0.4)";
}
