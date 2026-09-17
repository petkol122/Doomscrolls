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
import { enterWorldForCharacter } from "../../net/RealtimeClient";

import { createAccountHeader } from "./accountShell/accountShellAccountHeader";
import { createButton } from "./accountShell/accountShellDom";
import { createCharacterRoster } from "./accountShell/characterListView";
import { createCharacterPedestal } from "./accountShell/characterPedestalView";
import {
  createCharacterCreateForm,
  setCreateStatus,
  type CharacterCreateFormElements
} from "./accountShell/characterCreateFormView";
import { createCharacterDeleteConfirmModal } from "./accountShell/characterDeleteConfirmModal";
import { applyOverlayPanelStyles, applyOverlayRootStyles } from "./accountShell/accountShellOverlayStyling";

interface AccountShellSceneData {
  readonly account: AccountState;
}

type AccountShellMode = "select" | "create";

export class AccountShellScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private deleteConfirmOverlay: HTMLElement | null = null;
  private account: AccountState | null = null;
  private apiClient: ApiClient | null = null;
  private selectedCharacterId: CharacterId | null = null;
  private mode: AccountShellMode = "select";

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
      .text(this.scale.width / 2, 96, "Doomscrolls", {
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
    applyOverlayRootStyles(root);

    const panel = document.createElement("section");
    applyOverlayPanelStyles(panel);
    root.appendChild(panel);

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "flex-start";
    header.style.justifyContent = "space-between";
    header.appendChild(createAccountHeader(account));

    const logout = createButton(t("auth.logout"), "ghost");
    logout.style.marginTop = "0";
    logout.addEventListener("click", () => {
      clearStoredSessionToken();
      clearStoredSelectedCharacterId();
      this.destroyOverlay();
      this.scene.start("AuthScene");
    });
    header.appendChild(logout);
    panel.appendChild(header);

    if (this.mode === "create") {
      panel.appendChild(
        createCharacterCreateForm(
          account.characters,
          (elements) => {
            void this.submitCreateCharacter(elements);
          },
          () => {
            this.mode = "select";
            this.renderAccountOverlay(account);
          }
        )
      );
    } else {
      const layout = document.createElement("div");
      layout.style.display = "grid";
      layout.style.gridTemplateColumns = "minmax(220px, 280px) 1fr";
      layout.style.gap = "20px";
      layout.style.marginTop = "18px";

      const rosterPane = document.createElement("div");
      rosterPane.style.maxHeight = "min(60vh, 520px)";
      rosterPane.style.display = "flex";
      rosterPane.style.flexDirection = "column";
      rosterPane.appendChild(
        createCharacterRoster(account.characters, this.selectedCharacterId, (id) => {
          this.selectedCharacterId = id;
          storeSelectedCharacterId(id);
          this.renderAccountOverlay(account);
        })
      );
      layout.appendChild(rosterPane);

      const selectedCharacter =
        account.characters.find((character) => character.id === this.selectedCharacterId) ?? null;

      layout.appendChild(
        createCharacterPedestal(selectedCharacter, {
          onEnterWorld: () => {
            void this.handleEnterWorld();
          },
          onDeleteCharacter: (character) => {
            this.showDeleteConfirm(character);
          },
          onCreateCharacter: () => {
            this.mode = "create";
            this.renderAccountOverlay(account);
          }
        })
      );

      panel.appendChild(layout);
    }

    document.body.appendChild(root);
    return root;
  }

  private async handleEnterWorld(): Promise<void> {
    const sessionToken = readStoredSessionToken();
    if (sessionToken === null || this.selectedCharacterId === null || this.account === null) {
      return;
    }

    try {
      const joinedRoom = await enterWorldForCharacter(
        this.account.characters,
        this.selectedCharacterId,
        sessionToken as SessionToken,
      );

      this.destroyOverlay();
      this.scene.start("WorldSessionScene", {
        account: this.account,
        characterId: this.selectedCharacterId,
        room: joinedRoom,
      });
    } catch {
      const status = document.getElementById("doomscrolls-world-entry-status");
      if (status !== null) {
        status.textContent = t("world_entry.join_failed");
        status.style.color = "#ff9c8a";
      }
    }
  }

  private showDeleteConfirm(character: CharacterSummary): void {
    this.destroyDeleteConfirmOverlay();
    this.deleteConfirmOverlay = createCharacterDeleteConfirmModal(
      character,
      () => {
        void this.handleDeleteCharacter(character.id);
      },
      () => {
        this.destroyDeleteConfirmOverlay();
      }
    );
    document.body.appendChild(this.deleteConfirmOverlay);
  }

  private destroyDeleteConfirmOverlay(): void {
    this.deleteConfirmOverlay?.remove();
    this.deleteConfirmOverlay = null;
  }

  private async handleDeleteCharacter(characterId: CharacterId): Promise<void> {
    this.destroyDeleteConfirmOverlay();

    if (this.apiClient === null) {
      return;
    }

    const sessionToken = readStoredSessionToken();
    if (sessionToken === null) {
      return;
    }

    try {
      await this.apiClient.deleteCharacter(sessionToken, characterId);

      if (this.selectedCharacterId === characterId) {
        this.selectedCharacterId = null;
        clearStoredSelectedCharacterId();
      }

      const account = await this.apiClient.getMe(sessionToken);
      this.account = account;
      this.renderAccountOverlay(account);
    } catch {
      if (this.account !== null) {
        this.renderAccountOverlay(this.account);
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
      this.mode = "select";

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
      case "ITEM_NOT_FOUND":
      case "ITEM_NOT_IN_INVENTORY":
      case "ITEM_NOT_EQUIPPABLE":
      case "SLOT_MISMATCH":
      case "INVENTORY_FULL":
      case "INTERNAL_ERROR":
      case "UNKNOWN_ERROR":
        return t("error.generic");
    }
  }

  private destroyOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.destroyDeleteConfirmOverlay();
  }
}
