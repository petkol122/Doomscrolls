import type { Room } from "@colyseus/sdk";
import type {
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
import { createWorldSessionAreaBannerView, type WorldSessionAreaBannerView } from "./worldSession/worldSessionAreaBannerView";
import { createWorldSessionFeedbackView, type WorldSessionFeedbackView } from "./worldSession/worldSessionFeedbackView";
import { createWorldSessionOverlayView } from "./worldSession/worldSessionOverlayView";
import {
  createVendorInteractionPanel,
  type VendorInteractionPanel,
  type InventoryItemView,
} from "./worldSession/vendorInteractionPanel";
import {
  createTownServiceInteractionPanel,
  type TownServiceInteractionPanel,
} from "./worldSession/townServiceInteractionPanel";
import {
  createWaypointInteractionPanel,
  type WaypointInteractionPanel,
} from "./worldSession/waypointInteractionPanel";
import {
  createWorldSessionTravelOverlayView,
  type WorldSessionTravelOverlayKind,
} from "./worldSession/worldSessionTravelOverlayView";
import {
  createStashInteractionPanel,
  type StashInteractionPanel,
} from "./worldSession/stashInteractionPanel";
import {
  createNoticeBoardInteractionPanel,
  type NoticeBoardInteractionPanel,
} from "./worldSession/noticeBoardInteractionPanel";
import type { AvailableObjectiveEntry } from "../../net/interactResponseClient";
import {
  createWorldSessionAreaView,
  type WorldSessionAreaView,
  type WorldSessionSkillTargetingState,
} from "./worldSession/worldSessionAreaView";
import { attachWorldSessionDodgeInput, type WorldSessionDodgeInput } from "./worldSession/worldSessionDodgeInput";
import {
  attachWorldSessionHealingFlaskInput,
  type WorldSessionHealingFlaskInput,
} from "./worldSession/worldSessionHealingFlaskInput";
import {
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
  private lastObjectiveReadyToTurnInId: string | null = null;
  private vendorPanel: VendorInteractionPanel | null = null;
  private townServicePanel: TownServiceInteractionPanel | null = null;
  private stashPanel: StashInteractionPanel | null = null;
  private waypointPanel: WaypointInteractionPanel | null = null;
  private noticeBoardPanel: NoticeBoardInteractionPanel | null = null;
  private travelOverlayView: ReturnType<typeof createWorldSessionTravelOverlayView> | null = null;
  private pendingTravelKind: WorldSessionTravelOverlayKind | null = null;
  private pendingTravelHideAfterStateApply = false;
  private travelOverlayTimeout: ReturnType<typeof setTimeout> | null = null;
  private utilityPanelOpenState: WorldSessionUtilityPanelOpenState = {
    controls: false,
    objectives: false,
    equipment: false,
    inventory: false,
    debug: false,
  };
  private areaBanner: WorldSessionAreaBannerView | null = null;
  private latestSkillRejectedReason: string | null = null;
  private pendingRoomHandoff = false;

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
    this.travelOverlayView = createWorldSessionTravelOverlayView();
    this.apiClient = clientEnv.apiUrl === undefined ? null : new ApiClient(clientEnv.apiUrl);

    this.input.keyboard?.on("keydown-J", () => {
      this.utilityPanelOpenState = {
        ...this.utilityPanelOpenState,
        objectives: !this.utilityPanelOpenState.objectives,
      };
      this.renderOverlay();
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

    registerInteractResponseListener(this.room, (message: string, objectId?: string, availableObjectives?: readonly AvailableObjectiveEntry[]) => {
      // Task 348 — Notice board catalog: when available objectives are
      // returned, show the catalog panel instead of the fallback notice.
      if (objectId === "nightmarket_notice_board_01" && availableObjectives !== undefined && availableObjectives.length > 0) {
        this.noticeBoardPanel?.show(message, availableObjectives);
        return;
      }
      if (objectId === "nightmarket_notice_board_01" && availableObjectives !== undefined && availableObjectives.length === 0) {
        this.noticeBoardPanel?.hide();
        this.feedbackView?.showNotice(message);
        return;
      }
      if (objectId === "nightmarket_notice_board_01") {
        this.noticeBoardPanel?.hide();
      }
      if (objectId === "nightmarket_vendor_01") {
        const character = this.account !== null && this.characterId !== null
          ? this.account.characters.find((c) => c.id === this.characterId) ?? null
          : null;
        const moneyCopper = character?.moneyCopper ?? 0;
        // Task 204 — basic sell-disabled vendor stock preview.
        const stockEntries = contentRegistry.vendorStocks.all.filter(
          (entry) => entry.vendorId === "nightmarket_suspicious_vendor",
        );
        // Vendor name from content/town-service definition
        const vendorService = contentRegistry.townServices.get("nightmarket_suspicious_vendor");
        const vendorName = vendorService !== undefined
          ? t(vendorService.labelKey as never)
          : "Vendor";
        // Build inventory items view for sell section
        const inventoryItemsForSell = this.buildInventoryItemsForSell(character);
        this.vendorPanel?.destroy();
        this.vendorPanel = createVendorInteractionPanel(vendorName, moneyCopper, "nightmarket_suspicious_vendor", {
          stockEntries,
          inventoryItems: inventoryItemsForSell,
          onBuy: (vid, stockEntryId) => {
            if (this.room !== null) {
              this.room.send("request_buy_vendor_item", {
                type: "request_buy_vendor_item",
                vendorId: vid,
                stockEntryId,
              });
            }
          },
          onSell: (vid, itemInstanceId) => {
            if (this.room !== null) {
              this.room.send("request_sell_item", {
                type: "request_sell_item",
                vendorId: vid,
                itemInstanceId,
              });
            }
          },
        });
        this.vendorPanel.show();
        return;
      }
      // Task 205 — Stash keeper / future town-service placeholder panel.
      if (objectId === "nightmarket_stash_keeper_01") {
        this.stashPanel?.destroy();
        this.stashPanel = createStashInteractionPanel({
          onStore: (itemInstanceId) => {
            this.room?.send("request_store_inventory_item_in_stash", {
              type: "request_store_inventory_item_in_stash",
              serviceId: "nightmarket_stash_keeper",
              itemInstanceId,
            });
          },
          onTake: (itemInstanceId) => {
            this.room?.send("request_take_stash_item_to_inventory", {
              type: "request_take_stash_item_to_inventory",
              serviceId: "nightmarket_stash_keeper",
              itemInstanceId,
            });
          },
        });
        const character = this.account !== null && this.characterId !== null
          ? this.account.characters.find((c) => c.id === this.characterId) ?? null
          : null;
        this.stashPanel.setInventoryItems(this.buildInventoryItemsForStash(character));
        this.stashPanel.show();
        return;
      }
      // Task 208 — Trainer town-service placeholder panel.
      if (objectId === "nightmarket_trainer_01") {
        const service = contentRegistry.townServices.get("nightmarket_trainer");
        if (service !== undefined) {
          this.townServicePanel?.destroy();
          this.townServicePanel = createTownServiceInteractionPanel(service);
          this.townServicePanel.show();
          return;
        }
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
          ? t("objective.ready_to_turn_in_return_nightmarket" as never, { title: message.label })
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

    this.room.onMessage("waypoint_opened", (message: { destinations?: unknown; activated?: unknown; waypointId?: unknown }) => {
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
      const notice = message.activated === true
        ? t("town_service.waypoint.discovered" as never)
        : t("town_service.waypoint.already_discovered" as never);
      this.feedbackView?.showNotice(notice);
    });

    this.room.onMessage("request_waypoint_travel_accepted", (message: { message?: unknown }) => {
      this.pendingTravelHideAfterStateApply = true;
      const feedback = typeof message.message === "string" && message.message.length > 0
        ? message.message
        : t("town_service.waypoint.travel_success" as never);
      this.feedbackView?.showNotice(feedback);
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

    this.room.onMessage("xp_gained", (message: { amount?: unknown; totalXp?: unknown; leveledUp?: unknown; level?: unknown; hp?: unknown; maxHp?: unknown; gainedMaxHp?: unknown }) => {
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

      if (leveledUp && newLevel !== null) {
        // Prominent level-up notice showing new level and HP gain.
        this.feedbackView?.showNotice(
          gainedMaxHp > 0
            ? t("world_area.level_up_hp_notice", { level: newLevel, gainedMaxHp })
            : t("world_area.level_up_notice", { level: newLevel }),
        );
      } else {
        this.feedbackView?.showNotice(
          totalXp === null
            ? t("world_area.xp_gained", { amount })
            : t("world_area.xp_gained_total", { amount, totalXp }),
        );
      }
      this.renderOverlay();
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
    this.healingFlaskInput?.destroy();
    this.healingFlaskInput = null;

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

    this.healingFlaskInput = attachWorldSessionHealingFlaskInput(this, this.room, {
      onFlaskSentFeedback: (message) => {
        this.feedbackView?.showNotice(message);
      },
      onFlaskAcceptedFeedback: (message) => {
        this.feedbackView?.showHealFeedback(
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
      onAccepted: (message) => {
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
        this.feedbackView?.showNotice(t("world_area.skill_unavailable"));
        this.renderOverlay();
      },
    });

    // Task 298 — Show area name banner on zone entry.
    this.showAreaBanner();

    this.renderOverlay();
    this.bootMarker?.destroy();
    this.bootMarker = null;
    this.room.onStateChange(() => {
      if (this.room !== null) {
        this.worldAreaView?.refreshFromRoomState(this.room);
        this.renderOverlay();
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
    applyWorldSessionOverlayUtilityStyles(utilityRegion);
    root.appendChild(utilityRegion);

    const hudRegion = document.createElement("div");
    applyWorldSessionOverlayHudStyles(hudRegion);
    root.appendChild(hudRegion);

    const overlayView = createWorldSessionOverlayView(
      character,
      room,
      debugState,
      skillTargeting,
      this.latestSkillRejectedReason,
      (mode) => {
        this.handleProjectionModeChange(mode);
      },
      () => {
        this.handleRespawn();
      },
      () => {
        if (this.room !== null) {
          sendResetObjectiveIntent(this.room);
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
      try { room.leave(); } catch { /* ignore */ }
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
    this.healingFlaskInput?.destroy();
    this.healingFlaskInput = null;
    this.feedbackView?.destroy();
    this.feedbackView = null;
    this.vendorPanel?.destroy();
    this.vendorPanel = null;
    this.townServicePanel?.destroy();
    this.townServicePanel = null;
    this.stashPanel?.destroy();
    this.stashPanel = null;
    this.waypointPanel?.destroy();
    this.waypointPanel = null;
    this.noticeBoardPanel?.destroy();
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
    this.destroyOverlay();
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

  private async beginTownRoomReturnHandoff(targetZoneId: import("@doomscrolls/shared").ZoneId): Promise<void> {
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

    this.beginTravelOverlay("return_handoff");

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
        const fallbackRoom = await joinTownRoom(nextClient, sessionToken as never, this.characterId, "nightmarket" as never);
        this.room = fallbackRoom;
        this.feedbackView?.showNotice("Recovered to Nightmarket.");
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
      objectId: "combat_return_to_nightmarket",
    });
  }

  // Task 320 — Build inventory items view model for vendor sell section.
  // Only includes inventory items (not equipped items).
  private buildInventoryItemsForSell(
    character: { inventorySummaryItems?: readonly { itemInstanceId: string; definitionId: string }[] } | null,
  ): InventoryItemView[] {
    if (character?.inventorySummaryItems === undefined) {
      return [];
    }
    const sellPriceRatio = 0.5;
    const minSell = 1;
    const items: InventoryItemView[] = [];
    for (const item of character.inventorySummaryItems) {
      const def = contentRegistry.items.get(item.definitionId as never);
      if (def === undefined) continue;
      let sellPrice = minSell;
      for (const entry of contentRegistry.vendorStocks.all) {
        if (entry.itemId === item.definitionId) {
          sellPrice = Math.max(minSell, Math.floor(entry.priceCopper * sellPriceRatio));
          break;
        }
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
