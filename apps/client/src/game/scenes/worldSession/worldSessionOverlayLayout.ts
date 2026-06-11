import { makeInteractiveAndStopWorldInput, makeOverlayPassive } from "./worldSessionPointerEvents";

export function applyWorldSessionOverlayRootStyles(root: HTMLDivElement): void {
  makeOverlayPassive(root);
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "grid";
  root.style.gridTemplateColumns = "minmax(0, 1fr) auto";
  root.style.gridTemplateRows = "auto minmax(0, 1fr) auto";
  root.style.gridTemplateAreas = '"status utility" ". utility" "hud hud"';
  root.style.alignItems = "start";
  // Root overlay stays passive so ground clicks still reach the Phaser canvas
  // through empty space. Interactive children opt back in via
  // `makeInteractiveAndStopWorldInput()` from `worldSessionPointerEvents`.
  root.style.fontFamily = "Arial, sans-serif";
  root.style.padding = "8px 10px 10px";
  root.style.gap = "6px";
  root.style.boxSizing = "border-box";
}

export function applyWorldSessionOverlayUtilityStyles(panel: HTMLElement): void {
  makeOverlayPassive(panel);
  panel.style.gridArea = "utility";
  panel.style.display = "grid";
  panel.style.alignContent = "start";
  panel.style.gap = "8px";
  panel.style.justifySelf = "end";
  panel.style.width = "min(280px, calc(100vw - 28px))";
  panel.style.maxHeight = "calc(100vh - 28px)";
}

export function applyWorldSessionOverlayStatusStyles(panel: HTMLElement): void {
  makeOverlayPassive(panel);
  panel.style.gridArea = "status";
  panel.style.display = "grid";
  panel.style.alignContent = "start";
  panel.style.gap = "8px";
  panel.style.justifySelf = "start";
  panel.style.width = "min(260px, calc(100vw - 28px))";
}

export function applyWorldSessionOverlayHudStyles(panel: HTMLElement): void {
  makeOverlayPassive(panel);
  panel.style.gridArea = "hud";
  panel.style.display = "grid";
  panel.style.alignSelf = "end";
  panel.style.justifySelf = "center";
  panel.style.width = "min(680px, calc(100vw - 32px))";
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
