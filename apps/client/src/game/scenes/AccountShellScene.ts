import { t } from "@doomscrolls/localization";
import type { CharacterClassKey, CharacterId, CharacterSummary, OriginKey, SessionToken } from "@doomscrolls/shared";
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
  joinTownRoom
} from "../../net/RealtimeClient";

import { createInfoLine } from "./accountShell/accountShellDom";
import { createCharacterList } from "./accountShell/characterListView";
import {
  createCharacterCreateForm,
  setCreateStatus,
  type CharacterCreateFormElements
} from "./accountShell/characterCreateFormView";
import { createWorldEntryStub } from "./accountShell/worldEntryView";

interface AccountShellSceneData {
  readonly account: AccountState;
}

export class AccountShellScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private account: AccountState | null = null;
  private apiClient: ApiClient | null = null;
  private selectedCharacterId: CharacterId | null = null;

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

    panel.appendChild(createInfoLine(t("profile.display_name"), account.profile.displayName));
    panel.appendChild(createInfoLine(t("profile.avatar"), account.profile.avatarKey));

    const loaded = document.createElement("p");
    loaded.textContent = t("auth.account_loaded");
    loaded.style.margin = "18px 0";
    loaded.style.color = "#b9d49a";
    panel.appendChild(loaded);

    panel.appendChild(
      createWorldEntryStub(
        account.characters,
        this.selectedCharacterId,
        () => {
          void this.handleEnterWorld();
        }
      )
    );

    panel.appendChild(
      createCharacterList(
        account.characters,
        this.selectedCharacterId,
        (id) => {
          this.selectedCharacterId = id;
          storeSelectedCharacterId(id);
          if (this.account !== null) {
            this.renderAccountOverlay(this.account);
          }
        }
      )
    );

    panel.appendChild(
      createCharacterCreateForm((elements) => {
        void this.submitCreateCharacter(elements);
      })
    );

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

  private async handleEnterWorld(): Promise<void> {
    const sessionToken = readStoredSessionToken();
    if (sessionToken === null || this.selectedCharacterId === null) {
      return;
    }

    try {
      const client = createRealtimeClient();
      const joinedRoom = await joinTownRoom(client, sessionToken as SessionToken, this.selectedCharacterId);

      if (this.account !== null) {
        this.destroyOverlay();
        this.scene.start("WorldSessionScene", {
          account: this.account,
          characterId: this.selectedCharacterId,
          room: joinedRoom,
        });
      }
    } catch {
      const status = document.getElementById("doomscrolls-world-entry-status");
      if (status !== null) {
        status.textContent = t("world_entry.join_failed");
        status.style.color = "#ff9c8a";
      }
    }
  }

  private async submitCreateCharacter(elements: CharacterCreateFormElements): Promise<void> {
    if (this.apiClient === null) {
      setCreateStatus(elements, t("auth.api_url_missing"), "error");
      return;
    }

    const sessionToken = readStoredSessionToken();
    if (sessionToken === null) {
      setCreateStatus(elements, t("error.invalid_token"), "error");
      return;
    }

    const characterName = elements.characterName.value.trim();
    if (characterName === "") {
      setCreateStatus(elements, t("error.invalid_character_create_input"), "error");
      return;
    }

    elements.createButton.disabled = true;
    setCreateStatus(elements, "", "info");

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
      setCreateStatus(elements, this.toSafeCreateCharacterErrorMessage(error), "error");
    }
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

  private destroyOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
