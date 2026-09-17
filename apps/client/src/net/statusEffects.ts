/**
 * Core 0.2 -- Server-Authoritative Status Effects & Debuff System.
 *
 * Client-side counterpart of `apps/server/src/realtime/rooms/statusEffects.ts`.
 * The server syncs each player/enemy's active effects as a single flattened
 * `statusEffects` string ("type:expiresAtMs:magnitude:nextTickAtMs" entries
 * joined by "|"); this module only ever reads it for a purely visual
 * indicator -- the server remains the sole authority for what's actually
 * active.
 */

export type StatusEffectType = "bleed" | "slow" | "stun" | "burn" | "emp_dot";

function isStatusEffectType(value: string): value is StatusEffectType {
  return value === "bleed" || value === "slow" || value === "stun" || value === "burn" || value === "emp_dot";
}

/**
 * Parses the raw synced `statusEffects` string into the distinct effect
 * types currently active (not yet expired per `now`), in a stable order.
 * Used purely for display -- expiry is judged against the local clock,
 * so this can read very slightly stale near the exact expiry moment.
 */
export function parseActiveStatusEffectTypes(
  raw: string | undefined,
  now: number,
): readonly StatusEffectType[] {
  if (typeof raw !== "string" || raw.length === 0) {
    return [];
  }

  const active = new Set<StatusEffectType>();
  for (const entry of raw.split("|")) {
    const [type, expiresAtMsRaw] = entry.split(":");
    const expiresAtMs = Number(expiresAtMsRaw);
    if (type === undefined || !isStatusEffectType(type) || !Number.isFinite(expiresAtMs)) {
      continue;
    }
    if (expiresAtMs > now) {
      active.add(type);
    }
  }
  return Array.from(active);
}
