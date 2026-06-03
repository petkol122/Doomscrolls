import { t } from "@doomscrolls/localization";
import type { CharacterClassKey, CharacterId, CharacterSummary, OriginKey, SessionToken } from "@doomscrolls/shared";
import type { Room } from "@colyseus/sdk";
import Phaser from "phaser";

import {
  clearStoredSelectedCharacterId,
  clearStoredSessionToken,
  readStoredSelectedCharacterId,
  readStoredSessionToken,
  storeSelectedCharacterId
} from "../../auth/sessionStorage";
import { clientEnv } from "../../config/env";
import { ApiClient, ApiClientError, type AccountState, type ApiErrorCode } from "../../net/ApiClient";
import {
  createRealtimeClient,
  formatTownRoomState,
  joinTownRoom
} from "../../net/RealtimeClient";
import type { RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

const CORE_0_1_ORIGIN_ID = "sewer_dweller" satisfies OriginKey;
const CORE_0_1_CLASS_ID = "gravewalker" satisfies CharacterClassKey;

interface AccountShellSceneData {
  readonly account: AccountState;
}

interface CharacterCreateFormElements {
  readonly status: HTMLParagraphElement;
  readonly characterName: HTMLInputElement;
  readonly origin: HTMLSelectElement;
  readonly characterClass: HTMLSelectElement;
  readonly createButton: HTMLButtonElement;
}

export class AccountShellScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private account: AccountState | null = null;
  private apiClient: ApiClient | null = null;
  private selectedCharacterId: CharacterId | null = null;
  private room: Room<DoomscrollsRoomState> | null = null;
  private entered: boolean = false;

  public constructor() {
    super("AccountShellScene");
  }

  public init(data: AccountShellSceneData): void {
    this.account = data.account;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#090706");
    this.apiClient = clientEnv.apiUrl === undefined ? null : new ApiClient(clientEnv.apiUrl);

    this.add
      .text(640, 96, "Doomscrolls", {
        color: "#d8c6a3",
        fontFamily: "Georgia, serif",
        fontSize: "44px"
      })
      .setOrigin(0.5);

    if (this.account === null) {
      clearStoredSessionToken();
      this.scene.start("AuthScene");
      return;
    }

    this.renderAccountOverlay(this.account);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyOverlay());
  }

  private renderAccountOverlay(account: AccountState): void {
    this.syncSelectedCharacterId(account.characters);
    this.destroyOverlay();
    this.overlay = this.createAccountOverlay(account);
  }

  private syncSelectedCharacterId(characters: readonly CharacterSummary[]): void {
    if (characters.length === 0) {
      this.selectedCharacterId = null;
      clearStoredSelectedCharacterId();
      return;
    }

    this.selectedCharacterId ??= readStoredSelectedCharacterId() as CharacterId | null;

    const selectedCharacterExists = characters.some((character) => character.id === this.selectedCharacterId);
    if (!selectedCharacterExists) {
      this.selectedCharacterId = characters[0]?.id ?? null;
    }

    if (this.selectedCharacterId === null) {
      clearStoredSelectedCharacterId();
      return;
    }

    storeSelectedCharacterId(this.selectedCharacterId);
  }

  private createAccountOverlay(account: AccountState): HTMLDivElement {
    const root = document.createElement("div");
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.display = "flex";
    root.style.alignItems = "center";
    root.style.justifyContent = "center";
    root.style.pointerEvents = "none";
    root.style.fontFamily = "Arial, sans-serif";

    const panel = document.createElement("section");
    panel.style.width = "min(620px, calc(100vw - 32px))";
    panel.style.marginTop = "72px";
    panel.style.padding = "24px";
    panel.style.border = "1px solid #4d3f2a";
    panel.style.borderRadius = "12px";
    panel.style.background = "rgba(13, 10, 8, 0.94)";
    panel.style.color = "#d8c6a3";
    panel.style.boxShadow = "0 20px 70px rgba(0, 0, 0, 0.45)";
    panel.style.pointerEvents = "auto";
    panel.style.maxHeight = "calc(100vh - 120px)";
    panel.style.overflowY = "auto";
    root.appendChild(panel);

    const title = document.createElement("h1");
    title.textContent = account.profile.displayName;
    title.style.margin = "0";
    title.style.fontFamily = "Georgia, serif";
    panel.appendChild(title);

    const username = document.createElement("p");
    username.textContent = `@${account.user.username}`;
    username.style.margin = "8px 0 18px";
    username.style.color = "#a88d63";
    panel.appendChild(username);

    panel.appendChild(this.createInfoLine(t("profile.display_name"), account.profile.displayName));
    panel.appendChild(this.createInfoLine(t("profile.avatar"), account.profile.avatarKey));

    const loaded = document.createElement("p");
    loaded.textContent = t("auth.account_loaded");
    loaded.style.margin = "18px 0";
    loaded.style.color = "#b9d49a";
    panel.appendChild(loaded);

    panel.appendChild(this.createWorldEntryStub(account.characters));
    panel.appendChild(this.createCharacterList(account.characters));
    panel.appendChild(this.createCharacterCreateForm());

    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = t("auth.logout");
    logout.style.padding = "11px 14px";
    logout.style.border = "1px solid #8d6a35";
    logout.style.borderRadius = "8px";
    logout.style.background = "#5a311f";
    logout.style.color = "#ffe6bd";
    logout.style.cursor = "pointer";
    logout.style.font = "inherit";
    logout.addEventListener("click", () => {
      clearStoredSessionToken();
      clearStoredSelectedCharacterId();
      this.destroyOverlay();
      this.scene.start("AuthScene");
    });
    panel.appendChild(logout);

    document.body.appendChild(root);
    return root;
  }

  private createWorldEntryStub(characters: readonly CharacterSummary[]): HTMLElement {
    const selectedCharacter = characters.find((character) => character.id === this.selectedCharacterId) ?? null;
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
      section.appendChild(this.createSelectedCharacterSummary(selectedCharacter));
    }

    const playButton = this.createButton(t("world_entry.enter_world"));
    const isDisabled = selectedCharacter === null || this.entered;
    playButton.disabled = isDisabled;
    playButton.style.cursor = isDisabled ? "not-allowed" : "pointer";
    playButton.style.opacity = isDisabled ? "0.62" : "1";
    playButton.setAttribute("aria-describedby", "doomscrolls-world-entry-status");

    if (!this.entered && selectedCharacter !== null) {
      playButton.addEventListener("click", () => {
        void this.handleEnterWorld();
      });
    }

    section.appendChild(playButton);

    const status = document.createElement("p");
    status.id = "doomscrolls-world-entry-status";
    status.textContent = this.entered ? t("world_entry.connected") : t("world_entry.coming_next");
    status.style.margin = "10px 0 0";
    status.style.color = this.entered ? "#b9d49a" : "#c7ad84";
    section.appendChild(status);

    if (this.entered && this.room !== null) {
      const roomState = formatTownRoomState(this.room.state);
      section.appendChild(this.createInfoLine("Room Kind", roomState.roomKind));
      section.appendChild(this.createInfoLine("Zone ID", roomState.zoneId));
      section.appendChild(this.createInfoLine("Connected Players", String(roomState.playerCount)));
    }

    if (this.entered) {
      const leaveButton = this.createButton(t("world_entry.leave_world"));
      leaveButton.style.marginTop = "12px";
      leaveButton.addEventListener("click", () => {
        void this.handleLeaveWorld();
      });
      section.appendChild(leaveButton);
    }

    return section;
  }

  private async handleEnterWorld(): Promise<void> {
    const sessionToken = readStoredSessionToken();
    if (sessionToken === null || this.selectedCharacterId === null) {
      return;
    }

    if (this.room !== null) {
      return;
    }

    try {
      const client = createRealtimeClient();
      const joinedRoom = await joinTownRoom(client, sessionToken as SessionToken, this.selectedCharacterId);
      this.room = joinedRoom;
      this.entered = true;

      if (this.account !== null) {
        this.renderAccountOverlay(this.account);
      }
    } catch {
      const status = document.getElementById("doomscrolls-world-entry-status");
      if (status !== null) {
        status.textContent = t("world_entry.join_failed");
        status.style.color = "#ff9c8a";
      }
    }
  }

  private async handleLeaveWorld(): Promise<void> {
    if (this.room !== null) {
      try {
        this.room.leave();
      } catch {
        // Ignore leave errors
      }
      this.room = null;
    }

    this.entered = false;

    if (this.account !== null) {
      this.renderAccountOverlay(this.account);
    }
  }

  private createSelectedCharacterSummary(character: CharacterSummary): HTMLElement {
    const summary = document.createElement("div");
    summary.style.display = "grid";
    summary.style.gap = "6px";
    summary.style.marginBottom = "12px";

    summary.appendChild(this.createInfoLine(t("character.name"), character.characterName));
    summary.appendChild(this.createInfoLine(t("character.origin"), t(`origin.${character.originKey}.name`)));
    summary.appendChild(this.createInfoLine(t("character.class"), t(`class.${character.classKey}.name`)));
    summary.appendChild(this.createInfoLine(t("character.level"), String(character.level)));

    return summary;
  }

  private createCharacterList(characters: readonly CharacterSummary[]): HTMLElement {
    const section = document.createElement("section");
    section.style.margin = "18px 0 22px";

    const title = document.createElement("h2");
    title.textContent = t("character.list");
    title.style.margin = "0 0 12px";
    title.style.fontFamily = "Georgia, serif";
    title.style.fontSize = "24px";
    section.appendChild(title);

    if (characters.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = t("auth.no_characters");
      empty.style.margin = "0";
      empty.style.color = "#a88d63";
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement("ul");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "10px";
    list.style.margin = "0";
    list.style.padding = "0";
    list.style.listStyle = "none";

    for (const character of characters) {
      list.appendChild(this.createCharacterListItem(character));
    }

    section.appendChild(list);
    return section;
  }

  private createCharacterListItem(character: CharacterSummary): HTMLElement {
    const isSelected = character.id === this.selectedCharacterId;
    const item = document.createElement("li");
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.gap = "14px";
    item.style.padding = "12px";
    item.style.border = isSelected ? "1px solid #b9d49a" : "1px solid #3d3324";
    item.style.borderRadius = "8px";
    item.style.background = isSelected ? "rgba(46, 60, 31, 0.72)" : "rgba(25, 19, 14, 0.9)";

    const content = document.createElement("div");
    content.style.minWidth = "0";
    content.style.flex = "1";

    const name = document.createElement("strong");
    name.textContent = isSelected ? `${character.characterName} ✓` : character.characterName;
    name.style.display = "block";
    name.style.marginBottom = "6px";
    name.style.color = "#ffe6bd";
    content.appendChild(name);

    const details = document.createElement("p");
    details.textContent = [
      `${t("character.origin")}: ${t(`origin.${character.originKey}.name`)}`,
      `${t("character.class")}: ${t(`class.${character.classKey}.name`)}`,
      `${t("character.level")}: ${character.level}`
    ].join(" · ");
    details.style.margin = "0";
    details.style.color = "#c7ad84";
    content.appendChild(details);
    item.appendChild(content);

    const selectButton = this.createButton(t("character.select"));
    selectButton.style.marginTop = "0";
    selectButton.disabled = isSelected;
    selectButton.style.cursor = isSelected ? "default" : "pointer";
    selectButton.style.opacity = isSelected ? "0.72" : "1";
    selectButton.setAttribute("aria-pressed", String(isSelected));
    selectButton.addEventListener("click", () => {
      this.selectedCharacterId = character.id;
      storeSelectedCharacterId(character.id);

      if (this.account !== null) {
        this.renderAccountOverlay(this.account);
      }
    });
    item.appendChild(selectButton);

    return item;
  }

  private createCharacterCreateForm(): HTMLElement {
    const section = document.createElement("section");
    section.style.margin = "18px 0 22px";
    section.style.padding = "16px";
    section.style.border = "1px solid #3d3324";
    section.style.borderRadius = "8px";
    section.style.background = "rgba(18, 14, 11, 0.9)";

    const title = document.createElement("h2");
    title.textContent = t("character.create");
    title.style.margin = "0 0 12px";
    title.style.fontFamily = "Georgia, serif";
    title.style.fontSize = "24px";
    section.appendChild(title);

    const characterName = this.createInput(t("character.name"), "doomscrolls-character-name");
    const origin = this.createFixedOptionSelect(
      t("character.origin"),
      "doomscrolls-character-origin",
      CORE_0_1_ORIGIN_ID,
      t("origin.sewer_dweller.name")
    );
    const characterClass = this.createFixedOptionSelect(
      t("character.class"),
      "doomscrolls-character-class",
      CORE_0_1_CLASS_ID,
      t("class.gravewalker.name")
    );
    const createButton = this.createButton(t("character.create"));

    const fields = document.createElement("div");
    fields.style.display = "grid";
    fields.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
    fields.style.gap = "12px";
    fields.append(characterName.wrapper, origin.wrapper, characterClass.wrapper);
    section.appendChild(fields);
    section.appendChild(createButton);

    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.style.minHeight = "22px";
    status.style.margin = "12px 0 0";
    status.style.color = "#d8c6a3";
    section.appendChild(status);

    const elements: CharacterCreateFormElements = {
      status,
      characterName: characterName.input,
      origin: origin.select,
      characterClass: characterClass.select,
      createButton
    };

    createButton.addEventListener("click", () => {
      void this.submitCreateCharacter(elements);
    });

    return section;
  }

  private async submitCreateCharacter(elements: CharacterCreateFormElements): Promise<void> {
    if (this.apiClient === null) {
      this.setCreateStatus(elements, t("auth.api_url_missing"), "error");
      return;
    }

    const sessionToken = readStoredSessionToken();
    if (sessionToken === null) {
      this.setCreateStatus(elements, t("error.invalid_token"), "error");
      return;
    }

    const characterName = elements.characterName.value.trim();
    if (characterName === "") {
      this.setCreateStatus(elements, t("error.invalid_character_create_input"), "error");
      return;
    }

    elements.createButton.disabled = true;
    this.setCreateStatus(elements, "", "info");

    try {
      const createdCharacter = await this.apiClient.createCharacter(sessionToken, {
        characterName,
        originKey: elements.origin.value as OriginKey,
        classKey: elements.characterClass.value as CharacterClassKey
      });

      this.selectedCharacterId = createdCharacter.id;
      storeSelectedCharacterId(createdCharacter.id);

      const account = await this.apiClient.getMe(sessionToken);
      this.account = account;
      this.renderAccountOverlay(account);
    } catch (error: unknown) {
      elements.createButton.disabled = false;
      this.setCreateStatus(elements, this.toSafeCreateCharacterErrorMessage(error), "error");
    }
  }

  private createInput(
    labelText: string,
    id: string
  ): { readonly wrapper: HTMLElement; readonly input: HTMLInputElement } {
    const wrapper = document.createElement("label");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "6px";
    wrapper.style.fontSize = "14px";
    wrapper.setAttribute("for", id);
    wrapper.textContent = labelText;

    const input = document.createElement("input");
    input.id = id;
    input.type = "text";
    input.autocomplete = "off";
    input.style.padding = "10px 12px";
    input.style.border = "1px solid #5f4a2f";
    input.style.borderRadius = "8px";
    input.style.background = "#130f0c";
    input.style.color = "#f0dec0";
    input.style.font = "inherit";
    wrapper.appendChild(input);

    return { wrapper, input };
  }

  private createFixedOptionSelect(
    labelText: string,
    id: string,
    value: OriginKey | CharacterClassKey,
    optionText: string
  ): { readonly wrapper: HTMLElement; readonly select: HTMLSelectElement } {
    const wrapper = document.createElement("label");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "6px";
    wrapper.style.fontSize = "14px";
    wrapper.setAttribute("for", id);
    wrapper.textContent = labelText;

    const select = document.createElement("select");
    select.id = id;
    select.style.padding = "10px 12px";
    select.style.border = "1px solid #5f4a2f";
    select.style.borderRadius = "8px";
    select.style.background = "#130f0c";
    select.style.color = "#f0dec0";
    select.style.font = "inherit";

    const option = document.createElement("option");
    option.value = value;
    option.textContent = optionText;
    select.appendChild(option);
    wrapper.appendChild(select);

    return { wrapper, select };
  }

  private createButton(label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.marginTop = "12px";
    button.style.padding = "11px 14px";
    button.style.border = "1px solid #8d6a35";
    button.style.borderRadius = "8px";
    button.style.background = "#5a311f";
    button.style.color = "#ffe6bd";
    button.style.cursor = "pointer";
    button.style.font = "inherit";
    return button;
  }

  private setCreateStatus(elements: CharacterCreateFormElements, message: string, tone: "error" | "info"): void {
    elements.status.textContent = message;
    elements.status.style.color = tone === "error" ? "#ff9c8a" : "#d8c6a3";
  }

  private toSafeCreateCharacterErrorMessage(error: unknown): string {
    if (!(error instanceof ApiClientError)) {
      return t("error.generic");
    }

    return this.toSafeApiErrorMessage(error.code);
  }

  private toSafeApiErrorMessage(code: ApiErrorCode): string {
    switch (code) {
      case "SERVER_UNAVAILABLE":
        return t("error.server_unavailable");
      case "VALIDATION_ERROR":
      case "INVALID_CHARACTER_NAME":
      case "INVALID_ORIGIN":
      case "INVALID_CLASS":
      case "ORIGIN_CLASS_NOT_ALLOWED":
        return t("error.invalid_character_create_input");
      case "CHARACTER_NAME_TAKEN":
        return t("error.duplicate_character_name");
      case "SESSION_INVALID":
      case "SESSION_EXPIRED":
      case "AUTH_ERROR":
        return t("error.invalid_token");
      case "API_URL_MISSING":
        return t("auth.api_url_missing");
      case "INVALID_USERNAME":
      case "INVALID_PASSWORD":
      case "INVALID_DISPLAY_NAME":
      case "USERNAME_TAKEN":
      case "INVALID_CREDENTIALS":
      case "CHARACTER_NOT_FOUND":
      case "INTERNAL_ERROR":
      case "UNKNOWN_ERROR":
        return t("error.generic");
    }
  }

  private createInfoLine(label: string, value: string): HTMLElement {
    const line = document.createElement("p");
    line.style.margin = "8px 0";

    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    line.append(document.createTextNode(value));

    return line;
  }

  private destroyOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}