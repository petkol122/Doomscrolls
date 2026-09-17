import type { Room } from "@colyseus/sdk";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";

import {
  registerChatMessageListeners,
  registerGlobalChatMessageListeners,
  sendChatMessage,
  sendGlobalChatMessage,
} from "../../../net/chatClient";
import { consumeBufferedGlobalChatHistory } from "../../../net/globalChatHistoryBuffer";

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

  // Global Chat -- a small channel toggle above the input. Local chat
  // (room-local, Core 0.29) stays the default so existing behavior is
  // unchanged; switching to Global sends to every connected player
  // instead, via `sendGlobalChatMessage`.
  // Core 0.1 UI Overhaul Phase 1 -- collapse/expand toggle for the chat
  // frame. Hides the log/input/channel-tabs rather than removing them,
  // so a resumed session doesn't lose the typed draft or scroll state.
  const frameHeader = document.createElement("div");
  frameHeader.style.display = "flex";
  frameHeader.style.justifyContent = "flex-end";

  const collapseButton = document.createElement("button");
  collapseButton.type = "button";
  collapseButton.style.border = "1px solid #6b5738";
  collapseButton.style.borderRadius = "4px";
  collapseButton.style.background = "rgba(14, 11, 8, 0.85)";
  collapseButton.style.color = "#a8926d";
  collapseButton.style.fontSize = "10px";
  collapseButton.style.fontFamily = "monospace";
  collapseButton.style.padding = "1px 6px";
  collapseButton.style.cursor = "pointer";
  frameHeader.appendChild(collapseButton);
  root.appendChild(frameHeader);

  const channelRow = document.createElement("div");
  channelRow.style.display = "flex";
  channelRow.style.gap = "4px";

  let activeChannel: "local" | "global" = "local";

  const localTab = document.createElement("button");
  const globalTab = document.createElement("button");

  const styleTab = (button: HTMLButtonElement, isActive: boolean): void => {
    button.type = "button";
    button.style.flex = "1";
    button.style.padding = "3px 6px";
    button.style.fontSize = "11px";
    button.style.fontWeight = "600";
    button.style.border = "1px solid #6b5738";
    button.style.borderRadius = "6px";
    button.style.cursor = "pointer";
    button.style.background = isActive ? "rgba(140, 108, 56, 0.55)" : "rgba(14, 11, 8, 0.85)";
    button.style.color = isActive ? "#f0dec0" : "#a8926d";
  };

  const setActiveChannel = (channel: "local" | "global"): void => {
    activeChannel = channel;
    styleTab(localTab, channel === "local");
    styleTab(globalTab, channel === "global");
  };

  localTab.textContent = t("world_session.chat_channel_local" as never);
  globalTab.textContent = t("world_session.chat_channel_global" as never);
  localTab.addEventListener("click", () => setActiveChannel("local"));
  globalTab.addEventListener("click", () => setActiveChannel("global"));
  setActiveChannel("local");

  channelRow.appendChild(localTab);
  channelRow.appendChild(globalTab);

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
    const result = activeChannel === "global"
      ? sendGlobalChatMessage(room, input.value)
      : sendChatMessage(room, input.value);
    if (result.dispatched) {
      input.value = "";
    }
    // A rejected send (empty/too-long/on-cooldown) intentionally leaves
    // the typed text in place with no additional feedback UI this
    // pass -- see docs/CORE_BUILD_0_29_PLAN.md's queued follow-up on
    // chat cooldown UI feedback.
  });

  inputRow.appendChild(input);

  // Core 0.4 -- channel tabs/log/input share one `body` wrapper so
  // collapsing can animate a single `max-height` (matching the Quest
  // Tracker dock's collapse) instead of instantly toggling `.hidden`
  // on three separate elements with no transition.
  const body = document.createElement("div");
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.gap = "4px";
  body.style.overflow = "hidden";
  body.style.transition = "max-height 0.22s ease, opacity 0.18s ease";
  body.appendChild(channelRow);
  body.appendChild(log);
  body.appendChild(inputRow);
  root.appendChild(body);

  let isCollapsed = false;
  const applyCollapsedState = (): void => {
    collapseButton.textContent = isCollapsed ? "[+]" : "[_]";
    collapseButton.title = isCollapsed ? "Expand chat" : "Collapse chat";
    body.style.maxHeight = isCollapsed ? "0px" : "400px";
    body.style.opacity = isCollapsed ? "0" : "1";
  };
  collapseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    isCollapsed = !isCollapsed;
    applyCollapsedState();
  });
  applyCollapsedState();

  let renderedMessageCount = 0;

  const appendMessage = (displayName: string, text: string, isGlobal: boolean): void => {
    if (renderedMessageCount === 0) {
      emptyLine.remove();
    }

    const line = document.createElement("div");
    if (isGlobal) {
      const tagSpan = document.createElement("span");
      tagSpan.style.color = "#7fb0d8";
      tagSpan.style.fontWeight = "600";
      tagSpan.textContent = `[${t("world_session.chat_channel_global" as never)}] `;
      line.appendChild(tagSpan);
    }
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
      appendMessage(message.displayName, message.text, false);
    },
    onRejected: () => {
      // Silent per Core 0.29 Question 3 -- no dedicated cooldown/length
      // feedback UI this pass.
    },
  });

  registerGlobalChatMessageListeners(room, {
    onMessage: (message) => {
      appendMessage(message.displayName, message.text, true);
    },
    onRejected: () => {
      // Silent, matching room-local chat's rejection handling above.
    },
  });

  // Replay history buffered since join (see `globalChatHistoryBuffer.ts`
  // for why this can't just be a live listener registered above) so a
  // player who logs back in sees the recent conversation, not an empty
  // log.
  const bufferedHistory = consumeBufferedGlobalChatHistory(room);
  if (bufferedHistory !== null) {
    for (const historyMessage of bufferedHistory) {
      appendMessage(historyMessage.displayName, historyMessage.text, true);
    }
  }

  return { root };
}
