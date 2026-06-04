import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { CharacterSummary, InventorySummaryItem, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getTownRoomPresence } from "../../../net/townRoomPresence";
import { createButton, createInfoLine } from "../accountShell/accountShellDom";
import type { WorldSessionDebugState } from "./worldSessionAreaView";
import { applyWorldSessionOverlayPanelStyles } from "./worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../../worldProjection";

export function createWorldSessionOverlayView(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onRespawn: () => void,
  onLeaveWorld: () => void,
): HTMLElement {
  const section = createCardSection();
  let selectedInventoryItemId: InventorySummaryItem["itemInstanceId"] | null = character?.inventorySummaryItems?.[0]?.itemInstanceId ?? null;

  const title = document.createElement("h2");
  title.textContent = t("world_session.title");
  title.style.margin = "0 0 4px";
  title.style.fontFamily = "Georgia, serif";
  title.style.fontSize = "18px";
  section.appendChild(title);

  const status = document.createElement("p");
  status.textContent = t("world_entry.connected");
  status.style.margin = "0 0 10px";
  status.style.color = "#b9d49a";
  status.style.fontSize = "13px";
  section.appendChild(status);

  const notice = document.createElement("p");
  notice.textContent = t("world_session.debug_notice");
  notice.style.margin = "0 0 10px";
  notice.style.padding = "6px 8px";
  notice.style.border = "1px solid #5f4a2f";
  notice.style.borderRadius = "8px";
  notice.style.background = "rgba(31, 24, 18, 0.95)";
  notice.style.color = "#d6c29d";
  notice.style.fontSize = "11px";
  section.appendChild(notice);

  if (character !== null) {
    section.appendChild(createSectionBlock(t("world_session.selected_character"), [
      createCompactSummary([
        character.characterName,
        `${t(`origin.${character.originKey}.name`)} / ${t(`class.${character.classKey}.name`)}`,
        `${t("character.level")} ${character.level}`,
      ]),
    ]));
  }

  let inventorySummarySection: HTMLElement | null = null;
  let inventoryDetailSection: HTMLElement | null = null;

  function rerenderInventorySections(): void {
    if (character === null) {
      return;
    }

    const items = character.inventorySummaryItems ?? [];
    const nextSummary = createInventorySummarySection(items, () => selectedInventoryItemId, (itemId) => {
      selectedInventoryItemId = itemId;
      rerenderInventorySections();
    });
    const selectedItem = items.find((item) => item.itemInstanceId === selectedInventoryItemId) ?? items[0] ?? null;
    if (selectedItem !== null) {
      selectedInventoryItemId = selectedItem.itemInstanceId;
    }
    const nextDetail = createInventoryDetailSection(selectedItem);

    if (inventorySummarySection !== null) {
      section.replaceChild(nextSummary, inventorySummarySection);
    } else {
      section.appendChild(nextSummary);
    }

    if (inventoryDetailSection !== null) {
      section.replaceChild(nextDetail, inventoryDetailSection);
    } else {
      section.appendChild(nextDetail);
    }

    inventorySummarySection = nextSummary;
    inventoryDetailSection = nextDetail;
  }

  if (character !== null) {
    rerenderInventorySections();
  }

  const roomState = formatTownRoomState(room.state);
  section.appendChild(createSectionBlock(t("world_session.room_info"), [
    createInfoLine(t("world_session.room_kind"), roomState.roomKind),
    createInfoLine(t("world_session.zone_id"), roomState.zoneId),
    createInfoLine(t("world_session.connected_players"), String(roomState.playerCount)),
  ]));

  section.appendChild(createPresenceSection(room));
  section.appendChild(createProjectionSection(debugState, onProjectionModeChange));
  section.appendChild(createMovementDebugSection(room, debugState));

  const selfPresence = getTownRoomPresence(room.state as unknown as Record<string, unknown>)
    ?.players.find((player) => player.sessionId === room.sessionId);
  const selfHpSummary = formatPlayerHpSummary(selfPresence?.hp, selfPresence?.maxHp);
  const selfHpRatio = resolvePlayerHpRatio(selfPresence?.hp, selfPresence?.maxHp);

  section.appendChild(createVitalitySection(selfHpSummary, selfHpRatio, selfPresence?.lifeState));

  if (selfPresence?.lifeState === "downed") {
    const downedNotice = createMutedText(t("world_session.downed_notice"));
    downedNotice.style.color = "#e3a6a6";
    downedNotice.style.marginBottom = "8px";
    section.appendChild(downedNotice);

    const respawnButton = createButton(t("world_session.respawn"));
    respawnButton.style.marginTop = "4px";
    respawnButton.style.width = "100%";
    respawnButton.addEventListener("click", () => {
      onRespawn();
    });
    section.appendChild(respawnButton);
  }

  const leaveButton = createButton(t("world_entry.leave_world"));
  leaveButton.style.marginTop = "8px";
  leaveButton.style.width = "100%";
  leaveButton.addEventListener("click", () => {
    onLeaveWorld();
  });
  section.appendChild(leaveButton);

  return section;
}

function createProjectionSection(
  debugState: WorldSessionDebugState,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
): HTMLElement {
  const wrapper = createSectionBlock(t("world_session.projection_title"), []);

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

  const isometricButton = createButton(t("world_session.projection_isometric_preview"));
  isometricButton.style.flex = "1";
  isometricButton.disabled = debugState.projectionMode === "isometric_preview";
  isometricButton.addEventListener("click", () => {
    onProjectionModeChange("isometric_preview");
  });

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

function createSectionBlock(titleText: string, children: readonly HTMLElement[]): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.style.margin = "0 0 8px";
  wrapper.style.padding = "8px";
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.72)";

  const title = document.createElement("h3");
  title.textContent = titleText;
  title.style.margin = "0 0 6px";
  title.style.fontSize = "13px";
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
    return createSectionBlock(t("world_session.player_presence"), content);
  }

  if (presence.players.length === 0) {
    content.push(createMutedText(t("world_session.players_empty")));
    return createSectionBlock(t("world_session.player_presence"), content);
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
  return createSectionBlock(t("world_session.player_presence"), content);
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
  ]);
}

function createVitalitySection(
  hpSummary: string,
  hpRatio: number | null,
  lifeState?: "alive" | "downed",
): HTMLElement {
  const content: HTMLElement[] = [];

  content.push(createInfoLine(t("world_session.player_hp"), hpSummary));

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
      : "linear-gradient(90deg, #7c2525 0%, #d07a5c 100%)";
  barFrame.appendChild(barFill);
  content.push(barFrame);

  const stateLine = createMutedText(
    lifeState === "downed"
      ? t("world_session.downed_state_detail")
      : t("world_session.alive_state_detail"),
  );
  stateLine.style.color = lifeState === "downed" ? "#e3a6a6" : "#b9d49a";
  content.push(stateLine);

  return createSectionBlock(t("world_session.vitality"), content);
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
    return createSectionBlock("Inventory Summary", [createMutedText("No inventory items in bag.")]);
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
    row.appendChild(button);
    list.appendChild(row);
  }

  return createSectionBlock("Inventory Summary", [list]);
}

function createInventoryDetailSection(item: InventorySummaryItem | null): HTMLElement {
  if (item === null) {
    return createSectionBlock("Item Detail", [createMutedText("Select an item to inspect it.")]);
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

  return createSectionBlock("Item Detail", children);
}

function createCompactSummary(lines: readonly string[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "2px";

  for (const line of lines) {
    const text = document.createElement("p");
    text.textContent = line;
    text.style.margin = "0";
    text.style.fontSize = "12px";
    text.style.color = "#d8c6a3";
    wrapper.appendChild(text);
  }

  return wrapper;
}

function createMutedText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "0";
  paragraph.style.color = "#a88d63";
  paragraph.style.fontSize = "12px";
  return paragraph;
}