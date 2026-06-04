import type { Room } from "@colyseus/sdk";
import type {
  CharacterId,
  CharacterSummary,
  PlayerRespawnedServerMessage,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import type { AccountState } from "../../net/ApiClient";
import { ApiClient } from "../../net/ApiClient";
import { clientEnv } from "../../config/env";
import { registerAttackResponseListeners } from "../../net/attackIntentClient";
import { registerInteractResponseListener } from "../../net/interactResponseClient";
import { registerPickupWorldLootResponseListeners } from "../../net/pickupWorldLootClient";
import { registerRespawnListeners, sendRespawnRequest } from "../../net/respawnClient";
import { createAccountHeader } from "./accountShell/accountShellAccountHeader";
import { createWorldSessionFeedbackView, type WorldSessionFeedbackView } from "./worldSession/worldSessionFeedbackView";
import { createWorldSessionOverlayView } from "./worldSession/worldSessionOverlayView";
import { createWorldSessionAreaView, type WorldSessionAreaView } from "./worldSession/worldSessionAreaView";
import { attachWorldSessionDodgeInput, type WorldSessionDodgeInput } from "./worldSession/worldSessionDodgeInput";
import {
  applyWorldSessionOverlayPanelStyles,
  applyWorldSessionOverlayRootStyles,
  applyWorldSessionOverlaySidebarStyles,
} from "./worldSession/worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../worldProjection";
import { defaultWorldProjection } from "../worldProjection";
import {
  sendHealingFlaskIntent,
  registerHealingFlaskResponseListeners,
} from "../../net/healingFlaskIntentClient";

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
  private apiClient: ApiClient | null = null;
  private dodgeInput: WorldSessionDodgeInput | null = null;

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
    this.apiClient = clientEnv.apiUrl === undefined ? null : new ApiClient(clientEnv.apiUrl);

    this.worldAreaView = createWorldSessionAreaView(
      this,
      this.room,
      (message: string) => {
        this.showAttackFeedback(message);
      },
      (message: string) => {
        this.feedbackView?.showNotice(message);
      },
      () => {
        this.renderOverlay();
      },
    );

    // Task 057 — Register interact response listener
    registerInteractResponseListener(this.room, (message: string) => {
      this.feedbackView?.showNotice(message);
    });

    registerAttackResponseListeners(this.room, {
      onAccepted: (message) => {
        this.showAttackFeedback(t("world_area.attack_confirmed"));
        // Task 091 — brief visual damage feedback; HP still comes from synced room state
        this.worldAreaView?.showEnemyFloatingDamage(message.targetEnemyId, "-1");
      },
      onRejected: (message) => {
        this.showAttackFeedback(
          message.reason === "out_of_range"
            ? t("world_area.moving_closer")
            : message.reason === "attack_on_cooldown"
              ? t("world_area.attack_on_cooldown")
            : message.reason === "enemy_defeated"
              ? t("world_area.enemy_defeated")
              : t("world_area.attack_unavailable"),
        );
      },
      onDamageApplied: (message) => {
        const isDowned = message.remainingHp <= 0;
        // Task 092 — brief visual damage feedback near player; HP still comes from synced room state
        this.worldAreaView?.showPlayerFloatingDamage(`-${message.damage}`);
        this.feedbackView?.showDamageFeedback(
          isDowned
            ? t("world_session.downed_damage_feedback", {
                damage: message.damage,
              })
            : t("world_session.damage_feedback", {
                damage: message.damage,
                hp: message.remainingHp,
              }),
          { isDowned },
        );
        this.feedbackView?.showNotice(
          t("world_area.player_damage_taken", {
            damage: message.damage,
            hp: message.remainingHp,
          }),
        );
        if (isDowned) {
          this.feedbackView?.showNotice(t("world_session.downed_notice"));
        }
      },
      // Task 094 — server-owned enemy attack telegraph. The server
      // sends this before the damage lands; the client only uses it
      // to show a brief warning marker on the enemy.
      onEnemyAttackTelegraph: (message) => {
        this.worldAreaView?.showEnemyTelegraph(message.enemyId);
      },
    });

    this.room.onMessage("xp_gained", (message: { amount?: unknown; totalXp?: unknown }) => {
      const amount = typeof message.amount === "number" && Number.isFinite(message.amount)
        ? Math.max(0, Math.floor(message.amount))
        : 0;
      const totalXp = typeof message.totalXp === "number" && Number.isFinite(message.totalXp)
        ? Math.max(0, Math.floor(message.totalXp))
        : null;
      const leveledUp = message !== null
        && typeof message === "object"
        && "leveledUp" in message
        && message.leveledUp === true;

      this.feedbackView?.showNotice(
        totalXp === null
          ? t("world_area.xp_gained", { amount })
          : t("world_area.xp_gained_total", { amount, totalXp }),
      );
      if (leveledUp) {
        this.feedbackView?.showAttackFeedback(t("world_area.level_up"));
      }
      this.renderOverlay();
    });

    registerRespawnListeners(this.room, {
      onRespawned: (message: PlayerRespawnedServerMessage) => {
        this.feedbackView?.clearDamageFeedback();
        this.feedbackView?.showNotice(t("world_session.respawned_notice", { hp: message.hp }));
      },
    });

    // Task 095 — Spacebar -> server-authoritative dodge intent.
    // The dodge helper owns its keyboard listener and the
    // request_dodge_accepted / request_dodge_rejected message
    // listeners, and forwards safe UI feedback to the feedback view.
    this.dodgeInput = attachWorldSessionDodgeInput(
      this,
      this.room,
      {
        getLastClickTarget: () =>
          this.worldAreaView?.getLastClickTarget() ?? null,
        getSelfPosition: () => this.worldAreaView?.getSelfWorldPosition() ?? null,
      },
      {
        onDodgeSentFeedback: (message) => {
          this.feedbackView?.showNotice(message);
        },
        onDodgeConfirmedFeedback: (message) => {
          this.feedbackView?.showNotice(message);
        },
        onDodgeRejectedFeedback: (message) => {
          this.feedbackView?.showNotice(message);
        },
        onDodgeNoDirectionFeedback: (message) => {
          this.feedbackView?.showNotice(message);
        },
      },
    );

    // Task 096 — Q key -> server-authoritative healing flask intent
    const keyboard = this.input.keyboard;
    let qKey: Phaser.Input.Keyboard.Key | null = null;
    if (keyboard !== null) {
      qKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
      qKey.on("down", () => {
        const result = sendHealingFlaskIntent(this.room);
        if (result.dispatched) {
          this.feedbackView?.showNotice(t("world_area.flask_sent"));
        }
      });
    }

    registerHealingFlaskResponseListeners(this.room, {
      onAccepted: (message) => {
        this.feedbackView?.showNotice(
          t("world_area.flask_healed", {
            healed: message.healedAmount,
            hp: message.remainingHp,
          }),
        );
      },
      onRejected: (message) => {
        if (message.reason === "no_charges") {
          this.feedbackView?.showNotice(t("world_area.flask_no_charges"));
          return;
        }
        if (message.reason === "already_full_hp") {
          this.feedbackView?.showNotice(t("world_area.flask_full_hp"));
          return;
        }
        if (message.reason === "flask_on_cooldown") {
          this.feedbackView?.showNotice(t("world_area.flask_on_cooldown"));
          return;
        }
        if (message.reason === "player_downed") {
          this.feedbackView?.showNotice(t("world_area.flask_downed"));
          return;
        }
        this.feedbackView?.showNotice(t("world_area.flask_unavailable"));
      },
    });

    registerPickupWorldLootResponseListeners(this.room, {
      onAccepted: (message) => {
        this.feedbackView?.showNotice(message.message);
        void this.refreshAccountStateAfterPickup();
      },
      onRejected: (message) => {
        this.feedbackView?.showNotice(
          message.reason === "out_of_range"
            ? t("world_area.moving_closer")
            : message.reason === "inventory_full"
              ? t("world_area.inventory_full")
            : message.reason === "world_loot_not_found"
              ? t("world_area.pickup_unavailable")
              : t("world_area.pickup_unavailable"),
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
          this.handleRespawn();
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
    this.apiClient = null;
    this.dodgeInput?.destroy();
    this.dodgeInput = null;
    this.feedbackView?.destroy();
    this.feedbackView = null;
    this.worldAreaView?.destroy();
    this.worldAreaView = null;
    this.destroyOverlay();
  }

  private handleRespawn(): void {
    this.feedbackView?.clearDamageFeedback();
    const result = sendRespawnRequest(this.room);
    if (!result.dispatched) {
      this.feedbackView?.showNotice(t("world_session.respawn_unavailable"));
    }
  }

  private async refreshAccountStateAfterPickup(): Promise<void> {
    if (this.apiClient === null) {
      return;
    }

    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (typeof sessionToken !== "string" || sessionToken.length === 0) {
      return;
    }

    try {
      this.account = await this.apiClient.getMe(sessionToken);
    } catch {
      // Ignore refresh failures; pickup feedback already came from realtime server authority.
    }
  }
}