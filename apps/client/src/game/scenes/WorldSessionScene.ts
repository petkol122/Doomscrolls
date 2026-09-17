import type { Room } from "@colyseus/sdk";
import type {
  AccountStashItemSummary,
  CharacterId,
  CharacterSummary,
  EquipmentLoadout,
  ObjectiveUpdatedServerMessage,
  PlayerRespawnedServerMessage,
  RoomState as DoomscrollsRoomState,
} from "@doomscrolls/shared";
import { formatMoneyCompact } from "@doomscrolls/shared";
import { t } from "@doomscrolls/localization";
import Phaser from "phaser";
import { contentRegistry } from "@doomscrolls/content";

import type { AccountState } from "../../net/ApiClient";
import { ApiClient } from "../../net/ApiClient";
import { clientEnv } from "../../config/env";
import { createRealtimeClient, joinCombatRoom, joinResolvedCharacterRoom, joinTownRoom } from "../../net/RealtimeClient";
import { registerAttackResponseListeners } from "../../net/attackIntentClient";
import { registerInteractResponseListener } from "../../net/interactResponseClient";
import { registerPickupWorldLootResponseListeners } from "../../net/pickupWorldLootClient";
import { sendResetObjectiveIntent } from "../../net/resetObjectiveClient";
import { registerRespawnListeners, sendRespawnRequest } from "../../net/respawnClient";
import { registerSkillSlotResponseListeners } from "../../net/skillSlotIntentClient";
import { registerAllocateSkillPointResponseListeners, sendAllocateSkillPointIntent } from "../../net/skillPointAllocationClient";
import { createWorldSessionSkillTreeView, type WorldSessionSkillTreeView } from "./worldSession/worldSessionSkillTreeView";
import { getCurrentPlayerPresence } from "../../net/townRoomPresence";
import { createWorldSessionAreaBannerView, type WorldSessionAreaBannerView } from "./worldSession/worldSessionAreaBannerView";
import { createWorldSessionFeedbackView, type WorldSessionFeedbackView } from "./worldSession/worldSessionFeedbackView";
import { createWorldSessionOverlayView } from "./worldSession/worldSessionOverlayView";
import { createWorldSessionHudGlobesView } from "./worldSession/worldSessionHudView";
import {
  createVendorInteractionPanel,
  type VendorInteractionPanel,
  type InventoryItemView,
  type ProfessionTrainingView,
} from "./worldSession/worldSessionVendorView";
import {
  type TownServiceInteractionPanel,
} from "./worldSession/townServiceInteractionPanel";
import { showMaterialWithdrawPanel } from "./worldSession/worldSessionMaterialWithdrawPanel";
import {
  createWaypointInteractionPanel,
  type WaypointInteractionPanel,
} from "./worldSession/waypointInteractionPanel";
import {
  createWorldSessionTravelOverlayView,
  type WorldSessionTravelOverlayKind,
} from "./worldSession/worldSessionTravelOverlayView";
import {
  type StashInteractionPanel,
} from "./worldSession/stashInteractionPanel";
import {
  createWorldSessionStashView,
  type WorldSessionStashView,
} from "./worldSession/worldSessionStashView";
import {
  createNoticeBoardInteractionPanel,
  type NoticeBoardInteractionPanel,
} from "./worldSession/noticeBoardInteractionPanel";
import {
  createWorldSessionDialogueView,
  type WorldSessionDialogueView,
} from "./worldSession/worldSessionDialogueView";
import type { AvailableObjectiveEntry, InteractQuestInfo } from "../../net/interactResponseClient";
import {
  createWorldSessionAreaView,
  type WorldSessionAreaView,
  type WorldSessionSkillTargetingState,
} from "./worldSession/worldSessionAreaView";
import { attachWorldSessionDodgeInput, type WorldSessionDodgeInput } from "./worldSession/worldSessionDodgeInput";
import {
  attachWorldSessionFlaskBeltInput,
  type WorldSessionFlaskBeltInput,
} from "./worldSession/worldSessionFlaskBeltInput";
import {
  attachWorldSessionSkillTertiaryInput,
  type WorldSessionSkillTertiaryInput,
} from "./worldSession/worldSessionSkillTertiaryInput";
import {
  attachWorldSessionSkillPrimaryInput,
  type WorldSessionSkillPrimaryInput,
} from "./worldSession/worldSessionSkillPrimaryInput";
import {
  applyWorldSessionOverlayRootStyles,
  applyWorldSessionOverlayHudStyles,
  applyWorldSessionOverlayStatusStyles,
  applyWorldSessionOverlayQuestStyles,
  applyWorldSessionOverlayChatStyles,
} from "./worldSession/worldSessionOverlayLayout";
import { createWorldSessionChatView } from "./worldSession/worldSessionChatView";
import type { WorldProjectionMode } from "../worldProjection";
import { defaultWorldProjection } from "../worldProjection";
import {
  createEmptyEquipmentLoadout,
  createWorldSessionCharacterWindowView,
  registerEquipmentListener,
  type WorldSessionCharacterWindowView,
} from "./worldSession/worldSessionEquipmentView";
import {
  createWorldSessionInventoryWindowView,
  type WorldSessionInventoryWindowView,
} from "./worldSession/worldSessionInventoryView";
import type { WorldSessionOverlayWindowToggles, WorldSessionUtilityPanelOpenState } from "./worldSession/worldSessionOverlayView";
import { queueZoneGroundTileLoad, queueEnemyHpBarLoad, queuePlayerSpriteLoad } from "../visualAssetLoader";

function formatItemRarityLabel(rarity?: string): string | null {
  if (rarity === undefined || rarity.length === 0) {
    return null;
  }

  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function formatPickupAcceptedNotice(
  message: {
    readonly message: string;
    readonly itemLabel?: string;
    readonly rarity?: string;
    readonly formattedMoneyText?: string;
  },
): string {
  if (
    message.itemLabel === undefined ||
    message.itemLabel.length === 0
  ) {
    if (
      typeof message.formattedMoneyText === "string" &&
      message.formattedMoneyText.length > 0
    ) {
      return `Picked up ${message.formattedMoneyText}.`;
    }
    return message.message;
  }

  const rarityLabel = formatItemRarityLabel(message.rarity);
  return rarityLabel === null
    ? `${message.message} ${t(message.itemLabel as never)}`
    : `${message.message} ${t(message.itemLabel as never)} [${rarityLabel}]`;
}

// Milestone 0.2 — Account Stash Foundation: the Cathedral stash keeper's
// interactable id (see `packages/content/src/data/worldProps.ts`),
// dispatched to the account-wide stash panel regardless of interactable
// kind (a generic "town_service" placeholder otherwise).
const ACCOUNT_STASH_OBJECT_ID = "cathedral_account_stash";

interface WorldSessionSceneData {
  readonly account: AccountState;
  readonly characterId: CharacterId;
  readonly room: Room<DoomscrollsRoomState>;
}

export class WorldSessionScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private overlayView: ReturnType<typeof createWorldSessionOverlayView> | null = null;
  private hudGlobesView: ReturnType<typeof createWorldSessionHudGlobesView> | null = null;
  private account: AccountState | null = null;
  private characterId: CharacterId | null = null;
  private room: Room<DoomscrollsRoomState> | null = null;
  private bootMarker: Phaser.GameObjects.Text | null = null;
  private worldAreaView: WorldSessionAreaView | null = null;
  private feedbackView: WorldSessionFeedbackView | null = null;
  private apiClient: ApiClient | null = null;
  private dodgeInput: WorldSessionDodgeInput | null = null;
  private flaskBeltInput: WorldSessionFlaskBeltInput | null = null;
  private tertiarySkillInput: WorldSessionSkillTertiaryInput | null = null;
  private primarySkillInput: WorldSessionSkillPrimaryInput | null = null;
  private equipmentLoadout: EquipmentLoadout = createEmptyEquipmentLoadout();
  private lastObjectiveCompletionNotice: string | null = null;
  private lastObjectiveReadyToTurnInId: string | null = null;
  private vendorPanel: VendorInteractionPanel | null = null;
  private townServicePanel: TownServiceInteractionPanel | null = null;
  private stashPanel: StashInteractionPanel | null = null;
  private accountStashPanel: WorldSessionStashView | null = null;
  private waypointPanel: WaypointInteractionPanel | null = null;
  private noticeBoardPanel: NoticeBoardInteractionPanel | null = null;
  private dialogueView: WorldSessionDialogueView | null = null;
  // Core 0.1 -- persisted quest status, hydrated from `quest_state` on
  // join and kept in sync via `quest_updated`. Server-authoritative;
  // the client never derives status locally.
  private questStatusById: Map<string, "accepted" | "completed"> = new Map();
  private travelOverlayView: ReturnType<typeof createWorldSessionTravelOverlayView> | null = null;
  private pendingTravelKind: WorldSessionTravelOverlayKind | null = null;
  private pendingTravelHideAfterStateApply = false;
  private travelOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
  private utilityPanelOpenState: WorldSessionUtilityPanelOpenState = {
    controls: false,
    questTrackerExpanded: true,
    debug: false,
    lootFilter: false,
  };
  private areaBanner: WorldSessionAreaBannerView | null = null;
  private latestSkillRejectedReason: string | null = null;
  private skillTreeView: WorldSessionSkillTreeView | null = null;
  private characterWindowView: WorldSessionCharacterWindowView | null = null;
  private inventoryWindowView: WorldSessionInventoryWindowView | null = null;
  private pendingRoomHandoff = false;

  public constructor() {
    super("WorldSessionScene");
  }

  public init(data: WorldSessionSceneData): void {
    this.account = data.account;
    this.characterId = data.characterId;
    this.room = data.room;
  }

  public preload(): void {
    // Core 0.23 -- the enemy HP bar spritesheet is used in every room
    // kind (both TownRoom and CombatRoom enemies render through the same
    // worldSessionEnemyPlaceholderView.ts), so it loads unconditionally.
    queueEnemyHpBarLoad(this);

    // Core 0.4x follow-up -- the player-sprite pack renders both the
    // local and every other-player placeholder in every room kind, so
    // it loads unconditionally, same as the HP bar above.
    queuePlayerSpriteLoad(this);

    // Core 0.22 -- queue the current zone's ground-tile texture (if it
    // has one) so it's loaded before create() builds the world view.
    // The room is already joined and its state already synced by the
    // time this scene starts (showAreaBanner() below relies on the same
    // synchronous room.state.zoneId read in create()).
    if (this.room === null) {
      return;
    }
    const state = this.room.state as unknown as Record<string, unknown>;
    const zoneId = typeof state.zoneId === "string" && state.zoneId.length > 0 ? state.zoneId : null;
    if (zoneId === null) {
      return;
    }
    queueZoneGroundTileLoad(this, zoneId);
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
    this.travelOverlayView = createWorldSessionTravelOverlayView();
    this.apiClient = clientEnv.apiUrl === undefined ? null : new ApiClient(clientEnv.apiUrl);

    const toggleQuestsPanel = (): void => {
      this.utilityPanelOpenState = {
        ...this.utilityPanelOpenState,
        questTrackerExpanded: !this.utilityPanelOpenState.questTrackerExpanded,
      };
      this.renderOverlay();
    };
    this.input.keyboard?.on("keydown-J", toggleQuestsPanel);
    // Core 0.1 UI Overhaul Phase 1 -- Micro Menu labels this "Quests [L]";
    // 'J' stays wired too so nothing that depended on it breaks.
    this.input.keyboard?.on("keydown-L", toggleQuestsPanel);

    this.input.keyboard?.on("keydown-B", () => {
      this.toggleInventoryWindow();
    });

    this.input.keyboard?.on("keydown-C", () => {
      this.toggleCharacterWindow();
    });

    this.input.keyboard?.on("keydown-ESC", () => {
      this.vendorPanel?.destroy();
      this.vendorPanel = null;
    });

    // Core 0.1 Foundation -- Skill Point Allocation panel toggle.
    this.skillTreeView = createWorldSessionSkillTreeView((slot) => {
      if (this.room !== null) {
        sendAllocateSkillPointIntent(this.room, slot);
      }
    });
    this.input.keyboard?.on("keydown-K", () => {
      this.skillTreeView?.toggle();
      this.renderOverlay();
    });

    // Core 0.1 UI Overhaul Phase 2 -- Inventory ('B') and Character ('C')
    // are standalone draggable windows (worldSessionInventoryView.ts,
    // worldSessionEquipmentView.ts), not flyouts in the corner icon menu.
    this.inventoryWindowView = createWorldSessionInventoryWindowView(
      (characterId: string, itemInstanceId: string, slot: string) => this.handleEquipItem(characterId, itemInstanceId, slot),
      (characterId: string, slot: string) => this.handleUnequipItem(characterId, slot),
      (itemInstanceId: string, targetPageIndex: number, targetX: number, targetY: number) => {
        this.room?.send("move_inventory_item", {
          type: "move_inventory_item",
          itemInstanceId,
          targetPageIndex,
          targetX,
          targetY,
        });
      },
    );
    this.characterWindowView = createWorldSessionCharacterWindowView(
      () => this.equipmentLoadout,
      () => this.account?.characters.find((next) => next.id === this.characterId)?.inventorySummaryItems ?? [],
      () => this.account?.characters.find((next) => next.id === this.characterId) ?? null,
      (slot: string) => {
        const characterId = this.characterId;
        return characterId === null ? Promise.resolve() : this.handleUnequipItem(characterId, slot);
      },
      (characterId: string, itemInstanceId: string, slot: string) => this.handleEquipItem(characterId, itemInstanceId, slot),
    );

    registerAllocateSkillPointResponseListeners(this.room, {
      onAccepted: () => {
        this.updateSkillTreeView();
      },
      onRejected: (message) => {
        if (message.reason === "no_points_available") {
          this.feedbackView?.showNotice(t("skill_panel.no_points_available" as never));
          return;
        }
        if (message.reason === "rank_maxed") {
          this.feedbackView?.showNotice(t("skill_panel.rank_already_maxed" as never));
          return;
        }
        this.feedbackView?.showNotice(t("skill_panel.allocate_unavailable" as never));
      },
    });

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
      (itemLabel: string) => {
        this.feedbackView?.showRareDropNotice(t("world_area.rare_drop", { item: itemLabel }));
      },
    );

    // Task 348 — Create the notice board catalog panel (lazy).
    this.noticeBoardPanel?.destroy();
    this.noticeBoardPanel = createNoticeBoardInteractionPanel((objectiveId: string) => {
      if (this.room !== null) {
        this.room.send("request_start_board_objective", {
          type: "request_start_board_objective",
          objectiveId,
        });
      }
    });

    // Core 0.1 -- Persistent Quest & Dialogue System foundation.
    this.dialogueView?.destroy();
    this.dialogueView = createWorldSessionDialogueView({
      onAcceptQuest: (questId: string) => {
        this.room?.send("request_accept_quest", { type: "request_accept_quest", questId });
      },
      onCompleteQuest: (questId: string) => {
        this.room?.send("request_complete_quest", { type: "request_complete_quest", questId });
      },
    });

    this.room.onMessage("quest_state", (raw: unknown) => {
      const msg = raw as { quests?: readonly { questId: string; status: "accepted" | "completed" }[] } | null;
      if (!msg || !Array.isArray(msg.quests)) {
        return;
      }
      this.questStatusById.clear();
      for (const entry of msg.quests) {
        this.questStatusById.set(entry.questId, entry.status);
      }
    });

    this.room.onMessage("quest_updated", (raw: unknown) => {
      const msg = raw as { questId?: unknown; status?: unknown } | null;
      if (!msg || typeof msg.questId !== "string" || (msg.status !== "accepted" && msg.status !== "completed")) {
        return;
      }
      this.questStatusById.set(msg.questId, msg.status);
      // The dialogue view can't reflect the new state without re-fetching
      // the localized dialogue line from the server; close it so the
      // player re-interacts to see the updated greeting/turn-in copy.
      this.dialogueView?.hide();
    });

    this.room.onMessage("request_accept_quest_rejected", (raw: unknown) => {
      const msg = raw as { reason?: string } | null;
      this.feedbackView?.showNotice(`Could not accept quest: ${msg?.reason ?? "unknown reason"}`);
    });

    this.room.onMessage("request_complete_quest_rejected", (raw: unknown) => {
      const msg = raw as { reason?: string } | null;
      this.feedbackView?.showNotice(`Could not complete quest: ${msg?.reason ?? "unknown reason"}`);
    });

    registerInteractResponseListener(this.room, (
      message: string,
      objectId?: string,
      _availableObjectives?: readonly AvailableObjectiveEntry[],
      questInfo?: InteractQuestInfo,
    ) => {
      if (objectId !== undefined && this.getInteractableType(objectId) === "vendor") {
        this.openVendorPanel(objectId);
        return;
      }
      if (objectId === ACCOUNT_STASH_OBJECT_ID) {
        this.openAccountStashPanel();
        return;
      }
      if (objectId !== undefined && this.getInteractableType(objectId) === "quest_giver" && questInfo !== undefined) {
        this.dialogueView?.show(message, questInfo);
        return;
      }
      this.feedbackView?.showNotice(message);
    }, (message: ObjectiveUpdatedServerMessage) => {
      // Clear stale completion/ready-to-turn-in notice when a new in-progress objective arrives.
      if (!message.completed || message.readyToTurnIn !== true) {
        this.lastObjectiveCompletionNotice = null;
        if (!message.completed) {
          this.lastObjectiveReadyToTurnInId = null;
        }
      }
      if (message.completed && message.readyToTurnIn === true) {
        const xp = Number.isFinite(message.xpReward) ? Math.max(0, message.xpReward ?? 0) : 0;
        const copper = Number.isFinite(message.copperReward) ? Math.max(0, message.copperReward ?? 0) : 0;
        const roomState = this.room?.state as { roomKind?: unknown } | undefined;
        const roomKind = typeof roomState?.roomKind === "string" ? roomState.roomKind : "town";
        const readyText = roomKind === "combat"
          ? t("objective.ready_to_turn_in_return_town" as never, { title: message.label })
          : t("objective.ready_to_turn_in_notice_board" as never, { title: message.label });
        const rewardText = xp > 0 && copper > 0
          ? t("objective.complete_reward", { xpReward: xp, copperReward: copper })
          : xp > 0
            ? t("objective.complete_reward_xp_only", { xpReward: xp })
            : copper > 0
              ? t("objective.complete_reward_copper_only", { copperReward: copper })
              : t("objective.complete_generic" as never);
        const completionText = `${rewardText} ${readyText}`;
        if (this.lastObjectiveReadyToTurnInId !== message.objectiveId || this.lastObjectiveCompletionNotice !== completionText) {
          this.lastObjectiveReadyToTurnInId = message.objectiveId;
          this.lastObjectiveCompletionNotice = completionText;
          this.feedbackView?.showNotice(completionText);
          this.showAttackFeedback(readyText);
        }
      }
      // Task 348 — Hide notice board catalog when objective state updates.
      this.noticeBoardPanel?.hide();
      this.renderOverlay();
    });

    registerAttackResponseListeners(this.room, {
      onAccepted: (message) => {
        // Task 310 — flash the hit enemy and show a brief "Hit!" indicator.
        // Actual damage number is shown by the damage_applied handler.
        this.worldAreaView?.showEnemyHitFlash(message.targetEnemyId);
        this.worldAreaView?.showEnemyFloatingDamage(message.targetEnemyId, "Hit!");
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
        // Task 310 — route damage_applied to enemy or player visual.
        const isEnemyTarget = this.isEnemyEntityId(message.targetEntityId);
        if (isEnemyTarget) {
          this.worldAreaView?.showEnemyFloatingDamage(message.targetEntityId, `-${message.damage}`);
          this.worldAreaView?.showEnemyHitFlash(message.targetEntityId);
        } else {
          // Task 311 — player took server-confirmed damage: red flash +
          // floating damage number. Camera shake on downed for emphasis.
          this.worldAreaView?.showPlayerFloatingDamage(`-${message.damage}`);
          this.worldAreaView?.showPlayerHitFlash();
          if (isDowned) {
            this.cameras.main.shake(180, 0.008);
          }
        }
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
        this.worldAreaView?.showEnemyTelegraph(message.enemyId, message.attackKind);
        if (message.attackKind === "heavy") {
          this.feedbackView?.showNotice("Heavy attack!");
        }
      },
      onEnemyAttackResolved: (message) => {
        this.worldAreaView?.resolveEnemyAttackOutcome(message.enemyId, message.outcome);
        if (message.outcome === "miss") {
          this.feedbackView?.showNotice(t("world_area.enemy_attack_missed"));
        } else {
          this.feedbackView?.showNotice(
            t("world_area.enemy_attack_hit", { damage: message.damage ?? 0 }),
          );
        }
      },
    });

    this.room.onMessage("currency_picked_up", (message: { gainedCopper?: unknown; totalMoneyCopper?: unknown }) => {
      // Task 334 — Only show the "Picked up" notice when the player
      // actually gained copper. Zero-gain messages (e.g. vendor buy
      // money update) should not show a misleading "Picked up 0."
      // notice.
      const gained = typeof message.gainedCopper === "number" && Number.isFinite(message.gainedCopper) && message.gainedCopper > 0
        ? Math.floor(message.gainedCopper)
        : 0;
      if (gained > 0) {
        const formatted = formatMoneyCompact(gained);
        this.feedbackView?.showNotice(`Picked up ${formatted}.`);
      }
      void this.refreshAccountStateAfterPickup();
    });

    this.room.onMessage("waypoint_opened", (message: { destinations?: unknown; activated?: unknown; waypointId?: unknown; objectId?: unknown }) => {
      const destinations = Array.isArray(message.destinations) ? message.destinations as import("@doomscrolls/shared").WaypointDestinationEntry[] : [];
      this.waypointPanel?.destroy();
      this.waypointPanel = createWaypointInteractionPanel({
        onTravel: (waypointId) => {
          this.beginTravelOverlay("waypoint");
          this.room?.send("request_waypoint_travel", {
            type: "request_waypoint_travel",
            waypointId,
          });
        },
      });
      this.waypointPanel.show(destinations);
      if (message.activated === true) {
        const objectId = typeof message.objectId === "string" ? message.objectId : "";
        const prop = objectId.length > 0 ? contentRegistry.worldProps.get(objectId as never) : undefined;
        const waypointName = prop?.labelKey !== undefined ? t(prop.labelKey as never) : prop?.label ?? "Waypoint";
        this.feedbackView?.showNotice(t("town_service.waypoint.discovered_named" as never, { name: waypointName }));
      } else {
        this.feedbackView?.showNotice(t("town_service.waypoint.already_discovered" as never));
      }
    });

    this.room.onMessage("request_waypoint_travel_accepted", (message: { zoneId?: unknown; message?: unknown }) => {
      const feedback = typeof message.message === "string" && message.message.length > 0
        ? message.message
        : t("town_service.waypoint.travel_success" as never);
      this.feedbackView?.showNotice(feedback);

      const targetZoneId = typeof message.zoneId === "string" && message.zoneId.length > 0 ? message.zoneId : null;
      const currentState = this.room?.state as unknown as Record<string, unknown> | undefined;
      const currentZoneId = typeof currentState?.zoneId === "string" ? currentState.zoneId : null;

      // Milestone 0.2 — a waypoint that landed the player in a different
      // town zone needs the same leave/rejoin handoff a zone_transition
      // door uses; same-zone travel keeps relying on schema sync.
      if (targetZoneId !== null && currentZoneId !== null && targetZoneId !== currentZoneId) {
        void this.beginTownRoomReturnHandoff(targetZoneId as never, "waypoint");
        return;
      }

      this.pendingTravelHideAfterStateApply = true;
    });

    this.room.onMessage("request_waypoint_travel_rejected", (message: { reason?: unknown }) => {
      this.finishTravelOverlay(false);
      const reason = typeof message.reason === "string" ? message.reason : "travel_failed";
      const key = `town_service.waypoint.rejected.${reason}` as Parameters<typeof t>[0];
      const fallback = t("town_service.waypoint.rejected.travel_failed" as never);
      const feedback = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedback);
    });

    this.room.onMessage("request_route_travel_accepted", (message: { message?: unknown; areaLabel?: unknown }) => {
      this.pendingTravelHideAfterStateApply = true;
      const feedback = typeof message.message === "string" && message.message.length > 0
        ? message.message
        : t("town_service.route.travel_success.generic" as never);
      this.feedbackView?.showNotice(feedback);
      const areaLabel = typeof message.areaLabel === "string" && message.areaLabel.length > 0
        ? message.areaLabel
        : null;
      if (areaLabel !== null) {
        this.showAttackFeedback(areaLabel);
      }
    });

    this.room.onMessage("request_route_travel_rejected", (message: { reason?: unknown }) => {
      this.finishTravelOverlay(false);
      const reason = typeof message.reason === "string" ? message.reason : "travel_failed";
      const key = `town_service.route.rejected.${reason}` as Parameters<typeof t>[0];
      const fallback = t("town_service.route.rejected.travel_failed" as never);
      const feedback = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedback);
    });

    this.room.onMessage("town_combat_handoff_approved", (message: { targetZoneId?: unknown; message?: unknown }) => {
      const targetZoneId = typeof message.targetZoneId === "string" && message.targetZoneId.length > 0
        ? message.targetZoneId
        : "blackwire_sewers";
      const feedback = typeof message.message === "string" && message.message.length > 0
        ? message.message
        : "Entering combat.";
      this.feedbackView?.showNotice(feedback);
      void this.beginCombatRoomHandoff(targetZoneId as never);
    });

    // Core 0.1 — Zone transition doors (e.g. cathedral entrance/exit).
    // The server has already persisted the new zone/spawn location;
    // hand off to a fresh TownRoom instance for that zone the same way
    // a combat return does.
    this.room.onMessage("zone_transition_approved", (message: { targetZoneId?: unknown }) => {
      const targetZoneId = typeof message.targetZoneId === "string" && message.targetZoneId.length > 0
        ? message.targetZoneId
        : null;
      if (targetZoneId === null) {
        this.finishTravelOverlay(false);
        this.feedbackView?.showNotice("Could not enter world.");
        return;
      }

      const zone = contentRegistry.zones.get(targetZoneId as never);
      const zoneLabel = zone !== undefined ? t(zone.nameKey as never) : targetZoneId;
      this.feedbackView?.showNotice(`Entered ${zoneLabel}.`);
      void this.beginTownRoomReturnHandoff(targetZoneId as never, "zone_transition");
    });

    this.room.onMessage("town_combat_handoff_rejected", (message: { reason?: unknown }) => {
      this.pendingRoomHandoff = false;
      this.finishTravelOverlay(false);
      const reason = typeof message.reason === "string" ? message.reason : "transition_failed";
      const feedback = reason === "duplicate_request"
        ? "Transition already in progress."
        : reason === "player_not_ready"
          ? "Could not enter world."
          : "Could not enter world.";
      this.feedbackView?.showNotice(feedback);
    });

    this.room.onMessage("combat_town_return_approved", (message: { targetZoneId?: unknown; message?: unknown }) => {
      const targetZoneId = typeof message.targetZoneId === "string" && message.targetZoneId.length > 0
        ? message.targetZoneId
        : null;
      if (targetZoneId === null) {
        this.pendingRoomHandoff = false;
        this.finishTravelOverlay(false);
        this.feedbackView?.showNotice("Could not enter world.");
        return;
      }

      const feedback = typeof message.message === "string" && message.message.length > 0
        ? message.message
        : "Returning to town.";
      this.feedbackView?.showNotice(feedback);
      this.pendingRoomHandoff = false;
      void this.beginTownRoomReturnHandoff(targetZoneId as never);
    });

    this.room.onMessage("combat_town_return_rejected", (message: { reason?: unknown }) => {
      this.pendingRoomHandoff = false;
      this.finishTravelOverlay(false);
      this.feedbackView?.showNotice(
        message.reason === "duplicate_request"
          ? "Return already in progress."
          : message.reason === "player_not_ready"
            ? "Cannot return right now."
            : "Could not enter world.",
      );
    });

    // Task 319 — Vendor buy accepted/rejected feedback
    this.room.onMessage("request_buy_vendor_item_accepted", (message: { stockEntryId?: string; itemId?: string; priceCopper?: number; remainingCopper?: number }) => {
      const itemId = typeof message.itemId === "string" ? message.itemId : "";
      const itemDef = contentRegistry.items.get(itemId as never);
      const itemLabel = itemDef !== undefined ? t(itemDef.nameKey as never) : "Item";
      const remaining = typeof message.remainingCopper === "number" ? message.remainingCopper : 0;
      const priceFormatted = typeof message.priceCopper === "number" ? formatMoneyCompact(message.priceCopper) : "";
      this.feedbackView?.showNotice(t("town_service.vendor_panel.buy_success", { itemLabel, price: priceFormatted }));
      this.vendorPanel?.updateMoney(remaining);
      this.vendorPanel?.showFeedback(t("town_service.vendor_panel.buy_success", { itemLabel, price: priceFormatted }));
      // Task 334 — After a successful buy, refresh account state and
      // update the vendor panel sell inventory so the newly purchased
      // item appears in the sell section immediately.
      void this.refreshAccountStateAfterPickup().then(() => {
        if (this.account !== null && this.vendorPanel !== null) {
          const char = this.account.characters.find((c) => c.id === this.characterId) ?? null;
          this.vendorPanel.updateInventory(this.buildInventoryItemsForSell(char));
        }
      });
    });

    this.room.onMessage("request_buy_vendor_item_rejected", (message: { reason?: string }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "";
      const key = `town_service.vendor_panel.buy_rejected.${reason}` as Parameters<typeof t>[0];
      const fallback = t("town_service.vendor_panel.buy_rejected.vendor_unavailable" as never);
      const feedbackText = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedbackText);
      this.vendorPanel?.showFeedback(feedbackText);
    });

    // Task 320 — Vendor sell accepted/rejected feedback
    this.room.onMessage("request_sell_item_accepted", (message: { itemInstanceId?: string; definitionId?: string; sellPriceCopper?: number; remainingCopper?: number }) => {
      const definitionId = typeof message.definitionId === "string" ? message.definitionId : "";
      const itemDef = contentRegistry.items.get(definitionId as never);
      const itemLabel = itemDef !== undefined ? t(itemDef.nameKey as never) : "Item";
      const remaining = typeof message.remainingCopper === "number" ? message.remainingCopper : 0;
      const priceFormatted = typeof message.sellPriceCopper === "number" ? formatMoneyCompact(message.sellPriceCopper) : "";
      this.feedbackView?.showNotice(t("town_service.vendor_panel.sell_success" as never, { itemLabel, price: priceFormatted }));
      this.vendorPanel?.updateMoney(remaining);
      this.vendorPanel?.showFeedback(t("town_service.vendor_panel.sell_success" as never, { itemLabel, price: priceFormatted }));
      void this.refreshAccountStateAfterPickup().then(() => {
        if (this.account !== null && this.vendorPanel !== null) {
          const char = this.account.characters.find((c) => c.id === this.characterId) ?? null;
          this.vendorPanel.updateInventory(this.buildInventoryItemsForSell(char));
        }
      });
    });

    this.room.onMessage("request_sell_item_rejected", (message: { reason?: string }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "";
      const key = `town_service.vendor_panel.sell_rejected.${reason}` as Parameters<typeof t>[0];
      const fallback = t("town_service.vendor_panel.sell_rejected.vendor_unavailable" as never);
      const feedbackText = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedbackText);
      this.vendorPanel?.showFeedback(feedbackText);
    });

    // Milestone 0.3 — Salvage & Tech Teardown accepted/rejected feedback
    this.room.onMessage("request_salvage_item_accepted", (message: { definitionId?: string; materialItemId?: string; materialQuantity?: number }) => {
      const definitionId = typeof message.definitionId === "string" ? message.definitionId : "";
      const itemDef = contentRegistry.items.get(definitionId as never);
      const itemLabel = itemDef !== undefined ? t(itemDef.nameKey as never) : "Item";
      const materialItemId = typeof message.materialItemId === "string" ? message.materialItemId : "";
      const materialDef = contentRegistry.items.get(materialItemId as never);
      const materialLabel = materialDef !== undefined ? t(materialDef.nameKey as never) : "material";
      const feedbackText = t("town_service.vendor_panel.salvage_success" as never, { itemLabel, materialLabel });
      this.feedbackView?.showNotice(feedbackText);
      this.vendorPanel?.showFeedback(feedbackText);
      void this.refreshAccountStateAfterPickup().then(() => {
        if (this.account !== null && this.vendorPanel !== null) {
          const char = this.account.characters.find((c) => c.id === this.characterId) ?? null;
          this.vendorPanel.updateInventory(this.buildInventoryItemsForSell(char));
        }
      });
    });

    this.room.onMessage("request_salvage_item_rejected", (message: { reason?: string }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "";
      const key = `town_service.vendor_panel.salvage_rejected.${reason}` as Parameters<typeof t>[0];
      const fallback = t("town_service.vendor_panel.salvage_rejected.vendor_unavailable" as never);
      const feedbackText = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedbackText);
      this.vendorPanel?.showFeedback(feedbackText);
    });

    // Withdraw a salvage-material currency balance (Iron Scrap/Arcane
    // Dust) back into a physical inventory item stack.
    this.room.onMessage("request_withdraw_material_accepted", (message: { materialId?: string; quantity?: number }) => {
      const materialId = typeof message.materialId === "string" ? message.materialId : "";
      const materialDef = contentRegistry.items.get(materialId as never);
      const materialLabel = materialDef !== undefined ? t(materialDef.nameKey as never) : "material";
      const quantity = typeof message.quantity === "number" ? message.quantity : 0;
      this.feedbackView?.showNotice(t("town_service.material_withdraw.success" as never, { quantity, materialLabel }));
      void this.refreshAccountStateAfterPickup();
    });

    this.room.onMessage("request_withdraw_material_rejected", (message: { reason?: string }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "";
      const key = `town_service.material_withdraw.rejected.${reason}` as Parameters<typeof t>[0];
      const fallback = t("town_service.material_withdraw.rejected.character_not_found" as never);
      const feedbackText = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedbackText);
    });

    // Milestone 0.3 — Profession Training accepted/rejected feedback
    this.room.onMessage("request_unlock_profession_accepted", (message: { professionId?: string; newTier?: number; remainingCopper?: number }) => {
      const professionId = typeof message.professionId === "string" ? message.professionId : "";
      const professionDef = contentRegistry.professions.get(professionId as never);
      const professionLabel = professionDef !== undefined ? t(professionDef.nameKey as never) : "Profession";
      const tier = typeof message.newTier === "number" ? message.newTier : 0;
      const remaining = typeof message.remainingCopper === "number" ? message.remainingCopper : 0;
      const feedbackText = t("town_service.vendor_panel.training_success" as never, { professionLabel, tier });
      this.feedbackView?.showNotice(feedbackText);
      this.vendorPanel?.updateMoney(remaining);
      this.vendorPanel?.showFeedback(feedbackText);
      void this.refreshAccountStateAfterPickup().then(() => {
        if (this.account !== null && this.vendorPanel !== null) {
          const char = this.account.characters.find((c) => c.id === this.characterId) ?? null;
          this.vendorPanel.updateProfessions(this.buildProfessionViews(char));
        }
      });
    });

    this.room.onMessage("request_unlock_profession_rejected", (message: { reason?: string }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "";
      const key = `town_service.vendor_panel.training_rejected.${reason}` as Parameters<typeof t>[0];
      const fallback = t("town_service.vendor_panel.training_rejected.vendor_unavailable" as never);
      const feedbackText = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedbackText);
      this.vendorPanel?.showFeedback(feedbackText);
    });

    this.room.onMessage("stash_items_listed", (message: { items?: unknown }) => {
      const items = Array.isArray(message.items)
        ? (message.items as import("@doomscrolls/shared").ItemInstance[])
        : [];
      this.stashPanel?.setItems(items);
    });

    this.room.onMessage("request_store_inventory_item_in_stash_accepted", (message: { itemInstanceId?: string; stashItems?: unknown }) => {
      const itemId = typeof message.itemInstanceId === "string" ? message.itemInstanceId : "";
      const item = this.findInventorySummaryItem(itemId);
      const def = item !== null ? contentRegistry.items.get(item.definitionId as never) : undefined;
      const itemLabel = def !== undefined ? t(def.nameKey as never) : "Item";
      const stashItems = Array.isArray(message.stashItems) ? message.stashItems as import("@doomscrolls/shared").ItemInstance[] : [];
      this.stashPanel?.setItems(stashItems);
      const feedback = t("town_service.stash_keeper.store_success" as never, { itemLabel });
      this.feedbackView?.showNotice(feedback);
      this.stashPanel?.showFeedback(feedback);
      void this.refreshAccountStateAfterPickup().then(() => {
        const character = this.account !== null && this.characterId !== null
          ? this.account.characters.find((c) => c.id === this.characterId) ?? null
          : null;
        this.stashPanel?.setInventoryItems(this.buildInventoryItemsForStash(character));
      });
    });

    this.room.onMessage("request_take_stash_item_to_inventory_accepted", (message: { itemInstanceId?: string; stashItems?: unknown }) => {
      const itemId = typeof message.itemInstanceId === "string" ? message.itemInstanceId : "";
      const stashItems = Array.isArray(message.stashItems) ? message.stashItems as import("@doomscrolls/shared").ItemInstance[] : [];
      const takenItem = stashItems.find((item) => item.id === itemId);
      const fallbackDefinitionId = takenItem?.definitionId ?? "";
      const def = contentRegistry.items.get(fallbackDefinitionId as never);
      const itemLabel = def !== undefined ? t(def.nameKey as never) : "Item";
      this.stashPanel?.setItems(stashItems);
      const feedback = t("town_service.stash_keeper.take_success" as never, { itemLabel });
      this.feedbackView?.showNotice(feedback);
      this.stashPanel?.showFeedback(feedback);
      void this.refreshAccountStateAfterPickup().then(() => {
        const character = this.account !== null && this.characterId !== null
          ? this.account.characters.find((c) => c.id === this.characterId) ?? null
          : null;
        this.stashPanel?.setInventoryItems(this.buildInventoryItemsForStash(character));
      });
    });

    const showStashRejected = (reason?: string): void => {
      const key = `town_service.stash_keeper.rejected.${typeof reason === "string" ? reason : "stash_unavailable"}` as Parameters<typeof t>[0];
      const fallback = t("town_service.stash_keeper.rejected.stash_unavailable" as never);
      const feedbackText = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedbackText);
      this.stashPanel?.showFeedback(feedbackText);
    };

    this.room.onMessage("request_store_inventory_item_in_stash_rejected", (message: { reason?: string }) => {
      showStashRejected(message.reason);
    });

    this.room.onMessage("request_take_stash_item_to_inventory_rejected", (message: { reason?: string }) => {
      showStashRejected(message.reason);
    });

    this.room.onMessage("stash_items_list_rejected", () => {
      const feedback = t("town_service.stash_keeper.load_failed" as never);
      this.feedbackView?.showNotice(feedback);
      this.stashPanel?.showFeedback(feedback);
    });

    // Milestone 0.2 — Inventory grid repositioning: the server is the sole
    // authority on slot placement, so a successful move just triggers a
    // fresh account state fetch to pick up the persisted position.
    this.room.onMessage("move_inventory_item_accepted", () => {
      void this.refreshAccountStateAfterPickup();
    });

    this.room.onMessage("move_inventory_item_rejected", (message: { reason?: string }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "move_failed";
      this.feedbackView?.showNotice(`Could not move item: ${reason}`);
    });

    this.room.onMessage("account_stash_listed", (message: { items?: unknown }) => {
      const items = Array.isArray(message.items) ? (message.items as AccountStashItemSummary[]) : [];
      this.accountStashPanel?.setStashItems(items);
    });

    this.room.onMessage("request_deposit_stash_item_accepted", (message: { stashItems?: unknown }) => {
      const items = Array.isArray(message.stashItems) ? (message.stashItems as AccountStashItemSummary[]) : [];
      this.accountStashPanel?.setStashItems(items);
      const feedback = t("account_stash.deposit_success" as never);
      this.feedbackView?.showNotice(feedback);
      this.accountStashPanel?.showFeedback(feedback);
      void this.refreshAccountStateAfterPickup().then(() => {
        const character = this.account !== null && this.characterId !== null
          ? this.account.characters.find((c) => c.id === this.characterId) ?? null
          : null;
        this.accountStashPanel?.setInventoryItems(this.buildInventoryItemsForStash(character));
      });
    });

    this.room.onMessage("request_withdraw_stash_item_accepted", (message: { stashItems?: unknown }) => {
      const items = Array.isArray(message.stashItems) ? (message.stashItems as AccountStashItemSummary[]) : [];
      this.accountStashPanel?.setStashItems(items);
      const feedback = t("account_stash.withdraw_success" as never);
      this.feedbackView?.showNotice(feedback);
      this.accountStashPanel?.showFeedback(feedback);
      void this.refreshAccountStateAfterPickup().then(() => {
        const character = this.account !== null && this.characterId !== null
          ? this.account.characters.find((c) => c.id === this.characterId) ?? null
          : null;
        this.accountStashPanel?.setInventoryItems(this.buildInventoryItemsForStash(character));
      });
    });

    const showAccountStashRejected = (reason?: string): void => {
      const key = `account_stash.rejected.${typeof reason === "string" ? reason : "stash_unavailable"}` as Parameters<typeof t>[0];
      const fallback = t("account_stash.rejected.stash_unavailable" as never);
      const feedbackText = (() => { try { return t(key as never); } catch { return fallback; } })();
      this.feedbackView?.showNotice(feedbackText);
      this.accountStashPanel?.showFeedback(feedbackText);
    };

    this.room.onMessage("request_deposit_stash_item_rejected", (message: { reason?: string }) => {
      showAccountStashRejected(message.reason);
    });

    this.room.onMessage("request_withdraw_stash_item_rejected", (message: { reason?: string }) => {
      showAccountStashRejected(message.reason);
    });

    this.room.onMessage("account_stash_list_rejected", () => {
      showAccountStashRejected("stash_unavailable");
    });

    this.room.onMessage("xp_gained", (message: { amount?: unknown; totalXp?: unknown; leveledUp?: unknown; level?: unknown; hp?: unknown; maxHp?: unknown; gainedMaxHp?: unknown; gainedSkillPoints?: unknown }) => {
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
      const newLevel = typeof message.level === "number" && Number.isFinite(message.level)
        ? Math.max(1, Math.floor(message.level))
        : null;
      const gainedMaxHp = typeof message.gainedMaxHp === "number" && Number.isFinite(message.gainedMaxHp)
        ? Math.floor(message.gainedMaxHp)
        : 0;

      const gainedSkillPoints = typeof message.gainedSkillPoints === "number" && Number.isFinite(message.gainedSkillPoints)
        ? Math.max(0, Math.floor(message.gainedSkillPoints))
        : 0;

      if (leveledUp && newLevel !== null) {
        // Prominent level-up notice showing new level and HP gain.
        this.feedbackView?.showNotice(
          gainedMaxHp > 0
            ? t("world_area.level_up_hp_notice", { level: newLevel, gainedMaxHp })
            : t("world_area.level_up_notice", { level: newLevel }),
        );
        if (gainedSkillPoints > 0) {
          this.feedbackView?.showNotice(t("skill_panel.gained_points" as never, { gainedSkillPoints }));
        }
      } else {
        this.feedbackView?.showNotice(
          totalXp === null
            ? t("world_area.xp_gained", { amount })
            : t("world_area.xp_gained_total", { amount, totalXp }),
        );
      }
      this.renderOverlay();
      this.updateSkillTreeView();
    });

    registerRespawnListeners(this.room, {
      onRespawned: (message: PlayerRespawnedServerMessage) => {
        this.feedbackView?.clearDamageFeedback();
        this.feedbackView?.showNotice(t("world_session.respawned_notice", { hp: message.hp }));
      },
    });

    // Task 299 -- Town rest refill feedback: show a localized notice when
    // the server restores HP and flask charges on entering a valid town zone.
    // The synced Colyseus schema state is the source of truth for display;
    // this just provides user-facing notification text.
    this.room.onMessage("town_rest_refill", () => {
      this.feedbackView?.showNotice(t("world_session.town_rest_refill"));
    });

    // Task 236 -- corpse interact rejection feedback
    this.room.onMessage("corpse_interact_rejected", (message: { reason?: unknown }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "";
      if (reason === "player_downed") {
        this.feedbackView?.showNotice(t("world_area.corpse_interact_downed"));
      } else if (reason === "no_corpse") {
        this.feedbackView?.showNotice(t("world_area.corpse_interact_no_corpse"));
      } else if (reason === "out_of_range") {
        this.feedbackView?.showNotice(t("world_area.corpse_interact_out_of_range"));
      }
    });

    // Task 238 -- corpse interact accepted feedback
    this.room.onMessage("corpse_interact_accepted", () => {
      this.feedbackView?.showNotice(t("world_area.corpse_composure_restored"));
    });

    // Task 348 — Handle notice board objective start rejection.
    this.room.onMessage("request_start_board_objective_rejected", (message: { reason?: unknown }) => {
      const reason = typeof message?.reason === "string" ? message.reason : "invalid_request";
      const feedback =
        reason === "already_has_active_objective"
          ? "You already have an active objective."
          : reason === "objective_already_completed"
            ? "That objective is already completed."
          : reason === "objective_not_found"
            ? "Objective not available."
            : reason === "objective_not_available"
              ? "Objective not available."
              : "Could not start objective.";
      this.feedbackView?.showNotice(feedback);
    });

    this.dodgeInput?.destroy();
    this.dodgeInput = null;
    this.flaskBeltInput?.destroy();
    this.flaskBeltInput = null;
    this.tertiarySkillInput?.destroy();
    this.tertiarySkillInput = null;
    this.primarySkillInput?.destroy();
    this.primarySkillInput = null;

    // Task 246 -- wire each typed reason to its own feedback state so
    // cooldown, downed, no-direction and generic rejection are distinct
    // in the UI. Server rejection reasons stay authoritative; the scene
    // does not interpret intent validity.
    this.dodgeInput = attachWorldSessionDodgeInput(
      this,
      this.room,
      {
        getLastClickTarget: () => this.worldAreaView?.getLastClickTarget() ?? null,
        getSelfPosition: () => this.worldAreaView?.getSelfWorldPosition() ?? null,
      },
      {
        onDodgeSentFeedback: (message) => { this.feedbackView?.showDodgeFeedback("sent", message); },
        onDodgeConfirmedFeedback: (message) => { this.feedbackView?.showDodgeFeedback("accepted", message); },
        onDodgeCooldownFeedback: (message) => { this.feedbackView?.showDodgeFeedback("cooldown", message); },
        onDodgeDownedFeedback: (message) => { this.feedbackView?.showDodgeFeedback("downed", message); },
        onDodgeNoDirectionFeedback: (message) => { this.feedbackView?.showDodgeFeedback("no_direction", message); },
        onDodgeRejectedFeedback: (message) => { this.feedbackView?.showDodgeFeedback("rejected", message); },
      },
    );

    this.flaskBeltInput = attachWorldSessionFlaskBeltInput(this, this.room, {
      onFlaskSentFeedback: (message) => {
        this.feedbackView?.showNotice(message);
      },
      onFlaskAcceptedFeedback: (message) => {
        if (message.effectType === "restoreHpInstant") {
          this.feedbackView?.showHealFeedback(
            t("world_area.flask_healed", { healed: message.healedAmount, hp: message.remainingHp }),
          );
          return;
        }
        if (message.effectType === "restoreManaInstant") {
          this.feedbackView?.showNotice(
            t("world_area.flask_mana_restored", { restored: message.healedAmount, mana: message.remainingMana }),
          );
          return;
        }
        this.feedbackView?.showNotice(t("world_area.flask_stamina_restored"));
      },
      onFlaskRejectedFeedback: (message) => {
        if (message.reason === "no_charges") { this.feedbackView?.showNotice(t("world_area.flask_no_charges")); return; }
        if (message.reason === "slot_empty") { this.feedbackView?.showNotice(t("world_area.flask_slot_empty")); return; }
        if (message.reason === "flask_on_cooldown") { this.feedbackView?.showNotice(t("world_area.flask_on_cooldown")); return; }
        if (message.reason === "player_downed") { this.feedbackView?.showNotice(t("world_area.flask_downed")); return; }
        this.feedbackView?.showNotice(t("world_area.flask_unavailable"));
      },
    });

    // Core 0.7 -- tertiary skill slot (Bone Splinter). Response messages
    // share the same Colyseus message type as the secondary slot, so
    // this module does not register its own listeners; the single
    // `registerSkillSlotResponseListeners` call below routes
    // slot === "tertiary" responses into handleAccepted/handleRejected.
    this.tertiarySkillInput = attachWorldSessionSkillTertiaryInput(
      this,
      this.room,
      {
        getTargetEnemyId: () => {
          const state = this.worldAreaView?.getSkillTargetingState();
          return state?.hoveredEnemyId ?? state?.selectedEnemyId ?? null;
        },
        // Milestone 0.2 -- Groundbreaker (Ironclad tertiary) is
        // `ground_aoe`; Bone Splinter (Gravewalker tertiary) stays
        // `target`. This shared input handler serves both classes, so
        // the targeting mode is resolved per-cast from the joined
        // character's own class content, same lookup skillSlotContent.ts
        // uses server-side.
        isGroundTargeted: () => this.resolveTertiarySkillTargeting() === "ground_aoe",
        getGroundTargetPoint: () => {
          const pointer = this.input.activePointer;
          return this.worldAreaView?.getWorldPointFromScreenPoint(pointer.x, pointer.y) ?? null;
        },
        // Milestone 0.3 -- Street Alchemist's adrenaline_stim tertiary is
        // `self_buff`: same per-class content lookup as the ground_aoe
        // check above, just resolving to a different targeting mode.
        isSelfTargeted: () => this.resolveTertiarySkillTargeting() === "self_buff",
      },
      {
        onSentFeedback: (message) => {
          this.feedbackView?.showNotice(message);
        },
        onAcceptedFeedback: (message) => {
          this.feedbackView?.showNotice(t("world_area.skill_tertiary_hit", { damage: message.damage }));
          this.worldAreaView?.showEnemyFloatingDamage(
            message.targetEnemyId,
            t("world_area.skill_tertiary_hit_label", { damage: message.damage }),
          );
          this.worldAreaView?.showEnemyHitFlash(message.targetEnemyId);
          this.renderOverlay();
        },
        onRejectedFeedback: (message) => {
          if (message.reason === "out_of_range") { this.feedbackView?.showNotice(t("world_area.skill_tertiary_too_far")); return; }
          if (message.reason === "skill_on_cooldown") { this.feedbackView?.showNotice(t("world_area.skill_tertiary_on_cooldown")); return; }
          if (message.reason === "enemy_defeated") { this.feedbackView?.showNotice(t("world_area.skill_tertiary_target_dead")); return; }
          if (message.reason === "enemy_not_found") { this.feedbackView?.showNotice(t("world_area.skill_tertiary_target_missing")); return; }
          this.feedbackView?.showNotice(t("world_area.skill_unavailable"));
        },
      },
    );

    // Core 0.14 -- primary skill slot (Heavy Strike). Same shared
    // message-type reasoning as the tertiary slot above: this module
    // does not register its own listeners; the single
    // `registerSkillSlotResponseListeners` call below routes
    // slot === "primary" responses into handleAccepted/handleRejected.
    this.primarySkillInput = attachWorldSessionSkillPrimaryInput(
      this,
      this.room,
      {
        getTargetEnemyId: () => {
          const state = this.worldAreaView?.getSkillTargetingState();
          return state?.hoveredEnemyId ?? state?.selectedEnemyId ?? null;
        },
      },
      {
        onSentFeedback: (message) => {
          this.feedbackView?.showNotice(message);
        },
        onAcceptedFeedback: (message) => {
          this.feedbackView?.showNotice(t("world_area.skill_primary_hit", { damage: message.damage }));
          this.worldAreaView?.showEnemyFloatingDamage(
            message.targetEnemyId,
            t("world_area.skill_primary_hit_label", { damage: message.damage }),
          );
          this.worldAreaView?.showEnemyHitFlash(message.targetEnemyId);
          this.renderOverlay();
        },
        onRejectedFeedback: (message) => {
          if (message.reason === "out_of_range") { this.feedbackView?.showNotice(t("world_area.skill_primary_too_far")); return; }
          if (message.reason === "skill_on_cooldown") { this.feedbackView?.showNotice(t("world_area.skill_primary_on_cooldown")); return; }
          if (message.reason === "enemy_defeated") { this.feedbackView?.showNotice(t("world_area.skill_primary_target_dead")); return; }
          if (message.reason === "enemy_not_found") { this.feedbackView?.showNotice(t("world_area.skill_primary_target_missing")); return; }
          this.feedbackView?.showNotice(t("world_area.skill_unavailable"));
        },
      },
    );

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
      onAccepted: (message) => {
        if (message.slot === "tertiary") {
          this.tertiarySkillInput?.handleAccepted(message);
          return;
        }
        if (message.slot === "primary") {
          this.primarySkillInput?.handleAccepted(message);
          return;
        }
        this.latestSkillRejectedReason = null;
        this.feedbackView?.showNotice(t("world_area.skill_hit", { damage: message.damage }));
        this.worldAreaView?.showEnemyFloatingDamage(
          message.targetEnemyId,
          t("world_area.skill_hit_label", { damage: message.damage }),
        );
        // Task 310 — flash the enemy on skill hit for consistent feedback.
        this.worldAreaView?.showEnemyHitFlash(message.targetEnemyId);
        this.renderOverlay();
      },
      onRejected: (message) => {
        if (message.slot === "tertiary") {
          this.tertiarySkillInput?.handleRejected(message);
          return;
        }
        if (message.slot === "primary") {
          this.primarySkillInput?.handleRejected(message);
          return;
        }
        this.latestSkillRejectedReason = message.reason;
        if (message.reason === "slot_not_learned") {
          this.feedbackView?.showNotice(t("world_area.skill_unlearned"));
          this.renderOverlay();
          return;
        }
        if (message.reason === "out_of_range") {
          this.feedbackView?.showNotice(t("world_area.skill_too_far"));
          this.renderOverlay();
          return;
        }
        if (message.reason === "skill_on_cooldown") {
          this.feedbackView?.showNotice(t("world_area.skill_on_cooldown"));
          this.renderOverlay();
          return;
        }
        if (message.reason === "enemy_defeated") {
          this.feedbackView?.showNotice(t("world_area.skill_target_dead"));
          this.renderOverlay();
          return;
        }
        if (message.reason === "enemy_not_found") {
          this.feedbackView?.showNotice(t("world_area.skill_target_missing"));
          this.renderOverlay();
          return;
        }
        if (message.reason === "insufficient_mana") {
          this.feedbackView?.showNotice(t("world_area.skill_insufficient_mana"));
          this.renderOverlay();
          return;
        }
        this.feedbackView?.showNotice(t("world_area.skill_unavailable"));
        this.renderOverlay();
      },
    });

    // Task 298 — Show area name banner on zone entry.
    this.showAreaBanner();

    this.renderOverlay();
    this.updateSkillTreeView();
    this.bootMarker?.destroy();
    this.bootMarker = null;
    this.room.onStateChange(() => {
      if (this.room !== null) {
        this.worldAreaView?.refreshFromRoomState(this.room);
        this.renderOverlay();
        this.updateSkillTreeView();
        if (this.pendingTravelHideAfterStateApply) {
          this.finishTravelOverlay(true);
        }
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
      showDebugOverlay: true,
    };
    const skillTargeting = this.worldAreaView?.getSkillTargetingState() ?? {
      hoveredEnemyId: null,
      selectedEnemyId: null,
      targetEnemyLabel: null,
      targetDistance: null,
      isTargetInRange: null,
    } satisfies WorldSessionSkillTargetingState;

    if (this.overlay === null || this.overlayView === null) {
      const overlay = this.createOverlay(character, this.room, debugState, skillTargeting);
      this.overlay = overlay.root;
      this.overlayView = overlay.view;
      return;
    }

    this.overlayView.update(character, this.room, debugState, skillTargeting, this.latestSkillRejectedReason);
    this.hudGlobesView?.update(character, this.room);
    this.characterWindowView?.update();
    this.inventoryWindowView?.update(character);
  }

  /** Bundles the Character/Inventory/Skill-tree window toggle+open-state
   *  callbacks the overlay's Micro Menu and action-bar Bag icon need --
   *  built once per `createOverlay()` call since the windows themselves
   *  (and their toggle methods) don't change identity across a session. */
  private buildWindowToggles(): WorldSessionOverlayWindowToggles {
    return {
      onToggleCharacter: () => this.toggleCharacterWindow(),
      onToggleInventory: () => this.toggleInventoryWindow(),
      onToggleSkillTree: () => {
        this.skillTreeView?.toggle();
        this.renderOverlay();
      },
      isCharacterOpen: () => this.characterWindowView?.isOpen() ?? false,
      isInventoryOpen: () => this.inventoryWindowView?.isOpen() ?? false,
      isSkillTreeOpen: () => this.skillTreeView?.isOpen() ?? false,
    };
  }

  private createOverlay(
    character: CharacterSummary | null,
    room: Room<DoomscrollsRoomState>,
    debugState: ReturnType<WorldSessionAreaView["getDebugState"]>,
    skillTargeting: WorldSessionSkillTargetingState,
  ): { readonly root: HTMLDivElement; readonly view: ReturnType<typeof createWorldSessionOverlayView> } {
    const root = document.createElement("div");
    applyWorldSessionOverlayRootStyles(root);

    const statusRegion = document.createElement("div");
    applyWorldSessionOverlayStatusStyles(statusRegion);
    root.appendChild(statusRegion);

    const utilityRegion = document.createElement("div");
    applyWorldSessionOverlayQuestStyles(utilityRegion);
    root.appendChild(utilityRegion);

    const hudRegion = document.createElement("div");
    applyWorldSessionOverlayHudStyles(hudRegion);
    root.appendChild(hudRegion);

    const chatRegion = document.createElement("div");
    applyWorldSessionOverlayChatStyles(chatRegion);
    chatRegion.appendChild(createWorldSessionChatView(room).root);
    root.appendChild(chatRegion);

    const overlayView = createWorldSessionOverlayView(
      character,
      room,
      debugState,
      skillTargeting,
      this.latestSkillRejectedReason,
      (mode) => {
        this.handleProjectionModeChange(mode);
      },
      (show) => {
        this.handleShowDebugOverlayChange(show);
      },
      () => {
        this.handleRespawn();
      },
      (slot: 1 | 2) => {
        if (this.room !== null) {
          sendResetObjectiveIntent(this.room, slot);
        }
      },
      () => {
        void this.handleLeaveWorld();
      },
      undefined,
      () => this.utilityPanelOpenState,
      (nextState: WorldSessionUtilityPanelOpenState) => {
        this.utilityPanelOpenState = nextState;
      },
      this.buildWindowToggles(),
      (materialId, materialLabel, currentBalance) => {
        this.openMaterialWithdrawPanel(materialId, materialLabel, currentBalance);
      },
    );
    utilityRegion.appendChild(overlayView.utilityPanel);
    hudRegion.appendChild(overlayView.hudPanel);
    if (overlayView.statusPanel !== null) {
      statusRegion.appendChild(overlayView.statusPanel);
    }

    const hudGlobesView = createWorldSessionHudGlobesView(character, room);
    root.appendChild(hudGlobesView.root);
    this.hudGlobesView = hudGlobesView;

    document.body.appendChild(root);
    return { root, view: overlayView };
  }

  private async handleLeaveWorld(): Promise<void> {
    const room = this.room;
    const account = this.account;
    this.room = null;
    if (room !== null) {
      try { room.leave(); } catch { /* ignore */ }
    }
    this.destroyOverlay();
    if (account !== null) {
      this.scene.start("AccountShellScene", { account });
    }
  }

  private destroyOverlay(): void {
    this.overlayView = null;
    this.hudGlobesView = null;
    this.overlay?.remove();
    this.overlay = null;
  }

  private beginTravelOverlay(kind: WorldSessionTravelOverlayKind): void {
    this.pendingTravelKind = kind;
    this.pendingTravelHideAfterStateApply = false;
    if (this.travelOverlayTimeout !== null) {
      clearTimeout(this.travelOverlayTimeout);
      this.travelOverlayTimeout = null;
    }
    this.travelOverlayView?.show(kind);
    this.travelOverlayTimeout = setTimeout(() => {
      this.travelOverlayTimeout = null;
      this.finishTravelOverlay(false);
      this.feedbackView?.showNotice(t("world_session.travel_overlay.timeout" as never));
    }, 2500);
  }

  private finishTravelOverlay(hideAfterStateApplied: boolean): void {
    this.pendingTravelHideAfterStateApply = false;
    this.pendingTravelKind = null;
    if (this.travelOverlayTimeout !== null) {
      clearTimeout(this.travelOverlayTimeout);
      this.travelOverlayTimeout = null;
    }
    this.travelOverlayView?.hide();
    if (!hideAfterStateApplied) {
      this.renderOverlay();
    }
  }

  private showAttackFeedback(message: string): void {
    this.feedbackView?.showAttackFeedback(message);
  }

  private handleProjectionModeChange(mode: WorldProjectionMode): void {
    this.worldAreaView?.setProjectionMode(mode);
    this.renderOverlay();
  }

  private handleShowDebugOverlayChange(show: boolean): void {
    this.worldAreaView?.setShowDebugOverlay(show);
    this.renderOverlay();
  }

  private showAreaBanner(): void {
    if (this.room === null) return;
    const state = this.room.state as unknown as Record<string, unknown>;
    const zoneId = typeof state.zoneId === "string" && state.zoneId.length > 0
      ? state.zoneId
      : null;
    if (zoneId === null || zoneId.length === 0) return;
    this.areaBanner?.destroy();
    this.areaBanner = createWorldSessionAreaBannerView();
    this.areaBanner.show(zoneId);
  }

  private handleSceneTeardown(): void {
    // Null out room first so any pending onStateChange / onMessage
    // callbacks that fire during or after teardown will see a null
    // guard and skip rendering (prevents phantom overlays).
    this.room = null;
    this.account = null;
    this.apiClient = null;
    this.bootMarker?.destroy();
    this.bootMarker = null;
    this.dodgeInput?.destroy();
    this.dodgeInput = null;
    this.flaskBeltInput?.destroy();
    this.flaskBeltInput = null;
    this.tertiarySkillInput?.destroy();
    this.tertiarySkillInput = null;
    this.primarySkillInput?.destroy();
    this.primarySkillInput = null;
    this.feedbackView?.destroy();
    this.feedbackView = null;
    this.vendorPanel?.destroy();
    this.vendorPanel = null;
    this.townServicePanel?.destroy();
    this.townServicePanel = null;
    this.stashPanel?.destroy();
    this.stashPanel = null;
    this.accountStashPanel?.destroy();
    this.accountStashPanel = null;
    this.waypointPanel?.destroy();
    this.waypointPanel = null;
    this.noticeBoardPanel?.destroy();
    this.dialogueView?.destroy();
    this.areaBanner?.destroy();
    this.areaBanner = null;
    if (this.travelOverlayTimeout !== null) {
      clearTimeout(this.travelOverlayTimeout);
      this.travelOverlayTimeout = null;
    }
    this.pendingTravelKind = null;
    this.pendingTravelHideAfterStateApply = false;
    this.pendingRoomHandoff = false;
    this.travelOverlayView?.destroy();
    this.travelOverlayView = null;
    this.worldAreaView?.destroy();
    this.worldAreaView = null;
    this.skillTreeView?.destroy();
    this.skillTreeView = null;
    this.destroyOverlay();
  }

  /**
   * Milestone 0.2 -- resolves the joined character's own class's tertiary
   * skill targeting mode ("target" | "ground_aoe" | "self_buff" as of
   * Milestone 0.3), mirroring the server's `resolveSkillSlotDefinition`
   * lookup (class -> tertiarySkillId -> skill.targeting) so the client
   * input path and the server's cast validation always agree on which
   * slot behavior applies.
   */
  private resolveTertiarySkillTargeting(): "target" | "ground_aoe" | "self_buff" {
    if (this.room === null) {
      return "target";
    }
    const presence = getCurrentPlayerPresence(
      this.room.state as unknown as Record<string, unknown>,
      this.room.sessionId,
    );
    const classKey = presence?.classKey;
    if (classKey === undefined) {
      return "target";
    }
    const characterClass = contentRegistry.classes.get(classKey as never);
    const skill = characterClass !== undefined
      ? contentRegistry.skills.get(characterClass.tertiarySkillId as never)
      : undefined;
    return skill?.targeting ?? "target";
  }

  private updateSkillTreeView(): void {
    if (this.room === null || this.skillTreeView === null) {
      return;
    }
    const presence = getCurrentPlayerPresence(
      this.room.state as unknown as Record<string, unknown>,
      this.room.sessionId,
    );
    this.skillTreeView.update({
      classKey: presence?.classKey,
      skillPoints: presence?.skillPoints ?? 0,
      primarySkillRank: presence?.primarySkillRank ?? 1,
      secondarySkillRank: presence?.secondarySkillRank ?? 1,
      tertiarySkillRank: presence?.tertiarySkillRank ?? 1,
    });
  }

  /** Inventory ('B') opens/closes independently. */
  private toggleInventoryWindow(): void {
    this.inventoryWindowView?.toggle();
    this.renderOverlay();
  }

  /** Character ('C') also opens the Inventory window alongside it (not
   *  the reverse) so the equipment paperdoll and bag grid land
   *  side-by-side, ready for drag-and-drop equipping, the moment the
   *  player opens their character sheet. Closing Character leaves
   *  Inventory as the player left it. */
  private toggleCharacterWindow(): void {
    if (this.characterWindowView?.isOpen() === true) {
      this.characterWindowView.hide();
    } else {
      this.characterWindowView?.show();
      if (this.inventoryWindowView?.isOpen() === false) {
        this.inventoryWindowView.show();
      }
    }
    this.renderOverlay();
  }

  private handleRespawn(): void {
    this.feedbackView?.clearDamageFeedback();
    const result = sendRespawnRequest(this.room);
    if (!result.dispatched) {
      this.feedbackView?.showNotice(t("world_session.respawn_unavailable"));
    }
  }

  private async handleEquipItem(characterId: string, itemInstanceId: string, slot: string): Promise<void> {
    if (this.apiClient === null) throw new Error("API client not available");
    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (typeof sessionToken !== "string" || sessionToken.length === 0) throw new Error("Not authenticated");
    await this.apiClient.equipItem(sessionToken, characterId, itemInstanceId, slot);
    await this.refreshAccountStateFromMe();
  }

  private async handleUnequipItem(characterId: string, slot: string): Promise<void> {
    if (this.apiClient === null) throw new Error("API client not available");
    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (typeof sessionToken !== "string" || sessionToken.length === 0) throw new Error("Not authenticated");
    await this.apiClient.unequipItem(sessionToken, characterId, slot);
    await this.refreshAccountStateFromMe();
  }

  private async refreshAccountStateAfterPickup(): Promise<void> {
    await this.refreshAccountStateFromMe();
  }

  private async refreshAccountStateFromMe(): Promise<void> {
    if (this.apiClient === null) return;
    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (typeof sessionToken !== "string" || sessionToken.length === 0) return;
    try {
      this.account = await this.apiClient.getMe(sessionToken);
      this.renderOverlay();
    } catch { /* ignore */ }
  }

  private async beginCombatRoomHandoff(targetZoneId: import("@doomscrolls/shared").ZoneId): Promise<void> {
    if (this.pendingRoomHandoff || this.characterId === null || this.account === null) {
      return;
    }

    const currentRoom = this.room;
    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (currentRoom === null || typeof sessionToken !== "string" || sessionToken.length === 0) {
      this.finishTravelOverlay(false);
      this.feedbackView?.showNotice("Could not enter world.");
      return;
    }

    this.pendingRoomHandoff = true;
    this.beginTravelOverlay("handoff");

    try {
      try { currentRoom.leave(); } catch {}
      const nextClient = createRealtimeClient();
      const nextRoom = await joinCombatRoom(nextClient, sessionToken as never, this.characterId, targetZoneId);
      this.room = nextRoom;
      this.pendingTravelHideAfterStateApply = false;
      this.pendingTravelKind = null;
      this.pendingRoomHandoff = false;
      this.scene.restart({
        account: this.account,
        characterId: this.characterId,
        room: nextRoom,
      });
    } catch {
      await this.recoverFromInterruptedRoomHandoff("Could not enter combat. Recovering to a safe state.");
    }
  }

  private async beginTownRoomReturnHandoff(
    targetZoneId: import("@doomscrolls/shared").ZoneId,
    overlayKind: WorldSessionTravelOverlayKind = "return_handoff",
  ): Promise<void> {
    if (this.characterId === null || this.account === null) {
      return;
    }

    const currentRoom = this.room;
    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (currentRoom === null || typeof sessionToken !== "string" || sessionToken.length === 0) {
      this.finishTravelOverlay(false);
      this.feedbackView?.showNotice("Could not enter world.");
      return;
    }

    this.beginTravelOverlay(overlayKind);

    try {
      try { currentRoom.leave(); } catch {}
      const nextClient = createRealtimeClient();
      const nextRoom = await joinTownRoom(nextClient, sessionToken as never, this.characterId, targetZoneId);
      this.room = nextRoom;
      this.pendingTravelHideAfterStateApply = false;
      this.pendingTravelKind = null;
      this.pendingRoomHandoff = false;
      this.scene.restart({
        account: this.account,
        characterId: this.characterId,
        room: nextRoom,
      });
    } catch {
      await this.recoverFromInterruptedRoomHandoff("Could not return immediately. Recovering to a safe state.");
    }
  }

  private async recoverFromInterruptedRoomHandoff(message: string): Promise<void> {
    this.pendingRoomHandoff = false;
    this.finishTravelOverlay(false);
    this.feedbackView?.showNotice(message);

    const sessionToken = window.localStorage.getItem("doomscrolls.sessionToken");
    if (this.characterId === null || typeof sessionToken !== "string" || sessionToken.length === 0) {
      this.feedbackView?.showNotice("Could not enter world.");
      return;
    }

    try {
      await this.refreshAccountStateFromMe();
      const latestCharacter = this.account?.characters.find((character) => character.id === this.characterId) ?? null;
      const nextClient = createRealtimeClient();
      const recoveredRoom = await joinResolvedCharacterRoom(
        nextClient,
        sessionToken as never,
        this.characterId,
        latestCharacter?.currentZoneId,
      );
      this.room = recoveredRoom;
      this.scene.restart({
        account: this.account,
        characterId: this.characterId,
        room: recoveredRoom,
      });
      return;
    } catch {
      try {
        const nextClient = createRealtimeClient();
        const fallbackRoom = await joinTownRoom(nextClient, sessionToken as never, this.characterId, "namesti_republiky" as never);
        this.room = fallbackRoom;
        this.feedbackView?.showNotice("Recovered to town.");
        this.scene.restart({
          account: this.account,
          characterId: this.characterId,
          room: fallbackRoom,
        });
        return;
      } catch {
        this.feedbackView?.showNotice("Could not enter world.");
      }
    }
  }

  private handleRequestReturnToTown(): void {
    if (this.room === null || this.pendingRoomHandoff) {
      return;
    }

    const state = this.room.state as unknown as Record<string, unknown>;
    const roomKind = typeof state.roomKind === "string" ? state.roomKind : "";
    if (roomKind !== "combat") {
      this.feedbackView?.showNotice("Cannot return right now.");
      return;
    }

    this.beginTravelOverlay("return_handoff");
    this.pendingRoomHandoff = true;
    this.room.send("request_combat_return", {
      type: "request_combat_return",
      objectId: "combat_return_to_town",
    });
  }

  // Core 0.1 — Look up an interactable's server-synced type by object ID
  // (e.g. "vendor", "town_service") so the interact response handler can
  // decide which UI panel to open.
  private getInteractableType(objectId: string): string | null {
    const state = this.room?.state as unknown as Record<string, unknown> | undefined;
    const interactables = state?.interactables as
      | { get?: (id: string) => { type?: unknown } | undefined }
      | undefined;
    const entry = interactables?.get?.(objectId);
    return typeof entry?.type === "string" ? entry.type : null;
  }

  // Right-click on a salvage-material currency counter (Iron Scrap/
  // Arcane Dust) in the HUD -- opens the quantity picker and sends the
  // resulting withdrawal request. The server decides whether the
  // balance/inventory space allow it.
  private openMaterialWithdrawPanel(materialId: string, materialLabel: string, currentBalance: number): void {
    showMaterialWithdrawPanel({
      materialLabel,
      currentBalance,
      onConfirm: (quantity) => {
        this.room?.send("request_withdraw_material", {
          type: "request_withdraw_material",
          materialId,
          quantity,
        });
      },
    });
  }

  // Core 0.1 — Open the vendor UI panel for a vendor interactable, wiring
  // buy/sell callbacks to the existing server-authoritative room messages.
  private openVendorPanel(vendorId: string): void {
    if (this.account === null || this.characterId === null) {
      return;
    }
    const character = this.account.characters.find((c) => c.id === this.characterId) ?? null;
    if (character === null) {
      return;
    }
    const state = this.room?.state as unknown as Record<string, unknown> | undefined;
    const interactables = state?.interactables as
      | { get?: (id: string) => { label?: unknown } | undefined }
      | undefined;
    const label = interactables?.get?.(vendorId)?.label;
    const vendorName = typeof label === "string" && label.length > 0 ? label : "Vendor";

    this.vendorPanel?.destroy();
    this.vendorPanel = createVendorInteractionPanel(vendorName, character.moneyCopper, vendorId, {
      inventoryItems: this.buildInventoryItemsForSell(character),
      professions: this.buildProfessionViews(character),
      onBuy: (targetVendorId, stockEntryId) => {
        this.room?.send("request_buy_vendor_item", {
          type: "request_buy_vendor_item",
          vendorId: targetVendorId,
          stockEntryId,
        });
      },
      onSell: (targetVendorId, itemInstanceId) => {
        this.room?.send("request_sell_item", {
          type: "request_sell_item",
          vendorId: targetVendorId,
          itemInstanceId,
        });
      },
      onSalvage: (targetVendorId, itemInstanceId) => {
        this.room?.send("request_salvage_item", {
          type: "request_salvage_item",
          vendorId: targetVendorId,
          itemInstanceId,
        });
      },
      onTrainProfession: (targetVendorId, professionId) => {
        this.room?.send("request_unlock_profession", {
          type: "request_unlock_profession",
          vendorId: targetVendorId,
          professionId,
        });
      },
    });
    this.vendorPanel.show();
  }

  // Milestone 0.3 — Build the Training & Licenses tab's view model from
  // the character's persisted profession tiers plus content-defined
  // next-tier costs. `nextTierCostCopper` absent = not trainable
  // (either maxed out or -- gunsmithing today -- no tiers defined yet).
  private buildProfessionViews(
    character: { professions?: import("@doomscrolls/shared").ProfessionTiers } | null,
  ): ProfessionTrainingView[] {
    const tiers = character?.professions;
    const views: ProfessionTrainingView[] = [];
    for (const profession of contentRegistry.professions.all) {
      const currentTier = tiers?.[profession.id] ?? 0;
      const nextTierDef = profession.tiers.find((tierDef) => tierDef.tier === currentTier + 1);
      views.push({
        professionId: profession.id,
        label: t(profession.nameKey as never),
        currentTier,
        ...(nextTierDef !== undefined ? { nextTierCostCopper: nextTierDef.costCopper } : {}),
      });
    }
    return views;
  }

  // Milestone 0.2 — Open the account-wide stash panel and request its
  // current contents; the panel's inventory-side list is fed from the
  // already-loaded account state (same helper the per-character stash
  // panel uses).
  private openAccountStashPanel(): void {
    if (this.room === null) {
      return;
    }
    const character = this.account !== null && this.characterId !== null
      ? this.account.characters.find((c) => c.id === this.characterId) ?? null
      : null;

    this.accountStashPanel?.destroy();
    this.accountStashPanel = createWorldSessionStashView({
      onDeposit: (itemInstanceId) => {
        this.room?.send("request_deposit_stash_item", {
          type: "request_deposit_stash_item",
          itemInstanceId,
        });
      },
      onWithdraw: (stashItemId) => {
        this.room?.send("request_withdraw_stash_item", {
          type: "request_withdraw_stash_item",
          stashItemId,
        });
      },
    });
    this.accountStashPanel.setInventoryItems(this.buildInventoryItemsForStash(character));
    this.accountStashPanel.show();
    this.room.send("request_list_account_stash", { type: "request_list_account_stash" });
  }

  // Task 320 — Build inventory items view model for vendor sell section.
  // Only includes inventory items (not equipped items).
  //
  // Mirrors the server's authoritative `computeSellPrice`
  // (vendorSellItem.ts): vendor-stocked items sell for 50% of their buy
  // price; everything else (salvage/loot materials no vendor stocks)
  // falls back to 50% of the same baseValueCzk/rarity value the Net
  // Worth calculation uses, instead of a flat 1-copper floor, so the
  // preview shown here matches what the server will actually pay.
  private buildInventoryItemsForSell(
    character: { inventorySummaryItems?: readonly { itemInstanceId: string; definitionId: string }[] } | null,
  ): InventoryItemView[] {
    if (character?.inventorySummaryItems === undefined) {
      return [];
    }
    const sellPriceRatio = 0.5;
    const minSell = 1;
    const rarityFallbackCzk: Record<string, number> = { common: 50, rare: 250, epic: 1000 };
    const items: InventoryItemView[] = [];
    for (const item of character.inventorySummaryItems) {
      const def = contentRegistry.items.get(item.definitionId as never);
      if (def === undefined) continue;
      let sellPrice: number | undefined;
      for (const entry of contentRegistry.vendorStocks.all) {
        if (entry.itemId === item.definitionId) {
          sellPrice = Math.max(minSell, Math.floor(entry.priceCopper * sellPriceRatio));
          break;
        }
      }
      if (sellPrice === undefined) {
        const valueCzk = def.baseValueCzk ?? rarityFallbackCzk[def.rarity] ?? 0;
        sellPrice = Math.max(minSell, Math.floor(valueCzk * sellPriceRatio));
      }
      items.push({
        itemInstanceId: item.itemInstanceId,
        definitionId: item.definitionId,
        itemLabel: t(def.nameKey as never),
        sellPriceLabel: formatMoneyCompact(sellPrice),
        sellPriceCopper: sellPrice,
      });
    }
    return items;
  }

  private buildInventoryItemsForStash(
    character: { inventorySummaryItems?: readonly { itemInstanceId: string; definitionId: string }[] } | null,
  ): import("@doomscrolls/shared").ItemInstance[] {
    if (character?.inventorySummaryItems === undefined) {
      return [];
    }
    const items: import("@doomscrolls/shared").ItemInstance[] = [];
    for (const item of character.inventorySummaryItems) {
      items.push({
        id: item.itemInstanceId as never,
        definitionId: item.definitionId as never,
        stackQuantity: 1,
        ownerCharacterId: this.characterId as never,
        location: { type: "inventory", characterId: this.characterId as never, pageIndex: 0, x: 0, y: 0 } as import("@doomscrolls/shared").ItemLocation,
        createdAt: new Date(0).toISOString() as never,
        updatedAt: new Date(0).toISOString() as never,
      });
    }
    return items;
  }

  private findInventorySummaryItem(itemInstanceId: string): { readonly itemInstanceId: string; readonly definitionId: string } | null {
    const character = this.account !== null && this.characterId !== null
      ? this.account.characters.find((candidate) => candidate.id === this.characterId) ?? null
      : null;
    if (character?.inventorySummaryItems === undefined) {
      return null;
    }
    return character.inventorySummaryItems.find((item) => item.itemInstanceId === itemInstanceId) ?? null;
  }

  // Task 310 — check if an entity ID belongs to a room enemy so
  // damage_applied can route to enemy or player visual feedback.
  private isEnemyEntityId(entityId: string): boolean {
    if (this.room === null) return false;
    const state = this.room.state as unknown as Record<string, unknown>;
    const enemies = state?.enemies;
    if (!(enemies instanceof Map)) return false;
    return enemies.has(entityId);
  }
}
