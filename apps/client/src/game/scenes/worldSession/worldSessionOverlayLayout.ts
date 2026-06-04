export function applyWorldSessionOverlayRootStyles(root: HTMLDivElement): void {
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "flex";
  root.style.alignItems = "flex-start";
  root.style.justifyContent = "flex-end";
  root.style.pointerEvents = "none";
  root.style.fontFamily = "Arial, sans-serif";
  root.style.padding = "16px";
  root.style.boxSizing = "border-box";
}

export function applyWorldSessionOverlaySidebarStyles(sidebar: HTMLElement): void {
  sidebar.style.display = "flex";
  sidebar.style.flexDirection = "column";
  sidebar.style.alignItems = "stretch";
  sidebar.style.gap = "10px";
  sidebar.style.width = "min(300px, calc(100vw - 32px))";
  sidebar.style.maxHeight = "calc(100vh - 32px)";
}

export function applyWorldSessionOverlayPanelStyles(panel: HTMLElement): void {
  panel.style.padding = "10px 12px";
  panel.style.border = "1px solid #4d3f2a";
  panel.style.borderRadius = "10px";
  panel.style.background = "rgba(13, 10, 8, 0.9)";
  panel.style.color = "#d8c6a3";
  panel.style.boxShadow = "0 10px 32px rgba(0, 0, 0, 0.35)";
  panel.style.pointerEvents = "auto";
  panel.style.width = "100%";
  panel.style.maxWidth = "100%";
  panel.style.maxHeight = "calc(100vh - 32px)";
  panel.style.overflowY = "auto";
  panel.style.boxSizing = "border-box";
}
