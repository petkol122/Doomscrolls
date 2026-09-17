export function applyOverlayRootStyles(root: HTMLDivElement): void {
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.pointerEvents = "none";
  root.style.fontFamily = "Arial, sans-serif";
  root.style.padding = "16px";
  root.style.boxSizing = "border-box";
}

export function applyOverlayPanelStyles(panel: HTMLElement): void {
  panel.style.width = "min(1080px, calc(100vw - 32px))";
  panel.style.marginTop = "40px";
  panel.style.padding = "24px";
  panel.style.border = "1px solid #4d3f2a";
  panel.style.borderRadius = "12px";
  panel.style.background = "rgba(13, 10, 8, 0.94)";
  panel.style.color = "#d8c6a3";
  panel.style.boxShadow = "0 20px 70px rgba(0, 0, 0, 0.45)";
  panel.style.pointerEvents = "auto";
  panel.style.maxHeight = "calc(100vh - 80px)";
  panel.style.overflowY = "auto";
}
