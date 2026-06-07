import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { CharacterSummary, InventorySummaryItem, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import type { StatModifier } from "@doomscrolls/shared";
import type { EquipmentSlot } from "@doomscrolls/shared";

import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getCurrentPlayerPresence, getTownRoomPresence } from "../../../net/townRoomPresence";
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

const COMMON_ITEM_COLOR = "#d8c6a3";
const COMMON_ITEM_ACCENT_COLOR = "#a88d63";

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
  onResetObjective: () => void,
  onLeaveWorld: () => void,
  getUtilityState: () => WorldSessionUtilityPanelOpenState = () =>
    DEFAULT_WORLD_SESSION_UTILITY_PANEL_OPEN_STATE,
  onUtilityStateChange?: (next: WorldSessionUtilityPanelOpenState) => void,
  getEquipmentLoadout: () => EquipmentLoadout = () => createEmptyEquipmentLoadout(),
  onEquipmentLoadoutChange?: (loadout: EquipmentLoadout) => void,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
  onUnequipItem?: (characterId: string, slot: string) => Promise<void>,
): WorldSessionOverlayView {
  let selectedInventoryItemId: InventorySummaryItem["itemInstanceId"] | null = character?.inventorySummaryItems?.[0]?.itemInstanceId ?? null;
  let currentStatusPanel: HTMLElement | null = null;
  let currentUtilityPanel: HTMLElement;
  let currentHudPanel: HTMLElement;

  const buildStatusPanel = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
  ): HTMLElement | null => {
    if (nextCharacter === null) {
      return null;
    }
    const selfPresence = getCurrentPlayerPresence(
      nextRoom.state as unknown as Record<string, unknown>,
      nextRoom.sessionId,
    );
    const selfDisplayName = selfPresence?.displayName
      ?? nextCharacter.characterName
      ?? t("world_session.selected_character");
    return createCharacterChip(
      nextCharacter,
      selfDisplayName,
      selfPresence?.level ?? nextCharacter.level,
      onLeaveWorld,
    );
  };

  const buildHudPanel = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
  ): HTMLElement => {
    const selfPresence = getCurrentPlayerPresence(
      nextRoom.state as unknown as Record<string, unknown>,
      nextRoom.sessionId,
    );
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
      selfPresence?.objective ?? null,
      onResetObjective,
    ));
    panel.appendChild(createSkillSlotPlaceholder());

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
      () => nextCharacter?.inventorySummaryItems ?? [],
      utilityState.equipment,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), equipment: open });
      },
      nextCharacter?.id !== undefined && onUnequipItem !== undefined
        ? (slot) => onUnequipItem(nextCharacter.id, slot)
        : undefined,
    ));
    panel.appendChild(createDerivedStatsSection(nextCharacter));
    panel.appendChild(createInventoryPanelSection(
      nextCharacter,
      {
        getSelectedItemId: () => selectedInventoryItemId,
        onSelectItem: (itemId) => {
          selectedInventoryItemId = itemId;
        },
      },
      getEquipmentLoadout(),
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
  currentStatusPanel = statusPanel;
  currentUtilityPanel = utilityPanel;
  currentHudPanel = hudPanel;

  const update = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
    nextDebugState: WorldSessionDebugState,
  ): void => {
    if (currentStatusPanel !== null) {
      const nextStatus = buildStatusPanel(nextCharacter, nextRoom);
      if (nextStatus !== null) {
        currentStatusPanel.replaceWith(nextStatus);
        currentStatusPanel = nextStatus;
      }
    } else {
      currentStatusPanel = buildStatusPanel(nextCharacter, nextRoom);
    }

    const nextHud = buildHudPanel(nextCharacter, nextRoom);
    currentHudPanel.replaceWith(nextHud);
    currentHudPanel = nextHud;

    const nextUtility = buildUtilityPanel(nextCharacter, nextRoom, nextDebugState);
    currentUtilityPanel.replaceWith(nextUtility);
    currentUtilityPanel = nextUtility;
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
  level: number,
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

  const zoneLine = document.createElement("div");
  zoneLine.textContent = "The Nightmarket";
  zoneLine.style.fontSize = "12px";
  zoneLine.style.fontWeight = "bold";
  zoneLine.style.color = "#d8c6a3";
  textBlock.appendChild(zoneLine);

  const testCombatLine = document.createElement("div");
  testCombatLine.textContent = "Temporary test combat zone";
  testCombatLine.style.fontSize = "10px";
  testCombatLine.style.color = "#a88d63";
  textBlock.appendChild(testCombatLine);

  const nameLine = document.createElement("div");
  nameLine.textContent = character.characterName;
  nameLine.style.fontSize = "14px";
  nameLine.style.fontWeight = "bold";
  nameLine.style.color = "#f0ddbb";
  textBlock.appendChild(nameLine);

  const subLine = document.createElement("div");
  subLine.textContent = `${displayName} • ${t("character.level")} ${level}`;
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
  const self = getCurrentPlayerPresence(
    room.state as unknown as Record<string, unknown>,
    room.sessionId,
  );

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
  objective?: {
    readonly label: string;
    readonly current: number;
    readonly target: number;
    readonly completed: boolean;
  } | null,
  onResetObjective?: () => void,
): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.style.display = "grid";
  wrapper.style.gap = "8px";
  wrapper.style.gridTemplateColumns = "minmax(240px, 1.6fr) repeat(2, minmax(72px, auto))";
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

  if (objective !== undefined && objective !== null) {
    wrapper.appendChild(createObjectiveTrackerCard(objective, onResetObjective));
  }

  wrapper.appendChild(createMiniHudStat("Resource", t("world_session.resource_placeholder")));
  wrapper.appendChild(createMiniHudStat(t("character.level"), String(level ?? 1)));
  wrapper.appendChild(createMiniHudStat(t("world_session.player_xp"), String(xp ?? 0)));

  return wrapper;
}

function createDerivedStatsSection(character: CharacterSummary | null): HTMLElement {
  const details = document.createElement("details");
  details.style.border = "1px solid #31271c";
  details.style.borderRadius = "8px";
  details.style.background = "rgba(12, 10, 8, 0.72)";
  details.style.padding = "0";
  makeInteractive(details);

  const summary = document.createElement("summary");
  summary.textContent = "Derived Stats";
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "6px";

  const stats = character?.stats;
  if (stats === undefined) {
    content.appendChild(createMutedText("Derived stats unavailable."));
    details.appendChild(content);
    return details;
  }

  const chipRow = document.createElement("div");
  chipRow.style.display = "flex";
  chipRow.style.flexWrap = "wrap";
  chipRow.style.gap = "6px";

  chipRow.appendChild(createCompactStatChip("Move", formatMoveSpeed(stats.derived.moveSpeed)));
  chipRow.appendChild(createCompactStatChip("Atk", `${Math.round(stats.derived.attackCooldownMs)} ms`));
  chipRow.appendChild(createCompactStatChip("HP", `${Math.max(0, stats.currentHp)} / ${Math.max(0, stats.derived.maxHp)}`));

  content.appendChild(chipRow);
  details.appendChild(content);
  return details;
}

function createCompactStatChip(labelText: string, valueText: string): HTMLElement {
  const chip = document.createElement("div");
  chip.style.display = "inline-flex";
  chip.style.alignItems = "center";
  chip.style.gap = "6px";
  chip.style.padding = "4px 7px";
  chip.style.border = "1px solid #3c3122";
  chip.style.borderRadius = "999px";
  chip.style.background = "rgba(18, 14, 10, 0.88)";

  const label = document.createElement("span");
  label.textContent = labelText;
  label.style.color = "#a88d63";
  label.style.fontSize = "10px";
  chip.appendChild(label);

  const value = document.createElement("span");
  value.textContent = valueText;
  value.style.color = "#d8c6a3";
  value.style.fontSize = "10px";
  value.style.fontFamily = "monospace";
  value.style.fontWeight = "bold";
  chip.appendChild(value);

  return chip;
}

function formatMoveSpeed(moveSpeed: number): string {
  if (!Number.isFinite(moveSpeed)) {
    return "—";
  }

  return moveSpeed.toFixed(2);
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

function createObjectiveTrackerCard(objective: {
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
}, onResetObjective?: () => void): HTMLElement {
  const card = document.createElement("div");
  card.style.display = "grid";
  card.style.gap = "4px";
  card.style.padding = "8px 10px";
  card.style.border = objective.completed ? "1px solid #4f6b3d" : "1px solid #5a4727";
  card.style.borderRadius = "12px";
  card.style.background = objective.completed
    ? "linear-gradient(180deg, rgba(20, 34, 18, 0.92) 0%, rgba(14, 22, 12, 0.92) 100%)"
    : "linear-gradient(180deg, rgba(32, 24, 14, 0.92) 0%, rgba(18, 14, 10, 0.92) 100%)";
  card.style.minWidth = "176px";

  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.alignItems = "center";
  topRow.style.justifyContent = "space-between";
  topRow.style.gap = "8px";

  const title = document.createElement("div");
  title.textContent = "Objective";
  title.style.fontSize = "10px";
  title.style.color = objective.completed ? "#9fca8b" : "#c5a874";
  topRow.appendChild(title);

  const state = document.createElement("div");
  state.textContent = objective.completed ? "Complete" : "Active";
  state.style.fontSize = "10px";
  state.style.fontWeight = "bold";
  state.style.textTransform = "uppercase";
  state.style.color = objective.completed ? "#b9e5a8" : "#e0c88a";
  topRow.appendChild(state);

  card.appendChild(topRow);

  const trackerLine = document.createElement("div");
  trackerLine.textContent = `${objective.label}: ${objective.current}/${objective.target}`;
  trackerLine.style.fontSize = "12px";
  trackerLine.style.fontWeight = "bold";
  trackerLine.style.color = objective.completed ? "#d8f0c8" : "#f0ddbb";
  card.appendChild(trackerLine);

  const progressFrame = document.createElement("div");
  progressFrame.style.width = "100%";
  progressFrame.style.height = "8px";
  progressFrame.style.border = objective.completed ? "1px solid #567546" : "1px solid #5f4a2f";
  progressFrame.style.borderRadius = "999px";
  progressFrame.style.background = "rgba(10, 10, 10, 0.45)";
  progressFrame.style.overflow = "hidden";

  const progressFill = document.createElement("div");
  const ratio = objective.target <= 0 ? 0 : Math.max(0, Math.min(1, objective.current / objective.target));
  progressFill.style.width = `${ratio * 100}%`;
  progressFill.style.height = "100%";
  progressFill.style.borderRadius = "999px";
  progressFill.style.background = objective.completed
    ? "linear-gradient(90deg, #4c7e42 0%, #9fd27e 100%)"
    : "linear-gradient(90deg, #8c6131 0%, #d6a45a 100%)";
  progressFrame.appendChild(progressFill);
  card.appendChild(progressFrame);

  const resetButton = createButton("Reset objective");
  resetButton.style.width = "auto";
  resetButton.style.justifySelf = "start";
  resetButton.style.padding = "4px 8px";
  resetButton.style.fontSize = "11px";
  resetButton.addEventListener("click", () => {
    onResetObjective?.();
  });
  makeInteractive(resetButton);
  card.appendChild(resetButton);

  return card;
}

function createSkillSlotPlaceholder(): HTMLElement {
  const card = document.createElement("div");
  card.style.display = "flex";
  card.style.alignItems = "center";
  card.style.gap = "10px";
  card.style.padding = "8px 10px";
  card.style.border = "1px solid #3c3122";
  card.style.borderRadius = "12px";
  card.style.background = "rgba(18, 14, 10, 0.9)";

  const slotKey = document.createElement("div");
  slotKey.textContent = "RMB";
  slotKey.style.minWidth = "42px";
  slotKey.style.padding = "6px 0";
  slotKey.style.border = "1px solid #6b5738";
  slotKey.style.borderRadius = "8px";
  slotKey.style.background = "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)";
  slotKey.style.color = "#e0c88a";
  slotKey.style.fontSize = "11px";
  slotKey.style.fontFamily = "monospace";
  slotKey.style.fontWeight = "bold";
  slotKey.style.textAlign = "center";
  slotKey.style.flex = "0 0 auto";
  card.appendChild(slotKey);

  const textBlock = document.createElement("div");
  textBlock.style.display = "grid";
  textBlock.style.gap = "2px";
  textBlock.style.minWidth = "0";

  const title = document.createElement("div");
  title.textContent = t("world_session.skill_slot_secondary");
  title.style.color = "#d8c6a3";
  title.style.fontSize = "11px";
  title.style.fontWeight = "bold";
  textBlock.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.textContent = t("world_session.skill_slot_secondary_hint");
  subtitle.style.color = "#a88d63";
  subtitle.style.fontSize = "10px";
  textBlock.appendChild(subtitle);

  const emptyState = document.createElement("div");
  emptyState.textContent = t("world_session.skill_slot_secondary_empty");
  emptyState.style.color = "#b9d49a";
  emptyState.style.fontSize = "11px";
  emptyState.style.fontFamily = "monospace";
  textBlock.appendChild(emptyState);

  card.appendChild(textBlock);
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
  equipmentLoadout: EquipmentLoadout,
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
    const detailSection = createInventoryDetailSection(selectedItem, items, equipmentLoadout, characterId, onEquipItem);
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
    button.style.color = getItemRarityColor(item.rarity);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    const sizeText = item.size === undefined ? "" : ` • ${item.size.width}x${item.size.height}`;
    const rarityText = formatItemRarityLabel(item.rarity);
    button.textContent = `${item.label} [${rarityText}]${sizeText}`;
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
  inventoryItems: readonly InventorySummaryItem[],
  equipmentLoadout: EquipmentLoadout,
  characterId: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
): HTMLElement {
  if (item === null) {
    return createSectionBlock("Item Detail", [createMutedText("Select an item to inspect it.")], { compact: true });
  }

  const children: HTMLElement[] = [];

  const title = document.createElement("div");
  title.textContent = item.label;
  title.style.color = getItemRarityColor(item.rarity);
  title.style.fontWeight = "bold";
  title.style.fontSize = "13px";
  title.style.lineHeight = "1.2";

  const header = document.createElement("div");
  header.style.display = "grid";
  header.style.gap = "6px";

  const rarityBadge = document.createElement("div");
  rarityBadge.textContent = formatItemRarityLabel(item.rarity);
  rarityBadge.style.display = "inline-block";
  rarityBadge.style.padding = "2px 6px";
  rarityBadge.style.border = `1px solid ${getItemRarityAccentColor(item.rarity)}`;
  rarityBadge.style.borderRadius = "999px";
  rarityBadge.style.color = getItemRarityColor(item.rarity);
  rarityBadge.style.fontSize = "10px";
  rarityBadge.style.fontWeight = "bold";
  rarityBadge.style.textTransform = "uppercase";

  const headerMeta = document.createElement("div");
  headerMeta.style.display = "flex";
  headerMeta.style.flexWrap = "wrap";
  headerMeta.style.gap = "6px";

  const categoryBadge = createItemMetaBadge("Category", item.category);
  const sizeBadge = createItemMetaBadge(
    "Size/Grid",
    item.size === undefined
      ? `Unknown • p${item.pageIndex} @ ${item.x},${item.y}`
      : `${item.size.width}x${item.size.height} • p${item.pageIndex} @ ${item.x},${item.y}`,
  );

  header.appendChild(title);
  headerMeta.append(rarityBadge, categoryBadge, sizeBadge);
  header.appendChild(headerMeta);

  children.push(header);

  const compareData = resolveEquippedComparisonItem(item, inventoryItems, equipmentLoadout);
  if (compareData !== null) {
    children.push(createInfoLine("Compare", `${formatEquipmentSlotLabel(compareData.slot)}: ${compareData.equippedItem.label}`));
    children.push(createModifierComparisonBlock(item, compareData.equippedItem));
  }

  children.push(createItemModifierSection(item.statModifiers));

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

  const section = createSectionBlock("Item Detail", [], { compact: true });
  section.style.display = "grid";
  section.style.gap = "8px";
  section.append(...children);
  return section;
}

function formatItemRarityLabel(rarity?: string): string {
  if (rarity === undefined || rarity.length === 0) {
    return "Unknown";
  }

  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function getItemRarityColor(rarity?: string): string {
  if (rarity === "rare") {
    return "#8fc7ff";
  }

  return COMMON_ITEM_COLOR;
}

function getItemRarityAccentColor(rarity?: string): string {
  if (rarity === "rare") {
    return "#4b86d8";
  }

  return COMMON_ITEM_ACCENT_COLOR;
}

function formatItemModifierText(modifier: StatModifier): string {
  const prefix = modifier.operation === "add" ? "+" : "×";
  return `${prefix}${modifier.value} ${modifier.target}`;
}

function resolveEquippedComparisonItem(
  item: InventorySummaryItem,
  inventoryItems: readonly InventorySummaryItem[],
  equipmentLoadout: EquipmentLoadout,
): { readonly slot: EquipmentSlot; readonly equippedItem: InventorySummaryItem } | null {
  const firstSlot = item.allowedEquipmentSlots?.[0];
  if (firstSlot === undefined) {
    return null;
  }

  const equippedItemId = equipmentLoadout[firstSlot];
  if (equippedItemId === null) {
    return null;
  }

  const equippedItem = inventoryItems.find((candidate) => candidate.itemInstanceId === equippedItemId);
  if (equippedItem === undefined) {
    return null;
  }

  return { slot: firstSlot, equippedItem };
}

function createModifierComparisonBlock(
  selectedItem: InventorySummaryItem,
  equippedItem: InventorySummaryItem,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
  wrapper.style.gap = "6px";
  wrapper.style.padding = "8px";
  wrapper.style.border = "1px solid #3c3122";
  wrapper.style.borderRadius = "6px";
  wrapper.style.background = "rgba(18, 14, 10, 0.88)";

  wrapper.appendChild(createModifierComparisonColumn("Selected item modifiers", selectedItem.statModifiers));
  wrapper.appendChild(createModifierComparisonColumn("Equipped item modifiers", equippedItem.statModifiers));
  return wrapper;
}

function createModifierComparisonColumn(
  labelText: string,
  modifiers?: readonly StatModifier[],
): HTMLElement {
  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gap = "4px";

  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.color = "#a88d63";
  label.style.fontSize = "11px";
  label.style.fontWeight = "bold";
  container.appendChild(label);

  if (modifiers === undefined || modifiers.length === 0) {
    container.appendChild(createMutedText("No modifiers."));
    return container;
  }

  const list = document.createElement("ul");
  list.style.margin = "0";
  list.style.padding = "0 0 0 18px";
  list.style.color = "#d8c6a3";
  list.style.fontSize = "12px";

  for (const modifier of modifiers) {
    const entry = document.createElement("li");
    entry.textContent = formatItemModifierText(modifier);
    list.appendChild(entry);
  }

  container.appendChild(list);
  return container;
}

function createItemModifierSection(modifiers?: readonly StatModifier[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.gap = "6px";

  const label = document.createElement("div");
  label.textContent = "Modifiers";
  label.style.color = "#a88d63";
  label.style.fontSize = "11px";
  label.style.fontWeight = "bold";
  wrapper.appendChild(label);

  if (modifiers === undefined || modifiers.length === 0) {
    wrapper.appendChild(createMutedText("No item modifiers visible."));
    return wrapper;
  }

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "4px";

  for (const modifier of modifiers) {
    list.appendChild(createModifierChip(formatItemModifierText(modifier)));
  }

  wrapper.appendChild(list);
  return wrapper;
}

function createModifierChip(text: string): HTMLElement {
  const chip = document.createElement("div");
  chip.textContent = text;
  chip.style.padding = "4px 7px";
  chip.style.border = "1px solid #3c3122";
  chip.style.borderRadius = "6px";
  chip.style.background = "rgba(18, 14, 10, 0.88)";
  chip.style.color = "#d8c6a3";
  chip.style.fontSize = "11px";
  chip.style.fontFamily = "monospace";
  return chip;
}

function createItemMetaBadge(labelText: string, valueText: string): HTMLElement {
  const badge = document.createElement("div");
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.gap = "5px";
  badge.style.padding = "2px 6px";
  badge.style.border = "1px solid #3c3122";
  badge.style.borderRadius = "999px";
  badge.style.background = "rgba(18, 14, 10, 0.88)";

  const label = document.createElement("span");
  label.textContent = `${labelText}:`;
  label.style.color = "#a88d63";
  label.style.fontSize = "10px";
  label.style.fontWeight = "bold";
  badge.appendChild(label);

  const value = document.createElement("span");
  value.textContent = valueText;
  value.style.color = "#d8c6a3";
  value.style.fontSize = "10px";
  value.style.fontFamily = "monospace";
  badge.appendChild(value);

  return badge;
}

function formatEquipmentSlotLabel(slot: EquipmentSlot): string {
  return slot.replace("_", " ");
}

export function createMutedText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "0";
  paragraph.style.color = "#a88d63";
  paragraph.style.fontSize = "12px";
  return paragraph;
}