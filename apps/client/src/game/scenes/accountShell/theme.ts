// Shared dark ARPG theme tokens for the auth/character-select DOM overlays,
// so AuthScene and AccountShellScene stop hand-copying the same color/radius
// literals per file.

export const theme = {
  color: {
    panelBg: "rgba(13, 10, 8, 0.94)",
    panelBgAlt: "rgba(18, 14, 11, 0.92)",
    cardBg: "rgba(25, 19, 14, 0.9)",
    cardBgSelected: "rgba(46, 60, 31, 0.72)",
    border: "#4d3f2a",
    borderSubtle: "#3d3324",
    borderSelected: "#b9d49a",
    borderDanger: "#8d3a2f",
    inputBg: "#130f0c",
    inputBorder: "#5f4a2f",
    inputBorderFocus: "#c79f5a",
    inputBorderError: "#c14a35",
    textHeading: "#ffe6bd",
    textBody: "#d8c6a3",
    textMuted: "#a88d63",
    textSecondary: "#c7ad84",
    textStat: "#e0c88a",
    textError: "#ff9c8a",
    textSuccess: "#b9d49a",
    buttonBg: "#5a311f",
    buttonBorder: "#8d6a35",
    buttonText: "#ffe6bd",
    buttonDangerBg: "#3a2f22",
    buttonDangerBorder: "#8d3a2f",
    buttonDangerText: "#ff9c8a",
    shadow: "0 20px 70px rgba(0, 0, 0, 0.45)"
  },
  font: {
    heading: "Georgia, serif",
    body: "Arial, sans-serif"
  },
  radius: {
    panel: "12px",
    control: "8px"
  }
} as const;

export function hexColorToCss(hexColor: number): string {
  return `#${hexColor.toString(16).padStart(6, "0")}`;
}
