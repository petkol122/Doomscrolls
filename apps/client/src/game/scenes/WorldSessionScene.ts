import type { Room } from "@colyseus/sdk";
import type {
  CharacterId,
  CharacterSummary,
  EquipmentLoadout,
  ObjectiveUpdatedServerMessage,
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
import { registerSkillSlotResponseListeners } from "../../net/skillSlotIntentClient";
import { createWorldSessionFeedbackView, type WorldSessionFeedbackView } from "./worldSession/worldSessionFeedbackView";
import { createWorldSessionOverlayView } from "./worldSession/worldSessionOverlayView";
import { createWorldSessionAreaView, type WorldSessionAreaView } from "./worldSession/worldSessionAreaView";
import { attachWorldSessionDodgeInput, type WorldSessionDodgeInput } from "./worldSession/worldSessionDodgeInput";
import {
  attachWorldSessionHealingFlaskInput,
  type WorldSessionHealingFlaskInput,
} from "./worldSession/worldSessionHealingFlaskInput";
import {
  applyWorldSessionOverlayPanelStyles,
  applyWorldSessionOverlayRootStyles,
  applyWorldSessionOverlayHudStyles,
  applyWorldSessionOverlayStatusStyles,
  applyWorldSessionOverlayUtilityStyles,
} from "./worldSession/worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../worldProjection";
import { defaultWorldProjection } from "../worldProjection";
import {
  createEmptyEquipmentLoadout,
  registerEquipmentListener,
} from "./worldSession/worldSessionEquipmentView";
import type { WorldSessionUtilityPanelOpenState } from "./worldSession/worldSessionOverlayView";

function formatItemRarityLabel(rarity?: string): string | null {
  if (rarity === undefined || rarity.length === 0) {
    return null;
  }

  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function formatPickupAcceptedNotice(message: { readonly message: string; readonly itemLabel?: string; readonly rarity?: string }): string {
  if (message.itemLabel === undefined || message.itemLabel.length === 0) {
    return message.message;
  }

  const rarityLabel = formatItemRarityLabel(message.rarity);
  return rarityLabel === null
    ? `${message.message} ${t(message.itemLabel as never)}`
    : `${message.message} ${t(message.itemLabel as never)} [${rarityLabel}]`;
}

interface WorldSessionSceneData {
  readonly account: AccountState;
  readonly characterId: CharacterId;
  readonly room: Room<DoomscrollsRoomState>;
}

export class WorldSessionScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private overlayView: ReturnType<typeof createWorldSessionOverlayView> | null = null;
  private account: AccountState | null = null;
  private characterId: CharacterId | null = null;
  private room: Room<DoomscrollsRoomState> | null = null;
  private bootMarker: Phaser.GameObjects.Text | null = null;
  private worldAreaView: WorldSessionAreaView | null = null;
  private feedbackView: WorldSessionFeedbackView | null = null;
  private apiClient: ApiClient | null = null;
  private dodgeInput: WorldSessionDodgeInput | null = null;
  private healingFlaskInput: WorldSessionHealingFlaskInput | null = null;
  private equipmentLoadout: EquipmentLoadout = createEmptyEquipmentLoadout();
  private lastObjectiveCompletionNotice: string | null = null;
  private utilityPanelOpenState: WorldSessionUtilityPanelOpenState = {
    controls: false,
    equipment: false,
    inventory: false,
    debug: false,
  };

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
    this.bootMarker = this.add.text(24, 24, "WORLD_SESSION_CREATE_STARTED", {
      color: "#ff6b6b",
      fontFamily: "Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      backgroundColor: "#1a0000",
      padding: { left: 8, right: 8, top: 6, bottom: 6 },
    }).setDepth(10_000);

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

    registerInteractResponseListener(this.room, (message: string) => {
      this.feedbackView?.showNotice(message);
    }, (message: ObjectiveUpdatedServerMessage) => {
      if (message.completed) {
        const completionText = `${message.label} complete.`;
        if (this.lastObjectiveCompletionNotice !== completionText) {
          this.lastObjectiveCompletionNotice = completionText;
          this.feedbackView?.showNotice(completionText);
          this.showAttackFeedback(completionText);
        }
      }
      this.renderOverlay();
    });

    registerAttackResponseListeners(this.room, {
      onAccepted: (message) => {
        this.showAttackFeedback(t("world_area.attack_confirmed"));
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
        this.worldAreaView?.showPlayerFloatingDamage(`-${message.damage}`);
        this.feedbackView?.showDamageFeedback(
          isDowned
            ? t("world_session.downed_damage_feedback", { damage: message.damage })
            : t("world_session.damage_feedback", { damage: message.damage, hp: message.remainingHp }),
          { isDowned },
        );
        this.feedbackView?.showNotice(
          t("world_area.player_damage_taken", { damage: message.damage, hp: message.remainingHp }),
        );
        if (isDowned) {
          this.feedbackView?.showNotice(t("world_session.downed_notice"));
        }
      },
      onEnemyAttackTelegraph: (message) => {
        this.worldAreaView?.showEnemyTelegraph(message.enemyId);
      },
    });

    this.room.onMessage("xp_gained", (message: { amount?: unknown; totalXp?: unknown; leveledUp?: unknown; hp?: unknown; maxHp?: unknown }) => {
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
      void this.refreshAccountStateAfterProgression();
      this.renderOverlay();
    });

    registerRespawnListeners(this.room, {
      onRespawned: (message: PlayerRespawnedServerMessage) => {
        this.feedbackView?.clearDamageFeedback();
        this.feedbackView?.showNotice(t("world_session.respawned_notice", { hp: message.hp }));
      },
    });

    this.dodgeInput?.destroy();
    this.dodgeInput = null;
    this.healingFlaskInput?.destroy();
    this.healingFlaskInput = null;

    this.dodgeInput = attachWorldSessionDodgeInput(
      this,
      this.room,
      {
        getLastClickTarget: () => this.worldAreaView?.getLastClickTarget() ?? null,
        getSelfPosition: () => this.worldAreaView?.getSelfWorldPosition() ?? null,
      },
      {
        onDodgeSentFeedback: (message) => { this.feedbackView?.showNotice(message); },
        onDodgeConfirmedFeedback: (message) => { this.feedbackView?.showNotice(message); },
        onDodgeRejectedFeedback: (message) => { this.feedbackView?.showNotice(message); },
        onDodgeNoDirectionFeedback: (message) => { this.feedbackView?.showNotice(message); },
      },
    );

    this.healingFlaskInput = attachWorldSessionHealingFlaskInput(this, this.room, {
      onFlaskSentFeedback: (message) => {
        this.feedbackView?.showNotice(message);
      },
      onFlaskAcceptedFeedback: (message) => {
        this.feedbackView?.showNotice(
          t("world_area.flask_healed", { healed: message.healedAmount, hp: message.remainingHp }),
        );
      },
      onFlaskRejectedFeedback: (message) => {
        if (message.reason === "no_charges") { this.feedbackView?.showNotice(t("world_area.flask_no_charges")); return; }
        if (message.reason === "already_full_hp") { this.feedbackView?.showNotice(t("world_area.flask_full_hp")); return; }
        if (message.reason === "flask_on_cooldown") { this.feedbackView?.showNotice(t("world_area.flask_on_cooldown")); return; }
        if (message.reason === "player_downed") { this.feedbackView?.showNotice(t("world_area.flask_downed")); return; }
        this.feedbackView?.showNotice(t("world_area.flask_unavailable"));
      },
    });

    registerPickupWorldLootResponseListeners(this.room, {
      onDeferredQueued: (message) => {
        this.worldAreaView?.setPendingPickupTarget(message.targetId);
        this.feedbackView?.showNotice(t("world_area.pickup_moving_closer"));
      },
      onAccepted: (message) => {
        this.worldAreaView?.setPendingPickupTarget(null);
        this.feedbackView?.showNotice(formatPickupAcceptedNotice(message));
        void this.refreshAccountStateAfterPickup();
      },
      onRejected: (message) => {
        this.worldAreaView?.setPendingPickupTarget(null);
        this.feedbackView?.showNotice(
          message.reason === "out_of_range" ? t("world_area.pickup_too_far")
            : message.reason === "inventory_full" ? t("world_area.inventory_full")
            : message.reason === "world_loot_not_found" ? t("world_area.pickup_unavailable")
            : t("world_area.pickup_unavailable"),
        );
      },
    });

    registerSkillSlotResponseListeners(this.room, {
      onAccepted: () => {
        this.feedbackView?.showNotice(t("world_area.skill_unlearned"));
      },
      onRejected: (message) => {
        if (message.reason === "slot_not_learned") {
          this.feedbackView?.showNotice(t("world_area.skill_unlearned"));
          return;
        }
        this.feedbackView?.showNotice(t("world_area.skill_unavailable"));
      },
    });

    this.renderOverlay();
    this.bootMarker?.destroy();
    this.bootMarker = null;
    this.room.onStateChange(() => {
      if (this.room !== null) {
        this.worldAreaView?.refreshFromRoomState(this.room);
        this.renderOverlay();
      }
    });

    registerEquipmentListener(this.room, (loadout: EquipmentLoadout) => {
      this.equipmentLoadout = loadout;
      this.renderOverlay();
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleSceneTeardown());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.handleSceneTeardown());
  }

  private renderOverlay(): void {
    if (this.account === null || this.room === null) {
      return;
    }

    const character = this.account.characters.find((nextCharacter) => nextCharacter.id === this.characterId) ?? null;
    const debugState = this.worldAreaView?.getDebugState() ?? {
      lastClickTarget: null,
      projectionMode: defaultWorldProjection,
      isMovementInputEnabled: true,
      zoom: 1,
    };

    if (this.overlay === null || this.overlayView === null) {
      const overlay = this.createOverlay(character, this.room, debugState);
      this.overlay = overlay.root;
      this.overlayView = overlay.view;
      return;
    }

    this.overlayView.update(character, this.room, debugState);
  }

  private createOverlay(
    character: CharacterSummary | null,
    room: Room<DoomscrollsRoomState>,
    debugState: ReturnType<WorldSessionAreaView["getDebugState"]>,
  ): { readonly root: HTMLDivElement; readonly view: ReturnType<typeof createWorldSessionOverlayView> } {
    const root = document.createElement("div");
    applyWorldSessionOverlayRootStyles(root);

    const statusRegion = document.createElement("div");
    applyWorldSessionOverlayStatusStyles(statusRegion);
    root.appendChild(statusRegion);

    const utilityRegion = document.createElement("div");
    applyWorldSessionOverlayUtilityStyles(utilityRegion);
    root.appendChild(utilityRegion);

    const hudRegion = document.createElement("div");
    applyWorldSessionOverlayHudStyles(hudRegion);
    root.appendChild(hudRegion);

    const overlayView = createWorldSessionOverlayView(
      character,
      room,
      debugState,
      (mode) => {
        this.handleProjectionModeChange(mode);
      },
      () => {
        this.handleRespawn();
      },
      () => {
        void this.handleLeaveWorld();
      },
      () => this.utilityPanelOpenState,
      (nextState) => {
        this.utilityPanelOpenState = nextState;
      },
      () => this.equipmentLoadout,
      (loadout: EquipmentLoadout) => {
        this.equipmentLoadout = loadout;
      },
      (characterId: string, itemInstanceId: string, slot: string) => {
        return this.handleEquipItem(characterId, itemInstanceId, slot);
      },
      (characterId: string, slot: string) => {
        return this.handleUnequipItem(characterId, slot);
      },
    );
    utilityRegion.appendChild(overlayView.utilityPanel);
    hudRegion.appendChild(overlayView.hudPanel);
    if (overlayView.statusPanel !== null) {
      statusRegion.appendChild(overlayView.statusPanel);
    }

    document.body.appendChild(root);
    return { root, view: overlayView };
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
    this.overlayView = null;
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
    this.bootMarker?.destroy();
    this.bootMarker = null;
    this.dodgeInput?.destroy();
    this.dodgeInput = null;
    this.healingFlaskInput?.destroy();
    this.healingFlaskInput = null;
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

  private async handleEquipItem(
    characterId: string,
    itemInstanceId: string,
    slot: string,
  ): Promise<void> {
    if (this.apiClient === null) {
      throw new Error("API client not available");
    }

    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (typeof sessionToken !== "string" || sessionToken.length === 0) {
      throw new Error("Not authenticated");
    }

    await this.apiClient.equipItem(sessionToken, characterId, itemInstanceId, slot);

    // Refresh account state to get updated inventory + equipment
    try {
      this.account = await this.apiClient.getMe(sessionToken);
      this.renderOverlay();
    } catch {
      // Refresh happened best-effort
    }
  }

  private async handleUnequipItem(
    characterId: string,
    slot: string,
  ): Promise<void> {
    if (this.apiClient === null) {
      throw new Error("API client not available");
    }

    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (typeof sessionToken !== "string" || sessionToken.length === 0) {
      throw new Error("Not authenticated");
    }

    await this.apiClient.unequipItem(sessionToken, characterId, slot);

    try {
      this.account = await this.apiClient.getMe(sessionToken);
      this.renderOverlay();
    } catch {
      // Refresh happened best-effort
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
      this.renderOverlay();
    } catch {
      // Ignore refresh failures; pickup feedback already came from realtime server authority.
    }
  }

  private async refreshAccountStateAfterProgression(): Promise<void> {
    if (this.apiClient === null) {
      return;
    }

    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (typeof sessionToken !== "string" || sessionToken.length === 0) {
      return;
    }

    try {
      this.account = await this.apiClient.getMe(sessionToken);
      this.renderOverlay();
    } catch {
      // Ignore refresh failures; realtime state already carries the live progression values.
    }
  }
}