import { contentRegistry, type WorldPropContentDefinition } from "@doomscrolls/content";
import { en } from "@doomscrolls/localization";
import type { ZoneId } from "@doomscrolls/shared";

import { Interactable } from "./Interactable";
import type { CombatRoomState } from "./CombatRoomState";

const COMBAT_INTERACTABLE_PROP_KINDS = new Set(["combat_return_gate"]);

export function initializeCombatInteractables(
  state: CombatRoomState,
  zoneId: ZoneId,
): void {
  for (const prop of contentRegistry.worldProps.all) {
    if (prop.zoneId !== zoneId) {
      continue;
    }
    if (!COMBAT_INTERACTABLE_PROP_KINDS.has(prop.kind)) {
      continue;
    }

    const interactable = new Interactable(
      prop.id,
      prop.kind,
      resolvePropLabel(prop),
      prop.x,
      prop.y,
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