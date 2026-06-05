import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { CharacterSummary, InventorySummaryItem, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getTownRoomPresence } from "../../../net/townRoomPresence";
import { createButton, createInfoLine } from "../accountShell/accountShellDom";
import type { WorldSessionDebugState } from "./worldSessionAreaView";
import {
  createEmptyEquipmentLoadout,
  createEquipmentPanelSection,
} from "./worldSessionEquipmentView";
import { makeInteractive } from "./worldSessionPointerEvents";
import type { EquipmentLoadout } from "@doomscrolls/shared";
import {
  applyWorldSessionOverlayPanelStyles,
  applyWorldSessionOverlayScrollablePanelStyles,
} from "./worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../../worldProjection";

export interface WorldSessionUtilityPanelOpenState {
  readonly controls: boolean;
  readonly equipment: boolean;
  readonly inventory: boolean;
  readonly debug: boolean;
}

export const DEFAULT_WORLD_SESSION_UTILITY_PANEL_OPEN_STATE: WorldSessionUtilityPanelOpenState = {
  controls: false,
  equipment: false,
  inventory: false,
  debug: false,
};

export interface WorldSessionOverlayView {
  readonly statusPanel: HTMLElement | null;
  readonly utilityPanel: HTMLElement;
  readonly hudPanel: HTMLElement;
  readonly getEquipmentLoadout: () => EquipmentLoadout;
  readonly setEquipmentLoadout: (loadout: EquipmentLoadout) => void;
  readonly update: (
    character: CharacterSummary | null,
    room: Room<DoomscrollsRoomState>,
    debugState: WorldSessionDebugState,
  ) => void;
}

export function createWorldSessionOverlayView(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onRespawn: () => void,
  onLeaveWorld: () => void,
  getUtilityState: () => WorldSessionUtilityPanelOpenState = () =>
    DEFAULT_WORLD_SESSION_UTILITY_PANEL_OPEN_STATE,
  onUtilityStateChange?: (next: WorldSessionUtilityPanelOpenState) => void,
  getEquipmentLoadout: () => EquipmentLoadout = () => createEmptyEquipmentLoadout(),
  onEquipmentLoadoutChange?: (loadout: EquipmentLoadout) => void,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
): WorldSessionOverlayView {
  let selectedInventoryItemId: InventorySummaryItem["itemInstanceId"] | null = character?.inventorySummaryItems?.[0]?.itemInstanceId ?? null;

  const buildStatusPanel = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
  ): HTMLElement | null => {
    if (nextCharacter === null) {
      return null;
    }
    const selfPresence = getTownRoomPresence(nextRoom.state as unknown as Record<string, unknown>)
      ?.players.find((player) => player.sessionId === nextRoom.sessionId);
    const selfDisplayName = selfPresence?.displayName
      ?? nextCharacter.characterName
      ?? t("world_session.selected_character");
    return createCharacterChip(nextCharacter, selfDisplayName, onLeaveWorld);
  };

  const buildHudPanel = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
  ): HTMLElement => {
    const selfPresence = getTownRoomPresence(nextRoom.state as unknown as Record<string, unknown>)
      ?.players.find((player) => player.sessionId === nextRoom.sessionId);
    const selfHpSummary = formatPlayerHpSummary(selfPresence?.hp, selfPresence?.maxHp);
    const selfHpRatio = resolvePlayerHpRatio(selfPresence?.hp, selfPresence?.maxHp);

    const panel = createCardSection();
    panel.style.display = "grid";
    panel.style.gap = "6px";
    panel.style.padding = "8px 12px";
    panel.appendChild(createHudSection(
      selfHpSummary,
      selfHpRatio,
      selfPresence?.lifeState,
      selfPresence?.flaskCharges,
      selfPresence?.maxFlaskCharges,
      selfPresence?.level ?? nextCharacter?.level ?? 1,
      selfPresence?.xp ?? nextCharacter?.xp ?? 0,
    ));

    if (selfPresence?.lifeState === "downed") {
      const downedNotice = createMutedText(t("world_session.downed_notice"));
      downedNotice.style.color = "#e3a6a6";
      panel.appendChild(downedNotice);

      const respawnButton = createButton(t("world_session.respawn"));
      respawnButton.style.marginTop = "4px";
      respawnButton.style.width = "220px";
      respawnButton.addEventListener("click", () => {
        onRespawn();
      });
      makeInteractive(respawnButton);
      panel.appendChild(respawnButton);
    }

    return panel;
  };

  const buildUtilityPanel = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
    nextDebugState: WorldSessionDebugState,
  ): HTMLElement => {
    const panel = createScrollableCardSection();
    panel.style.display = "grid";
    panel.style.gap = "8px";
    panel.style.alignContent = "start";

    const utilityState = getUtilityState();

    panel.appendChild(createControlsSection(utilityState.controls, (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), controls: open });
    }));
    panel.appendChild(createEquipmentPanelSection(
      getEquipmentLoadout,
      utilityState.equipment,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), equipment: open });
      },
    ));
    panel.appendChild(createInventoryPanelSection(
      nextCharacter,
      {
        getSelectedItemId: () => selectedInventoryItemId,
        onSelectItem: (itemId) => {
          selectedInventoryItemId = itemId;
        },
      },
      nextCharacter?.id ?? null,
      onEquipItem,
      utilityState.inventory,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), inventory: open });
      },
    ));
    panel.appendChild(
      createDebugPanel(
        nextRoom,
        formatTownRoomState(nextRoom.state),
        nextDebugState,
        onProjectionModeChange,
        utilityState.debug,
        (open) => {
          onUtilityStateChange?.({ ...getUtilityState(), debug: open });
        },
      ),
    );
    return panel;
  };

  const statusPanel = buildStatusPanel(character, room);
  const utilityPanel = buildUtilityPanel(character, room, debugState);
  const hudPanel = buildHudPanel(character, room);

  const update = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
    nextDebugState: WorldSessionDebugState,
  ): void => {
    if (statusPanel !== null) {
      const nextStatus = buildStatusPanel(nextCharacter, nextRoom);
      if (nextStatus !== null) {
        statusPanel.replaceWith(nextStatus);
      }
    }

    const nextHud = buildHudPanel(nextCharacter, nextRoom);
    hudPanel.replaceWith(nextHud);

    const nextUtility = buildUtilityPanel(nextCharacter, nextRoom, nextDebugState);
    utilityPanel.replaceWith(nextUtility);
  };

  return {
    statusPanel,
    utilityPanel,
    hudPanel,
    getEquipmentLoadout,
    setEquipmentLoadout: (loadout: EquipmentLoadout) => {
      onEquipmentLoadoutChange?.(loadout);
    },
    update,
  };
}

function createCharacterChip(
  character: CharacterSummary,
  displayName: string,
  onLeaveWorld: () => void,
): HTMLElement {
  const panel = createCardSection();
  panel.style.display = "flex";
  panel.style.alignItems = "center";
  panel.style.justifyContent = "space-between";
  panel.style.gap = "10px";
  panel.style.width = "min(260px, calc(100vw - 28px))";
  panel.style.padding = "8px 10px";

  const textBlock = document.createElement("div");
  textBlock.style.display = "grid";
  textBlock.style.gap = "2px";

  const nameLine = document.createElement("div");
  nameLine.textContent = character.characterName;
  nameLine.style.fontSize = "14px";
  nameLine.style.fontWeight = "bold";
  nameLine.style.color = "#f0ddbb";
  textBlock.appendChild(nameLine);

  const subLine = document.createElement("div");
  subLine.textContent = `${displayName} • ${t("character.level")} ${character.level}`;
  subLine.style.fontSize = "11px";
  subLine.style.color = "#b9d49a";
  textBlock.appendChild(subLine);

  panel.appendChild(textBlock);

  const leaveButton = createButton(t("world_entry.leave_world"));
  leaveButton.style.width = "auto";
  leaveButton.style.flex = "0 0 auto";
  leaveButton.style.padding = "4px 8px";
  leaveButton.style.fontSize = "11px";
  leaveButton.addEventListener("click", () => {
    onLeaveWorld();
  });
  makeInteractive(leaveButton);
  panel.appendChild(leaveButton);

  return panel;
}

function createControlsSection(isOpen: boolean, onOpenChange: (open: boolean) => void): HTMLElement {
  const details = document.createElement("details");
  details.open = isOpen;
  details.style.border = "1px solid #31271c";
  details.style.borderRadius = "8px";
  details.style.background = "rgba(12, 10, 8, 0.72)";
  makeInteractive(details);
  details.addEventListener("toggle", () => {
    onOpenChange(details.open);
  });

  const summary = document.createElement("summary");
  summary.textContent = `${t("world_session.controls")} / Help`;
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.flexWrap = "wrap";
  controls.style.gap = "6px";
  controls.style.padding = "0 8px 8px";

  const bindings: readonly { readonly key: string; readonly action: string }[] = [
    { key: "Click", action: t("world_session.control_move") },
    { key: "Click (enemy)", action: t("world_session.control_attack") },
    { key: "Click (loot)", action: "Pickup" },
    { key: "Click (object)", action: "Interact" },
    { key: "Space", action: t("world_session.control_dodge") },
    { key: "Q", action: t("world_session.control_flask") },
  ];

  for (const binding of bindings) {
    const chip = document.createElement("div");
    chip.style.display = "inline-flex";
    chip.style.alignItems = "center";
    chip.style.gap = "6px";
    chip.style.padding = "4px 7px";
    chip.style.border = "1px solid #4d3f2a";
    chip.style.borderRadius = "999px";
    chip.style.background = "rgba(24, 18, 13, 0.88)";

    const keyLabel = document.createElement("span");
    keyLabel.textContent = binding.key;
    keyLabel.style.color = "#e0c88a";
    keyLabel.style.fontWeight = "bold";
    keyLabel.style.fontSize = "10px";
    keyLabel.style.fontFamily = "monospace";
    chip.appendChild(keyLabel);

    const actionLabel = document.createElement("span");
    actionLabel.textContent = binding.action;
    actionLabel.style.color = "#b9d49a";
    actionLabel.style.fontSize = "10px";
    chip.appendChild(actionLabel);

    controls.appendChild(chip);
  }

  details.appendChild(controls);
  return details;
}

function createProjectionSection(
  debugState: WorldSessionDebugState,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
): HTMLElement {
  const wrapper = createSectionBlock(t("world_session.projection_title"), [], { compact: true });

  const description = createMutedText(t("world_session.projection_notice"));
  description.style.marginBottom = "8px";
  wrapper.appendChild(description);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  buttonRow.style.marginBottom = "8px";

  const topDownButton = createButton(t("world_session.projection_top_down"));
  topDownButton.style.flex = "1";
  topDownButton.disabled = debugState.projectionMode === "debug_top_down";
  topDownButton.addEventListener("click", () => {
    onProjectionModeChange("debug_top_down");
  });
  makeInteractive(topDownButton);

  const isometricButton = createButton(t("world_session.projection_isometric_preview"));
  isometricButton.style.flex = "1";
  isometricButton.disabled = debugState.projectionMode === "isometric_preview";
  isometricButton.addEventListener("click", () => {
    onProjectionModeChange("isometric_preview");
  });
  makeInteractive(isometricButton);

  buttonRow.append(topDownButton, isometricButton);
  wrapper.appendChild(buttonRow);

  wrapper.appendChild(
    createInfoLine(
      t("world_session.projection_current"),
      debugState.projectionMode === "debug_top_down"
        ? t("world_session.projection_top_down")
        : t("world_session.projection_isometric_preview"),
    ),
  );
  wrapper.appendChild(
    createInfoLine(
      t("world_session.projection_click_mode"),
      debugState.isMovementInputEnabled
        ? t("world_session.projection_click_top_down_only")
        : t("world_session.projection_click_disabled_preview"),
    ),
  );

  return wrapper;
}

function createCardSection(): HTMLElement {
  const section = document.createElement("section");
  applyWorldSessionOverlayPanelStyles(section);
  section.style.margin = "0";
  return section;
}

function createScrollableCardSection(): HTMLElement {
  const section = document.createElement("section");
  applyWorldSessionOverlayScrollablePanelStyles(section);
  section.style.margin = "0";
  return section;
}

function createSectionBlock(titleText: string, children: readonly HTMLElement[], options?: { readonly compact?: boolean }): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.style.margin = "0";
  wrapper.style.padding = options?.compact === true ? "7px 8px" : "8px";
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.56)";

  const title = document.createElement("h3");
  title.textContent = titleText;
  title.style.margin = "0 0 6px";
  title.style.fontSize = options?.compact === true ? "12px" : "13px";
  title.style.color = "#d8c6a3";
  wrapper.appendChild(title);

  for (const child of children) {
    wrapper.appendChild(child);
  }

  return wrapper;
}

function createPresenceSection(room: Room<DoomscrollsRoomState>): HTMLElement {
  const presence = getTownRoomPresence(room.state as unknown as Record<string, unknown>);
  const content: HTMLElement[] = [];

  if (presence === null) {
    content.push(createMutedText(t("world_session.no_presence")));
    return createSectionBlock(t("world_session.player_presence"), content, { compact: true });
  }

  if (presence.players.length === 0) {
    content.push(createMutedText(t("world_session.players_empty")));
    return createSectionBlock(t("world_session.player_presence"), content, { compact: true });
  }

  const playerList = document.createElement("ul");
  playerList.style.margin = "0";
  playerList.style.padding = "0 0 0 18px";
  playerList.style.color = "#b9d49a";
  playerList.style.fontSize = "11px";

  for (const player of presence.players) {
    const li = document.createElement("li");
    li.style.marginBottom = "4px";

    const details: string[] = [];
    if (player.spawnPointId !== undefined && player.spawnPointId.length > 0) {
      details.push(`spawn=${player.spawnPointId}`);
    }
    if (player.hp !== undefined && player.maxHp !== undefined) {
      details.push(`hp=${player.hp}/${player.maxHp}`);
    }
    if (player.lifeState !== undefined) {
      details.push(`state=${player.lifeState}`);
    }

    li.textContent = player.displayName + (details.length > 0 ? ` (${details.join(" | ")})` : "");
    playerList.appendChild(li);
  }

  content.push(playerList);
  return createSectionBlock(t("world_session.player_presence"), content, { compact: true });
}

function createMovementDebugSection(
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
): HTMLElement {
  const presence = getTownRoomPresence(room.state as unknown as Record<string, unknown>);
  const self = presence?.players.find((player) => player.sessionId === room.sessionId) ?? null;

  return createSectionBlock(t("world_session.movement_debug"), [
    createInfoLine(
      t("world_session.player_hp"),
      self?.hp !== undefined && self?.maxHp !== undefined
        ? formatPlayerHpSummary(self.hp, self.maxHp)
        : t("world_session.awaiting_player_hp"),
    ),
    createInfoLine(
      t("world_session.current_position"),
      self?.position !== undefined
        ? `x=${Math.round(self.position.x)}, y=${Math.round(self.position.y)}`
        : t("world_area.no_position"),
    ),
    createInfoLine(
      t("world_session.last_click_target"),
      debugState.lastClickTarget !== null
        ? `x=${debugState.lastClickTarget.x}, y=${debugState.lastClickTarget.y}`
        : t("world_session.awaiting_click_target"),
    ),
    createInfoLine(
      t("world_session.projection_current"),
      debugState.projectionMode === "debug_top_down"
        ? t("world_session.projection_top_down")
        : t("world_session.projection_isometric_preview"),
    ),
    createInfoLine(
      t("world_session.movement_speed"),
      self?.movementSpeed !== undefined
        ? String(self.movementSpeed)
        : t("world_session.awaiting_movement_speed"),
    ),
  ], { compact: true });
}

function createHudSection(
  hpSummary: string,
  hpRatio: number | null,
  lifeState?: "alive" | "downed",
  flaskCharges?: number,
  maxFlaskCharges?: number,
  level?: number,
  xp?: number,
): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.style.display = "grid";
  wrapper.style.gap = "8px";
  wrapper.style.gridTemplateColumns = "minmax(240px, 1.6fr) repeat(3, minmax(72px, auto))";
  wrapper.style.alignItems = "center";

  const hpLine = document.createElement("div");
  hpLine.style.display = "flex";
  hpLine.style.justifyContent = "space-between";
  hpLine.style.alignItems = "center";
  hpLine.style.marginBottom = "4px";

  const hpLabel = document.createElement("span");
  hpLabel.textContent = t("world_session.player_hp");
  hpLabel.style.color = "#d8c6a3";
  hpLabel.style.fontSize = "12px";
  hpLine.appendChild(hpLabel);

  const hpValue = document.createElement("span");
  hpValue.textContent = hpSummary;
  hpValue.style.color = lifeState === "downed" ? "#e3a6a6" : "#c8aa7a";
  hpValue.style.fontWeight = "bold";
  hpValue.style.fontSize = "14px";
  hpValue.style.fontFamily = "monospace";
  hpLine.appendChild(hpValue);

  const vitalityCard = document.createElement("div");
  vitalityCard.style.padding = "8px 10px";
  vitalityCard.style.border = "1px solid #4d2a2a";
  vitalityCard.style.borderRadius = "12px";
  vitalityCard.style.background = "linear-gradient(180deg, rgba(40, 12, 12, 0.92) 0%, rgba(20, 8, 8, 0.92) 100%)";
  vitalityCard.appendChild(hpLine);

  const barFrame = document.createElement("div");
  barFrame.style.width = "100%";
  barFrame.style.height = "14px";
  barFrame.style.border = "1px solid #5f4a2f";
  barFrame.style.borderRadius = "999px";
  barFrame.style.background = "rgba(22, 16, 14, 0.95)";
  barFrame.style.overflow = "hidden";
  barFrame.style.marginBottom = "6px";

  const barFill = document.createElement("div");
  barFill.style.height = "100%";
  barFill.style.width = hpRatio === null ? "0%" : `${Math.max(0, Math.min(100, hpRatio * 100))}%`;
  barFill.style.background = lifeState === "downed"
    ? "linear-gradient(90deg, #7a1f1f 0%, #bf5252 100%)"
    : hpRatio !== null && hpRatio <= 0.25
      ? "linear-gradient(90deg, #8f2a2a 0%, #d46262 100%)"
      : "linear-gradient(90deg, #6e2f1f 0%, #c46a3a 100%)";
  barFill.style.borderRadius = "999px";
  barFill.style.transition = "width 0.3s ease";
  barFrame.appendChild(barFill);
  vitalityCard.appendChild(barFrame);

  vitalityCard.appendChild(createFlaskChargesLine(flaskCharges, maxFlaskCharges));

  wrapper.appendChild(vitalityCard);

  wrapper.appendChild(createMiniHudStat("Resource", t("world_session.resource_placeholder")));
  wrapper.appendChild(createMiniHudStat(t("character.level"), String(level ?? 1)));
  wrapper.appendChild(createMiniHudStat(t("world_session.player_xp"), String(xp ?? 0)));

  return wrapper;
}

function createMiniHudStat(labelText: string, valueText: string): HTMLElement {
  const card = document.createElement("div");
  card.style.padding = "6px 8px";
  card.style.border = "1px solid #3c3122";
  card.style.borderRadius = "999px";
  card.style.background = "rgba(18, 14, 10, 0.9)";
  card.style.minWidth = "72px";
  card.style.textAlign = "center";

  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.fontSize = "10px";
  label.style.color = "#a88d63";
  card.appendChild(label);

  const value = document.createElement("div");
  value.textContent = valueText;
  value.style.fontSize = "11px";
  value.style.fontFamily = "monospace";
  value.style.fontWeight = "bold";
  value.style.color = "#d8c6a3";
  card.appendChild(value);

  return card;
}

function createFlaskChargesLine(charges?: number, maxCharges?: number): HTMLElement {
  if (charges === undefined || maxCharges === undefined) {
    const line = document.createElement("div");
    line.style.display = "flex";
    line.style.alignItems = "center";
    line.style.gap = "6px";

    const keyHint = document.createElement("span");
    keyHint.textContent = "[Q]";
    keyHint.style.color = "#7a5f4a";
    keyHint.style.fontWeight = "bold";
    keyHint.style.fontFamily = "monospace";
    keyHint.style.fontSize = "11px";
    keyHint.style.background = "rgba(63, 50, 30, 0.7)";
    keyHint.style.padding = "1px 5px";
    keyHint.style.borderRadius = "3px";
    line.appendChild(keyHint);

    const label = document.createElement("span");
    label.textContent = t("world_session.awaiting_flask");
    label.style.color = "#7a5f4a";
    label.style.fontSize = "12px";
    line.appendChild(label);
    return line;
  }

  const line = document.createElement("div");
  line.style.display = "flex";
  line.style.alignItems = "center";
  line.style.gap = "6px";
  line.style.marginTop = "2px";

  const keyHint = document.createElement("span");
  keyHint.textContent = "[Q]";
  keyHint.style.color = charges > 0 ? "#e0c88a" : "#7a5f4a";
  keyHint.style.fontWeight = "bold";
  keyHint.style.fontFamily = "monospace";
  keyHint.style.fontSize = "11px";
  keyHint.style.background = charges > 0 ? "rgba(63, 50, 30, 0.7)" : "rgba(40, 30, 20, 0.5)";
  keyHint.style.padding = "1px 5px";
  keyHint.style.borderRadius = "3px";
  line.appendChild(keyHint);

  // Mini flask charge dots
  const dotsWrapper = document.createElement("div");
  dotsWrapper.style.display = "flex";
  dotsWrapper.style.gap = "4px";
  dotsWrapper.style.alignItems = "center";

  for (let i = 0; i < maxCharges; i++) {
    const dot = document.createElement("span");
    const isFilled = i < charges;
    dot.textContent = "●";
    dot.style.color = isFilled ? "#b4512a" : "#3a2a1a";
    dot.style.fontSize = "14px";
    dot.style.lineHeight = "1";
    dotsWrapper.appendChild(dot);
  }

  line.appendChild(dotsWrapper);

  const fracLabel = document.createElement("span");
  fracLabel.textContent = `${charges} / ${maxCharges}`;
  fracLabel.style.color = charges > 0 ? "#b9d49a" : "#7a5f4a";
  fracLabel.style.fontSize = "11px";
  fracLabel.style.fontFamily = "monospace";
  line.appendChild(fracLabel);

  return line;
}

function createInventoryPanelSection(
  character: CharacterSummary | null,
  selection: {
    readonly getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null;
    readonly onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void;
  },
  characterId: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
  isOpen: boolean = false,
  onOpenChange?: (open: boolean) => void,
): HTMLElement {
  const items = character?.inventorySummaryItems ?? [];
  const wrapper = document.createElement("details");
  wrapper.open = isOpen;
  wrapper.addEventListener("toggle", () => {
    onOpenChange?.(wrapper.open);
  });
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.72)";
  wrapper.style.padding = "0";
  makeInteractive(wrapper);

  const summary = document.createElement("summary");
  summary.textContent = `Inventory (${items.length})`;
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "13px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  wrapper.appendChild(summary);

  const content = document.createElement("div");
  content.style.padding = "0 8px 8px";

  const render = (): void => {
    content.replaceChildren();
    const summarySection = createInventorySummarySection(items, () => selection.getSelectedItemId(), (itemId) => {
      selection.onSelectItem(itemId);
      render();
    });
    const selectedItem = items.find((item) => item.itemInstanceId === selection.getSelectedItemId()) ?? items[0] ?? null;
    if (selectedItem !== null) {
      selection.onSelectItem(selectedItem.itemInstanceId);
    }
    const detailSection = createInventoryDetailSection(selectedItem, characterId, onEquipItem);
    content.append(summarySection, detailSection);
  };

  render();
  wrapper.appendChild(content);
  return wrapper;
}

function createDebugPanel(
  room: Room<DoomscrollsRoomState>,
  roomState: ReturnType<typeof formatTownRoomState>,
  debugState: WorldSessionDebugState,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  isOpen: boolean = false,
  onOpenChange?: (open: boolean) => void,
): HTMLElement {
  const details = document.createElement("details");
  details.open = isOpen;
  details.addEventListener("toggle", () => {
    onOpenChange?.(details.open);
  });
  details.style.border = "1px solid #31271c";
  details.style.borderRadius = "8px";
  details.style.background = "rgba(12, 10, 8, 0.56)";
  makeInteractive(details);

  const summary = document.createElement("summary");
  summary.textContent = "Debug Panel";
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#a88d63";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "8px";

  content.appendChild(createSectionBlock(t("world_session.room_info"), [
    createInfoLine(t("world_session.room_kind"), roomState.roomKind),
    createInfoLine(t("world_session.zone_id"), roomState.zoneId),
    createInfoLine(t("world_session.connected_players"), String(roomState.playerCount)),
  ], { compact: true }));
  content.appendChild(createMovementDebugSection(room, debugState));
  content.appendChild(createPresenceSection(room));
  content.appendChild(createProjectionSection(debugState, onProjectionModeChange));

  details.appendChild(content);
  return details;
}

function formatPlayerHpSummary(hp?: number, maxHp?: number): string {
  if (hp === undefined || maxHp === undefined) {
    return t("world_session.awaiting_player_hp");
  }

  const safeMaxHp = Math.max(0, maxHp);
  const safeHp = Math.max(0, hp);
  const percent = safeMaxHp > 0 ? Math.round((safeHp / safeMaxHp) * 100) : 0;
  return `${safeHp} / ${safeMaxHp} (${percent}%)`;
}

function resolvePlayerHpRatio(hp?: number, maxHp?: number): number | null {
  if (hp === undefined || maxHp === undefined || maxHp <= 0) {
    return null;
  }

  return Math.max(0, Math.min(1, hp / maxHp));
}

function createInventorySummarySection(
  items: readonly InventorySummaryItem[],
  getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null,
  onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void,
): HTMLElement {
  if (items.length === 0) {
    return createSectionBlock("Inventory Summary", [createMutedText("No inventory items in bag.")], { compact: true });
  }

  const list = document.createElement("ul");
  list.style.margin = "0";
  list.style.padding = "0";
  list.style.color = "#d8c6a3";
  list.style.fontSize = "12px";

  for (const item of items) {
    const row = document.createElement("li");
    const isSelected = getSelectedItemId() === item.itemInstanceId;
    row.style.marginBottom = "6px";
    row.style.listStyle = "none";
    makeInteractive(row);

    const button = createButton(item.label);
    button.style.width = "100%";
    button.style.textAlign = "left";
    button.style.fontSize = "12px";
    button.style.padding = "6px 8px";
    button.style.border = isSelected ? "1px solid #b9d49a" : "1px solid #5f4a2f";
    button.style.background = isSelected ? "rgba(63, 83, 49, 0.9)" : "rgba(31, 24, 18, 0.95)";
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    const sizeText = item.size === undefined ? "" : ` | ${item.size.width}x${item.size.height}`;
    button.textContent = `${item.label}${sizeText}`;
    button.addEventListener("click", () => {
      onSelectItem(item.itemInstanceId);
    });
    makeInteractive(button);
    row.appendChild(button);
    list.appendChild(row);
  }

  return createSectionBlock("Inventory Summary", [list], { compact: true });
}

function createInventoryDetailSection(
  item: InventorySummaryItem | null,
  characterId: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
): HTMLElement {
  if (item === null) {
    return createSectionBlock("Item Detail", [createMutedText("Select an item to inspect it.")], { compact: true });
  }

  const children: HTMLElement[] = [
    createInfoLine("Label", item.label),
    createInfoLine("Category", item.category),
    createInfoLine("Size", item.size === undefined ? "Unknown" : `${item.size.width}x${item.size.height}`),
    createInfoLine("Grid Position", `page=${item.pageIndex}, x=${item.x}, y=${item.y}`),
  ];

  if ((item.statModifiers?.length ?? 0) > 0) {
    const modifierList = document.createElement("ul");
    modifierList.style.margin = "0";
    modifierList.style.padding = "0 0 0 18px";
    modifierList.style.color = "#d8c6a3";
    modifierList.style.fontSize = "12px";

    for (const modifier of item.statModifiers ?? []) {
      const entry = document.createElement("li");
      entry.textContent = `${modifier.operation === "add" ? "+" : "×"}${modifier.value} ${modifier.target}`;
      modifierList.appendChild(entry);
    }

    children.push(modifierList);
  } else {
    children.push(createMutedText("No item modifiers visible."));
  }

  // Add Equip button if the item is equip-capable (has statModifiers or non-material category)
  if (characterId !== null && onEquipItem !== undefined && item.category !== "flask" && item.category !== "material") {
    const equipRow = document.createElement("div");
    equipRow.style.marginTop = "8px";

    const equipButton = createButton("Equip");
    equipButton.style.width = "100%";
    equipButton.style.fontSize = "12px";
    equipButton.style.padding = "6px 8px";
    equipButton.style.background = "rgba(49, 65, 38, 0.9)";
    equipButton.style.border = "1px solid #6a8a4a";
    makeInteractive(equipButton);
    equipButton.addEventListener("click", async () => {
      equipButton.disabled = true;
      equipButton.textContent = "Equipping...";
      try {
        const firstSlot = item.allowedEquipmentSlots?.[0];
        if (firstSlot === undefined) {
          throw new Error("Item has no allowed equipment slots");
        }
        await onEquipItem(characterId, item.itemInstanceId, firstSlot);
        equipButton.textContent = "Equipped!";
      } catch {
        equipButton.textContent = "Failed";
        setTimeout(() => {
          equipButton.disabled = false;
          equipButton.textContent = "Equip";
        }, 2000);
      }
    });
    equipRow.appendChild(equipButton);
    children.push(equipRow);
  }

  return createSectionBlock("Item Detail", children, { compact: true });
}

export function createMutedText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "0";
  paragraph.style.color = "#a88d63";
  paragraph.style.fontSize = "12px";
  return paragraph;
}