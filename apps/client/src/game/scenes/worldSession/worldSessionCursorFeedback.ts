/**
 * Task 314 — World Cursor Target Feedback
 *
 * Lightweight hover indicator showing what the player's cursor is pointing
 * at. Uses a single Phaser text object updated only on POINTER_MOVE.
 * No per-frame object creation or destruction.
 */

import Phaser from "phaser";

export type HoverTargetType =
  | "enemy"
  | "loot"
  | "interactable"
  | "own_corpse"
  | "ground";

export interface HoverTargetInfo {
  readonly type: HoverTargetType;
  readonly label?: string;
}

export interface HoverTargetInfoWithLabel extends HoverTargetInfo {
  readonly label: string;
}

export interface WorldSessionCursorFeedback {
  readonly updateHover: (info: HoverTargetInfo | null) => void;
  readonly setPosition: (x: number, y: number) => void;
  readonly setVisible: (visible: boolean) => void;
  readonly getCurrentHover: () => HoverTargetInfo | null;
  readonly destroy: () => void;
}

const HOVER_LABEL_OFFSET_Y = -48;

function getHoverLabel(info: HoverTargetInfo): string {
  switch (info.type) {
    case "enemy":
      return info.label !== undefined
        ? `[Attack] ${info.label}`
        : "[Attack]";
    case "loot":
      return info.label !== undefined
        ? `[Pick up] ${info.label}`
        : "[Pick up]";
    case "interactable":
      return info.label !== undefined
        ? `[Interact] ${info.label}`
        : "[Interact]";
    case "own_corpse":
      return "[Recover corpse]";
    case "ground":
      return "[Move]";
  }
}

function getHoverLabelColor(info: HoverTargetInfo): string {
  switch (info.type) {
    case "enemy":
      return "#ff6b6b";
    case "loot":
      return "#ffe7a8";
    case "interactable":
      return "#d8c6a3";
    case "own_corpse":
      return "#5aeaea";
    case "ground":
      return "#8d7958";
  }
}

export function createWorldSessionCursorFeedback(
  scene: Phaser.Scene,
  parentContainer?: Phaser.GameObjects.Container,
): WorldSessionCursorFeedback {
  const label = scene.add.text(0, 0, "", {
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    fontSize: "11px",
    fontStyle: "bold",
    stroke: "#000000",
    strokeThickness: 3,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: { left: 5, right: 5, top: 2, bottom: 2 },
  }).setOrigin(0.5, 1).setDepth(10_000);

  // Small arrow indicator below the label
  const arrow = scene.add.text(0, 0, "", {
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    fontSize: "8px",
    fontStyle: "bold",
    stroke: "#000000",
    strokeThickness: 2,
  }).setOrigin(0.5).setDepth(10_000);

  parentContainer?.add([label, arrow]);

  let currentHover: HoverTargetInfo | null = null;

  const updateHover = (info: HoverTargetInfo | null): void => {
    currentHover = info;
    if (info === null) {
      label.setText("");
      arrow.setText("");
      return;
    }

    const text = getHoverLabel(info);
    const color = getHoverLabelColor(info);
    label.setStyle({
      color,
      fontFamily: "Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 3,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      padding: { left: 5, right: 5, top: 2, bottom: 2 },
    });
    label.setText(text);
    arrow.setText("▼");
    arrow.setColor(color);

    // Center the arrow below the label
    const labelBounds = label.getBounds();
    arrow.setPosition(labelBounds.centerX, labelBounds.bottom);
  };

  const setPosition = (x: number, y: number): void => {
    label.setPosition(x, y + HOVER_LABEL_OFFSET_Y);

    // Update arrow position relative to label's new position
    if (currentHover !== null && label.text.length > 0) {
      const labelBounds = label.getBounds();
      arrow.setPosition(labelBounds.centerX, labelBounds.bottom);
    } else {
      arrow.setPosition(x, y + HOVER_LABEL_OFFSET_Y + 12);
    }
  };

  const setVisible = (visible: boolean): void => {
    label.setVisible(visible);
    arrow.setVisible(visible);
  };

  // Start hidden
  setVisible(false);

  return {
    updateHover,
    setPosition,
    setVisible,
    getCurrentHover: () => currentHover,
    destroy: () => {
      label.destroy();
      arrow.destroy();
    },
  };
}