import { Interactable } from "./Interactable";
import type { TownRoomState } from "./TownRoomState";
import type { ZoneId } from "@doomscrolls/shared";
import { contentRegistry, type WorldPropContentDefinition } from "@doomscrolls/content";
import type { WorldPropKind } from "@doomscrolls/content";
import { en } from "@doomscrolls/localization";

/**
 * Task 057 — Interactable Object Foundation Batch (initial)
 * Task 290 — Data-driven zone-based interactable setup.
 *
 * Filter the content registry's worldProps by zoneId and interactable-relevant
 * kind values. This replaces the earlier hardcoded `zoneId === "nightmarket"`
 * branch so that any zone with matching world prop definitions automatically
 * gets its interactables populated.
 *
 * Cathedral hub build — `cathedral_vendor` (a "vendor" prop) and the
 * `cathedral_entrance`/`cathedral_exit` doors (a "zone_transition" prop)
 * all flow through this same data-driven lookup once registered in
 * `worldProps.ts`; no per-zone or per-id branching is added here.
 */
const INTERACTABLE_PROP_KINDS: ReadonlySet<WorldPropKind> = new Set<WorldPropKind>([
  "town_service",
  "vendor",
  "waypoint",
  "loot_container",
  "combat_edge",
  "zone_transition",
  "quest_giver",
]);

export function initializeTownInteractables(
  state: TownRoomState,
  zoneId: ZoneId,
): void {
  for (const prop of contentRegistry.worldProps.all) {
    if (prop.zoneId !== zoneId) {
      continue;
    }
    if (!INTERACTABLE_PROP_KINDS.has(prop.kind)) {
      continue;
    }

    const isLootContainer = prop.kind === "loot_container";
    const interactable = new Interactable(
      prop.id,
      prop.kind,
      resolvePropLabel(prop),
      prop.x,
      prop.y,
      isLootContainer ? false : undefined,
    );
    state.interactables.set(interactable.id, interactable);
  }
}

function resolvePropLabel(prop: WorldPropContentDefinition): string {
  if (prop.labelKey !== undefined && en[prop.labelKey] !== undefined) {
    return en[prop.labelKey];
  }
  return prop.label;
}
