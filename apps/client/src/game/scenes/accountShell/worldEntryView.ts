import { t } from "@doomscrolls/localization";
import type { CharacterId, CharacterSummary, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import type { Room } from "@colyseus/sdk";
import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getTownRoomPresence } from "../../../net/townRoomPresence";
import { createButton, createInfoLine } from "./accountShellDom";
import { createWorldAreaInput } from "./worldAreaInputView";

export function createWorldEntryStub(
  characters: readonly CharacterSummary[],
  selectedCharacterId: CharacterId | null,
  entered: boolean,
  room: Room<DoomscrollsRoomState> | null,
  onEnterWorld: () => void,
  onLeaveWorld: () => void
): HTMLElement {
  const selectedCharacter = characters.find((character) => character.id === selectedCharacterId) ?? null;
  const section = document.createElement("section");
  section.style.margin = "18px 0 22px";
  section.style.padding = "16px";
  section.style.border = "1px solid #3d3324";
  section.style.borderRadius = "8px";
  section.style.background = "rgba(18, 14, 11, 0.9)";

  const title = document.createElement("h2");
  title.textContent = t("world_entry.title");
  title.style.margin = "0 0 12px";
  title.style.fontFamily = "Georgia, serif";
  title.style.fontSize = "24px";
  section.appendChild(title);

  if (selectedCharacter === null) {
    const empty = document.createElement("p");
    empty.textContent = t("world_entry.no_character_selected");
    empty.style.margin = "0 0 12px";
    empty.style.color = "#a88d63";
    section.appendChild(empty);
  } else {
    section.appendChild(createSelectedCharacterSummary(selectedCharacter));
  }

  const playButton = createButton(t("world_entry.enter_world"));
  const isDisabled = selectedCharacter === null || entered;
  playButton.disabled = isDisabled;
  playButton.style.cursor = isDisabled ? "not-allowed" : "pointer";
  playButton.style.opacity = isDisabled ? "0.62" : "1";
  playButton.setAttribute("aria-describedby", "doomscrolls-world-entry-status");

  if (!entered && selectedCharacter !== null) {
    playButton.addEventListener("click", () => {
      onEnterWorld();
    });
  }

  section.appendChild(playButton);

  const status = document.createElement("p");
  status.id = "doomscrolls-world-entry-status";
  status.textContent = entered ? t("world_entry.connected") : t("world_entry.coming_next");
  status.style.margin = "10px 0 0";
  status.style.color = entered ? "#b9d49a" : "#c7ad84";
  section.appendChild(status);

  if (entered && room !== null) {
    const roomState = formatTownRoomState(room.state);
    section.appendChild(createInfoLine("Room Kind", roomState.roomKind));
    section.appendChild(createInfoLine("Zone ID", roomState.zoneId));
    section.appendChild(createInfoLine("Connected Players", String(roomState.playerCount)));

    const presence = getTownRoomPresence(room.state as unknown as Record<string, unknown>);
    if (presence !== null && presence.players.length > 0) {
      const playerList = document.createElement("ul");
      playerList.style.margin = "8px 0 0";
      playerList.style.padding = "0";
      playerList.style.listStyle = "none";
      playerList.style.fontSize = "13px";
      playerList.style.color = "#b9d49a";

      for (const player of presence.players) {
        const li = document.createElement("li");
        const spawnSuffix =
          player.spawnPointId !== undefined && player.spawnPointId.length > 0
            ? ` @ ${player.spawnPointId}`
            : "";
        const positionSuffix =
          player.position !== undefined
            ? ` (x=${player.position.x}, y=${player.position.y})`
            : "";
        li.textContent = `${player.displayName} (${player.characterId})${spawnSuffix}${positionSuffix}`;
        li.style.marginBottom = "2px";
        playerList.appendChild(li);
      }

      const label = document.createElement("p");
      label.textContent = "Players:";
      label.style.margin = "10px 0 2px";
      label.style.fontSize = "13px";
      label.style.color = "#a88d63";
      section.appendChild(label);
      section.appendChild(playerList);
    }
  }

  if (entered) {
    const leaveButton = createButton(t("world_entry.leave_world"));
    leaveButton.style.marginTop = "12px";
    leaveButton.addEventListener("click", () => {
      onLeaveWorld();
    });
    section.appendChild(leaveButton);

    // World area input panel (Task 033). Shows a bounded clickable area
    // that sends movement intents on click/tap. The player's synced
    // position (x, y) from the server is displayed as a dot and text.
    // No local position faking — the dot only moves on server sync.
    const worldArea = createWorldAreaInput({ room: room! });
    section.appendChild(worldArea.container);
  }

  return section;
}

function createSelectedCharacterSummary(character: CharacterSummary): HTMLElement {
  const summary = document.createElement("div");
  summary.style.display = "grid";
  summary.style.gap = "6px";
  summary.style.marginBottom = "12px";

  summary.appendChild(createInfoLine(t("character.name"), character.characterName));
  summary.appendChild(createInfoLine(t("character.origin"), t(`origin.${character.originKey}.name`)));
  summary.appendChild(createInfoLine(t("character.class"), t(`class.${character.classKey}.name`)));
  summary.appendChild(createInfoLine(t("character.level"), String(character.level)));

  return summary;
}
