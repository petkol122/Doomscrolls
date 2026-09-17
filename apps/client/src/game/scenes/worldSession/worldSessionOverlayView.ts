import type { Room } from "@colyseus/sdk";
import { contentRegistry, type ZoneContentId } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import { resolveZoneDisplayName } from "./worldSessionAreaBannerView";
import { MATERIAL_IDS, type CharacterSummary, type MaterialBalances, type MaterialId, type RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

import { clientEnv } from "../../../config/env";
import { formatTownRoomState } from "../../../net/RealtimeClient";
import { getCurrentPlayerPresence, getTownRoomPresence, type FlaskBeltSlotEntry } from "../../../net/townRoomPresence";
import { getTownRoomEnemies } from "../../../net/townRoomEnemies";
import { parseActiveStatusEffectTypes, type StatusEffectType } from "../../../net/statusEffects";
import { createButton, createInfoLine } from "../accountShell/accountShellDom";
import type { WorldSessionDebugState, WorldSessionSkillTargetingState } from "./worldSessionAreaView";
import { makeInteractive, makeInteractiveAndStopWorldInput, makePassive } from "./worldSessionPointerEvents";
import {
  applyWorldSessionOverlayPanelStyles,
  applyWorldSessionOverlayFloatingHudStyles,
} from "./worldSessionOverlayLayout";
import type { WorldProjectionMode } from "../../worldProjection";
import {
  getLootFilterRules,
  setLootFilterRules,
  type LootFilterRules,
} from "./worldSessionLootFilterState";

export interface WorldSessionUtilityPanelOpenState {
  readonly controls: boolean;
  // Core 0.4 HUD Overhaul -- whether the right-hand Quest/Objective
  // Tracker dock is expanded (body visible) or collapsed to just its
  // header bar. Replaces the old "objectives" flyout-open flag now that
  // the tracker is a persistent dock, not a Micro Menu flyout.
  readonly questTrackerExpanded: boolean;
  readonly debug: boolean;
  // Milestone 0.3 -- Client Loot Filter flyout open state.
  readonly lootFilter: boolean;
}

export const DEFAULT_WORLD_SESSION_UTILITY_PANEL_OPEN_STATE: WorldSessionUtilityPanelOpenState = {
  controls: false,
  questTrackerExpanded: true,
  debug: false,
  lootFilter: false,
};

/** Core 0.1 UI Overhaul Phase 2 -- the Micro Menu no longer hosts the
 *  Character/Inventory/Skill-tree panels itself; it just toggles the
 *  standalone windows WorldSessionScene owns, and reflects whether each
 *  is currently open. */
export interface WorldSessionOverlayWindowToggles {
  readonly onToggleCharacter: () => void;
  readonly onToggleInventory: () => void;
  readonly onToggleSkillTree: () => void;
  readonly isCharacterOpen: () => boolean;
  readonly isInventoryOpen: () => boolean;
  readonly isSkillTreeOpen: () => boolean;
}

export interface WorldSessionOverlayView {
  readonly statusPanel: HTMLElement | null;
  readonly utilityPanel: HTMLElement;
  readonly hudPanel: HTMLElement;
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

interface UnitFrameBarRefs {
  readonly frame: HTMLElement;
  readonly fill: HTMLElement;
  readonly text: HTMLElement;
}

interface TargetFrameRefs {
  readonly root: HTMLElement;
  readonly nameLine: HTMLElement;
  readonly hp: UnitFrameBarRefs;
  readonly statusIconsRow: HTMLElement;
}

interface StatusViewRefs {
  /** The whole status-region root: the Player Unit Frame plus, beside
   *  it, the Dynamic Target Frame slot. */
  readonly root: HTMLElement;
  readonly zoneLine: HTMLElement;
  readonly testCombatLine: HTMLElement;
  readonly nameLine: HTMLElement;
  readonly levelBadge: HTMLElement;
  readonly hp: UnitFrameBarRefs;
  readonly mana: UnitFrameBarRefs;
  readonly statusIconsRow: HTMLElement;
  readonly walletLine: HTMLElement;
  /** One span per salvage-material currency id (see `MaterialTypes.ts`),
   *  each carrying its own right-click-to-withdraw handler attached
   *  once at creation; `syncStatusView` only ever updates their text
   *  and the balance each one's handler reads off `latestBalances`. */
  readonly materialSpans: ReadonlyMap<MaterialId, HTMLElement>;
  readonly latestBalances: { current: MaterialBalances };
  readonly targetFrame: TargetFrameRefs;
}

/**
 * Milestone 0.3 -- Multi-Currency Wallet Engine. Pilsen is CZK-only
 * today (no other region is reachable yet), so the HUD's "primary
 * regional balance" is always CZK; a later region rollout picks this
 * dynamically off the character's current area instead.
 */
function formatPrimaryRegionalBalance(wallet: CharacterSummary["wallet"]): string {
  const czk = contentRegistry.currencies.get("czk");
  const balance = wallet.balances.czk;
  return `${balance.toLocaleString()} ${czk?.symbol ?? "Kč"}`;
}

function formatNetWorth(netWorth: number | undefined): string {
  const czk = contentRegistry.currencies.get("czk");
  return `${t("hud.net_worth_label")}: ${(netWorth ?? 0).toLocaleString()} ${czk?.symbol ?? "Kč"}`;
}

/** Localized display name for a salvage-material currency id, see `MaterialTypes.ts`. */
function resolveMaterialLabel(materialId: string): string {
  const def = contentRegistry.items.get(materialId as never);
  return def !== undefined ? t(def.nameKey as never) : materialId;
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

interface QuestTrackerRefs {
  readonly root: HTMLElement;
  readonly header: HTMLElement;
  readonly collapseButton: HTMLButtonElement;
  readonly body: HTMLElement;
}

interface UtilityViewRefs {
  readonly root: HTMLElement;
  readonly questRefs: QuestTrackerRefs;
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
  onReturnToTown: (() => void) | undefined,
  getUtilityState: () => WorldSessionUtilityPanelOpenState = () =>
    DEFAULT_WORLD_SESSION_UTILITY_PANEL_OPEN_STATE,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
  windowToggles: WorldSessionOverlayWindowToggles,
  onRequestWithdrawMaterial: (materialId: string, materialLabel: string, currentBalance: number) => void,
): WorldSessionOverlayView {
  let currentStatusPanel: HTMLElement | null = null;

  const statusRefs = character !== null
    ? createPlayerUnitFrame(character, character.level, resolveCurrentZoneId(room), onRequestWithdrawMaterial)
    : null;
  // Core 0.4 HUD Overhaul -- `utilityRefs`/`utilityPanel` now host the
  // right-hand Quest/Objective Tracker dock rather than the old
  // top-right Micro Menu icon bar (see `applyWorldSessionOverlayQuestStyles`).
  const utilityRefs = createStableQuestContent(room, onResetObjective, getUtilityState, onUtilityStateChange);
  const hudRefs = createStableHudContent(
    character,
    room,
    debugState,
    skillTargeting,
    lastSkillRejectedReason,
    onRespawn,
    onLeaveWorld,
    onReturnToTown,
    getUtilityState,
    onUtilityStateChange,
    onProjectionModeChange,
    onShowDebugOverlayChange,
    windowToggles,
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
      syncStatusView(statusRefs, character, room, skillTargeting);
    }
  }
  utilityPanel.appendChild(utilityRefs.root);
  hudPanel.appendChild(hudRefs.root);
  syncQuestView(utilityRefs, room, onResetObjective, getUtilityState);
  syncHudView(
    hudRefs,
    character,
    room,
    debugState,
    skillTargeting,
    lastSkillRejectedReason,
    onRespawn,
    onLeaveWorld,
    onReturnToTown,
    getUtilityState,
    onUtilityStateChange,
    onProjectionModeChange,
    onShowDebugOverlayChange,
    windowToggles,
  );
  currentStatusPanel = statusPanel;

  const update = (
    nextCharacter: CharacterSummary | null,
    nextRoom: Room<DoomscrollsRoomState>,
    nextDebugState: WorldSessionDebugState,
    nextSkillTargeting: WorldSessionSkillTargetingState,
    nextLastSkillRejectedReason: string | null,
  ): void => {
    if (statusRefs !== null && nextCharacter !== null && currentStatusPanel !== null) {
      syncStatusView(statusRefs, nextCharacter, nextRoom, nextSkillTargeting);
    }

    syncHudView(
      hudRefs,
      nextCharacter,
      nextRoom,
      nextDebugState,
      nextSkillTargeting,
      nextLastSkillRejectedReason,
      onRespawn,
      onLeaveWorld,
      onReturnToTown,
      getUtilityState,
      onUtilityStateChange,
      onProjectionModeChange,
      onShowDebugOverlayChange,
      windowToggles,
    );
    syncQuestView(utilityRefs, nextRoom, onResetObjective, getUtilityState);
  };

  return {
    statusPanel,
    utilityPanel,
    hudPanel,
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

/** A single labeled resource bar (HP/Mana on the Player Unit Frame and
 *  Target Frame) -- a bordered track with a colored fill and a
 *  centered "current/max (percent%)" readout. */
function createUnitFrameBar(borderColor: string, fillGradient: string): UnitFrameBarRefs {
  const frame = document.createElement("div");
  frame.style.position = "relative";
  frame.style.width = "100%";
  frame.style.height = "12px";
  frame.style.border = `1px solid ${borderColor}`;
  frame.style.borderRadius = "4px";
  frame.style.background = "rgba(10, 10, 10, 0.55)";
  frame.style.overflow = "hidden";
  frame.style.boxSizing = "border-box";

  const fill = document.createElement("div");
  fill.style.position = "absolute";
  fill.style.inset = "0";
  fill.style.width = "0%";
  fill.style.background = fillGradient;
  fill.style.transition = "width 0.25s ease";
  frame.appendChild(fill);

  const text = document.createElement("div");
  text.style.position = "absolute";
  text.style.inset = "0";
  text.style.display = "flex";
  text.style.alignItems = "center";
  text.style.justifyContent = "center";
  text.style.fontSize = "9px";
  text.style.fontFamily = "monospace";
  text.style.fontWeight = "bold";
  text.style.color = "#f3e2c4";
  text.style.textShadow = "0 1px 2px rgba(0, 0, 0, 0.9)";
  frame.appendChild(text);

  return { frame, fill, text };
}

function syncUnitFrameBar(bar: UnitFrameBarRefs, current: number | undefined, max: number | undefined): void {
  const ratio = current !== undefined && max !== undefined && max > 0
    ? Math.max(0, Math.min(1, current / max))
    : null;
  bar.fill.style.width = ratio === null ? "0%" : `${ratio * 100}%`;

  if (current === undefined || max === undefined) {
    bar.text.textContent = "…";
    return;
  }
  const safeCurrent = Math.max(0, Math.round(current));
  const safeMax = Math.max(0, Math.round(max));
  const percent = safeMax > 0 ? Math.round((safeCurrent / safeMax) * 100) : 0;
  bar.text.textContent = `${safeCurrent}/${safeMax} (${percent}%)`;
}

const STATUS_EFFECT_GLYPHS: Record<StatusEffectType, string> = {
  bleed: "\u{1FA78}",
  slow: "❄",
  stun: "\u{1F4AB}",
  burn: "\u{1F525}",
  emp_dot: "⚡",
};

/** Renders the small row of active-status-effect glyphs underneath a
 *  unit frame's bars (Player Unit Frame and Target Frame both use
 *  this), from the server-owned flattened `statusEffects` string. */
function syncStatusEffectIcons(row: HTMLElement, rawStatusEffects: string | undefined): void {
  const active = parseActiveStatusEffectTypes(rawStatusEffects, Date.now());
  row.replaceChildren();
  for (const effect of active) {
    const icon = document.createElement("span");
    icon.textContent = STATUS_EFFECT_GLYPHS[effect];
    icon.title = effect;
    icon.style.fontSize = "11px";
    icon.style.lineHeight = "1";
    row.appendChild(icon);
  }
}

/** Core 0.4 HUD Overhaul -- the top-left Player Unit Frame: a dark
 *  portrait badge (level), character name, HP/Mana bars (numeric +
 *  percent), and active status-effect glyphs underneath. Replaces the
 *  old plain-text character chip; the Leave World / Return to Town
 *  buttons that used to live here moved into the Settings flyout in
 *  the bottom Micro Menu dock (`createControlsSection`) so this frame
 *  reads as a real ARPG unit frame, not a text card with buttons. */
function createPlayerUnitFrame(
  character: CharacterSummary,
  level: number,
  zoneId: string,
  onRequestWithdrawMaterial: (materialId: string, materialLabel: string, currentBalance: number) => void,
): StatusViewRefs {
  // Task 242 — the frame is a visible interactive panel root; it must
  // keep `pointer-events: auto` and stop world input from leaking to
  // the Phaser canvas underneath.
  const panel = createCardSection();
  panel.style.display = "flex";
  panel.style.alignItems = "flex-start";
  panel.style.gap = "8px";
  panel.style.width = "min(240px, calc(100vw - 28px))";
  panel.style.padding = "8px 10px";

  const portrait = document.createElement("div");
  portrait.style.position = "relative";
  portrait.style.flex = "0 0 auto";
  portrait.style.width = "44px";
  portrait.style.height = "44px";
  portrait.style.borderRadius = "8px";
  portrait.style.border = "2px solid #6b5738";
  portrait.style.background = "radial-gradient(circle at 50% 30%, rgba(60, 46, 30, 0.9) 0%, rgba(14, 11, 8, 0.95) 100%)";
  portrait.style.display = "flex";
  portrait.style.alignItems = "center";
  portrait.style.justifyContent = "center";
  portrait.style.boxShadow = "inset 0 0 10px rgba(0, 0, 0, 0.6)";

  const levelBadge = document.createElement("div");
  levelBadge.textContent = String(level);
  levelBadge.style.fontSize = "17px";
  levelBadge.style.fontWeight = "bold";
  levelBadge.style.color = "#e0c88a";
  portrait.appendChild(levelBadge);
  makePassive(portrait);
  panel.appendChild(portrait);

  const infoBlock = document.createElement("div");
  infoBlock.style.display = "grid";
  infoBlock.style.gap = "3px";
  infoBlock.style.flex = "1 1 auto";
  infoBlock.style.minWidth = "0";

  const nameLine = document.createElement("div");
  nameLine.textContent = character.characterName;
  nameLine.style.fontSize = "13px";
  nameLine.style.fontWeight = "bold";
  nameLine.style.color = "#f0ddbb";
  nameLine.style.whiteSpace = "nowrap";
  nameLine.style.overflow = "hidden";
  nameLine.style.textOverflow = "ellipsis";
  infoBlock.appendChild(nameLine);

  const hp = createUnitFrameBar("#7a2c2c", "linear-gradient(90deg, #d46262 0%, #7a1f1f 100%)");
  infoBlock.appendChild(hp.frame);

  const mana = createUnitFrameBar("#2c3c5a", "linear-gradient(90deg, #4a7ac4 0%, #1f3a6e 100%)");
  infoBlock.appendChild(mana.frame);

  const statusIconsRow = document.createElement("div");
  statusIconsRow.style.display = "flex";
  statusIconsRow.style.gap = "3px";
  statusIconsRow.style.minHeight = "13px";
  infoBlock.appendChild(statusIconsRow);

  const zoneLine = document.createElement("div");
  zoneLine.textContent = resolveZoneDisplayName(zoneId);
  zoneLine.style.fontSize = "10px";
  zoneLine.style.color = "#a88d63";
  infoBlock.appendChild(zoneLine);

  const testCombatLine = document.createElement("div");
  testCombatLine.textContent = resolveZoneKindLabel(zoneId);
  testCombatLine.style.fontSize = "9px";
  testCombatLine.style.color = "#a88d63";
  infoBlock.appendChild(testCombatLine);

  const walletLine = document.createElement("div");
  walletLine.textContent = `${formatPrimaryRegionalBalance(character.wallet)} • ${formatNetWorth(character.netWorth)}`;
  walletLine.style.fontSize = "9px";
  walletLine.style.fontFamily = "monospace";
  walletLine.style.color = "#8d7958";
  infoBlock.appendChild(walletLine);

  const latestBalances: { current: MaterialBalances } = { current: character.materialBalances };
  const materialsLine = document.createElement("div");
  materialsLine.style.cssText = "display: flex; gap: 8px; font-size: 9px; font-family: monospace; color: #8d7958;";
  const materialSpans = new Map<MaterialId, HTMLElement>();
  for (const materialId of MATERIAL_IDS) {
    const materialLabel = resolveMaterialLabel(materialId);
    const span = document.createElement("span");
    span.style.cursor = "context-menu";
    span.title = "Right-click to withdraw as an item";
    span.textContent = `${materialLabel}: ${character.materialBalances[materialId]}`;
    span.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onRequestWithdrawMaterial(materialId, materialLabel, latestBalances.current[materialId]);
    });
    materialSpans.set(materialId, span);
    materialsLine.appendChild(span);
  }
  infoBlock.appendChild(materialsLine);

  makePassive(infoBlock);
  panel.appendChild(infoBlock);

  const targetFrame = createTargetFrame();

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "row";
  root.style.alignItems = "flex-start";
  root.style.gap = "8px";
  makePassive(root);
  root.append(panel, targetFrame.root);

  return {
    root,
    zoneLine,
    testCombatLine,
    nameLine,
    levelBadge,
    hp,
    mana,
    statusIconsRow,
    walletLine,
    materialSpans,
    latestBalances,
    targetFrame,
  };
}

/** Core 0.4 HUD Overhaul -- the Dynamic Target Frame, shown immediately
 *  to the right of the Player Unit Frame while an enemy/NPC is
 *  hovered or selected (see `WorldSessionSkillTargetingState`), and
 *  hidden the moment there's no target. Gains a gold/orange border for
 *  elite/champion enemies instead of a separate badge graphic, since
 *  the pack has no dedicated elite-frame asset. */
function createTargetFrame(): TargetFrameRefs {
  const root = createCardSection();
  root.style.display = "none";
  root.style.flexDirection = "column";
  root.style.gap = "4px";
  root.style.width = "min(200px, calc(100vw - 28px))";
  root.style.padding = "8px 10px";

  const nameLine = document.createElement("div");
  nameLine.style.fontSize = "12px";
  nameLine.style.fontWeight = "bold";
  nameLine.style.color = "#f0ddbb";
  nameLine.style.whiteSpace = "nowrap";
  nameLine.style.overflow = "hidden";
  nameLine.style.textOverflow = "ellipsis";
  root.appendChild(nameLine);

  const hp = createUnitFrameBar("#7a2c2c", "linear-gradient(90deg, #d46262 0%, #7a1f1f 100%)");
  root.appendChild(hp.frame);

  const statusIconsRow = document.createElement("div");
  statusIconsRow.style.display = "flex";
  statusIconsRow.style.gap = "3px";
  statusIconsRow.style.minHeight = "13px";
  root.appendChild(statusIconsRow);

  return { root, nameLine, hp, statusIconsRow };
}

function syncStatusView(
  refs: StatusViewRefs,
  character: CharacterSummary,
  room: Room<DoomscrollsRoomState>,
  skillTargeting: WorldSessionSkillTargetingState,
): void {
  const selfPresence = getCurrentPlayerPresence(
    room.state as unknown as Record<string, unknown>,
    room.sessionId,
  );
  const currentZoneId = resolveCurrentZoneId(room);
  refs.zoneLine.textContent = resolveZoneDisplayName(currentZoneId);
  refs.testCombatLine.textContent = resolveZoneKindLabel(currentZoneId);
  refs.nameLine.textContent = character.characterName;
  refs.levelBadge.textContent = String(selfPresence?.level ?? character.level);
  refs.walletLine.textContent = `${formatPrimaryRegionalBalance(character.wallet)} • ${formatNetWorth(character.netWorth)}`;
  refs.latestBalances.current = character.materialBalances;
  for (const [materialId, span] of refs.materialSpans) {
    span.textContent = `${resolveMaterialLabel(materialId)}: ${character.materialBalances[materialId]}`;
  }
  syncUnitFrameBar(refs.hp, selfPresence?.hp, selfPresence?.maxHp);
  syncUnitFrameBar(refs.mana, selfPresence?.mana, selfPresence?.maxMana);
  syncStatusEffectIcons(refs.statusIconsRow, selfPresence?.statusEffects);
  syncTargetFrame(refs.targetFrame, room, skillTargeting);
}

/** Resolves the currently hovered/selected enemy (hover wins, matching
 *  the skill-targeting hint line's own precedence) and syncs the
 *  Target Frame to it, hiding it entirely when there is no target. */
function syncTargetFrame(
  refs: TargetFrameRefs,
  room: Room<DoomscrollsRoomState>,
  skillTargeting: WorldSessionSkillTargetingState,
): void {
  const targetId = skillTargeting.hoveredEnemyId ?? skillTargeting.selectedEnemyId;
  const enemy = targetId === null
    ? undefined
    : getTownRoomEnemies(room.state).find((candidate) => candidate.id === targetId);

  if (enemy === undefined) {
    refs.root.style.display = "none";
    return;
  }

  refs.root.style.display = "flex";
  refs.root.style.border = enemy.rarity === "champion"
    ? "2px solid #e0824a"
    : enemy.rarity === "elite"
      ? "2px solid #c9a23f"
      : "1px solid #4d3f2a";
  refs.nameLine.textContent = skillTargeting.targetEnemyLabel ?? t(enemy.label);
  syncUnitFrameBar(refs.hp, enemy.hp, enemy.maxHp);
  syncStatusEffectIcons(refs.statusIconsRow, enemy.statusEffects);
}

function createStableHudContent(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  onRespawn: () => void,
  onLeaveWorld: () => void,
  onReturnToTown: (() => void) | undefined,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
  windowToggles: WorldSessionOverlayWindowToggles,
): HudViewRefs {
  const root = document.createElement("div");
  makePassive(root);
  syncHudView(
    { root },
    character,
    room,
    debugState,
    skillTargeting,
    lastSkillRejectedReason,
    onRespawn,
    onLeaveWorld,
    onReturnToTown,
    getUtilityState,
    onUtilityStateChange,
    onProjectionModeChange,
    onShowDebugOverlayChange,
    windowToggles,
  );
  return { root };
}

function syncHudView(
  refs: HudViewRefs,
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  onRespawn: () => void,
  onLeaveWorld: () => void,
  onReturnToTown: (() => void) | undefined,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
  windowToggles: WorldSessionOverlayWindowToggles,
): void {
  // Task 229: HUD content is rebuilt on every update pass. This means
  // the respawn button and any other interactive HUD control is destroyed
  // and recreated each frame. To make clicks reliable we must NOT
  // destroy children while a pointer-down is in flight. The browser
  // already handles this for native button clicks — the click event
  // fires on the element that received mousedown, even if it gets
  // removed before mouseup. The real problem was pointer-events: none
  // on parent panels blocking the click entirely (fixed in overlayLayout).
  refs.root.replaceChildren(renderHudContent(
    character,
    room,
    debugState,
    skillTargeting,
    lastSkillRejectedReason,
    onRespawn,
    onLeaveWorld,
    onReturnToTown,
    getUtilityState,
    onUtilityStateChange,
    onProjectionModeChange,
    onShowDebugOverlayChange,
    windowToggles,
  ));
}

function renderHudContent(
  nextCharacter: CharacterSummary | null,
  nextRoom: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  onRespawn: () => void,
  onLeaveWorld: () => void,
  onReturnToTown: (() => void) | undefined,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
  windowToggles: WorldSessionOverlayWindowToggles,
): HTMLElement {
  const selfPresence = getCurrentPlayerPresence(
    nextRoom.state as unknown as Record<string, unknown>,
    nextRoom.sessionId,
  );

  const panel = createFloatingHudSection();
  panel.style.display = "grid";
  panel.style.gap = "4px";
  panel.appendChild(createHudSection(
    selfPresence?.flaskBelt,
    selfPresence?.xp ?? nextCharacter?.xp ?? 0,
    selfPresence?.nextSkillSlotAt,
    skillTargeting,
    lastSkillRejectedReason,
    windowToggles,
    buildMicroMenuDockItems(
      nextRoom,
      debugState,
      getUtilityState,
      onUtilityStateChange,
      onProjectionModeChange,
      onShowDebugOverlayChange,
      windowToggles,
      onLeaveWorld,
      onReturnToTown,
    ),
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

/** Core 0.4 HUD Overhaul -- the right-hand Quest/Objective Tracker
 *  dock. `root` just hosts whatever `createQuestTrackerPanel` builds,
 *  same stable-root/replace-children idiom as the HUD panel. */
function createStableQuestContent(
  room: Room<DoomscrollsRoomState>,
  onResetObjective: (slot: 1 | 2) => void,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
): UtilityViewRefs {
  const root = document.createElement("div");
  makePassive(root);
  const questRefs = createQuestTrackerChrome(getUtilityState, onUtilityStateChange);
  root.appendChild(questRefs.root);
  applyQuestTrackerCollapsedState(questRefs, getUtilityState().questTrackerExpanded);
  renderQuestTrackerBody(questRefs, room, onResetObjective);
  return { root, questRefs };
}

function syncQuestView(
  refs: UtilityViewRefs,
  room: Room<DoomscrollsRoomState>,
  onResetObjective: (slot: 1 | 2) => void,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
): void {
  applyQuestTrackerCollapsedState(refs.questRefs, getUtilityState().questTrackerExpanded);
  renderQuestTrackerBody(refs.questRefs, room, onResetObjective);
}

/** Core 0.4 HUD Overhaul -- the persistent, collapsible right-hand
 *  Quest/Objective Tracker dock's chrome (root/header/collapse button/
 *  body), built exactly ONCE per overlay session rather than rebuilt
 *  on every sync. This matters for the collapse animation: only a node
 *  that persists across renders can actually play a CSS `transition`
 *  when its style changes -- a node recreated fresh on every click
 *  (the previous implementation, which also skipped ever building the
 *  body while collapsed) has no prior painted state to animate from,
 *  so it just snapped instantly. `applyQuestTrackerCollapsedState`
 *  toggles this same body's `max-height`/opacity every time instead. */
function createQuestTrackerChrome(
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
): QuestTrackerRefs {
  const root = document.createElement("div");
  makeInteractiveAndStopWorldInput(root);
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.border = "1px solid #4d3f2a";
  root.style.borderRadius = "10px";
  root.style.background = "rgba(10, 8, 7, 0.9)";
  root.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
  root.style.overflow = "hidden";
  root.style.maxHeight = "calc(100vh - 28px)";
  root.style.boxSizing = "border-box";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "8px";
  header.style.padding = "7px 10px";
  header.style.background = "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)";
  header.style.transition = "border-color 0.2s ease";

  const title = document.createElement("div");
  title.textContent = t("objective.panel.title" as never);
  title.style.color = "#f0dec0";
  title.style.fontWeight = "bold";
  title.style.fontSize = "12px";
  header.appendChild(title);

  const collapseButton = document.createElement("button");
  collapseButton.type = "button";
  collapseButton.style.border = "1px solid #6b5738";
  collapseButton.style.borderRadius = "4px";
  collapseButton.style.background = "rgba(14, 11, 8, 0.85)";
  collapseButton.style.color = "#e0c88a";
  collapseButton.style.fontSize = "12px";
  collapseButton.style.lineHeight = "1";
  collapseButton.style.padding = "3px 9px";
  collapseButton.style.cursor = "pointer";
  makeInteractive(collapseButton);
  header.appendChild(collapseButton);
  root.appendChild(header);

  const body = document.createElement("div");
  body.style.padding = "8px 10px";
  body.style.display = "grid";
  body.style.gap = "8px";
  body.style.overflowY = "auto";
  body.style.boxSizing = "border-box";
  body.style.transition = "max-height 0.22s ease, opacity 0.18s ease, padding-top 0.22s ease, padding-bottom 0.22s ease";
  root.appendChild(body);

  const refs: QuestTrackerRefs = { root, header, collapseButton, body };

  collapseButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const nextExpanded = !getUtilityState().questTrackerExpanded;
    onUtilityStateChange?.({ ...getUtilityState(), questTrackerExpanded: nextExpanded });
    // Apply immediately (don't wait for the next periodic sync pass)
    // so the click feels instant and the transition above actually
    // has a "from" state to animate away from.
    applyQuestTrackerCollapsedState(refs, nextExpanded);
  });

  return refs;
}

const QUEST_TRACKER_EXPANDED_MAX_HEIGHT_PX = "480px";

function applyQuestTrackerCollapsedState(refs: QuestTrackerRefs, isExpanded: boolean): void {
  refs.collapseButton.textContent = isExpanded ? "−" : "+";
  refs.collapseButton.title = isExpanded ? "Collapse" : "Expand";
  refs.collapseButton.setAttribute("aria-label", isExpanded ? "Collapse quest tracker" : "Expand quest tracker");
  refs.header.style.borderBottom = isExpanded ? "1px solid #4d3f2a" : "none";
  refs.body.style.maxHeight = isExpanded ? QUEST_TRACKER_EXPANDED_MAX_HEIGHT_PX : "0px";
  refs.body.style.opacity = isExpanded ? "1" : "0";
  refs.body.style.paddingTop = isExpanded ? "8px" : "0px";
  refs.body.style.paddingBottom = isExpanded ? "8px" : "0px";
}

/** Rebuilds only the Quest Tracker's body *contents* (the objective
 *  cards and completed list) from the latest presence snapshot --
 *  called on every sync since objectives change often, but never
 *  touches `body`'s own collapse styling (see
 *  `applyQuestTrackerCollapsedState`), so an in-flight collapse
 *  animation is never interrupted by an unrelated objective update. */
function renderQuestTrackerBody(
  refs: QuestTrackerRefs,
  room: Room<DoomscrollsRoomState>,
  onResetObjective: (slot: 1 | 2) => void,
): void {
  const presence = getCurrentPlayerPresence(room.state as unknown as Record<string, unknown>, room.sessionId);
  const children: HTMLElement[] = [];

  const slotSources: readonly [1 | 2, ObjectiveTrackerSource, boolean | undefined][] = [
    [1, presence?.objective ?? null, presence?.objectiveRewardGranted],
    [2, presence?.objective2 ?? null, presence?.objectiveRewardGranted2],
  ];
  const activeSlots = slotSources.filter(([, objective]) => objective !== null);

  if (activeSlots.length === 0) {
    children.push(createMutedText(t("objective.panel.empty" as never)));
  } else {
    for (const [slot, objective, objectiveRewardGranted] of activeSlots) {
      const viewModel = resolveObjectiveTrackerViewModel(objective, objectiveRewardGranted);
      if (viewModel !== null) {
        children.push(createObjectiveTrackerCard(viewModel, slot, onResetObjective));
      }
    }
  }

  const completedObjectives = presence?.completedObjectives ?? [];
  if (completedObjectives.length > 0) {
    const divider = document.createElement("div");
    divider.style.height = "1px";
    divider.style.background = "rgba(88, 68, 45, 0.6)";
    children.push(divider);

    const completedTitle = document.createElement("div");
    completedTitle.textContent = t("objective.panel.completed_section" as never);
    completedTitle.style.fontSize = "11px";
    completedTitle.style.fontWeight = "bold";
    completedTitle.style.color = "#d8c6a3";
    children.push(completedTitle);

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

      children.push(row);
    }
  }

  refs.body.replaceChildren(...children);
}

/** Core 0.4 HUD Overhaul -- the Micro Menu, re-anchored into a compact
 *  horizontal strip docked directly above the bottom action bar
 *  (WoW/Diablo style), replacing the old floating top-right icon bar.
 *  Character [C], Skills [K], Inventory [B] just toggle their
 *  standalone windows (see worldSessionEquipmentView.ts,
 *  worldSessionInventoryView.ts, worldSessionSkillTreeView.ts) exactly
 *  as before. Quests [L] now toggles the right-hand Quest Tracker
 *  dock's expanded/collapsed state instead of opening a flyout, since
 *  the tracker itself is a persistent dock (`createQuestTrackerPanel`),
 *  not a Micro Menu flyout, in this build. Settings/Loot
 *  Filter/Debug keep their own flyouts, which now open *upward* (see
 *  `toIconMenuItem`'s `direction` option) since this strip sits at the
 *  bottom of the screen. */
function buildMicroMenuDockItems(
  room: Room<DoomscrollsRoomState>,
  debugState: WorldSessionDebugState,
  getUtilityState: () => WorldSessionUtilityPanelOpenState,
  onUtilityStateChange: ((next: WorldSessionUtilityPanelOpenState) => void) | undefined,
  onProjectionModeChange: (mode: WorldProjectionMode) => void,
  onShowDebugOverlayChange: (show: boolean) => void,
  windowToggles: WorldSessionOverlayWindowToggles,
  onLeaveWorld: () => void,
  onReturnToTown: (() => void) | undefined,
): HTMLElement[] {
  const utilityState = getUtilityState();

  const characterSection = createMenuToggleButton("\u{1F9CD}", "Character [C]", windowToggles.isCharacterOpen(), windowToggles.onToggleCharacter);
  const skillsSection = createMenuToggleButton("⚔", "Skills [K]", windowToggles.isSkillTreeOpen(), windowToggles.onToggleSkillTree);
  const inventorySection = createMenuToggleButton("\u{1F392}", "Inventory [B]", windowToggles.isInventoryOpen(), windowToggles.onToggleInventory);
  const questsSection = createMenuToggleButton(
    "\u{1F4DC}",
    "Quests [L]",
    utilityState.questTrackerExpanded,
    () => {
      onUtilityStateChange?.({ ...getUtilityState(), questTrackerExpanded: !getUtilityState().questTrackerExpanded });
    },
  );

  const settingsSection = toIconMenuItem(
    createControlsSection(utilityState.controls, (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), controls: open });
    }, onLeaveWorld, onReturnToTown),
    { icon: "⚙", label: "Settings [Esc]", direction: "up" },
  );

  const lootFilterSection = toIconMenuItem(
    createLootFilterSection(utilityState.lootFilter, (open) => {
      onUtilityStateChange?.({ ...getUtilityState(), lootFilter: open });
    }),
    { icon: "\u{1F4E6}", label: "Loot Filter", direction: "up" },
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

  const items = [characterSection, skillsSection, inventorySection, questsSection, lootFilterSection, settingsSection];
  // Core 0.25 -- Debug Panel is a dev-only tool, not a menu item players
  // should ever see. Only wired into the toolbar in dev builds; in a
  // production build `debugSection` is built (harmless) but never
  // appended anywhere, so it's neither visible nor reachable.
  if (clientEnv.isDevBuild) {
    items.push(toIconMenuItem(debugSection, { icon: "\u{1F41E}", label: "Debug Panel", direction: "up" }));
  }

  return items;
}

/** A Micro Menu icon with no flyout of its own -- it just toggles a
 *  standalone window (Character/Skills/Inventory) owned by
 *  WorldSessionScene, highlighting its border while that window is
 *  open so there's one clear state shown two ways (this icon, and the
 *  window's own title bar). */
function createMenuToggleButton(icon: string, label: string, isOpen: boolean, onToggle: (() => void) | undefined): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = icon;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.width = "40px";
  button.style.height = "40px";
  button.style.margin = "0";
  button.style.padding = "0";
  button.style.fontSize = "18px";
  button.style.lineHeight = "1";
  button.style.border = isOpen ? "1px solid #e0c88a" : "1px solid #4d3f2a";
  button.style.borderRadius = "50%";
  button.style.background = "rgba(10, 8, 7, 0.86)";
  button.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.35)";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 auto";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggle?.();
  });
  makeInteractiveAndStopWorldInput(button);
  return button;
}

function createControlsSection(
  isOpen: boolean,
  onOpenChange: (open: boolean) => void,
  onLeaveWorld: () => void,
  onReturnToTown: (() => void) | undefined,
): HTMLElement {
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
    { key: "Z (enemy)", action: t("skill.heavy_strike.name") },
    { key: "RMB (enemy)", action: t("skill.grave_spark.name") },
    { key: "E (enemy)", action: t("skill.bone_splinter.name") },
    { key: "Click (loot)", action: "Pickup" },
    { key: "Click (object)", action: "Interact" },
    { key: "Space", action: t("world_session.control_dodge") },
    { key: "1-4", action: t("world_session.control_flask") },
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

  // Core 0.4 HUD Overhaul -- these buttons used to live on the
  // top-left character chip; they moved here so the Player Unit Frame
  // reads as a real ARPG unit frame instead of a text card with
  // buttons on it.
  const worldActions = document.createElement("div");
  worldActions.style.display = "flex";
  worldActions.style.gap = "6px";
  worldActions.style.padding = "0 8px 8px";

  if (onReturnToTown !== undefined) {
    const returnButton = createButton("Return to Town");
    returnButton.style.width = "auto";
    returnButton.style.flex = "0 0 auto";
    returnButton.style.padding = "4px 8px";
    returnButton.style.fontSize = "10px";
    returnButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onReturnToTown();
    });
    makeInteractive(returnButton);
    worldActions.appendChild(returnButton);
  }

  const leaveButton = createButton(t("world_entry.leave_world"));
  leaveButton.style.width = "auto";
  leaveButton.style.flex = "0 0 auto";
  leaveButton.style.padding = "4px 8px";
  leaveButton.style.fontSize = "10px";
  leaveButton.addEventListener("click", (event) => {
    event.stopPropagation();
    onLeaveWorld();
  });
  makeInteractive(leaveButton);
  worldActions.appendChild(leaveButton);

  details.appendChild(worldActions);
  return details;
}

/** Milestone 0.3 -- Client Loot Filter settings flyout: one checkbox per
 *  rarity tier plus a reminder of the Alt-hold reveal-all keybind. Writes
 *  straight through to `worldSessionLootFilterState.ts`, which the ground
 *  loot renderer (`worldSessionLootPlaceholderView.ts`) subscribes to
 *  directly -- no state needs to flow back through this view. */
function createLootFilterSection(isOpen: boolean, onOpenChange: (open: boolean) => void): HTMLElement {
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
  summary.textContent = "Loot Filter";
  summary.style.cursor = "pointer";
  summary.style.listStyle = "none";
  summary.style.padding = "8px";
  summary.style.fontSize = "12px";
  summary.style.color = "#d8c6a3";
  summary.style.fontWeight = "bold";
  makeInteractive(summary);
  details.appendChild(summary);

  const content = document.createElement("div");
  content.style.display = "grid";
  content.style.gap = "6px";
  content.style.padding = "0 8px 8px";

  const toggles: readonly { readonly key: keyof LootFilterRules; readonly label: string; readonly color: string }[] = [
    { key: "showNormal", label: "Normal (White)", color: "#e8e6e0" },
    { key: "showMagic", label: "Magic (Blue)", color: "#4a90ff" },
    { key: "showRare", label: "Rare (Yellow)", color: "#ffd23f" },
    { key: "showLegendary", label: "Legendary (Orange)", color: "#ff8c3d" },
  ];

  for (const toggle of toggles) {
    const row = document.createElement("label");
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.gap = "6px";
    row.style.fontSize = "12px";
    row.style.color = toggle.color;
    row.style.cursor = "pointer";
    makeInteractive(row);

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = getLootFilterRules()[toggle.key];
    checkbox.addEventListener("change", () => {
      setLootFilterRules({ ...getLootFilterRules(), [toggle.key]: checkbox.checked });
    });
    makeInteractive(checkbox);

    const labelText = document.createElement("span");
    labelText.textContent = toggle.label;

    row.append(checkbox, labelText);
    content.appendChild(row);
  }

  const hint = createMutedText("Hold Alt to temporarily reveal hidden ground loot.");
  hint.style.marginTop = "2px";
  content.appendChild(hint);

  details.appendChild(content);
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
 * built by `createControlsSection`/`createLootFilterSection`/etc., each a
 * `<details>` with a `<summary>` first child) into a single icon-button
 * toolbar item: the `<summary>` becomes a round icon glyph, and every
 * other child is moved into one absolutely-positioned flyout panel.
 * This only restyles/regroups the DOM the section functions already
 * build -- their open/close state wiring (`isOpen`, `onOpenChange`,
 * the native `toggle` event) is untouched.
 *
 * Core 0.4 HUD Overhaul -- `direction` picks which way the flyout
 * opens off the icon: "down" (the default, unchanged) for the old
 * top-right placement, "up" for the Micro Menu's new bottom-dock
 * placement so a flyout never opens off the bottom of the screen. */
function toIconMenuItem(
  details: HTMLElement,
  options: { readonly icon: string; readonly label: string; readonly direction?: "down" | "up" },
): HTMLElement {
  const summary = details.firstElementChild;
  const flyoutChildren = Array.from(details.children).filter((child) => child !== summary);
  const flyout = document.createElement("div");
  flyout.style.position = "absolute";
  if (options.direction === "up") {
    flyout.style.bottom = "calc(100% + 8px)";
  } else {
    flyout.style.top = "calc(100% + 8px)";
  }
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

export function createSectionBlock(titleText: string, children: readonly HTMLElement[], options?: { readonly compact?: boolean }): HTMLElement {
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
  flaskBelt: readonly FlaskBeltSlotEntry[] | undefined,
  xp: number | undefined,
  nextSkillSlotAt: number | undefined,
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
  windowToggles: WorldSessionOverlayWindowToggles,
  microMenuDockItems: readonly HTMLElement[],
): HTMLElement {
  // Core 0.4 HUD Overhaul -- the Micro Menu now docks directly above
  // the action bar (WoW/Diablo style) instead of floating in the
  // top-right corner; the old objective-tracker cards that used to
  // float here moved into the persistent right-hand Quest Tracker
  // dock (`createQuestTrackerPanel`), so this section is just the
  // dock strip + action bar + targeting hint + XP chip.
  const wrapper = document.createElement("section");
  wrapper.style.display = "grid";
  wrapper.style.gap = "6px";
  wrapper.style.justifyItems = "center";

  const dockRow = document.createElement("div");
  dockRow.style.display = "flex";
  dockRow.style.flexDirection = "row";
  dockRow.style.gap = "8px";
  dockRow.style.justifyContent = "center";
  dockRow.append(...microMenuDockItems);
  // Icons opt back into pointer events individually (see
  // `createMenuToggleButton`/`toIconMenuItem`); the empty gaps in this
  // row must stay passive so clicks fall through to the world.
  makePassive(dockRow);
  wrapper.appendChild(dockRow);

  wrapper.appendChild(createActionBar(flaskBelt, nextSkillSlotAt, windowToggles));

  const targetingHint = createTargetingHintLine(skillTargeting, lastSkillRejectedReason);
  if (targetingHint !== null) {
    wrapper.appendChild(targetingHint);
  }

  wrapper.appendChild(createMiniHudStat(t("character.xp"), String(xp ?? 0)));

  return wrapper;
}

/** Compact single line describing the current skill-target hover/selection
 *  and the range check, shown under the action bar only when there's
 *  something to say (mirrors what the old green skill card printed
 *  below its cooldown text). */
function createTargetingHintLine(
  skillTargeting: WorldSessionSkillTargetingState,
  lastSkillRejectedReason: string | null,
): HTMLElement | null {
  if (skillTargeting.targetEnemyLabel === null && lastSkillRejectedReason === null) {
    return null;
  }

  const line = document.createElement("div");
  line.style.fontSize = "10px";
  line.style.fontFamily = "monospace";
  line.style.textAlign = "center";
  line.style.maxWidth = "min(420px, calc(100vw - 32px))";

  const targetPrefix = skillTargeting.hoveredEnemyId !== null
    ? t("world_session.skill_target_hover")
    : skillTargeting.selectedEnemyId !== null
      ? t("world_session.skill_target_selected")
      : t("world_session.skill_target_none");

  if (skillTargeting.targetEnemyLabel === null) {
    line.textContent = `${targetPrefix} • ${t("world_session.skill_target_none")}`;
    line.style.color = "#a88d63";
  } else {
    const roundedDistance = skillTargeting.targetDistance === null
      ? null
      : Math.round(skillTargeting.targetDistance);
    const rangeText = roundedDistance === null
      ? t("world_session.skill_range_unknown")
      : skillTargeting.isTargetInRange === true
        ? t("world_session.skill_target_in_range", { distance: roundedDistance })
        : t("world_session.skill_target_out_of_range", { distance: roundedDistance, range: 96 });
    line.textContent = `${targetPrefix} • ${skillTargeting.targetEnemyLabel} • ${rangeText}`;
    line.style.color = skillTargeting.isTargetInRange === false ? "#d9936b" : "#b9d49a";
  }

  if (lastSkillRejectedReason === "out_of_range") {
    const hint = document.createElement("div");
    hint.textContent = t("world_session.skill_target_move_to_cast");
    hint.style.color = "#e0c88a";
    hint.style.fontWeight = "bold";
    line.appendChild(hint);
  }

  return line;
}

const HUD_BELT_SLOT_SIZE_PX = 52;

/** Core 0.1 UI Overhaul Phase 1 -- the bottom action bar: the 4-slot
 *  flask belt (hotkeys 1-4), plus W, E (Bone Splinter), R, LMB (basic
 *  attack) and RMB (Grave Spark) hotkey slots, and a bag toggle,
 *  centered between the fixed HP/mana globes (worldSessionHudView.ts).
 *  Only slots with a real, server-wired binding show a live
 *  glyph/cooldown -- the flask belt, E (Bone Splinter), LMB (basic
 *  attack) and RMB (Grave Spark, the only skill slot with a tracked
 *  cooldown via `nextSkillSlotAt`). W/R have no binding yet and render
 *  as empty slots rather than faking one. */
function createActionBar(
  flaskBelt: readonly FlaskBeltSlotEntry[] | undefined,
  nextSkillSlotAt: number | undefined,
  windowToggles: WorldSessionOverlayWindowToggles,
): HTMLElement {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "flex-end";
  row.style.justifyContent = "center";
  row.style.gap = "10px";
  row.style.flexWrap = "wrap";

  const slots = document.createElement("div");
  slots.style.display = "flex";
  slots.style.gap = "6px";
  slots.style.alignItems = "flex-end";

  const FLASK_BELT_SLOT_NUMBERS = [1, 2, 3, 4] as const;
  for (const slotNumber of FLASK_BELT_SLOT_NUMBERS) {
    slots.appendChild(createFlaskBeltVialSlot(slotNumber, flaskBelt?.[slotNumber - 1]));
  }
  slots.appendChild(createEmptyActionSlot("W"));
  slots.appendChild(createSkillActionSlot("E", "✦", t("skill.bone_splinter.name"), t("skill.bone_splinter.description"), null));
  slots.appendChild(createEmptyActionSlot("R"));
  slots.appendChild(createSkillActionSlot("LMB", "⚔", t("world_session.control_attack"), t("world_session.control_attack"), null));
  slots.appendChild(createSkillActionSlot("RMB", "✧", t("skill.grave_spark.name"), t("skill.grave_spark.description"), formatSkillCooldownSeconds(nextSkillSlotAt)));

  row.appendChild(slots);
  row.appendChild(createBagToggleButton(windowToggles.isInventoryOpen(), windowToggles.onToggleInventory));

  // Core 0.4x -- same idiom as the old belt row: the strip is read-only
  // display except the bag button, which opts itself back in. Without
  // `makePassive` here, the row's default pointer-events would silently
  // eat click-to-move/held-movement input crossing the bottom HUD.
  makePassive(row);

  return row;
}

/** Compact hotkey tile for a real, wired skill/action -- shows the key
 *  badge, a glyph, and (when `remainingSeconds` is non-null) a dimmed
 *  cooldown overlay with a countdown, all summarized in the tile's
 *  hover tooltip. */
function createSkillActionSlot(
  keyLabel: string,
  glyph: string,
  name: string,
  description: string,
  remainingSeconds: string | null,
): HTMLElement {
  const isReady = remainingSeconds === null;
  const slot = createBeltSlotShell(
    isReady ? "#6aa25e" : "#6b5738",
    "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)",
  );

  const keyBadge = document.createElement("div");
  keyBadge.textContent = keyLabel;
  keyBadge.style.position = "absolute";
  keyBadge.style.top = "2px";
  keyBadge.style.left = "3px";
  keyBadge.style.fontSize = "8px";
  keyBadge.style.fontWeight = "bold";
  keyBadge.style.fontFamily = "monospace";
  keyBadge.style.color = "#e0c88a";
  slot.appendChild(keyBadge);

  const iconGlyph = document.createElement("div");
  iconGlyph.textContent = glyph;
  iconGlyph.style.fontSize = "18px";
  iconGlyph.style.color = isReady ? "#e0c88a" : "#7a6a4a";
  slot.appendChild(iconGlyph);

  if (!isReady) {
    const sweep = document.createElement("div");
    sweep.style.position = "absolute";
    sweep.style.inset = "0";
    sweep.style.borderRadius = "6px";
    sweep.style.background = "rgba(6, 5, 4, 0.68)";
    slot.appendChild(sweep);

    const cooldownLabel = document.createElement("div");
    cooldownLabel.textContent = `${remainingSeconds}s`;
    cooldownLabel.style.position = "absolute";
    cooldownLabel.style.bottom = "2px";
    cooldownLabel.style.fontSize = "9px";
    cooldownLabel.style.fontWeight = "bold";
    cooldownLabel.style.color = "#d8a86a";
    cooldownLabel.style.fontFamily = "monospace";
    slot.appendChild(cooldownLabel);
  }

  slot.title = isReady
    ? `${name} [${keyLabel}] — ${description} — ${t("world_session.skill_slot_ready_now")}`
    : `${name} [${keyLabel}] — ${description} — ${remainingSeconds}s`;

  return slot;
}

/** Unbound action-bar slot -- rendered clean and inert (not a fake
 *  cooldown) rather than claiming a binding that doesn't exist. */
function createEmptyActionSlot(keyLabel: string): HTMLElement {
  const slot = createBeltSlotShell("#4a4a4a", "rgba(18, 14, 10, 0.55)");
  slot.style.opacity = "0.45";

  const keyBadge = document.createElement("div");
  keyBadge.textContent = keyLabel;
  keyBadge.style.position = "absolute";
  keyBadge.style.top = "2px";
  keyBadge.style.left = "3px";
  keyBadge.style.fontSize = "8px";
  keyBadge.style.fontWeight = "bold";
  keyBadge.style.fontFamily = "monospace";
  keyBadge.style.color = "#8a8a8a";
  slot.appendChild(keyBadge);

  slot.title = `[${keyLabel}] — ${t("world_session.belt_slot_soon_hint")}`;
  return slot;
}

/** Bag icon toggle next to the action bar (Core 0.1 UI Overhaul Phase 1)
 *  -- opens/closes the same inventory flyout the top-right micro menu's
 *  Inventory item controls, so there are two ways in, one state. */
function createBagToggleButton(isOpen: boolean, onToggle: () => void): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "\u{1F392}";
  button.title = `${t("equipment.title" as never)} — Inventory [B]`;
  button.style.width = `${HUD_BELT_SLOT_SIZE_PX}px`;
  button.style.height = `${HUD_BELT_SLOT_SIZE_PX}px`;
  button.style.border = isOpen ? "2px solid #e0c88a" : "1px solid #6b5738";
  button.style.borderRadius = "8px";
  button.style.background = "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)";
  button.style.fontSize = "20px";
  button.style.cursor = "pointer";
  button.style.flex = "0 0 auto";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onToggle();
  });
  makeInteractiveAndStopWorldInput(button);
  return button;
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

/**
 * Milestone 0.3 -- 4-Slot Flask Belt vial. One of four action-bar
 * tiles, keyed to hotkeys 1-4. The vial's liquid is tinted by the
 * equipped flask's effect type (red = health, blue = mana, green =
 * stamina/utility); a vertical fill overlay + numeric "current/max"
 * text show the remaining charges, matching the requested "flask
 * belt" visual (dynamic liquid tint + charge fill + numeric label).
 * `maxCharges === 0` (no `entry`, or an entry with `maxCharges` 0)
 * means the slot has no flask equipped -- rendered empty/dimmed
 * rather than faking a binding.
 */
function createFlaskBeltVialSlot(slotNumber: 1 | 2 | 3 | 4, entry: FlaskBeltSlotEntry | undefined): HTMLElement {
  const slot = createBeltSlotShell(
    "#6b5738",
    "linear-gradient(180deg, rgba(42, 32, 22, 0.96) 0%, rgba(24, 18, 13, 0.96) 100%)",
  );

  const keyBadge = document.createElement("div");
  keyBadge.textContent = String(slotNumber);
  keyBadge.style.position = "absolute";
  keyBadge.style.top = "2px";
  keyBadge.style.left = "3px";
  keyBadge.style.fontSize = "8px";
  keyBadge.style.fontWeight = "bold";
  keyBadge.style.fontFamily = "monospace";
  keyBadge.style.color = "#e0c88a";
  slot.appendChild(keyBadge);

  if (entry === undefined) {
    const waiting = document.createElement("div");
    waiting.textContent = "…";
    waiting.style.color = "#7a5f4a";
    waiting.style.fontSize = "14px";
    slot.appendChild(waiting);
    slot.title = t("world_session.awaiting_flask");
    return slot;
  }

  if (entry.maxCharges <= 0) {
    slot.style.opacity = "0.45";
    const emptyGlyph = document.createElement("div");
    emptyGlyph.textContent = "⚗";
    emptyGlyph.style.fontSize = "16px";
    emptyGlyph.style.color = "#5a4a3a";
    slot.appendChild(emptyGlyph);
    slot.title = `[${slotNumber}] — ${t("world_area.flask_slot_empty")}`;
    return slot;
  }

  const liquidColor = resolveFlaskLiquidColor(entry.effectType);
  const fillRatio = entry.charges / entry.maxCharges;

  const vial = document.createElement("div");
  vial.style.position = "relative";
  vial.style.width = "20px";
  vial.style.height = "28px";
  vial.style.border = "1px solid #3a2a1a";
  vial.style.borderRadius = "3px 3px 6px 6px";
  vial.style.overflow = "hidden";
  vial.style.background = "rgba(8, 6, 4, 0.85)";
  slot.appendChild(vial);

  const fill = document.createElement("div");
  fill.style.position = "absolute";
  fill.style.left = "0";
  fill.style.right = "0";
  fill.style.bottom = "0";
  fill.style.height = `${Math.round(fillRatio * 100)}%`;
  fill.style.background = liquidColor;
  fill.style.transition = "height 120ms ease-out";
  vial.appendChild(fill);

  const chargeText = document.createElement("div");
  chargeText.textContent = `${entry.charges}/${entry.maxCharges}`;
  chargeText.style.marginTop = "2px";
  chargeText.style.fontSize = "8px";
  chargeText.style.fontFamily = "monospace";
  chargeText.style.fontWeight = "bold";
  chargeText.style.color = entry.charges > 0 ? "#e0c88a" : "#5a4530";
  slot.appendChild(chargeText);

  if (entry.charges <= 0 && entry.nextReadyAt > 0) {
    const sweep = document.createElement("div");
    sweep.style.position = "absolute";
    sweep.style.inset = "0";
    sweep.style.borderRadius = "6px";
    sweep.style.background = "rgba(6, 5, 4, 0.45)";
    slot.appendChild(sweep);
  }

  slot.title = `${t("world_session.flask_charges")}: ${entry.charges}/${entry.maxCharges} [${slotNumber}]`;
  return slot;
}

/** Red = health, blue = mana, green/yellow = stamina/utility -- matches the requested dynamic liquid tinting. */
function resolveFlaskLiquidColor(effectType: string): string {
  if (effectType === "restoreManaInstant") {
    return "linear-gradient(180deg, #5a9bd8 0%, #2f5c8a 100%)";
  }
  if (effectType === "restoreStaminaInstant") {
    return "linear-gradient(180deg, #c9d85a 0%, #7a8a2f 100%)";
  }
  return "linear-gradient(180deg, #e0824a 0%, #a5341a 100%)";
}

export function createDerivedStatsSection(character: CharacterSummary | null): HTMLElement {
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

export function createMutedText(text: string): HTMLElement {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  paragraph.style.margin = "0";
  paragraph.style.color = "#a88d63";
  paragraph.style.fontSize = "12px";
  return paragraph;
}