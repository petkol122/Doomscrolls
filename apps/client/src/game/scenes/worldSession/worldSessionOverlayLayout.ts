export function applyWorldSessionOverlayRootStyles(root: HTMLDivElement): void {
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "flex";
  root.style.alignItems = "flex-start";
  root.style.justifyContent = "space-between";
  root.style.gap = "12px";
  root.style.pointerEvents = "none";
  root.style.fontFamily = "Arial, sans-serif";
  root.style.padding = "12px";
  root.style.boxSizing = "border-box";
}

export function applyWorldSessionOverlayGroupStyles(group: HTMLElement): void {
  group.style.display = "flex";
  group.style.flexDirection = "column";
  group.style.alignItems = "flex-start";
  group.style.gap = "10px";
  group.style.maxWidth = "min(340px, calc(100vw - 24px))";
}

export function applyWorldSessionOverlayPanelStyles(panel: HTMLElement): void {
  panel.style.padding = "10px 12px";
  panel.style.border = "1px solid #4d3f2a";
  panel.style.borderRadius = "10px";
  panel.style.background = "rgba(13, 10, 8, 0.9)";
  panel.style.color = "#d8c6a3";
  panel.style.boxShadow = "0 10px 32px rgba(0, 0, 0, 0.35)";
  panel.style.pointerEvents = "auto";
  panel.style.maxWidth = "100%";
  panel.style.maxHeight = "calc(100vh - 24px)";
  panel.style.overflowY = "auto";
}
