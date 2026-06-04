import type { Room } from "@colyseus/sdk";
import type { CharacterId, CharacterSummary, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { AccountState } from "../../net/ApiClient";
import { registerAttackResponseListeners } from "../../net/attackIntentClient";
import { registerInteractResponseListener } from "../../net/interactResponseClient";
import { createAccountHeader } from "./accountShell/accountShellAccountHeader";
import { createWorldSessionFeedbackView, type WorldSessionFeedbackView } from "./worldSession/worldSessionFeedbackView";
import { createWorldSessionOverlayView } from "./worldSession/worldSessionOverlayView";
import { createWorldSessionAreaView, type WorldSessionAreaView } from "./worldSession/worldSessionAreaView";
import {
  applyWorldSessionOverlayPanelStyles,
  applyWorldSessionOverlayRootStyles,
  applyWorldSessionOverlaySidebarStyles,
} from "./worldSession/worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../worldProjection";
import { defaultWorldProjection } from "../worldProjection";

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
  private worldAreaView: WorldSessionAreaView | null = null;
  private feedbackView: WorldSessionFeedbackView | null = null;

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

    this.feedbackView = createWorldSessionFeedbackView(this);

    this.worldAreaView = createWorldSessionAreaView(this, this.room, (message: string) => {
      this.showAttackFeedback(message);
    }, () => {
      this.renderOverlay();
    });

    // Task 057 — Register interact response listener
    registerInteractResponseListener(this.room, (message: string) => {
      this.feedbackView?.showNotice(message);
    });

    registerAttackResponseListeners(this.room, {
      onAccepted: () => {
        this.showAttackFeedback(t("world_area.attack_confirmed"));
      },
      onRejected: (message) => {
        this.showAttackFeedback(
          message.reason === "out_of_range"
            ? t("world_area.attack_too_far")
            : message.reason === "enemy_defeated"
              ? t("world_area.enemy_defeated")
              : t("world_area.attack_unavailable"),
        );
      },
    });

    this.renderOverlay();
    this.room.onStateChange(() => {
      if (this.room !== null) {
        this.worldAreaView?.refreshFromRoomState(this.room);
        this.renderOverlay();
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleSceneTeardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.handleSceneTeardown());
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
    applyWorldSessionOverlayRootStyles(root);

    const sidebar = document.createElement("div");
    applyWorldSessionOverlaySidebarStyles(sidebar);
    root.appendChild(sidebar);

    const accountPanel = document.createElement("section");
    applyWorldSessionOverlayPanelStyles(accountPanel);
    accountPanel.style.width = "100%";
    accountPanel.appendChild(createAccountHeader(account));
    sidebar.appendChild(accountPanel);

    sidebar.appendChild(
      createWorldSessionOverlayView(
        character,
        room,
        this.worldAreaView?.getDebugState() ?? {
          lastClickTarget: null,
          projectionMode: defaultWorldProjection,
          isMovementInputEnabled: true,
        },
        (mode) => {
          this.handleProjectionModeChange(mode);
        },
        () => {
          void this.handleLeaveWorld();
        },
      ),
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

  private showAttackFeedback(message: string): void {
    this.feedbackView?.showAttackFeedback(message);
  }

  private handleProjectionModeChange(mode: WorldProjectionMode): void {
    this.worldAreaView?.setProjectionMode(mode);
    this.renderOverlay();
  }

  private handleSceneTeardown(): void {
    this.feedbackView?.destroy();
    this.feedbackView = null;
    this.worldAreaView?.destroy();
    this.worldAreaView = null;
    this.destroyOverlay();
  }
}