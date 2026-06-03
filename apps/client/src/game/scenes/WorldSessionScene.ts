import type { Room } from "@colyseus/sdk";
import type { CharacterId, CharacterSummary, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import type { AccountState } from "../../net/ApiClient";
import { createConnectedWorldSessionView } from "./accountShell/worldEntryView";

interface WorldSessionSceneData {
  readonly account: AccountState;
  readonly characterId: CharacterId;
  readonly room: Room<DoomscrollsRoomState>;
}

export class WorldSessionScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private account: AccountState | null = null;
  private characterId: CharacterId | null = null;
  private room: Room<DoomscrollsRoomState> | null = null;

  public constructor() {
    super("WorldSessionScene");
  }

  public init(data: WorldSessionSceneData): void {
    this.account = data.account;
    this.characterId = data.characterId;
    this.room = data.room;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#090706");

    if (this.account === null || this.room === null || this.characterId === null) {
      this.scene.start("AuthScene");
      return;
    }

    this.add
      .text(640, 96, "Doomscrolls", {
        color: "#d8c6a3",
        fontFamily: "Georgia, serif",
        fontSize: "44px"
      })
      .setOrigin(0.5);

    this.renderOverlay();
    this.room.onStateChange(() => {
      if (this.room !== null) {
        this.renderOverlay();
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyOverlay());
  }

  private renderOverlay(): void {
    if (this.account === null || this.room === null) {
      return;
    }

    this.destroyOverlay();
    this.overlay = this.createOverlay(
      this.account,
      this.account.characters.find((character) => character.id === this.characterId) ?? null,
      this.room,
    );
  }

  private createOverlay(
    account: AccountState,
    character: CharacterSummary | null,
    room: Room<DoomscrollsRoomState>,
  ): HTMLDivElement {
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

    panel.appendChild(
      createConnectedWorldSessionView(character, room, () => {
        void this.handleLeaveWorld();
      })
    );

    document.body.appendChild(root);
    return root;
  }

  private async handleLeaveWorld(): Promise<void> {
    const room = this.room;
    const account = this.account;

    this.room = null;

    if (room !== null) {
      try {
        room.leave();
      } catch {
        // Ignore leave errors.
      }
    }

    this.destroyOverlay();

    if (account !== null) {
      this.scene.start("AccountShellScene", { account });
    }
  }

  private destroyOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}