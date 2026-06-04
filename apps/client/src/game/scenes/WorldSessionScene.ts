import type { Room } from "@colyseus/sdk";
import type { CharacterId, CharacterSummary, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import Phaser from "phaser";

import type { AccountState } from "../../net/ApiClient";
import { registerAttackResponseListeners } from "../../net/attackIntentClient";
import { registerInteractResponseListener } from "../../net/interactResponseClient";
import { createAccountHeader } from "./accountShell/accountShellAccountHeader";
import { applyOverlayPanelStyles, applyOverlayRootStyles } from "./accountShell/accountShellOverlayStyling";
import { createWorldSessionOverlayView } from "./worldSession/worldSessionOverlayView";
import { createWorldSessionAreaView, type WorldSessionAreaView } from "./worldSession/worldSessionAreaView";

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
  private interactResponseText: Phaser.GameObjects.Text | null = null;
  private interactResponseTimer: Phaser.Time.TimerEvent | null = null;
  private attackFeedbackText: Phaser.GameObjects.Text | null = null;
  private attackFeedbackTimer: Phaser.Time.TimerEvent | null = null;

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

    // Task 057 — Create interact response message display
    this.interactResponseText = this.add.text(640, 200, "", {
      color: "#d8c6a3",
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      align: "center",
      wordWrap: { width: 400 },
    }).setOrigin(0.5);

    this.attackFeedbackText = this.add.text(640, 226, "", {
      color: "#e0b870",
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      align: "center",
      wordWrap: { width: 400 },
    }).setOrigin(0.5);

    this.worldAreaView = createWorldSessionAreaView(this, this.room, (message: string) => {
      this.showAttackFeedback(message);
    }, () => {
      this.renderOverlay();
    });

    // Task 057 — Register interact response listener
    registerInteractResponseListener(this.room, (message: string) => {
      if (this.interactResponseText !== null) {
        this.interactResponseText.setText(message);
        
        // Clear message after 3 seconds
        if (this.interactResponseTimer !== null) {
          this.time.removeEvent(this.interactResponseTimer);
        }
        this.interactResponseTimer = this.time.delayedCall(3000, () => {
          if (this.interactResponseText !== null) {
            this.interactResponseText.setText("");
          }
          this.interactResponseTimer = null;
        });
      }
    });

    registerAttackResponseListeners(this.room, {
      onAccepted: () => {
        this.showAttackFeedback("Attack sent");
      },
      onRejected: (message) => {
        this.showAttackFeedback(
          message.reason === "out_of_range" ? "Too far away" : "Attack could not be used",
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
    applyOverlayRootStyles(root);

    const panel = document.createElement("section");
    applyOverlayPanelStyles(panel);
    root.appendChild(panel);

    panel.appendChild(createAccountHeader(account));

    panel.appendChild(
      createWorldSessionOverlayView(
        character,
        room,
        this.worldAreaView?.getDebugState() ?? { lastClickTarget: null },
        () => {
        void this.handleLeaveWorld();
        },
      )
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
    if (this.attackFeedbackText === null) {
      return;
    }

    this.attackFeedbackText.setText(message);
    if (this.attackFeedbackTimer !== null) {
      this.time.removeEvent(this.attackFeedbackTimer);
    }

    this.attackFeedbackTimer = this.time.delayedCall(1500, () => {
      if (this.attackFeedbackText !== null) {
        this.attackFeedbackText.setText("");
      }
      this.attackFeedbackTimer = null;
    });
  }

  private handleSceneTeardown(): void {
    if (this.interactResponseTimer !== null) {
      this.time.removeEvent(this.interactResponseTimer);
      this.interactResponseTimer = null;
    }
    this.interactResponseText = null;
    if (this.attackFeedbackTimer !== null) {
      this.time.removeEvent(this.attackFeedbackTimer);
      this.attackFeedbackTimer = null;
    }
    this.attackFeedbackText = null;
    this.worldAreaView?.destroy();
    this.worldAreaView = null;
    this.destroyOverlay();
  }
}