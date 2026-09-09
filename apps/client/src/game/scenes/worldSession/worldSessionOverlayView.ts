import type { Room } from "@colyseus/sdk";
import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import { resolveZoneDisplayName } from "./worldSessionAreaBannerView";
import type { CharacterSummary, EquippedItemSummary, InventorySummaryItem, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import { DEFAULT_INVENTORY_GRID_CONFIG } from "@doomscrolls/shared";
import type { StatModifier } from "@doomscrolls/shared";
import type { EquipmentSlot } from "@doomscrolls/shared";

import { clientEnv } from "../../../config/env";
import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getCurrentPlayerPresence, getTownRoomPresence } from "../../../net/townRoomPresence";
import { createButton, createInfoLine } from "../accountShell/accountShellDom";
import type { WorldSessionDebugState, WorldSessionSkillTargetingState } from "./worldSessionAreaView";
import {
  createEmptyEquipmentLoadout,
  createEquipmentPanelSection,
} from "./worldSessionEquipmentView";
import { makeInteractive, makeInteractiveAndStopWorldInput, makePassive } from "./worldSessionPointerEvents";
import type { EquipmentLoadout } from "@doomscrolls/shared";
import {
  applyWorldSessionOverlayPanelStyles,
  applyWorldSessionOverlayFloatingHudStyles,
  applyWorldSessionOverlayItemPanelStyles,
} from "./worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../../worldProjection";
import { resolveItemIconUrl } from "../../itemIconResolver";
import { resolveRarityFrameUrl } from "../../rarityFrameResolver";

const COMMON_ITEM_COLOR = "#d8c6a3";
const COMMON_ITEM_ACCENT_COLOR = "#a88d63";

export interface WorldSessionUtilityPanelOpenState {
  readonly controls: boolean;
  readonly objectives: boolean;
  readonly equipment: boolean;
  readonly inventory: boolean;
  readonly debug: boolean;
}

export const DEFAULT_WORLD_SESSION_UTILITY_PANEL_OPEN_STATE: WorldSessionUtilityPanelOpenState = {
  controls: false,
  objectives: false,
  equipment: false,
  inventory: false,
  debug: false,
};

export interface WorldSessionOverlayView {
  readonly statusPanel: HTMLElement | null;
  readonly utilityPanel: HTMLElement;
  readonly hudPanel: HTMLElement;
  readonly getEquipmentLoadout: () => EquipmentLoadout;
  readonly setEquipmentLoadout: (loadout: EquipmentLoadout) => void;
  readonly update: (
    character: CharacterSummary | null,
    room: Room<DoomscrollsRoomState>,
    debugState: WorldSessionDebugState,
    skillTargeting: WorldSessionSkillTargetingState,
    lastSkillRejectedReason: string | null,
  ) => void;
}

interface ObjectiveTrackerViewModel {
  readonly title: string;
  readonly stateLabel: string;
  readonly description?: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
  readonly readyToTurnIn?: boolean;
  readonly location?: string;
  readonly xpReward?: number;
  readonly copperReward?: number;
}

interface StatusViewRefs {
  readonly root: HTMLElement;
  readonly zoneLine: HTMLElement;
  readonly testCombatLine: HTMLElement;
  readonly nameLine: HTMLElement;
  readonly subLine: HTMLElement;
}

interface HudViewRefs {
  readonly root: HTMLElement;
}

function formatSkillCooldownSeconds(nextSkillSlotAt?: number): string | null {
  const readyAt = Number.isFinite(nextSkillSlotAt) ? Number(nextSkillSlotAt) : 0;
  const remainingMs = readyAt - Date.now();
  if (remainingMs <= 0) {
    return null;
  }
  return (remainingMs / 1000).toFixed(1);
}

interface UtilityViewRefs {
  readonly root: HTMLElement;
  equipmentSection: HTMLElement;
  inventorySection: HTMLElement;
  debugSection: HTMLElement;
}

export function createWorldSessionOverlayView(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
  onRespawn: () => void,
  onResetObjective: (slot: 1 | 2) => void,
  onLeaveWorld: () => void,
  onReturnToTown?: () => void,
  getUtilityState: () => WorldSessionUtilityPanelOpenState = () =>
    DEFAULT_WORLD_SESSION_UTILITY_PANEL_OPEN_STATE,
  onUtilityStateChange?: (next: WorldSessionUtilityPanelOpenState) => void,
  getEquipmentLoadout: () => EquipmentLoadout = () => createEmptyEquipmentLoadout(),
  onEquipmentLoadoutChange?: (loadout: EquipmentLoadout) => void,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
  onUnequipItem?: (characterId: string, slot: string) => Promise<void>,
): WorldSessionOverlayView {
  let selectedInventoryItemId: InventorySummaryItem["itemInstanceId"] | null = character?.inventorySummaryItems?.[0]?.itemInstanceId ?? null;
  let currentStatusPanel: HTMLElement | null = null;

  const statusRefs = character !== null
    ? createCharacterChip(character, character.characterName, character.level, character.xp ?? 0, onLeaveWorld, onReturnToTown, resolveCurrentZoneId(room))
    : null;
  const utilityRefs = createStableUtilityContent(
    character,
    room,
    debugState,
    getUtilityState,
    onUtilityStateChange,
    getEquipmentLoadout,
    onEquipItem,
    onUnequipItem,
    () => selectedInventoryItemId,
    (itemId) => {
      selectedInventoryItemId = itemId;
    },
    onProjectionModeChange,
    onShowDebugOverlayChange,
  );
  const hudRefs = createStableHudContent(
    character,
    room,
    skillTargeting,
    lastSkillRejectedReason,
    onResetObjective,
    onRespawn,
  );

  const createMountedPanel = (): HTMLElement => {
    const panel = document.createElement("div");
    // Keep these panel roots mounted across overlay refreshes so interactive
    // controls do not lose listeners/focus from root replacement regressions.
    makePassive(panel);
    panel.style.display = "contents";
    return panel;
  };

  const statusPanel = createMountedPanel();
  const utilityPanel = createMountedPanel();
  const hudPanel = createMountedPanel();
  if (statusRefs !== null) {
    statusPanel.appendChild(statusRefs.root);
    if (character !== null) {
      syncStatusView(statusRefs, character, room);
    }
  }
  utilityPanel.appendChild(utilityRefs.root);
  hudPanel.appendChild(hudRefs.root);
  syncUtilityView(utilityRefs, character, room, debugState, getUtilityState, onUtilityStateChange, getEquipmentLoadout, onEquipItem, onUnequipItem, () => selectedInventoryItemId, (itemId) => {
    selectedInventoryItemId = itemId;
  }, onProjectionModeChange, onShowDebugOverlayChange);
  syncHudView(hudRefs, character, room, skillTargeting, lastSkillRejectedReason, onResetObjective, onRespawn);
  currentStatusPanel = statusPanel;

  const update = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
    nextDebugState: WorldSessionDebugState,
    nextSkillTargeting: WorldSessionSkillTargetingState,
    nextLastSkillRejectedReason: string | null,
  ): void => {
    if (statusRefs !== null && nextCharacter !== null && currentStatusPanel !== null) {
      syncStatusView(statusRefs, nextCharacter, nextRoom);
    }

    syncHudView(hudRefs, nextCharacter, nextRoom, nextSkillTargeting, nextLastSkillRejectedReason, onResetObjective, onRespawn);
    syncUtilityView(utilityRefs, nextCharacter, nextRoom, nextDebugState, getUtilityState, onUtilityStateChange, getEquipmentLoadout, onEquipItem, onUnequipItem, () => selectedInventoryItemId, (itemId) => {
      selectedInventoryItemId = itemId;
    }, onProjectionModeChange, onShowDebugOverlayChange);
  };

  return {
    statusPanel,
    utilityPanel,
    hudPanel,
    getEquipmentLoadout,
    setEquipmentLoadout: (loadout: EquipmentLoadout) => {
      onEquipmentLoadoutChange?.(loadout);
    },
    update,
  };
}

/** Reads the live room's current zone id off its synced state. */
function resolveCurrentZoneId(room: Room<DoomscrollsRoomState>): string {
  const state = room.state as unknown as Record<string, unknown>;
  return typeof state.zoneId === "string" ? state.zoneId : "";
}

/** Short, at-a-glance subtitle for the character chip's zone line,
 *  derived from the zone's own content (`roomType`), not hardcoded
 *  per zone -- unlike the old "Temporary test combat zone" constant,
 *  this stays correct as new zones/room kinds are added. */
function resolveZoneKindLabel(zoneId: string): string {
  try {
    const zone = contentRegistry.zones.get(zoneId as ZoneContentId);
    if (zone?.roomType === "combat") {
      return "Combat Zone";
    }
    if (zone?.roomType === "town") {
      return "Town";
    }
  } catch { /* fall through */ }
  return "";
}

function createCharacterChip(
  character: CharacterSummary,
  displayName: string,
  level: number,
  xp: number,
  onLeaveWorld: () => void,
  onReturnToTown: (() => void) | undefined,
  zoneId: string,
): StatusViewRefs {
  // Task 242 — the chip is a visible interactive panel root. We
  // intentionally do NOT call `makePassive(panel)` here; the panel
  // must keep `pointer-events: auto` (set by the card styles) and
  // must stop world input from leaking to the Phaser canvas. The
  // leave button is the only true interactive control inside, but
  // the chip's panel background is also a visible card and must
  // catch clicks reliably.
  const panel = createCardSection();
  panel.style.display = "flex";
  panel.style.alignItems = "center";
  panel.style.justifyContent = "space-between";
  panel.style.gap = "10px";
  panel.style.width = "min(220px, calc(100vw - 28px))";
  panel.style.padding = "8px 10px";

  const textBlock = document.createElement("div");
  textBlock.style.display = "grid";
  textBlock.style.gap = "3px";

  const zoneLine = document.createElement("div");
  zoneLine.textContent = resolveZoneDisplayName(zoneId);
  zoneLine.style.fontSize = "11px";
  zoneLine.style.fontWeight = "bold";
  zoneLine.style.color = "#d8c6a3";
  textBlock.appendChild(zoneLine);

  const testCombatLine = document.createElement("div");
  testCombatLine.textContent = resolveZoneKindLabel(zoneId);
  testCombatLine.style.fontSize = "9px";
  testCombatLine.style.color = "#a88d63";
  textBlock.appendChild(testCombatLine);

  const nameLine = document.createElement("div");
  nameLine.textContent = character.characterName;
  nameLine.style.fontSize = "13px";
  nameLine.style.fontWeight = "bold";
  nameLine.style.color = "#f0ddbb";
  textBlock.appendChild(nameLine);

  const subLine = document.createElement("div");
  subLine.textContent = `${displayName} • ${t("world_session.level_xp_format", { level, xp })}`;
  subLine.style.fontSize = "10px";
  subLine.style.color = "#b9d49a";
  textBlock.appendChild(subLine);

  makePassive(textBlock);
  panel.appendChild(textBlock);

  const buttonColumn = document.createElement("div");
  buttonColumn.style.display = "grid";
  buttonColumn.style.gap = "6px";

  if (onReturnToTown !== undefined) {
    const returnButton = createButton("Return to Town");
    returnButton.style.width = "auto";
    returnButton.style.flex = "0 0 auto";
    returnButton.style.padding = "4px 8px";
    returnButton.style.fontSize = "10px";
    returnButton.addEventListener("click", () => {
      onReturnToTown();
    });
    makeInteractive(returnButton);
    buttonColumn.appendChild(returnButton);
  }

  const leaveButton = createButton(t("world_entry.leave_world"));
  leaveButton.style.width = "auto";
  leaveButton.style.flex = "0 0 auto";
  leaveButton.style.padding = "4px 8px";
  leaveButton.style.fontSize = "10px";
  leaveButton.addEventListener("click", () => {
    onLeaveWorld();
  });
  makeInteractive(leaveButton);
  buttonColumn.appendChild(leaveButton);
  panel.appendChild(buttonColumn);

  return {
    root: panel,
    zoneLine,
    testCombatLine,
    nameLine,
    subLine,
  };
}

function syncStatusView(
  refs: StatusViewRefs,
  character: CharacterSummary,
  room: Room<DoomscrollsRoomState>,
): void {
  const selfPresence = getCurrentPlayerPresence(
    room.state as unknown as Record<string, unknown>,
    room.sessionId,
  );
  const selfDisplayName = selfPresence?.displayName ?? character.characterName ?? t("world_session.selected_character");
  const currentZoneId = resolveCurrentZoneId(room);
  refs.zoneLine.textContent = resolveZoneDisplayName(currentZoneId);
  refs.testCombatLine.textContent = resolveZoneKindLabel(currentZoneId);
  refs.nameLine.textContent = character.characterName;
  refs.subLine.textContent = `${selfDisplayName} • ${t("world_session.level_xp_format", { level: selfPresence?.level ?? character.level, xp: selfPresence?.xp ?? character.xp ?? 0 })}`;
}

function createStableHudContent(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  onResetObjective: (slot: 1 | 2) => void,
  onRespawn: () => void,
): HudViewRefs {
  const root = document.createElement("div");
  makePassive(root);
  syncHudView({ root }, character, room, skillTargeting, lastSkillRejectedReason, onResetObjective, onRespawn);
  return { root };
}

function syncHudView(
  refs: HudViewRefs,
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  onResetObjective: (slot: 1 | 2) => void,
  onRespawn: () => void,
): void {
  // Task 229: HUD content is rebuilt on every update pass. This means
  // the respawn button and any other interactive HUD control is destroyed
  // and recreated each frame. To make clicks reliable we must NOT
  // destroy children while a pointer-down is in flight. The browser
  // already handles this for native button clicks — the click event
  // fires on the element that received mousedown, even if it gets
  // removed before mouseup. The real problem was pointer-events: none
  // on parent panels blocking the click entirely (fixed in overlayLayout).
  refs.root.replaceChildren(renderHudContent(character, room, skillTargeting, lastSkillRejectedReason, onResetObjective, onRespawn));
}

function renderHudContent(
  nextCharacter: CharacterSummary | null,
  nextRoom: Room<DoomscrollsRoomState>,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  onResetObjective: (slot: 1 | 2) => void,
  onRespawn: () => void,
): HTMLElement {
  const selfPresence = getCurrentPlayerPresence(
    nextRoom.state as unknown as Record<string, unknown>,
    nextRoom.sessionId,
  );
  const selfHpSummary = formatPlayerHpSummary(selfPresence?.hp, selfPresence?.maxHp);
  const selfHpRatio = resolvePlayerHpRatio(selfPresence?.hp, selfPresence?.maxHp);

  const panel = createFloatingHudSection();
  panel.style.display = "grid";
  panel.style.gap = "4px";
  panel.appendChild(createHudSection(
    selfHpSummary,
    selfHpRatio,
    selfPresence?.lifeState,
    selfPresence?.flaskCharges,
    selfPresence?.maxFlaskCharges,
    selfPresence?.level ?? nextCharacter?.level ?? 1,
    selfPresence?.xp ?? nextCharacter?.xp ?? 0,
    selfPresence?.objective ?? null,
    onResetObjective,
    selfPresence?.objectiveRewardGranted,
    selfPresence?.objective2 ?? null,
    selfPresence?.objectiveRewardGranted2,
    selfPresence?.nextSkillSlotAt,
    skillTargeting,
    lastSkillRejectedReason,
  ));

  if (selfPresence?.lifeState === "downed") {
    // Core 0.14 -- CombatRoom's downed state now sends the player back
    // to town on respawn (a real death consequence) instead of
    // healing them in place; the copy here reflects that so the button
    // isn't describing a different mechanic than the one it triggers.
    // TownRoom's downed state is unaffected (its own corpse-recovery
    // flow), so this only changes copy for a combat-zone room.
    const isCombatZoneRoom = resolveZoneKindLabel(resolveCurrentZoneId(nextRoom)) === "Combat Zone";

    const downedNotice = createMutedText(t("world_session.downed_notice"));
    downedNotice.style.color = "#e3a6a6";
    panel.appendChild(downedNotice);

    const respawnHint = createMutedText(
      t(isCombatZoneRoom ? "world_session.downed_respawn_hint_combat" : "world_session.downed_respawn_hint"),
    );
    respawnHint.style.color = "#a88d63";
    panel.appendChild(respawnHint);

    const respawnButton = createButton(t(isCombatZoneRoom ? "world_session.respawn_to_town" : "world_session.respawn"));
    respawnButton.style.marginTop = "4px";
    respawnButton.style.width = "220px";
    respawnButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onRespawn();
    });
    makeInteractive(respawnButton);
    panel.appendChild(respawnButton);
  }

  if (selfPresence?.hasCorpse === true && selfPresence?.lifeState !== "downed") {
    const corpseNotice = createMutedText(t("world_session.corpse_return_hint"));
    corpseNotice.style.color = "#8f5f5f";
    panel.appendChild(corpseNotice);
  }

  return panel;
}

function createStableUtilityContent(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
  getEquipmentLoadout: () => EquipmentLoadout,
  onEquipItem: ((characterId: string, itemInstanceId: string, slot: string) => Promise<void>) | undefined,
  onUnequipItem: ((characterId: string, slot: string) => Promise<void>) | undefined,
  getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null,
  onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
): UtilityViewRefs {
  // Core 0.25 -- corner icon toolbar, not a stacked list of bordered
  // buttons. `root` only lays out the icons in a row; each icon's own
  // `<details>` hosts its flyout panel via `toIconMenuItem` below.
  //
  // `makeInteractiveAndStopWorldInput` then `makePassive` (in that
  // order) is the same idiom `createCardSection`/`createScrollableCardSection`
  // use: the capture-phase pointerdown/mousedown listeners it attaches
  // stay in effect regardless of `root`'s own `pointer-events` value, so
  // every icon click (a descendant with pointer-events:auto) is still
  // intercepted before it can bubble to Phaser's window-level pointer
  // listener -- while `makePassive` afterward keeps clicks in the empty
  // gaps between icons falling through to the world underneath. Without
  // this, a click square on an icon still reaches Phaser as a world
  // click, firing click-to-move underneath the menu.
  const root = document.createElement("div");
  makeInteractiveAndStopWorldInput(root);
  makePassive(root);
  root.style.display = "flex";
  root.style.flexDirection = "row";
  root.style.gap = "8px";
  root.style.justifyContent = "flex-end";

  const utilityState = getUtilityState();
  const controlsSection = toIconMenuItem(
    createControlsSection(utilityState.controls, (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), controls: open });
    }),
    { icon: "❓", label: `${t("world_session.controls")} / Help` },
  );
  const objectivesSection = toIconMenuItem(
    createObjectivesSection(
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective ?? null,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective2 ?? null,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted2,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.completedObjectives ?? [],
      utilityState.objectives,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), objectives: open });
      },
    ),
    { icon: "\u{1F4DC}", label: t("objective.panel.title" as never) },
  );
  const equipmentSection = toIconMenuItem(
    createEquipmentPanelSection(
      getEquipmentLoadout,
      () => character?.inventorySummaryItems ?? [],
      utilityState.equipment,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), equipment: open });
      },
      character?.id !== undefined && onUnequipItem !== undefined
        ? (slot) => onUnequipItem(character.id, slot)
        : undefined,
      () => character,
    ),
    { icon: "\u{1F6E1}", label: t("equipment.title") },
  );
  const derivedStatsSection = toIconMenuItem(
    createDerivedStatsSection(character),
    { icon: "\u{1F4CA}", label: "Derived Stats" },
  );
  const inventorySection = toIconMenuItem(
    createInventoryPanelSection(
      character,
      { getSelectedItemId, onSelectItem },
      getEquipmentLoadout(),
      character?.id ?? null,
      onEquipItem,
      utilityState.inventory,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), inventory: open });
      },
    ),
    { icon: "\u{1F392}", label: "Inventory" },
  );
  const debugSection = createDebugPanel(
    room,
    formatTownRoomState(room.state),
    debugState,
    onProjectionModeChange,
    onShowDebugOverlayChange,
    utilityState.debug,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), debug: open });
    },
  );

  const menuItems = [controlsSection, objectivesSection, equipmentSection, derivedStatsSection, inventorySection];
  // Core 0.25 -- Debug Panel is a dev-only tool, not a menu item players
  // should ever see. Only wired into the toolbar in dev builds; in a
  // production build `debugSection` is built (harmless) but never
  // appended anywhere, so it's neither visible nor reachable.
  if (clientEnv.isDevBuild) {
    menuItems.push(toIconMenuItem(debugSection, { icon: "\u{1F41E}", label: "Debug Panel" }));
  }
  root.append(...menuItems);
  return { root, equipmentSection, inventorySection, debugSection };
}

function syncUtilityView(
  refs: UtilityViewRefs,
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
  getEquipmentLoadout: () => EquipmentLoadout,
  onEquipItem: ((characterId: string, itemInstanceId: string, slot: string) => Promise<void>) | undefined,
  onUnequipItem: ((characterId: string, slot: string) => Promise<void>) | undefined,
  getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null,
  onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
): void {
  const utilityState = getUtilityState();
  const controlsSection = toIconMenuItem(
    createControlsSection(utilityState.controls, (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), controls: open });
    }),
    { icon: "❓", label: `${t("world_session.controls")} / Help` },
  );
  const objectivesSection = toIconMenuItem(
    createObjectivesSection(
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective ?? null,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective2 ?? null,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted2,
      getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.completedObjectives ?? [],
      utilityState.objectives,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), objectives: open });
      },
    ),
    { icon: "\u{1F4DC}", label: t("objective.panel.title" as never) },
  );
  const equipmentSection = toIconMenuItem(
    createEquipmentPanelSection(
      getEquipmentLoadout,
      () => character?.inventorySummaryItems ?? [],
      utilityState.equipment,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), equipment: open });
      },
      character?.id !== undefined && onUnequipItem !== undefined
        ? (slot) => onUnequipItem(character.id, slot)
        : undefined,
      () => character,
    ),
    { icon: "\u{1F6E1}", label: t("equipment.title") },
  );
  const derivedStatsSection = toIconMenuItem(
    createDerivedStatsSection(character),
    { icon: "\u{1F4CA}", label: "Derived Stats" },
  );
  const inventorySection = toIconMenuItem(
    createInventoryPanelSection(
      character,
      { getSelectedItemId, onSelectItem },
      getEquipmentLoadout(),
      character?.id ?? null,
      onEquipItem,
      utilityState.inventory,
      (open) => {
        onUtilityStateChange?.({ ...getUtilityState(), inventory: open });
      },
    ),
    { icon: "\u{1F392}", label: "Inventory" },
  );
  const nextDebugSection = createDebugPanel(
    room,
    formatTownRoomState(room.state),
    debugState,
    onProjectionModeChange,
    onShowDebugOverlayChange,
    utilityState.debug,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), debug: open });
    },
  );
  const menuItems = [controlsSection, objectivesSection, equipmentSection, derivedStatsSection, inventorySection];
  if (clientEnv.isDevBuild) {
    menuItems.push(toIconMenuItem(nextDebugSection, { icon: "\u{1F41E}", label: "Debug Panel" }));
  }
  refs.root.replaceChildren(...menuItems);
  refs.equipmentSection = equipmentSection;
  refs.inventorySection = inventorySection;
  refs.debugSection = nextDebugSection;
}

function createControlsSection(isOpen: boolean, onOpenChange: (open: boolean) => void): HTMLElement {
  const details = document.createElement("details");
  details.open = isOpen;
  details.style.border = "1px solid #31271c";
  details.style.borderRadius = "8px";
  details.style.background = "rgba(12, 10, 8, 0.72)";
  makeInteractive(details);
  details.addEventListener("toggle", () => {
    onOpenChange(details.open);
  });

  const summary = document.createElement("summary");
  summary.textContent = `${t("world_session.controls")} / Help`;
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.flexWrap = "wrap";
  controls.style.gap = "6px";
  controls.style.padding = "0 8px 8px";

  const bindings: readonly { readonly key: string; readonly action: string }[] = [
    { key: "Click", action: t("world_session.control_move") },
    { key: "Click (enemy)", action: t("world_session.control_attack") },
    { key: "1 (enemy)", action: t("skill.heavy_strike.name") },
    { key: "RMB (enemy)", action: t("skill.grave_spark.name") },
    { key: "E (enemy)", action: t("skill.bone_splinter.name") },
    { key: "Click (loot)", action: "Pickup" },
    { key: "Click (object)", action: "Interact" },
    { key: "Space", action: t("world_session.control_dodge") },
    { key: "Q", action: t("world_session.control_flask") },
  ];

  for (const binding of bindings) {
    const chip = document.createElement("div");
    chip.style.display = "inline-flex";
    chip.style.alignItems = "center";
    chip.style.gap = "6px";
    chip.style.padding = "4px 7px";
    chip.style.border = "1px solid #4d3f2a";
    chip.style.borderRadius = "999px";
    chip.style.background = "rgba(24, 18, 13, 0.88)";

    const keyLabel = document.createElement("span");
    keyLabel.textContent = binding.key;
    keyLabel.style.color = "#e0c88a";
    keyLabel.style.fontWeight = "bold";
    keyLabel.style.fontSize = "10px";
    keyLabel.style.fontFamily = "monospace";
    chip.appendChild(keyLabel);

    const actionLabel = document.createElement("span");
    actionLabel.textContent = binding.action;
    actionLabel.style.color = "#b9d49a";
    actionLabel.style.fontSize = "10px";
    chip.appendChild(actionLabel);

    controls.appendChild(chip);
  }

  details.appendChild(controls);
  return details;
}

type ObjectiveTrackerSource = {
  readonly id: string;
  readonly label: string;
  readonly descriptionKey?: string;
  readonly current: number;
  readonly target: number;
  readonly completed: boolean;
  readonly readyToTurnIn?: boolean;
  readonly xpReward?: number;
  readonly copperReward?: number;
  readonly targetEnemyLabel?: string | undefined;
} | null;

function createObjectivesSection(
  // Core 0.15 -- two concurrent objective slots, rendered as two
  // independent "Active" blocks under one shared "Completed" history.
  objective1: ObjectiveTrackerSource,
  objectiveRewardGranted1: boolean | undefined,
  objective2: ObjectiveTrackerSource,
  objectiveRewardGranted2: boolean | undefined,
  completedObjectives: readonly {
    readonly id: string;
    readonly title: string;
    readonly completed: true;
  }[],
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
): HTMLElement {
  const details = document.createElement("details");
  details.open = isOpen;
  details.addEventListener("toggle", () => {
    onOpenChange(details.open);
  });
  details.style.border = "1px solid #31271c";
  details.style.borderRadius = "8px";
  details.style.background = "rgba(12, 10, 8, 0.72)";
  makeInteractive(details);

  const summary = document.createElement("summary");
  summary.textContent = `${t("objective.panel.title" as never)} [J]`;
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "8px";

  const activeSectionTitle = document.createElement("div");
  activeSectionTitle.textContent = t("objective.panel.active_section" as never);
  activeSectionTitle.style.fontSize = "11px";
  activeSectionTitle.style.fontWeight = "bold";
  activeSectionTitle.style.color = "#d8c6a3";
  content.appendChild(activeSectionTitle);

  const slotSources: readonly [1 | 2, ObjectiveTrackerSource, boolean | undefined][] = [
    [1, objective1, objectiveRewardGranted1],
    [2, objective2, objectiveRewardGranted2],
  ];
  const activeSlots = slotSources.filter(([, objective]) => objective !== null);

  if (activeSlots.length === 0) {
    content.appendChild(createMutedText(t("objective.panel.empty" as never)));
  } else {
    for (const [slot, objective, objectiveRewardGranted] of activeSlots) {
      const viewModel = resolveObjectiveTrackerViewModel(objective, objectiveRewardGranted);
      if (viewModel === null) {
        continue;
      }

      const card = createObjectiveTrackerCard(viewModel, slot);
      content.appendChild(card);

      const stateLine = createInfoLine(t("objective.panel.state" as never), viewModel.stateLabel);
      content.appendChild(stateLine);

      const progressLine = createInfoLine(
        t("objective.panel.progress" as never),
        `${viewModel.current}/${viewModel.target}`,
      );
      content.appendChild(progressLine);

      if (viewModel.description !== undefined) {
        const description = createMutedText(viewModel.description);
        description.style.color = "#cdb892";
        content.appendChild(description);
      }

      if (viewModel.completed) {
        const turnInState = createInfoLine(
          t("objective.panel.turn_in" as never),
          objectiveRewardGranted === true
            ? t("objective.state.completed")
            : t("objective.state.ready_to_turn_in"),
        );
        content.appendChild(turnInState);
      }
    }
  }

  const divider = document.createElement("div");
  divider.style.height = "1px";
  divider.style.background = "rgba(88, 68, 45, 0.6)";
  divider.style.margin = "2px 0";
  content.appendChild(divider);

  const completedTitle = document.createElement("div");
  completedTitle.textContent = t("objective.panel.completed_section" as never);
  completedTitle.style.fontSize = "11px";
  completedTitle.style.fontWeight = "bold";
  completedTitle.style.color = "#d8c6a3";
  content.appendChild(completedTitle);

  if (completedObjectives.length === 0) {
    content.appendChild(createMutedText(t("objective.panel.completed_empty" as never)));
  } else {
    const completedList = document.createElement("div");
    completedList.style.display = "grid";
    completedList.style.gap = "6px";

    for (const completedObjective of completedObjectives) {
      const row = document.createElement("div");
      row.style.display = "grid";
      row.style.gap = "2px";
      row.style.padding = "6px 8px";
      row.style.border = "1px solid #4f6b3d";
      row.style.borderRadius = "8px";
      row.style.background = "rgba(20, 34, 18, 0.56)";

      const rowTitle = document.createElement("div");
      rowTitle.textContent = completedObjective.title;
      rowTitle.style.fontSize = "12px";
      rowTitle.style.fontWeight = "bold";
      rowTitle.style.color = "#d8f0c8";
      row.appendChild(rowTitle);

      const rowState = document.createElement("div");
      rowState.textContent = t("objective.state.completed" as never);
      rowState.style.fontSize = "10px";
      rowState.style.color = "#9fca8b";
      row.appendChild(rowState);

      completedList.appendChild(row);
    }

    content.appendChild(completedList);
  }

  details.appendChild(content);
  return details;
}

function createDebugOverlayToggleSection(
  debugState: WorldSessionDebugState,
  onShowDebugOverlayChange: (show: boolean) => void,
): HTMLElement {
  const wrapper = createSectionBlock(t("world_session.debug_overlay_title"), [], { compact: true });

  const label = document.createElement("label");
  label.style.display = "flex";
  label.style.alignItems = "center";
  label.style.gap = "6px";
  label.style.fontSize = "12px";
  label.style.color = "#d8c6a3";
  label.style.cursor = "pointer";
  makeInteractive(label);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = debugState.showDebugOverlay;
  checkbox.addEventListener("change", () => {
    onShowDebugOverlayChange(checkbox.checked);
  });
  makeInteractive(checkbox);

  const labelText = document.createElement("span");
  labelText.textContent = t("world_session.debug_overlay_toggle");

  label.append(checkbox, labelText);
  wrapper.appendChild(label);

  return wrapper;
}

function createProjectionSection(
  debugState: WorldSessionDebugState,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
): HTMLElement {
  const wrapper = createSectionBlock(t("world_session.projection_title"), [], { compact: true });

  const description = createMutedText(t("world_session.projection_notice"));
  description.style.marginBottom = "8px";
  wrapper.appendChild(description);

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  buttonRow.style.marginBottom = "8px";

  const topDownButton = createButton(t("world_session.projection_top_down"));
  topDownButton.style.flex = "1";
  topDownButton.disabled = debugState.projectionMode === "debug_top_down";
  topDownButton.addEventListener("click", () => {
    onProjectionModeChange("debug_top_down");
  });
  makeInteractive(topDownButton);

  const isometricButton = createButton(t("world_session.projection_isometric_preview"));
  isometricButton.style.flex = "1";
  isometricButton.disabled = debugState.projectionMode === "isometric_preview";
  isometricButton.addEventListener("click", () => {
    onProjectionModeChange("isometric_preview");
  });
  makeInteractive(isometricButton);

  buttonRow.append(topDownButton, isometricButton);
  wrapper.appendChild(buttonRow);

  wrapper.appendChild(
    createInfoLine(
      t("world_session.projection_current"),
      debugState.projectionMode === "debug_top_down"
        ? t("world_session.projection_top_down")
        : t("world_session.projection_isometric_preview"),
    ),
  );
  wrapper.appendChild(
    createInfoLine(
      t("world_session.projection_click_mode"),
      debugState.isMovementInputEnabled
        ? t("world_session.projection_click_top_down_only")
        : t("world_session.projection_click_disabled_preview"),
    ),
  );

  return wrapper;
}

function createCardSection(): HTMLElement {
  const section = document.createElement("section");
  applyWorldSessionOverlayPanelStyles(section);
  section.style.margin = "0";
  return section;
}

/** Core 0.25 -- the borderless variant of `createCardSection` for the
 * bottom HUD, which must float over the world with no visible container
 * (see `applyWorldSessionOverlayFloatingHudStyles`). */
function createFloatingHudSection(): HTMLElement {
  const section = document.createElement("section");
  applyWorldSessionOverlayFloatingHudStyles(section);
  section.style.margin = "0";
  return section;
}

/** Core 0.25 -- turns one of the utility menu's `<details>` sections (as
 * built by `createControlsSection`/`createObjectivesSection`/etc., each a
 * `<details>` with a `<summary>` first child) into a single icon-button
 * toolbar item: the `<summary>` becomes a round icon glyph, and every
 * other child is moved into one absolutely-positioned flyout panel that
 * opens below it. This only restyles/regroups the DOM the section
 * functions already build -- their open/close state wiring (`isOpen`,
 * `onOpenChange`, the native `toggle` event) is untouched. */
function toIconMenuItem(details: HTMLElement, options: { readonly icon: string; readonly label: string }): HTMLElement {
  const summary = details.firstElementChild;
  const flyoutChildren = Array.from(details.children).filter((child) => child !== summary);
  const flyout = document.createElement("div");
  flyout.style.position = "absolute";
  flyout.style.top = "calc(100% + 8px)";
  flyout.style.right = "0";
  flyout.style.minWidth = "240px";
  flyout.style.width = "max-content";
  flyout.style.maxWidth = "min(340px, calc(100vw - 24px))";
  flyout.style.maxHeight = "calc(100vh - 80px)";
  flyout.style.overflowY = "auto";
  flyout.style.border = "1px solid #4d3f2a";
  flyout.style.borderRadius = "10px";
  flyout.style.background = "rgba(10, 8, 7, 0.94)";
  flyout.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.45)";
  flyout.style.zIndex = "30";
  flyout.style.padding = "4px 0 8px";
  flyout.append(...flyoutChildren);
  details.appendChild(flyout);

  details.style.position = "relative";
  details.style.border = "none";
  details.style.background = "transparent";
  details.style.borderRadius = "0";
  details.style.padding = "0";
  details.style.width = "auto";
  details.style.flex = "0 0 auto";

  if (summary instanceof HTMLElement) {
    summary.textContent = options.icon;
    summary.title = options.label;
    summary.setAttribute("aria-label", options.label);
    summary.style.display = "flex";
    summary.style.alignItems = "center";
    summary.style.justifyContent = "center";
    summary.style.width = "40px";
    summary.style.height = "40px";
    summary.style.margin = "0";
    summary.style.padding = "0";
    summary.style.fontSize = "18px";
    summary.style.lineHeight = "1";
    summary.style.border = "1px solid #4d3f2a";
    summary.style.borderRadius = "50%";
    summary.style.background = "rgba(10, 8, 7, 0.86)";
    summary.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.35)";
  }

  return details;
}

function createSectionBlock(titleText: string, children: readonly HTMLElement[], options?: { readonly compact?: boolean }): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.style.margin = "0";
  wrapper.style.padding = options?.compact === true ? "7px 8px" : "8px";
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.56)";

  const title = document.createElement("h3");
  title.textContent = titleText;
  title.style.margin = "0 0 6px";
  title.style.fontSize = options?.compact === true ? "12px" : "13px";
  title.style.color = "#d8c6a3";
  wrapper.appendChild(title);

  for (const child of children) {
    wrapper.appendChild(child);
  }

  return wrapper;
}

/** Core 0.26 -- same as `createSectionBlock`, but with the more ornate
 * inventory/equipment panel frame (`applyWorldSessionOverlayItemPanelStyles`)
 * instead of the plain flat box every other section block still uses. */
function createItemPanelSectionBlock(titleText: string, children: readonly HTMLElement[], options?: { readonly compact?: boolean }): HTMLElement {
  const wrapper = createSectionBlock(titleText, children, options);
  applyWorldSessionOverlayItemPanelStyles(wrapper);
  return wrapper;
}

function createPresenceSection(room: Room<DoomscrollsRoomState>): HTMLElement {
  const presence = getTownRoomPresence(room.state as unknown as Record<string, unknown>);
  const content: HTMLElement[] = [];

  if (presence === null) {
    content.push(createMutedText(t("world_session.no_presence")));
    return createSectionBlock(t("world_session.player_presence"), content, { compact: true });
  }

  if (presence.players.length === 0) {
    content.push(createMutedText(t("world_session.players_empty")));
    return createSectionBlock(t("world_session.player_presence"), content, { compact: true });
  }

  const playerList = document.createElement("ul");
  playerList.style.margin = "0";
  playerList.style.padding = "0 0 0 18px";
  playerList.style.color = "#b9d49a";
  playerList.style.fontSize = "11px";

  for (const player of presence.players) {
    const li = document.createElement("li");
    li.style.marginBottom = "4px";

    const details: string[] = [];
    if (player.spawnPointId !== undefined && player.spawnPointId.length > 0) {
      details.push(`spawn=${player.spawnPointId}`);
    }
    if (player.hp !== undefined && player.maxHp !== undefined) {
      details.push(`hp=${player.hp}/${player.maxHp}`);
    }
    if (player.lifeState !== undefined) {
      details.push(`state=${player.lifeState}`);
    }

    li.textContent = player.displayName + (details.length > 0 ? ` (${details.join(" | ")})` : "");
    playerList.appendChild(li);
  }

  content.push(playerList);
  return createSectionBlock(t("world_session.player_presence"), content, { compact: true });
}

function createMovementDebugSection(
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
): HTMLElement {
  const self = getCurrentPlayerPresence(
    room.state as unknown as Record<string, unknown>,
    room.sessionId,
  );

  return createSectionBlock(t("world_session.movement_debug"), [
    createInfoLine(
      t("world_session.player_hp"),
      self?.hp !== undefined && self?.maxHp !== undefined
        ? formatPlayerHpSummary(self.hp, self.maxHp)
        : t("world_session.awaiting_player_hp"),
    ),
    createInfoLine(
      t("world_session.current_position"),
      self?.position !== undefined
        ? `x=${Math.round(self.position.x)}, y=${Math.round(self.position.y)}`
        : t("world_area.no_position"),
    ),
    createInfoLine(
      t("world_session.last_click_target"),
      debugState.lastClickTarget !== null
        ? `x=${debugState.lastClickTarget.x}, y=${debugState.lastClickTarget.y}`
        : t("world_session.awaiting_click_target"),
    ),
    createInfoLine(
      t("world_session.projection_current"),
      debugState.projectionMode === "debug_top_down"
        ? t("world_session.projection_top_down")
        : t("world_session.projection_isometric_preview"),
    ),
    createInfoLine(
      t("world_session.movement_speed"),
      self?.movementSpeed !== undefined
        ? String(self.movementSpeed)
        : t("world_session.awaiting_movement_speed"),
    ),
  ], { compact: true });
}

function createHudSection(
  hpSummary: string,
  hpRatio: number | null,
  lifeState: "alive" | "downed" | undefined,
  flaskCharges: number | undefined,
  maxFlaskCharges: number | undefined,
  level: number | undefined,
  xp: number | undefined,
  objective: ObjectiveTrackerSource,
  onResetObjective: ((slot: 1 | 2) => void) | undefined,
  objectiveRewardGranted: boolean | undefined,
  // Core 0.15 -- second concurrent objective slot, mirrors `objective`/`objectiveRewardGranted` above.
  objective2: ObjectiveTrackerSource,
  objectiveRewardGranted2: boolean | undefined,
  nextSkillSlotAt: number | undefined,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
): HTMLElement {
  // Core 0.21 -- PoE-style bottom-center HUD: a dual-orb cluster (HP orb,
  // real; resource orb, visual stub -- Core 0.1 has no mana/resource
  // system) flanking a flask/belt strip (flask_1 real, slots 2-5 visual
  // stubs). Quest trackers and the skill-cooldown card keep their
  // existing wiring/logic but sit above the orb cluster so it reads as
  // one clean action bar, matching the reference games instead of the
  // old stacked-text-card layout. See docs/CORE_BUILD_0_21_PLAN.md.
  const wrapper = document.createElement("section");
  wrapper.style.display = "grid";
  wrapper.style.gap = "8px";
  wrapper.style.justifyItems = "center";

  const objectiveTrackerViewModel = resolveObjectiveTrackerViewModel(objective, objectiveRewardGranted);
  const objectiveTrackerViewModel2 = resolveObjectiveTrackerViewModel(objective2, objectiveRewardGranted2);
  if (objectiveTrackerViewModel !== null || objectiveTrackerViewModel2 !== null) {
    const objectiveRow = document.createElement("div");
    objectiveRow.style.display = "flex";
    objectiveRow.style.flexWrap = "wrap";
    objectiveRow.style.justifyContent = "center";
    objectiveRow.style.gap = "8px";
    if (objectiveTrackerViewModel !== null) {
      objectiveRow.appendChild(createObjectiveTrackerCard(objectiveTrackerViewModel, 1, onResetObjective));
    }
    if (objectiveTrackerViewModel2 !== null) {
      objectiveRow.appendChild(createObjectiveTrackerCard(objectiveTrackerViewModel2, 2, onResetObjective));
    }
    wrapper.appendChild(objectiveRow);
  }

  wrapper.appendChild(createSkillSlotPlaceholder(nextSkillSlotAt, skillTargeting, lastSkillRejectedReason));
  wrapper.appendChild(createVitalityClusterRow(hpSummary, hpRatio, lifeState, flaskCharges, maxFlaskCharges));
  wrapper.appendChild(createMiniHudStat(`${t("character.level")} ${String(level ?? 1)}`, `${t("character.xp")} ${String(xp ?? 0)}`));

  return wrapper;
}

const HUD_ORB_DIAMETER_PX = 84;
const HUD_BELT_SLOT_SIZE_PX = 52;
const HUD_BELT_STUB_SLOT_COUNT = 4;

function createVitalityClusterRow(
  hpSummary: string,
  hpRatio: number | null,
  lifeState: "alive" | "downed" | undefined,
  flaskCharges: number | undefined,
  maxFlaskCharges: number | undefined,
): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "flex-end";
  row.style.justifyContent = "center";
  row.style.gap = "14px";
  row.style.flexWrap = "wrap";

  row.appendChild(createHpOrb(hpSummary, hpRatio, lifeState));
  row.appendChild(createBeltStrip(flaskCharges, maxFlaskCharges));
  row.appendChild(createResourceOrbStub());

  // Core 0.4x -- the HP orb, belt strip (flask slot included -- it's
  // used via the [Q] hotkey, not a click handler) and resource stub are
  // all read-only display, with no click handler anywhere in this row.
  // Without this, the row's default `pointer-events: auto` silently ate
  // every mouse event (move/up/down) the moment the cursor crossed its
  // bounding box, which sits directly over the bottom of the same
  // click-to-move viewport -- a live report caught held-movement drags
  // canceling and plain clicks never registering whenever the cursor
  // passed under this HUD. `makePassive` lets all of it pass through to
  // the world canvas underneath, exactly like every other decorative-
  // only panel in this file already does.
  makePassive(row);

  return row;
}

function createOrbShell(
  diameterPx: number,
  ringColor: string,
  background: string,
): { readonly shell: HTMLElement; readonly fill: HTMLElement; readonly labelLayer: HTMLElement } {
  const shell = document.createElement("div");
  shell.style.position = "relative";
  shell.style.width = `${diameterPx}px`;
  shell.style.height = `${diameterPx}px`;
  shell.style.borderRadius = "50%";
  shell.style.border = `3px solid ${ringColor}`;
  shell.style.background = background;
  shell.style.overflow = "hidden";
  shell.style.boxShadow = "inset 0 0 12px rgba(0, 0, 0, 0.65), 0 4px 10px rgba(0, 0, 0, 0.4)";
  shell.style.flex = "0 0 auto";

  const fill = document.createElement("div");
  fill.style.position = "absolute";
  fill.style.left = "0";
  fill.style.right = "0";
  fill.style.bottom = "0";
  fill.style.height = "0%";
  fill.style.transition = "height 0.3s ease, background 0.3s ease";
  shell.appendChild(fill);

  const labelLayer = document.createElement("div");
  labelLayer.style.position = "absolute";
  labelLayer.style.inset = "0";
  labelLayer.style.display = "flex";
  labelLayer.style.flexDirection = "column";
  labelLayer.style.alignItems = "center";
  labelLayer.style.justifyContent = "center";
  labelLayer.style.textAlign = "center";
  labelLayer.style.pointerEvents = "none";
  shell.appendChild(labelLayer);

  return { shell, fill, labelLayer };
}

/** Real, wired: fill ratio and downed-state color come from the same
 *  synced `hp`/`maxHp`/`lifeState` presence fields the old HP bar read. */
function createHpOrb(
  hpSummary: string,
  hpRatio: number | null,
  lifeState: "alive" | "downed" | undefined,
): HTMLElement {
  const isDowned = lifeState === "downed";
  const { shell, fill, labelLayer } = createOrbShell(
    HUD_ORB_DIAMETER_PX,
    isDowned ? "#7a3535" : "#5a3c22",
    "radial-gradient(circle at 50% 30%, rgba(48, 20, 20, 0.9) 0%, rgba(18, 8, 8, 0.95) 100%)",
  );

  fill.style.height = hpRatio === null ? "0%" : `${Math.max(0, Math.min(100, hpRatio * 100))}%`;
  fill.style.background = isDowned
    ? "linear-gradient(180deg, #bf5252 0%, #7a1f1f 100%)"
    : hpRatio !== null && hpRatio <= 0.25
      ? "linear-gradient(180deg, #d46262 0%, #8f2a2a 100%)"
      : "linear-gradient(180deg, #c46a3a 0%, #6e2f1f 100%)";

  const hpText = document.createElement("div");
  hpText.textContent = hpSummary;
  hpText.style.color = isDowned ? "#ffd6d6" : "#f3e2c4";
  hpText.style.fontWeight = "bold";
  hpText.style.fontSize = "11px";
  hpText.style.fontFamily = "monospace";
  hpText.style.textShadow = "0 1px 3px rgba(0, 0, 0, 0.85)";
  hpText.style.padding = "0 4px";
  labelLayer.appendChild(hpText);

  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.justifyItems = "center";
  wrapper.style.gap = "4px";
  wrapper.appendChild(shell);

  const caption = document.createElement("div");
  caption.textContent = t("world_session.player_hp");
  caption.style.fontSize = "9px";
  caption.style.color = "#a88d63";
  caption.style.textTransform = "uppercase";
  caption.style.letterSpacing = "0.04em";
  wrapper.appendChild(caption);

  return wrapper;
}

/** Visual stub only -- Core 0.1 has no mana/class-resource system
 *  (docs/GAME_DESIGN.md) and `PlayerPresenceEntry` has no such field.
 *  Flat/unfilled vessel, lock glyph, "Coming Later" label, disabled
 *  cursor, no click handler -- unmistakably not a live control. */
function createResourceOrbStub(): HTMLElement {
  const { shell, labelLayer } = createOrbShell(
    HUD_ORB_DIAMETER_PX,
    "#3c3a42",
    "repeating-linear-gradient(135deg, rgba(40, 40, 46, 0.9) 0px, rgba(40, 40, 46, 0.9) 6px, rgba(28, 28, 32, 0.9) 6px, rgba(28, 28, 32, 0.9) 12px)",
  );
  shell.style.cursor = "not-allowed";
  shell.title = t("world_session.resource_placeholder");

  const lock = document.createElement("div");
  lock.textContent = "\u{1F512}";
  lock.style.fontSize = "16px";
  lock.style.opacity = "0.75";
  labelLayer.appendChild(lock);

  const soonLabel = document.createElement("div");
  soonLabel.textContent = t("world_session.resource_placeholder");
  soonLabel.style.color = "#8a8a92";
  soonLabel.style.fontSize = "9px";
  soonLabel.style.fontWeight = "bold";
  soonLabel.style.textTransform = "uppercase";
  soonLabel.style.marginTop = "2px";
  labelLayer.appendChild(soonLabel);

  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.justifyItems = "center";
  wrapper.style.gap = "4px";
  wrapper.appendChild(shell);

  const caption = document.createElement("div");
  caption.textContent = t("world_session.resource");
  caption.style.fontSize = "9px";
  caption.style.color = "#6f6f76";
  caption.style.textTransform = "uppercase";
  caption.style.letterSpacing = "0.04em";
  wrapper.appendChild(caption);

  return wrapper;
}

function createBeltStrip(flaskCharges: number | undefined, maxFlaskCharges: number | undefined): HTMLElement {
  const strip = document.createElement("div");
  strip.style.display = "flex";
  strip.style.gap = "6px";
  strip.style.alignItems = "flex-end";

  strip.appendChild(createFlaskBeltSlot(flaskCharges, maxFlaskCharges));
  for (let i = 0; i < HUD_BELT_STUB_SLOT_COUNT; i++) {
    strip.appendChild(createStubBeltSlot());
  }

  return strip;
}

function createBeltSlotShell(borderColor: string, background: string): HTMLElement {
  const slot = document.createElement("div");
  slot.style.position = "relative";
  slot.style.width = `${HUD_BELT_SLOT_SIZE_PX}px`;
  slot.style.height = `${HUD_BELT_SLOT_SIZE_PX}px`;
  slot.style.border = `2px solid ${borderColor}`;
  slot.style.borderRadius = "8px";
  slot.style.background = background;
  slot.style.display = "flex";
  slot.style.flexDirection = "column";
  slot.style.alignItems = "center";
  slot.style.justifyContent = "center";
  slot.style.boxSizing = "border-box";
  slot.style.flex = "0 0 auto";
  return slot;
}

/** Real, wired: same `flaskCharges`/`maxFlaskCharges` presence fields
 *  and `[Q]` keybind the old flask-charges line read, redrawn as a
 *  belt-slot tile instead of a standalone text-and-dots row. */
function createFlaskBeltSlot(charges: number | undefined, maxCharges: number | undefined): HTMLElement {
  const slot = createBeltSlotShell(
    "#6b5738",
    "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)",
  );

  const keyBadge = document.createElement("div");
  keyBadge.textContent = "Q";
  keyBadge.style.position = "absolute";
  keyBadge.style.top = "2px";
  keyBadge.style.left = "3px";
  keyBadge.style.fontSize = "8px";
  keyBadge.style.fontWeight = "bold";
  keyBadge.style.fontFamily = "monospace";
  keyBadge.style.color = "#e0c88a";
  slot.appendChild(keyBadge);

  if (charges === undefined || maxCharges === undefined) {
    const waiting = document.createElement("div");
    waiting.textContent = "…";
    waiting.style.color = "#7a5f4a";
    waiting.style.fontSize = "14px";
    slot.appendChild(waiting);
    slot.title = t("world_session.awaiting_flask");
    return slot;
  }

  const glyph = document.createElement("div");
  glyph.textContent = "⚗";
  glyph.style.fontSize = "18px";
  glyph.style.color = charges > 0 ? "#e0824a" : "#5a4530";
  slot.appendChild(glyph);

  const dots = document.createElement("div");
  dots.style.display = "flex";
  dots.style.gap = "2px";
  dots.style.marginTop = "2px";
  for (let i = 0; i < maxCharges; i++) {
    const dot = document.createElement("span");
    dot.textContent = "●";
    dot.style.fontSize = "7px";
    dot.style.color = i < charges ? "#b4512a" : "#3a2a1a";
    dots.appendChild(dot);
  }
  slot.appendChild(dots);

  slot.title = `${t("world_session.flask_charges")}: ${charges}/${maxCharges} [Q]`;
  return slot;
}

/** Visual stub only -- Core 0.1's belt has exactly one real flask slot
 *  (`flask_1`); these represent belt capacity the itemization doesn't
 *  have yet. Visibly locked (dashed border, reduced opacity, lock
 *  glyph, "Soon" label, disabled cursor), no keybind badge, no click
 *  handler -- reads as inert, not as a live slot that no-ops. */
function createStubBeltSlot(): HTMLElement {
  const slot = createBeltSlotShell(
    "#4a4a4a",
    "repeating-linear-gradient(135deg, rgba(36, 36, 40, 0.85) 0px, rgba(36, 36, 40, 0.85) 5px, rgba(24, 24, 27, 0.85) 5px, rgba(24, 24, 27, 0.85) 10px)",
  );
  slot.style.borderStyle = "dashed";
  slot.style.opacity = "0.55";
  slot.style.cursor = "not-allowed";
  slot.title = t("world_session.belt_slot_soon_hint");

  const lock = document.createElement("div");
  lock.textContent = "\u{1F512}";
  lock.style.fontSize = "13px";
  slot.appendChild(lock);

  const label = document.createElement("div");
  label.textContent = t("world_session.belt_slot_soon");
  label.style.fontSize = "7px";
  label.style.color = "#8a8a8a";
  label.style.fontWeight = "bold";
  label.style.textTransform = "uppercase";
  label.style.marginTop = "1px";
  slot.appendChild(label);

  return slot;
}

function createDerivedStatsSection(character: CharacterSummary | null): HTMLElement {
  const details = document.createElement("details");
  details.style.border = "1px solid #31271c";
  details.style.borderRadius = "8px";
  details.style.background = "rgba(12, 10, 8, 0.72)";
  details.style.padding = "0";
  makeInteractive(details);

  const summary = document.createElement("summary");
  summary.textContent = "Derived Stats";
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "6px";

  const stats = character?.stats;
  if (stats === undefined) {
    content.appendChild(createMutedText("Derived stats unavailable."));
    details.appendChild(content);
    return details;
  }

  const chipRow = document.createElement("div");
  chipRow.style.display = "flex";
  chipRow.style.flexWrap = "wrap";
  chipRow.style.gap = "6px";

  chipRow.appendChild(createCompactStatChip("Move", formatMoveSpeed(stats.derived.moveSpeed)));
  chipRow.appendChild(createCompactStatChip("Atk", `${Math.round(stats.derived.attackCooldownMs)} ms`));
  chipRow.appendChild(createCompactStatChip("HP", `${Math.max(0, stats.currentHp)} / ${Math.max(0, stats.derived.maxHp)}`));

  content.appendChild(chipRow);
  details.appendChild(content);
  return details;
}

function createCompactStatChip(labelText: string, valueText: string): HTMLElement {
  const chip = document.createElement("div");
  chip.style.display = "inline-flex";
  chip.style.alignItems = "center";
  chip.style.gap = "6px";
  chip.style.padding = "4px 7px";
  chip.style.border = "1px solid #3c3122";
  chip.style.borderRadius = "999px";
  chip.style.background = "rgba(18, 14, 10, 0.88)";

  const label = document.createElement("span");
  label.textContent = labelText;
  label.style.color = "#a88d63";
  label.style.fontSize = "10px";
  chip.appendChild(label);

  const value = document.createElement("span");
  value.textContent = valueText;
  value.style.color = "#d8c6a3";
  value.style.fontSize = "10px";
  value.style.fontFamily = "monospace";
  value.style.fontWeight = "bold";
  chip.appendChild(value);

  return chip;
}

function formatMoveSpeed(moveSpeed: number): string {
  if (!Number.isFinite(moveSpeed)) {
    return "—";
  }

  return moveSpeed.toFixed(2);
}

function createMiniHudStat(labelText: string, valueText: string): HTMLElement {
  const card = document.createElement("div");
  card.style.padding = "4px 8px";
  card.style.border = "1px solid #3c3122";
  card.style.borderRadius = "999px";
  card.style.background = "rgba(18, 14, 10, 0.9)";
  card.style.minWidth = "72px";
  card.style.textAlign = "center";

  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.fontSize = "10px";
  label.style.color = "#a88d63";
  card.appendChild(label);

  const value = document.createElement("div");
  value.textContent = valueText;
  value.style.fontSize = "11px";
  value.style.fontFamily = "monospace";
  value.style.fontWeight = "bold";
  value.style.color = "#d8c6a3";
  card.appendChild(value);

  return card;
}

function createObjectiveTrackerCard(
  objective: ObjectiveTrackerViewModel,
  slot: 1 | 2,
  onResetObjective?: (slot: 1 | 2) => void,
): HTMLElement {
  const card = document.createElement("div");
  card.style.display = "grid";
  card.style.gap = "4px";
  card.style.padding = "8px 10px";
  const isReadyToTurnIn = objective.readyToTurnIn === true;

  card.style.border = isReadyToTurnIn
    ? "1px solid #85733a"
    : objective.completed
      ? "1px solid #4f6b3d"
      : "1px solid #5a4727";
  card.style.borderRadius = "12px";
  card.style.background = isReadyToTurnIn
    ? "linear-gradient(180deg, rgba(36, 30, 12, 0.92) 0%, rgba(20, 16, 8, 0.92) 100%)"
    : objective.completed
      ? "linear-gradient(180deg, rgba(20, 34, 18, 0.92) 0%, rgba(14, 22, 12, 0.92) 100%)"
      : "linear-gradient(180deg, rgba(32, 24, 14, 0.92) 0%, rgba(18, 14, 10, 0.92) 100%)";
  card.style.minWidth = "176px";

  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.alignItems = "center";
  topRow.style.justifyContent = "space-between";
  topRow.style.gap = "8px";

  const title = document.createElement("div");
  title.textContent = "Objective";
  title.style.fontSize = "10px";
  title.style.color = isReadyToTurnIn ? "#f0dd9b" : objective.completed ? "#9fca8b" : "#c5a874";
  topRow.appendChild(title);

  const state = document.createElement("div");
  state.textContent = objective.stateLabel;
  state.style.fontSize = "10px";
  state.style.fontWeight = "bold";
  state.style.textTransform = "uppercase";
  state.style.color = isReadyToTurnIn ? "#f3dd8a" : objective.completed ? "#b9e5a8" : "#e0c88a";
  topRow.appendChild(state);

  card.appendChild(topRow);

  if (objective.description !== undefined) {
    const descriptionLine = document.createElement("div");
    descriptionLine.textContent = objective.description;
    descriptionLine.style.fontSize = "10px";
    descriptionLine.style.color = "#a88d63";
    descriptionLine.style.fontStyle = "italic";
    card.appendChild(descriptionLine);
  }

  const trackerLine = document.createElement("div");
  trackerLine.textContent = `${objective.title}: ${objective.current}/${objective.target}`;
  trackerLine.style.fontSize = "12px";
  trackerLine.style.fontWeight = "bold";
  trackerLine.style.color = isReadyToTurnIn ? "#f7e8b9" : objective.completed ? "#d8f0c8" : "#f0ddbb";
  card.appendChild(trackerLine);

  const subtitleLine = document.createElement("div");
  subtitleLine.textContent = objective.location ?? "Town";
  subtitleLine.style.fontSize = "10px";
  subtitleLine.style.color = "#a88d63";
  card.appendChild(subtitleLine);

  const progressFrame = document.createElement("div");
  progressFrame.style.width = "100%";
  progressFrame.style.height = "8px";
  progressFrame.style.border = isReadyToTurnIn ? "1px solid #8f7a3e" : objective.completed ? "1px solid #567546" : "1px solid #5f4a2f";
  progressFrame.style.borderRadius = "999px";
  progressFrame.style.background = "rgba(10, 10, 10, 0.45)";
  progressFrame.style.overflow = "hidden";

  const progressFill = document.createElement("div");
  const ratio = objective.target <= 0 ? 0 : Math.max(0, Math.min(1, objective.current / objective.target));
  progressFill.style.width = `${ratio * 100}%`;
  progressFill.style.height = "100%";
  progressFill.style.borderRadius = "999px";
  progressFill.style.background = isReadyToTurnIn
    ? "linear-gradient(90deg, #8b6a2c 0%, #e3c56f 100%)"
    : objective.completed
      ? "linear-gradient(90deg, #4c7e42 0%, #9fd27e 100%)"
      : "linear-gradient(90deg, #8c6131 0%, #d6a45a 100%)";
  progressFrame.appendChild(progressFill);
  card.appendChild(progressFrame);

  if (isReadyToTurnIn) {
    const hintLine = document.createElement("div");
    hintLine.textContent = t("objective.panel.ready_to_turn_in_hint" as never);
    hintLine.style.fontSize = "11px";
    hintLine.style.color = "#f0dd9b";
    hintLine.style.fontWeight = "bold";
    card.appendChild(hintLine);
  }

  // Show reward info for completed objectives (only if not already granted)
  if (objective.completed && objective.xpReward !== undefined && objective.copperReward !== undefined) {
    const rewardLine = document.createElement("div");
    rewardLine.textContent = t("objective.complete_reward", {
      xpReward: objective.xpReward,
      copperReward: objective.copperReward,
    });
    rewardLine.style.fontSize = "11px";
    rewardLine.style.color = "#8fcd7a";
    rewardLine.style.fontWeight = "bold";
    card.appendChild(rewardLine);
  } else if (objective.completed && objective.xpReward !== undefined) {
    const rewardLine = document.createElement("div");
    rewardLine.textContent = t("objective.complete_reward_xp_only", { xpReward: objective.xpReward });
    rewardLine.style.fontSize = "11px";
    rewardLine.style.color = "#8fcd7a";
    rewardLine.style.fontWeight = "bold";
    card.appendChild(rewardLine);
  } else if (objective.completed && objective.copperReward !== undefined) {
    const rewardLine = document.createElement("div");
    rewardLine.textContent = t("objective.complete_reward_copper_only", { copperReward: objective.copperReward });
    rewardLine.style.fontSize = "11px";
    rewardLine.style.color = "#8fcd7a";
    rewardLine.style.fontWeight = "bold";
    card.appendChild(rewardLine);
  }

  // Clear current objective button (resets progress only)
  const clearButton = createButton(t("objective.clear"));
  clearButton.title = t("objective.clear_hint");
  clearButton.style.width = "auto";
  clearButton.style.justifySelf = "start";
  clearButton.style.padding = "4px 8px";
  clearButton.style.fontSize = "11px";
  clearButton.addEventListener("click", (event) => {
    event.stopPropagation();
    onResetObjective?.(slot);
  });
  // Core 0.4x -- this card now sits inside the passive floating HUD
  // wrapper (see applyWorldSessionOverlayFloatingHudStyles), so the
  // button must both opt back in to pointer events AND stop
  // pointerdown/mousedown in capture phase itself; a bubble-phase
  // stopPropagation on "click" alone is too late to stop Phaser's
  // window-level pointerdown listener from also firing click-to-move.
  makeInteractiveAndStopWorldInput(clearButton);
  card.appendChild(clearButton);

  return card;
}

function resolveObjectiveTrackerViewModel(
  objective: {
    readonly id: string;
    readonly label: string;
    readonly descriptionKey?: string;
    readonly current: number;
    readonly target: number;
    readonly completed: boolean;
    readonly readyToTurnIn?: boolean;
    readonly xpReward?: number;
    readonly copperReward?: number;
    readonly targetEnemyLabel?: string | undefined;
  } | null | undefined,
  objectiveRewardGranted?: boolean,
) : ObjectiveTrackerViewModel | null {
  void objectiveRewardGranted;

  if (objective === null || objective === undefined) {
    return null;
  }

  // Build a more actionable description that includes target enemy
  // and progress in the description field.
  const description = objective.descriptionKey !== undefined
    ? t(objective.descriptionKey as never)
    : undefined;

  // State label: "Return to Board" when completed, "Active" otherwise
  const isReadyToTurnIn = objective.readyToTurnIn === true || objective.completed;
  const stateLabel = isReadyToTurnIn
    ? t("objective.state.ready_to_turn_in")
    : t("objective.state.active");

  // Build actionable subtitle: show target enemy when active, return hint when ready
  let subtitle: string | undefined;
  if (isReadyToTurnIn) {
    subtitle = t("objective.panel.ready_to_turn_in_hint" as never);
  } else if (objective.targetEnemyLabel !== undefined) {
    subtitle = `${objective.targetEnemyLabel} — ${objective.current}/${objective.target}`;
  }

  return {
    title: objective.label,
    stateLabel,
    ...(description !== undefined ? { description } : {}),
    current: objective.current,
    target: objective.target,
    completed: objective.completed,
    ...(isReadyToTurnIn ? { readyToTurnIn: true } : {}),
    location: subtitle ?? "Town",
    ...(objective.xpReward !== undefined && { xpReward: objective.xpReward }),
    ...(objective.copperReward !== undefined && { copperReward: objective.copperReward }),
  };
}

function createSkillSlotPlaceholder(
  nextSkillSlotAt: number | undefined,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
): HTMLElement {
  const card = document.createElement("div");
  card.style.display = "flex";
  card.style.alignItems = "flex-start";
  card.style.gap = "10px";
  card.style.padding = "8px 10px";
  const remainingSeconds = formatSkillCooldownSeconds(nextSkillSlotAt);
  const isReady = remainingSeconds === null;
  card.style.border = isReady ? "1px solid #355a2f" : "1px solid #5a3c22";
  card.style.borderRadius = "12px";
  card.style.background = isReady
    ? "linear-gradient(180deg, rgba(16, 24, 14, 0.92) 0%, rgba(12, 18, 10, 0.92) 100%)"
    : "linear-gradient(180deg, rgba(28, 20, 12, 0.92) 0%, rgba(18, 14, 10, 0.92) 100%)";

  const slotKey = document.createElement("div");
  slotKey.textContent = "RMB";
  slotKey.style.minWidth = "42px";
  slotKey.style.padding = "6px 0";
  slotKey.style.border = isReady ? "1px solid #6aa25e" : "1px solid #6b5738";
  slotKey.style.borderRadius = "8px";
  slotKey.style.background = "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)";
  slotKey.style.color = "#e0c88a";
  slotKey.style.fontSize = "11px";
  slotKey.style.fontFamily = "monospace";
  slotKey.style.fontWeight = "bold";
  slotKey.style.textAlign = "center";
  slotKey.style.flex = "0 0 auto";
  card.appendChild(slotKey);

  const textBlock = document.createElement("div");
  textBlock.style.display = "grid";
  textBlock.style.gap = "2px";
  textBlock.style.minWidth = "0";
  textBlock.style.flex = "1 1 auto";

  const title = document.createElement("div");
  title.textContent = t("world_session.skill_slot_secondary");
  title.style.color = "#d8c6a3";
  title.style.fontSize = "11px";
  title.style.fontWeight = "bold";
  textBlock.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.textContent = t("skill.grave_spark.name");
  subtitle.style.color = "#b9d49a";
  subtitle.style.fontSize = "11px";
  subtitle.style.fontFamily = "monospace";
  subtitle.style.fontWeight = "bold";
  textBlock.appendChild(subtitle);

  const description = document.createElement("div");
  description.textContent = t("skill.grave_spark.description");
  description.style.color = "#a88d63";
  description.style.fontSize = "10px";
  textBlock.appendChild(description);

  const cooldownStatus = document.createElement("div");
  cooldownStatus.textContent = remainingSeconds === null
    ? `${t("world_session.skill_slot_ready")} • ${t("world_session.skill_slot_ready_now")}`
    : t("world_session.skill_slot_cooldown", { seconds: remainingSeconds });
  cooldownStatus.style.color = remainingSeconds === null ? "#8fce74" : "#d8a86a";
  cooldownStatus.style.fontSize = "10px";
  cooldownStatus.style.fontFamily = "monospace";
  cooldownStatus.style.fontWeight = "bold";
  textBlock.appendChild(cooldownStatus);

  const targetHint = document.createElement("div");
  targetHint.style.fontSize = "10px";
  targetHint.style.fontFamily = "monospace";
  targetHint.style.whiteSpace = "normal";
  targetHint.style.wordBreak = "break-word";

  const targetPrefix = skillTargeting.hoveredEnemyId !== null
    ? t("world_session.skill_target_hover")
    : skillTargeting.selectedEnemyId !== null
      ? t("world_session.skill_target_selected")
      : t("world_session.skill_target_none");

  if (skillTargeting.targetEnemyLabel === null) {
    targetHint.textContent = `${targetPrefix} • ${t("world_session.skill_target_none")}`;
    targetHint.style.color = "#a88d63";
  } else {
    const roundedDistance = skillTargeting.targetDistance === null
      ? null
      : Math.round(skillTargeting.targetDistance);
    const rangeText = roundedDistance === null
      ? t("world_session.skill_range_unknown")
      : skillTargeting.isTargetInRange === true
        ? t("world_session.skill_target_in_range", { distance: roundedDistance })
        : t("world_session.skill_target_out_of_range", { distance: roundedDistance, range: 96 });
    targetHint.textContent = `${targetPrefix} • ${skillTargeting.targetEnemyLabel} • ${rangeText}`;
    targetHint.style.color = skillTargeting.isTargetInRange === false ? "#d9936b" : "#b9d49a";
  }
  textBlock.appendChild(targetHint);

  if (lastSkillRejectedReason === "out_of_range") {
    const unavailableHint = document.createElement("div");
    unavailableHint.textContent = t("world_session.skill_target_move_to_cast");
    unavailableHint.style.color = "#e0c88a";
    unavailableHint.style.fontSize = "10px";
    unavailableHint.style.fontWeight = "bold";
    textBlock.appendChild(unavailableHint);
  }

  card.appendChild(textBlock);
  return card;
}

function createInventoryPanelSection(
  character: CharacterSummary | null,
  selection: {
    readonly getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null;
    readonly onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void;
  },
  equipmentLoadout: EquipmentLoadout,
  characterId: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
  isOpen: boolean = false,
  onOpenChange?: (open: boolean) => void,
): HTMLElement {
  const items = character?.inventorySummaryItems ?? [];
  const equippedItems = character?.equippedItems ?? [];
  const wrapper = document.createElement("details");
  wrapper.open = isOpen;
  wrapper.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  wrapper.addEventListener("toggle", () => {
    onOpenChange?.(wrapper.open);
  });
  wrapper.style.border = "1px solid #31271c";
  wrapper.style.borderRadius = "8px";
  wrapper.style.background = "rgba(12, 10, 8, 0.72)";
  wrapper.style.padding = "0";
  makeInteractive(wrapper);

  const summary = document.createElement("summary");
  summary.textContent = `Inventory (${items.length})`;
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "13px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  wrapper.appendChild(summary);

  const content = document.createElement("div");
  content.dataset.worldSessionInventoryContent = "true";
  content.style.padding = "0 8px 8px";
  makeInteractive(content);
  wrapper.appendChild(content);
  // Initial render
  fullRebuildInventoryContent(content, items, equippedItems, selection, equipmentLoadout, characterId, onEquipItem);
  return wrapper;
}

/** Version checksum used to skip full inventory rebuilds across overlay updates. */
let _inventoryContentVersion = -1;

function fullRebuildInventoryContent(
  content: HTMLElement,
  items: readonly InventorySummaryItem[],
  equippedItems: readonly EquippedItemSummary[],
  selection: {
    readonly getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null;
    readonly onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void;
  },
  equipmentLoadout: EquipmentLoadout,
  characterId: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
): void {
  content.replaceChildren();
  const currentSelection = selection.getSelectedItemId();
  const summarySection = createInventorySummarySection(items, () => selection.getSelectedItemId(), (itemId) => {
    selection.onSelectItem(itemId);
    fullRebuildInventoryContent(content, items, equippedItems, selection, equipmentLoadout, characterId, onEquipItem);
  });
  const selectedItem = items.find((item) => item.itemInstanceId === currentSelection) ?? null;
  const detailSection = createInventoryDetailSection(selectedItem, equippedItems, characterId, onEquipItem);
  content.append(summarySection, detailSection);
  _inventoryContentVersion = computeInventoryVersion(items, selection.getSelectedItemId());
}

function computeInventoryVersion(
  items: readonly InventorySummaryItem[],
  selectedItemId: string | null,
): number {
  let hash = items.length;
  for (let i = 0; i < Math.min(items.length, 4); i++) {
    const item = items[i];
    if (item === undefined) {
      break;
    }
    hash = ((hash << 5) - hash) + item.itemInstanceId.length;
    hash |= 0;
  }
  hash = ((hash << 5) - hash) + (selectedItemId?.length ?? 0);
  hash |= 0;
  return hash;
}

function createDebugPanel(
  room: Room<DoomscrollsRoomState>,
  roomState: ReturnType<typeof formatTownRoomState>,
  debugState: WorldSessionDebugState,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
  isOpen: boolean = false,
  onOpenChange?: (open: boolean) => void,
): HTMLElement {
  const details = document.createElement("details");
  details.open = isOpen;
  details.addEventListener("toggle", () => {
    onOpenChange?.(details.open);
  });
  details.style.border = "1px solid #31271c";
  details.style.borderRadius = "8px";
  details.style.background = "rgba(12, 10, 8, 0.56)";
  makeInteractive(details);

  const summary = document.createElement("summary");
  summary.textContent = "Debug Panel";
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#a88d63";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.style.padding = "0 8px 8px";
  content.style.display = "grid";
  content.style.gap = "8px";

  content.appendChild(createSectionBlock(t("world_session.room_info"), [
    createInfoLine(t("world_session.room_kind"), roomState.roomKind),
    createInfoLine(t("world_session.zone_id"), roomState.zoneId),
    createInfoLine(t("world_session.connected_players"), String(roomState.playerCount)),
  ], { compact: true }));
  content.appendChild(createDebugOverlayToggleSection(debugState, onShowDebugOverlayChange));
  content.appendChild(createMovementDebugSection(room, debugState));
  content.appendChild(createPresenceSection(room));
  content.appendChild(createProjectionSection(debugState, onProjectionModeChange));

  details.appendChild(content);
  return details;
}

function formatPlayerHpSummary(hp?: number, maxHp?: number): string {
  if (hp === undefined || maxHp === undefined) {
    return t("world_session.awaiting_player_hp");
  }

  const safeMaxHp = Math.max(0, maxHp);
  const safeHp = Math.max(0, hp);
  const percent = safeMaxHp > 0 ? Math.round((safeHp / safeMaxHp) * 100) : 0;
  return `${safeHp} / ${safeMaxHp} (${percent}%)`;
}

function resolvePlayerHpRatio(hp?: number, maxHp?: number): number | null {
  if (hp === undefined || maxHp === undefined || maxHp <= 0) {
    return null;
  }

  return Math.max(0, Math.min(1, hp / maxHp));
}

const INVENTORY_GRID_CELL_PX = 30;
const INVENTORY_GRID_GAP_PX = 3;

/** Core 0.26 -- a real slot grid, not a scrollable text list: every item
 * already carries its true `pageIndex`/`x`/`y`/`size` (the server-owned
 * grid position, `packages/shared/src/inventory/InventoryTypes.ts`), so
 * this renders the actual `DEFAULT_INVENTORY_GRID_CONFIG` grid (page 0 --
 * Core 0.1 has exactly one page) with each item spanning its real
 * width/height, plus an empty rarity-neutral slot for every uncovered
 * cell, instead of re-flowing occupied items into an arbitrary list. */
function createInventorySummarySection(
  items: readonly InventorySummaryItem[],
  getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null,
  onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void,
): HTMLElement {
  if (items.length === 0) {
    return createItemPanelSectionBlock("Inventory Summary", [createMutedText("No inventory items in bag.")], { compact: true });
  }

  const { gridWidth, gridHeight } = DEFAULT_INVENTORY_GRID_CONFIG;
  const pageItems = items.filter((item) => item.pageIndex === 0);

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${gridWidth}, ${INVENTORY_GRID_CELL_PX}px)`;
  grid.style.gridTemplateRows = `repeat(${gridHeight}, ${INVENTORY_GRID_CELL_PX}px)`;
  grid.style.gap = `${INVENTORY_GRID_GAP_PX}px`;
  makeInteractive(grid);
  grid.addEventListener("click", (event) => {
    event.stopPropagation();

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const itemTrigger = target.closest("[data-inventory-item-id]");
    if (!(itemTrigger instanceof HTMLElement)) {
      return;
    }

    const itemId = itemTrigger.dataset.inventoryItemId;
    if (typeof itemId !== "string" || itemId.length === 0) {
      return;
    }

    const selectedItem = items.find((item) => item.itemInstanceId === itemId);
    if (selectedItem === undefined) {
      return;
    }

    onSelectItem(selectedItem.itemInstanceId);
  });

  const occupied = new Set<string>();
  for (const item of pageItems) {
    const width = item.size?.width ?? 1;
    const height = item.size?.height ?? 1;
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        occupied.add(`${item.x + dx},${item.y + dy}`);
      }
    }

    const isSelected = getSelectedItemId() === item.itemInstanceId;
    const slot = document.createElement("button");
    slot.type = "button";
    slot.dataset.inventoryItemId = item.itemInstanceId;
    slot.setAttribute("aria-pressed", isSelected ? "true" : "false");
    slot.title = `${item.label} [${formatItemRarityLabel(item.rarity)}]`;
    slot.style.gridColumn = `${item.x + 1} / span ${width}`;
    slot.style.gridRow = `${item.y + 1} / span ${height}`;
    applyInventorySlotShellStyles(slot, item.rarity, isSelected);
    makeInteractive(slot);

    // Real icon when the pack has a reasonable match for this item (see
    // visualAssets.ts); otherwise a short text fallback, same fallback
    // rule item rows used before this build.
    const iconUrl = resolveItemIconUrl(item.definitionId);
    if (iconUrl === null) {
      const fallbackText = document.createElement("span");
      fallbackText.textContent = item.label.slice(0, 3);
      fallbackText.style.fontSize = "9px";
      fallbackText.style.color = getItemRarityColor(item.rarity);
      fallbackText.style.textAlign = "center";
      fallbackText.style.overflow = "hidden";
      fallbackText.style.pointerEvents = "none";
      slot.appendChild(fallbackText);
    } else {
      const icon = document.createElement("img");
      icon.src = iconUrl;
      icon.alt = "";
      icon.style.width = "70%";
      icon.style.height = "70%";
      icon.style.imageRendering = "pixelated";
      icon.style.pointerEvents = "none";
      slot.appendChild(icon);
    }

    grid.appendChild(slot);
  }

  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      if (occupied.has(`${x},${y}`)) {
        continue;
      }

      const emptySlot = document.createElement("div");
      emptySlot.style.gridColumn = `${x + 1} / span 1`;
      emptySlot.style.gridRow = `${y + 1} / span 1`;
      applyInventorySlotShellStyles(emptySlot, undefined, false);
      emptySlot.style.opacity = "0.4";
      grid.appendChild(emptySlot);
    }
  }

  return createItemPanelSectionBlock("Inventory Summary", [grid], { compact: true });
}

/** Shared shell styling for both an occupied (item) and empty inventory
 * grid cell -- a rarity-colored slot frame from the pack when the item
 * has a recognized rarity (`resolveRarityFrameUrl`), or a plain neutral
 * border for an empty cell / an item with no rarity match. */
function applyInventorySlotShellStyles(cell: HTMLElement, rarity: string | undefined, isSelected: boolean): void {
  cell.style.position = "relative";
  cell.style.display = "flex";
  cell.style.alignItems = "center";
  cell.style.justifyContent = "center";
  cell.style.padding = "0";
  cell.style.margin = "0";
  cell.style.boxSizing = "border-box";
  cell.style.background = "rgba(20, 16, 12, 0.85)";
  cell.style.cursor = cell.tagName === "BUTTON" ? "pointer" : "default";

  const frameUrl = resolveRarityFrameUrl(rarity);
  if (frameUrl === null) {
    cell.style.border = `1px solid ${COMMON_ITEM_ACCENT_COLOR}`;
    cell.style.borderRadius = "3px";
  } else {
    cell.style.border = "none";
    cell.style.borderRadius = "0";
    cell.style.backgroundImage = `url(${frameUrl})`;
    cell.style.backgroundSize = "100% 100%";
    cell.style.backgroundRepeat = "no-repeat";
    cell.style.backgroundPosition = "center";
  }

  cell.style.boxShadow = isSelected ? "0 0 0 2px #f0ddbb, 0 0 8px rgba(240, 221, 187, 0.7)" : "none";
}

function createInventoryDetailSection(
  item: InventorySummaryItem | null,
  equippedItems: readonly EquippedItemSummary[],
  characterId: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
): HTMLElement {
  if (item === null) {
    return createItemPanelSectionBlock("Item Detail", [createMutedText("Select an item to inspect it.")], { compact: true });
  }

  const children: HTMLElement[] = [];

  const title = document.createElement("div");
  title.textContent = item.label;
  title.style.color = getItemRarityColor(item.rarity);
  title.style.fontWeight = "bold";
  title.style.fontSize = "13px";
  title.style.lineHeight = "1.2";

  const header = document.createElement("div");
  header.style.display = "grid";
  header.style.gap = "6px";

  const rarityBadge = document.createElement("div");
  rarityBadge.textContent = formatItemRarityLabel(item.rarity);
  rarityBadge.style.display = "inline-block";
  rarityBadge.style.padding = "2px 6px";
  rarityBadge.style.border = `1px solid ${getItemRarityAccentColor(item.rarity)}`;
  rarityBadge.style.borderRadius = "999px";
  rarityBadge.style.color = getItemRarityColor(item.rarity);
  rarityBadge.style.fontSize = "10px";
  rarityBadge.style.fontWeight = "bold";
  rarityBadge.style.textTransform = "uppercase";

  const headerMeta = document.createElement("div");
  headerMeta.style.display = "flex";
  headerMeta.style.flexWrap = "wrap";
  headerMeta.style.gap = "6px";

  const categoryBadge = createItemMetaBadge("Category", item.category);
  const sizeBadge = createItemMetaBadge(
    "Size/Grid",
    item.size === undefined
      ? `Unknown • p${item.pageIndex} @ ${item.x},${item.y}`
      : `${item.size.width}x${item.size.height} • p${item.pageIndex} @ ${item.x},${item.y}`,
  );

  header.appendChild(title);
  headerMeta.append(rarityBadge, categoryBadge, sizeBadge);
  header.appendChild(headerMeta);

  children.push(header);

  const compareData = resolveEquippedComparisonItem(item, equippedItems);
  if (compareData !== null) {
    children.push(createInfoLine("Compare", `${formatEquipmentSlotLabel(compareData.slot)}: ${compareData.equippedItem.label}`));
    children.push(createModifierComparisonBlock(item, compareData.equippedItem));
  }

  children.push(createItemModifierSection(item.statModifiers));

  // Add Equip button if the item is equip-capable (has statModifiers or non-material category)
  if (characterId !== null && onEquipItem !== undefined && item.category !== "flask" && item.category !== "material") {
    const equipRow = document.createElement("div");
    equipRow.style.marginTop = "8px";

    const equipButton = createButton("Equip");
    equipButton.style.width = "100%";
    equipButton.style.fontSize = "12px";
    equipButton.style.padding = "6px 8px";
    equipButton.style.background = "rgba(49, 65, 38, 0.9)";
    equipButton.style.border = "1px solid #6a8a4a";
    makeInteractive(equipButton);
    equipButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      equipButton.disabled = true;
      equipButton.textContent = "Equipping...";
      try {
        const firstSlot = item.allowedEquipmentSlots?.[0];
        if (firstSlot === undefined) {
          throw new Error("Item has no allowed equipment slots");
        }
        await onEquipItem(characterId, item.itemInstanceId, firstSlot);
        equipButton.textContent = "Equipped!";
      } catch {
        equipButton.textContent = "Failed";
        setTimeout(() => {
          equipButton.disabled = false;
          equipButton.textContent = "Equip";
        }, 2000);
      }
    });
    equipRow.appendChild(equipButton);
    children.push(equipRow);
  }

  const section = createItemPanelSectionBlock("Item Detail", [], { compact: true });
  section.style.display = "grid";
  section.style.gap = "8px";
  section.append(...children);
  return section;
}

function formatItemRarityLabel(rarity?: string): string {
  if (rarity === undefined || rarity.length === 0) {
    return "Unknown";
  }

  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

function getItemRarityColor(rarity?: string): string {
  if (rarity === "epic") {
    return "#c77dff";
  }

  if (rarity === "rare") {
    return "#8fc7ff";
  }

  return COMMON_ITEM_COLOR;
}

function getItemRarityAccentColor(rarity?: string): string {
  if (rarity === "epic") {
    return "#8b3fd6";
  }

  if (rarity === "rare") {
    return "#4b86d8";
  }

  return COMMON_ITEM_ACCENT_COLOR;
}

function formatItemModifierText(modifier: StatModifier): string {
  const prefix = modifier.operation === "add" ? "+" : "×";
  return `${prefix}${modifier.value} ${modifier.target}`;
}

function resolveEquippedComparisonItem(
  item: InventorySummaryItem,
  equippedItems: readonly EquippedItemSummary[],
): { readonly slot: EquipmentSlot; readonly equippedItem: EquippedItemSummary } | null {
  const firstSlot = item.allowedEquipmentSlots?.[0];
  if (firstSlot === undefined) {
    return null;
  }

  // Task 358 (Core 0.5) — equipped items live in `character.equippedItems`
  // (Task 277), not in the unequipped-bag `inventorySummaryItems` list, so
  // the comparison must look up by slot here rather than by instance ID
  // against the bag. Looking the equipped item up in the bag never matched,
  // silently disabling this comparison since Task 277.
  const equippedItem = equippedItems.find((candidate) => candidate.slot === firstSlot);
  if (equippedItem === undefined || equippedItem.itemInstanceId === item.itemInstanceId) {
    return null;
  }

  return { slot: firstSlot, equippedItem };
}

function createModifierComparisonBlock(
  selectedItem: { readonly statModifiers?: readonly StatModifier[] },
  equippedItem: { readonly statModifiers?: readonly StatModifier[] },
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(150px, 1fr))";
  wrapper.style.gap = "6px";
  wrapper.style.padding = "8px";
  wrapper.style.border = "1px solid #3c3122";
  wrapper.style.borderRadius = "6px";
  wrapper.style.background = "rgba(18, 14, 10, 0.88)";

  wrapper.appendChild(createModifierComparisonColumn("Selected item modifiers", selectedItem.statModifiers));
  wrapper.appendChild(createModifierComparisonColumn("Equipped item modifiers", equippedItem.statModifiers));
  return wrapper;
}

function createModifierComparisonColumn(
  labelText: string,
  modifiers?: readonly StatModifier[],
): HTMLElement {
  const container = document.createElement("div");
  container.style.display = "grid";
  container.style.gap = "4px";

  const label = document.createElement("div");
  label.textContent = labelText;
  label.style.color = "#a88d63";
  label.style.fontSize = "11px";
  label.style.fontWeight = "bold";
  container.appendChild(label);

  if (modifiers === undefined || modifiers.length === 0) {
    container.appendChild(createMutedText("No modifiers."));
    return container;
  }

  const list = document.createElement("ul");
  list.style.margin = "0";
  list.style.padding = "0 0 0 18px";
  list.style.color = "#d8c6a3";
  list.style.fontSize = "12px";

  for (const modifier of modifiers) {
    const entry = document.createElement("li");
    entry.textContent = formatItemModifierText(modifier);
    list.appendChild(entry);
  }

  container.appendChild(list);
  return container;
}

function createItemModifierSection(modifiers?: readonly StatModifier[]): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "grid";
  wrapper.style.gap = "6px";

  const label = document.createElement("div");
  label.textContent = "Modifiers";
  label.style.color = "#a88d63";
  label.style.fontSize = "11px";
  label.style.fontWeight = "bold";
  wrapper.appendChild(label);

  if (modifiers === undefined || modifiers.length === 0) {
    wrapper.appendChild(createMutedText("No item modifiers visible."));
    return wrapper;
  }

  const list = document.createElement("div");
  list.style.display = "grid";
  list.style.gap = "4px";

  for (const modifier of modifiers) {
    list.appendChild(createModifierChip(formatItemModifierText(modifier)));
  }

  wrapper.appendChild(list);
  return wrapper;
}

function createModifierChip(text: string): HTMLElement {
  const chip = document.createElement("div");
  chip.textContent = text;
  chip.style.padding = "4px 7px";
  chip.style.border = "1px solid #3c3122";
  chip.style.borderRadius = "6px";
  chip.style.background = "rgba(18, 14, 10, 0.88)";
  chip.style.color = "#d8c6a3";
  chip.style.fontSize = "11px";
  chip.style.fontFamily = "monospace";
  return chip;
}

function createItemMetaBadge(labelText: string, valueText: string): HTMLElement {
  const badge = document.createElement("div");
  badge.style.display = "inline-flex";
  badge.style.alignItems = "center";
  badge.style.gap = "5px";
  badge.style.padding = "2px 6px";
  badge.style.border = "1px solid #3c3122";
  badge.style.borderRadius = "999px";
  badge.style.background = "rgba(18, 14, 10, 0.88)";

  const label = document.createElement("span");
  label.textContent = `${labelText}:`;
  label.style.color = "#a88d63";
  label.style.fontSize = "10px";
  label.style.fontWeight = "bold";
  badge.appendChild(label);

  const value = document.createElement("span");
  value.textContent = valueText;
  value.style.color = "#d8c6a3";
  value.style.fontSize = "10px";
  value.style.fontFamily = "monospace";
  badge.appendChild(value);

  return badge;
}

function formatEquipmentSlotLabel(slot: EquipmentSlot): string {
  return slot.replace("_", " ");
}

export function createMutedText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "0";
  paragraph.style.color = "#a88d63";
  paragraph.style.fontSize = "12px";
  return paragraph;
}