import { t } from "@doomscrolls/localization";
import type { CharacterId, CharacterSummary, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import type { Room } from "@colyseus/sdk";
import { formatTownRoomState } from "../../../net/RealtimeClient";
import { createButton, createInfoLine } from "./accountShellDom";

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
  }

  if (entered) {
    const leaveButton = createButton(t("world_entry.leave_world"));
    leaveButton.style.marginTop = "12px";
    leaveButton.addEventListener("click", () => {
      onLeaveWorld();
    });
    section.appendChild(leaveButton);
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
