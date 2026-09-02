import type { Room } from "@colyseus/sdk";
import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import { resolveZoneDisplayName } from "./worldSessionAreaBannerView";
import type { CharacterSummary, EquippedItemSummary, InventorySummaryItem, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";
import type { StatModifier } from "@doomscrolls/shared";
import type { EquipmentSlot } from "@doomscrolls/shared";

import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getCurrentPlayerPresence, getTownRoomPresence } from "../../../net/townRoomPresence";
import { createButton, createInfoLine } from "../accountShell/accountShellDom";
import type { WorldSessionDebugState, WorldSessionSkillTargetingState } from "./worldSessionAreaView";
import {
  createEmptyEquipmentLoadout,
  createEquipmentPanelSection,
} from "./worldSessionEquipmentView";
import { makeInteractive, makePassive } from "./worldSessionPointerEvents";
import type { EquipmentLoadout } from "@doomscrolls/shared";
import {
  applyWorldSessionOverlayPanelStyles,
  applyWorldSessionOverlayScrollablePanelStyles,
} from "./worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../../worldProjection";

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
  }, onProjectionModeChange);
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
    }, onProjectionModeChange);
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

  const panel = createCardSection();
  panel.style.display = "grid";
  panel.style.gap = "4px";
  panel.style.padding = "6px 8px";
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
  ));
  panel.appendChild(createSkillSlotPlaceholder(selfPresence?.nextSkillSlotAt, skillTargeting, lastSkillRejectedReason));

  if (selfPresence?.lifeState === "downed") {
    // Core 0.14 -- CombatRoom's downed state now sends the player back
    // to Nightmarket on respawn (a real death consequence) instead of
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
): UtilityViewRefs {
  const root = createScrollableCardSection();
  makePassive(root);
  root.style.display = "grid";
  root.style.gap = "8px";
  root.style.alignContent = "start";

  const utilityState = getUtilityState();
  const controlsSection = createControlsSection(utilityState.controls, (open) => {
    onUtilityStateChange?.({ ...getUtilityState(), controls: open });
  });
  const objectivesSection = createObjectivesSection(
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective ?? null,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective2 ?? null,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted2,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.completedObjectives ?? [],
    utilityState.objectives,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), objectives: open });
    },
  );
  const equipmentSection = createEquipmentPanelSection(
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
  );
  const derivedStatsSection = createDerivedStatsSection(character);
  const inventorySection = createInventoryPanelSection(
    character,
    { getSelectedItemId, onSelectItem },
    getEquipmentLoadout(),
    character?.id ?? null,
    onEquipItem,
    utilityState.inventory,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), inventory: open });
    },
  );
  const debugSection = createDebugPanel(
    room,
    formatTownRoomState(room.state),
    debugState,
    onProjectionModeChange,
    utilityState.debug,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), debug: open });
    },
  );

  root.append(controlsSection, objectivesSection, equipmentSection, derivedStatsSection, inventorySection, debugSection);
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
): void {
  const utilityState = getUtilityState();
  const controlsSection = createControlsSection(utilityState.controls, (open) => {
    onUtilityStateChange?.({ ...getUtilityState(), controls: open });
  });
  const objectivesSection = createObjectivesSection(
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective ?? null,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objective2 ?? null,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.objectiveRewardGranted2,
    getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId)?.completedObjectives ?? [],
    utilityState.objectives,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), objectives: open });
    },
  );
  const equipmentSection = createEquipmentPanelSection(
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
  );
  const derivedStatsSection = createDerivedStatsSection(character);
  const inventorySection = createInventoryPanelSection(
    character,
    { getSelectedItemId, onSelectItem },
    getEquipmentLoadout(),
    character?.id ?? null,
    onEquipItem,
    utilityState.inventory,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), inventory: open });
    },
  );
  const nextDebugSection = createDebugPanel(
    room,
    formatTownRoomState(room.state),
    debugState,
    onProjectionModeChange,
    utilityState.debug,
    (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), debug: open });
    },
  );
  refs.root.replaceChildren(
    controlsSection,
    objectivesSection,
    equipmentSection,
    derivedStatsSection,
    inventorySection,
    nextDebugSection,
  );
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

function createScrollableCardSection(): HTMLElement {
  const section = document.createElement("section");
  applyWorldSessionOverlayScrollablePanelStyles(section);
  section.style.margin = "0";
  return section;
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
  lifeState?: "alive" | "downed",
  flaskCharges?: number,
  maxFlaskCharges?: number,
  level?: number,
  xp?: number,
  objective?: ObjectiveTrackerSource,
  onResetObjective?: (slot: 1 | 2) => void,
  objectiveRewardGranted?: boolean,
  // Core 0.15 -- second concurrent objective slot, mirrors `objective`/`objectiveRewardGranted` above.
  objective2?: ObjectiveTrackerSource,
  objectiveRewardGranted2?: boolean,
): HTMLElement {
  const activeSlotCount = (objective !== null && objective !== undefined ? 1 : 0)
    + (objective2 !== null && objective2 !== undefined ? 1 : 0);
  const wrapper = document.createElement("section");
  wrapper.style.display = "grid";
  wrapper.style.gap = "8px";
  wrapper.style.gridTemplateColumns = activeSlotCount === 0
    ? "minmax(240px, 1.6fr) minmax(72px, auto)"
    : activeSlotCount === 1
      ? "minmax(240px, 1.6fr) minmax(176px, auto) minmax(72px, auto)"
      : "minmax(240px, 1.6fr) minmax(176px, auto) minmax(176px, auto) minmax(72px, auto)";
  wrapper.style.alignItems = "center";

  const hpLine = document.createElement("div");
  hpLine.style.display = "flex";
  hpLine.style.justifyContent = "space-between";
  hpLine.style.alignItems = "center";
  hpLine.style.marginBottom = "4px";

  const hpLabel = document.createElement("span");
  hpLabel.textContent = t("world_session.player_hp");
  hpLabel.style.color = "#d8c6a3";
  hpLabel.style.fontSize = "12px";
  hpLine.appendChild(hpLabel);

  const hpValue = document.createElement("span");
  hpValue.textContent = hpSummary;
  hpValue.style.color = lifeState === "downed" ? "#e3a6a6" : "#c8aa7a";
  hpValue.style.fontWeight = "bold";
  hpValue.style.fontSize = "14px";
  hpValue.style.fontFamily = "monospace";
  hpLine.appendChild(hpValue);

  const vitalityCard = document.createElement("div");
  vitalityCard.style.padding = "8px 10px";
  vitalityCard.style.border = "1px solid #4d2a2a";
  vitalityCard.style.borderRadius = "12px";
  vitalityCard.style.background = "linear-gradient(180deg, rgba(40, 12, 12, 0.92) 0%, rgba(20, 8, 8, 0.92) 100%)";
  vitalityCard.appendChild(hpLine);

  const barFrame = document.createElement("div");
  barFrame.style.width = "100%";
  barFrame.style.height = "14px";
  barFrame.style.border = "1px solid #5f4a2f";
  barFrame.style.borderRadius = "999px";
  barFrame.style.background = "rgba(22, 16, 14, 0.95)";
  barFrame.style.overflow = "hidden";
  barFrame.style.marginBottom = "6px";

  const barFill = document.createElement("div");
  barFill.style.height = "100%";
  barFill.style.width = hpRatio === null ? "0%" : `${Math.max(0, Math.min(100, hpRatio * 100))}%`;
  barFill.style.background = lifeState === "downed"
    ? "linear-gradient(90deg, #7a1f1f 0%, #bf5252 100%)"
    : hpRatio !== null && hpRatio <= 0.25
      ? "linear-gradient(90deg, #8f2a2a 0%, #d46262 100%)"
      : "linear-gradient(90deg, #6e2f1f 0%, #c46a3a 100%)";
  barFill.style.borderRadius = "999px";
  barFill.style.transition = "width 0.3s ease";
  barFrame.appendChild(barFill);
  vitalityCard.appendChild(barFrame);

  vitalityCard.appendChild(createFlaskChargesLine(flaskCharges, maxFlaskCharges));

  wrapper.appendChild(vitalityCard);

  const objectiveTrackerViewModel = resolveObjectiveTrackerViewModel(objective, objectiveRewardGranted);
  if (objectiveTrackerViewModel !== null) {
    wrapper.appendChild(createObjectiveTrackerCard(objectiveTrackerViewModel, 1, onResetObjective));
  }
  const objectiveTrackerViewModel2 = resolveObjectiveTrackerViewModel(objective2, objectiveRewardGranted2);
  if (objectiveTrackerViewModel2 !== null) {
    wrapper.appendChild(createObjectiveTrackerCard(objectiveTrackerViewModel2, 2, onResetObjective));
  }

  wrapper.appendChild(createMiniHudStat(`${t("character.level")} ${String(level ?? 1)}`, `${t("character.xp")} ${String(xp ?? 0)}`));

  return wrapper;
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
  subtitleLine.textContent = objective.location ?? "Nightmarket";
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
  makeInteractive(clearButton);
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
    location: subtitle ?? "The Nightmarket",
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

function createFlaskChargesLine(charges?: number, maxCharges?: number): HTMLElement {
  if (charges === undefined || maxCharges === undefined) {
    const line = document.createElement("div");
    line.style.display = "flex";
    line.style.alignItems = "center";
    line.style.gap = "6px";

    const keyHint = document.createElement("span");
    keyHint.textContent = "[Q]";
    keyHint.style.color = "#7a5f4a";
    keyHint.style.fontWeight = "bold";
    keyHint.style.fontFamily = "monospace";
    keyHint.style.fontSize = "11px";
    keyHint.style.background = "rgba(63, 50, 30, 0.7)";
    keyHint.style.padding = "1px 5px";
    keyHint.style.borderRadius = "3px";
    line.appendChild(keyHint);

    const label = document.createElement("span");
    label.textContent = t("world_session.awaiting_flask");
    label.style.color = "#7a5f4a";
    label.style.fontSize = "12px";
    line.appendChild(label);
    return line;
  }

  const line = document.createElement("div");
  line.style.display = "flex";
  line.style.alignItems = "center";
  line.style.gap = "6px";
  line.style.marginTop = "2px";

  const keyHint = document.createElement("span");
  keyHint.textContent = "[Q]";
  keyHint.style.color = charges > 0 ? "#e0c88a" : "#7a5f4a";
  keyHint.style.fontWeight = "bold";
  keyHint.style.fontFamily = "monospace";
  keyHint.style.fontSize = "11px";
  keyHint.style.background = charges > 0 ? "rgba(63, 50, 30, 0.7)" : "rgba(40, 30, 20, 0.5)";
  keyHint.style.padding = "1px 5px";
  keyHint.style.borderRadius = "3px";
  line.appendChild(keyHint);

  // Mini flask charge dots
  const dotsWrapper = document.createElement("div");
  dotsWrapper.style.display = "flex";
  dotsWrapper.style.gap = "4px";
  dotsWrapper.style.alignItems = "center";

  for (let i = 0; i < maxCharges; i++) {
    const dot = document.createElement("span");
    const isFilled = i < charges;
    dot.textContent = "●";
    dot.style.color = isFilled ? "#b4512a" : "#3a2a1a";
    dot.style.fontSize = "14px";
    dot.style.lineHeight = "1";
    dotsWrapper.appendChild(dot);
  }

  line.appendChild(dotsWrapper);

  const fracLabel = document.createElement("span");
  fracLabel.textContent = `${charges} / ${maxCharges}`;
  fracLabel.style.color = charges > 0 ? "#b9d49a" : "#7a5f4a";
  fracLabel.style.fontSize = "11px";
  fracLabel.style.fontFamily = "monospace";
  line.appendChild(fracLabel);

  return line;
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

function createInventorySummarySection(
  items: readonly InventorySummaryItem[],
  getSelectedItemId: () => InventorySummaryItem["itemInstanceId"] | null,
  onSelectItem: (itemId: InventorySummaryItem["itemInstanceId"]) => void,
): HTMLElement {
  if (items.length === 0) {
    return createSectionBlock("Inventory Summary", [createMutedText("No inventory items in bag.")], { compact: true });
  }

  const list = document.createElement("ul");
  list.style.margin = "0";
  list.style.padding = "0";
  list.style.color = "#d8c6a3";
  list.style.fontSize = "12px";
  makeInteractive(list);
  list.addEventListener("click", (event) => {
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

  for (const item of items) {
    const row = document.createElement("li");
    const isSelected = getSelectedItemId() === item.itemInstanceId;
    row.style.marginBottom = "6px";
    row.style.listStyle = "none";
    makeInteractive(row);
    row.dataset.inventoryItemId = item.itemInstanceId;

    const button = createButton(item.label);
    button.style.width = "100%";
    button.style.textAlign = "left";
    button.style.fontSize = "12px";
    button.style.padding = "6px 8px";
    button.style.background = isSelected ? "rgba(63, 83, 49, 0.9)" : "rgba(31, 24, 18, 0.95)";
    button.style.color = getItemRarityColor(item.rarity);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    button.type = "button";
    button.dataset.inventoryItemId = item.itemInstanceId;
    const sizeText = item.size === undefined ? "" : ` • ${item.size.width}x${item.size.height}`;
    const rarityText = formatItemRarityLabel(item.rarity);
    button.textContent = `${item.label} [${rarityText}]${sizeText}`;
    makeInteractive(button);
    row.appendChild(button);
    list.appendChild(row);
  }

  return createSectionBlock("Inventory Summary", [list], { compact: true });
}

function createInventoryDetailSection(
  item: InventorySummaryItem | null,
  equippedItems: readonly EquippedItemSummary[],
  characterId: string | null,
  onEquipItem?: (characterId: string, itemInstanceId: string, slot: string) => Promise<void>,
): HTMLElement {
  if (item === null) {
    return createSectionBlock("Item Detail", [createMutedText("Select an item to inspect it.")], { compact: true });
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

  const section = createSectionBlock("Item Detail", [], { compact: true });
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