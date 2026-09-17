/** Milestone 0.3 -- Client-Side Loot Filter.
 *
 * Tiny, self-contained module owning the loot filter's rule state (which
 * rarity tiers to render on the ground), its localStorage persistence, and
 * the Alt-hold "reveal everything" override. Kept independent of
 * `worldSessionAreaView.ts`/`worldSessionOverlayView.ts` so both the ground
 * loot renderer and the settings UI can read/write it without threading a
 * new prop through the large per-frame render pipeline.
 */

export interface LootFilterRules {
  readonly showNormal: boolean;
  readonly showMagic: boolean;
  readonly showRare: boolean;
  readonly showLegendary: boolean;
}

const DEFAULT_LOOT_FILTER_RULES: LootFilterRules = {
  showNormal: true,
  showMagic: true,
  showRare: true,
  showLegendary: true,
};

const STORAGE_KEY = "doomscrolls.worldSession.lootFilter.v1";

function loadRules(): LootFilterRules {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_LOOT_FILTER_RULES;
    }
    const parsed = JSON.parse(raw) as Partial<LootFilterRules>;
    return {
      showNormal: parsed.showNormal !== false,
      showMagic: parsed.showMagic !== false,
      showRare: parsed.showRare !== false,
      showLegendary: parsed.showLegendary !== false,
    };
  } catch {
    return DEFAULT_LOOT_FILTER_RULES;
  }
}

let currentRules: LootFilterRules = loadRules();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getLootFilterRules(): LootFilterRules {
  return currentRules;
}

export function setLootFilterRules(next: LootFilterRules): void {
  currentRules = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private browsing / disabled storage -- filter still works in-memory
    // for the rest of the session.
  }
  notifyListeners();
}

/** Subscribes to both rule changes and Alt-hold override changes (anything
 *  that should cause ground loot to re-evaluate its visibility). Returns
 *  an unsubscribe function. */
export function subscribeLootFilterState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function ruleKeyForRarity(rarity: string | undefined): keyof LootFilterRules | null {
  if (rarity === undefined || rarity.length === 0 || rarity === "common" || rarity === "normal") {
    return "showNormal";
  }
  if (rarity === "magic") {
    return "showMagic";
  }
  if (rarity === "rare") {
    return "showRare";
  }
  if (rarity === "legendary") {
    return "showLegendary";
  }
  // "epic" (the content package's fixed-rarity vocabulary) has no filter
  // toggle of its own -- always shown, same as currency drops.
  return null;
}

export function isLootRarityVisible(rarity: string | undefined): boolean {
  const ruleKey = ruleKeyForRarity(rarity);
  if (ruleKey === null) {
    return true;
  }
  return currentRules[ruleKey];
}

let altHeld = false;
let altListenerAttached = false;

export function isLootFilterOverrideActive(): boolean {
  return altHeld;
}

function setAltHeld(next: boolean): void {
  if (altHeld === next) {
    return;
  }
  altHeld = next;
  notifyListeners();
}

/** Idempotent -- safe to call from every loot placeholder view's
 *  constructor without double-attaching window listeners. */
export function ensureLootFilterAltListenerAttached(): void {
  if (altListenerAttached) {
    return;
  }
  altListenerAttached = true;
  window.addEventListener("keydown", (event) => {
    if (event.key === "Alt") {
      setAltHeld(true);
    }
  });
  window.addEventListener("keyup", (event) => {
    if (event.key === "Alt") {
      setAltHeld(false);
    }
  });
  // Alt-tabbing away while held would otherwise leave the override stuck on.
  window.addEventListener("blur", () => {
    setAltHeld(false);
  });
}
