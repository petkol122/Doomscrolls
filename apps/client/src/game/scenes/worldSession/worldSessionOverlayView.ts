import type { Room } from "@colyseus/sdk";
import { t } from "@doomscrolls/localization";
import type { CharacterSummary, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getTownRoomPresence } from "../../../net/townRoomPresence";
import { createButton, createInfoLine } from "../accountShell/accountShellDom";
import type { WorldSessionDebugState } from "./worldSessionAreaView";
import { applyWorldSessionOverlayPanelStyles } from "./worldSessionOverlayLayout";

export function createWorldSessionOverlayView(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  onLeaveWorld: () => void,
): HTMLElement {
  const section = createCardSection();

  const title = document.createElement("h2");
  title.textContent = t("world_session.title");
  title.style.margin = "0 0 8px";
  title.style.fontFamily = "Georgia, serif";
  title.style.fontSize = "20px";
  section.appendChild(title);

  const status = document.createElement("p");
  status.textContent = t("world_entry.connected");
  status.style.margin = "0 0 8px";
  status.style.color = "#b9d49a";
  section.appendChild(status);

  const notice = document.createElement("p");
  notice.textContent = t("world_session.debug_notice");
  notice.style.margin = "0 0 12px";
  notice.style.padding = "8px 10px";
  notice.style.border = "1px solid #5f4a2f";
  notice.style.borderRadius = "8px";
  notice.style.background = "rgba(31, 24, 18, 0.95)";
  notice.style.color = "#d6c29d";
  notice.style.fontSize = "12px";
  section.appendChild(notice);

  if (character !== null) {
    section.appendChild(createSectionBlock(t("world_session.selected_character"), [
      createInfoLine(t("character.name"), character.characterName),
      createInfoLine(t("character.origin"), t(`origin.${character.originKey}.name`)),
      createInfoLine(t("character.class"), t(`class.${character.classKey}.name`)),
      createInfoLine(t("character.level"), String(character.level)),
    ]));
  }

  const roomState = formatTownRoomState(room.state);
  section.appendChild(createSectionBlock(t("world_session.room_info"), [
    createInfoLine(t("world_session.room_kind"), roomState.roomKind),
    createInfoLine(t("world_session.zone_id"), roomState.zoneId),
    createInfoLine(t("world_session.connected_players"), String(roomState.playerCount)),
  ]));

  section.appendChild(createPresenceSection(room));
  section.appendChild(createMovementDebugSection(room, debugState));

  const leaveButton = createButton(t("world_entry.leave_world"));
  leaveButton.style.marginTop = "12px";
  leaveButton.addEventListener("click", () => {
    onLeaveWorld();
  });
  section.appendChild(leaveButton);

  return section;
}

function createCardSection(): HTMLElement {
  const section = document.createElement("section");
  applyWorldSessionOverlayPanelStyles(section);
  section.style.margin = "0";
  section.style.width = "320px";
  return section;
}

function createSectionBlock(titleText: string, children: readonly HTMLElement[]): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.style.margin = "0 0 10px";
  wrapper.style.padding = "10px";
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.72)";

  const title = document.createElement("h3");
  title.textContent = titleText;
  title.style.margin = "0 0 8px";
  title.style.fontSize = "14px";
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
  playerList.style.fontSize = "12px";

  for (const player of presence.players) {
    const li = document.createElement("li");
    li.style.marginBottom = "6px";

    const details: string[] = [player.characterId];
    if (player.spawnPointId !== undefined && player.spawnPointId.length > 0) {
      details.push(`spawn=${player.spawnPointId}`);
    }
    if (player.position !== undefined) {
      details.push(`x=${player.position.x}, y=${player.position.y}`);
    }
    if (player.movementSpeed !== undefined) {
      details.push(`speed=${player.movementSpeed}`);
    }

    li.textContent = `${player.displayName} (${details.join(" | ")})`;
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
      t("world_session.current_position"),
      self?.position !== undefined
        ? `x=${Math.round(self.position.x)}, y=${Math.round(self.position.y)}`
        : t("world_area.no_position"),
    ),
    createInfoLine(
      t("world_session.movement_speed"),
      self?.movementSpeed !== undefined
        ? String(self.movementSpeed)
        : t("world_session.awaiting_movement_speed"),
    ),
    createInfoLine(
      t("world_session.last_click_target"),
      debugState.lastClickTarget !== null
        ? `x=${debugState.lastClickTarget.x}, y=${debugState.lastClickTarget.y}`
        : t("world_session.awaiting_click_target"),
    ),
  ]);
}

function createMutedText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "0";
  paragraph.style.color = "#a88d63";
  paragraph.style.fontSize = "12px";
  return paragraph;
}