import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";

import { registerChatMessageListeners, sendChatMessage } from "../../../net/chatClient";

// ---------------------------------------------------------------------------
// Core 0.29 -- Room-Local Chat.
//
// Persistent floating chat log + input, docked bottom-left (see
// `applyWorldSessionOverlayChatStyles`). Matches the D2-style HUD
// language already established for the orb cluster (Core 0.25) rather
// than the bordered-card look used by the corner-menu flyouts -- a
// soft dark gradient scrim behind the log, no hard-edged panel.
//
// Every rendered piece of text here (sender name, message body) is set
// via `.textContent` only, never `.innerHTML` -- both are player-typed
// strings a third party's client renders, and this is the one place in
// the client that must not slip to markup-parsing assignment. See
// docs/CORE_BUILD_0_29_PLAN.md, Question 5 / Risk 6.
// ---------------------------------------------------------------------------

const MAX_RENDERED_MESSAGES = 50;

export interface WorldSessionChatView {
  readonly root: HTMLElement;
}

export function createWorldSessionChatView(
  room: Room<DoomscrollsRoomState>,
): WorldSessionChatView {
  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "4px";

  const log = document.createElement("div");
  log.style.display = "flex";
  log.style.flexDirection = "column";
  log.style.gap = "2px";
  log.style.maxHeight = "220px";
  log.style.overflowY = "auto";
  log.style.padding = "6px 8px";
  log.style.borderRadius = "10px";
  log.style.background = "linear-gradient(180deg, rgba(20, 16, 12, 0.55) 0%, rgba(10, 8, 6, 0.72) 100%)";
  log.style.fontSize = "12px";
  log.style.lineHeight = "1.4";
  log.style.color = "#d8c6a3";
  log.style.wordBreak = "break-word";

  const emptyLine = document.createElement("div");
  emptyLine.style.opacity = "0.6";
  emptyLine.textContent = t("world_session.chat_empty" as never);
  log.appendChild(emptyLine);

  const inputRow = document.createElement("div");
  inputRow.style.display = "flex";

  const input = document.createElement("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = t("world_session.chat_input_placeholder" as never);
  // DOM-level cap mirrors the server's MAX_CHAT_MESSAGE_LENGTH -- a
  // cheap early guard only; the server remains the sole authority.
  input.maxLength = 240;
  input.style.flex = "1";
  input.style.width = "100%";
  input.style.boxSizing = "border-box";
  input.style.padding = "6px 8px";
  input.style.border = "1px solid #6b5738";
  input.style.borderRadius = "8px";
  input.style.background = "rgba(14, 11, 8, 0.85)";
  input.style.color = "#f0dec0";
  input.style.font = "inherit";
  input.style.fontSize = "12px";

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const result = sendChatMessage(room, input.value);
    if (result.dispatched) {
      input.value = "";
    }
    // A rejected send (empty/too-long/on-cooldown) intentionally leaves
    // the typed text in place with no additional feedback UI this
    // pass -- see docs/CORE_BUILD_0_29_PLAN.md's queued follow-up on
    // chat cooldown UI feedback.
  });

  inputRow.appendChild(input);
  root.appendChild(log);
  root.appendChild(inputRow);

  let renderedMessageCount = 0;

  const appendMessage = (displayName: string, text: string): void => {
    if (renderedMessageCount === 0) {
      emptyLine.remove();
    }

    const line = document.createElement("div");
    const nameSpan = document.createElement("span");
    nameSpan.style.color = "#e8d2a0";
    nameSpan.style.fontWeight = "600";
    nameSpan.textContent = `${displayName}: `;
    const textSpan = document.createElement("span");
    textSpan.textContent = text;
    line.appendChild(nameSpan);
    line.appendChild(textSpan);
    log.appendChild(line);
    renderedMessageCount += 1;

    while (renderedMessageCount > MAX_RENDERED_MESSAGES && log.firstChild !== null) {
      log.removeChild(log.firstChild);
      renderedMessageCount -= 1;
    }

    log.scrollTop = log.scrollHeight;
  };

  registerChatMessageListeners(room, {
    onMessage: (message) => {
      appendMessage(message.displayName, message.text);
    },
    onRejected: () => {
      // Silent per Core 0.29 Question 3 -- no dedicated cooldown/length
      // feedback UI this pass.
    },
  });

  return { root };
}
