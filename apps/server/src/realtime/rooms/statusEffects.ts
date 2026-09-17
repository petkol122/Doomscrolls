/**
 * Core 0.2 -- Server-Authoritative Status Effects & Debuff System.
 *
 * A minimal status-effect engine shared by `PlayerPresence` and
 * `EnemyPresence`. Both schemas store their active effects as a single
 * flattened `statusEffects` string field ("type:expiresAtMs:magnitude"
 * entries joined by "|"), matching the codebase's existing convention for
 * server-owned array-ish state on a `Schema` (see `pathWaypoints` /
 * `completedObjectiveIds`) instead of introducing a nested `ArraySchema<Schema>`.
 *
 * The server is the sole authority: this module both mutates the string
 * field (apply / decay / DoT tick) and answers movement/cast queries
 * (stunned / slow multiplier) read directly off it. Clients only ever
 * read the synced string for a purely visual indicator.
 */

/**
 * Milestone 0.3 -- Street Alchemist Class Archetype. `"haste"` is the
 * first positive/buff effect type -- unlike every other type here, it's
 * applied to the *caster* (see `applySkillEffectIfDefined`'s self_buff
 * call site), and its `magnitude` is a fractional speed/attack-speed
 * increase (0.3 = +30%) rather than a debuff/DoT amount.
 */
export type StatusEffectType = "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste";

/** DoT effects (bleed/burn) deal `magnitude` damage once per this interval. */
export const STATUS_EFFECT_DOT_TICK_INTERVAL_MS = 1000;

interface ActiveStatusEffect {
  readonly type: StatusEffectType;
  readonly expiresAtMs: number;
  /** Damage per tick for bleed/burn; fractional slow amount (0..1) for slow; unused for stun. */
  readonly magnitude: number;
  readonly nextTickAtMs: number;
}

interface StatusEffectHost {
  statusEffects: string;
}

function isStatusEffectType(value: string): value is StatusEffectType {
  return (
    value === "bleed" ||
    value === "slow" ||
    value === "stun" ||
    value === "burn" ||
    value === "emp_dot" ||
    value === "haste"
  );
}

function parseStatusEffects(raw: string): ActiveStatusEffect[] {
  if (raw.length === 0) {
    return [];
  }

  const effects: ActiveStatusEffect[] = [];
  for (const entry of raw.split("|")) {
    const [type, expiresAtMsRaw, magnitudeRaw, nextTickAtMsRaw] = entry.split(":");
    const expiresAtMs = Number(expiresAtMsRaw);
    const magnitude = Number(magnitudeRaw);
    const nextTickAtMs = Number(nextTickAtMsRaw);
    if (
      type === undefined ||
      !isStatusEffectType(type) ||
      !Number.isFinite(expiresAtMs) ||
      !Number.isFinite(magnitude) ||
      !Number.isFinite(nextTickAtMs)
    ) {
      continue;
    }
    effects.push({ type, expiresAtMs, magnitude, nextTickAtMs });
  }
  return effects;
}

function serializeStatusEffects(effects: readonly ActiveStatusEffect[]): string {
  return effects
    .map((effect) => `${effect.type}:${effect.expiresAtMs}:${effect.magnitude}:${effect.nextTickAtMs}`)
    .join("|");
}

/**
 * Applies (or refreshes) a status effect on `host`. Refreshing replaces any
 * existing effect of the same type rather than stacking it -- a fresh cast
 * simply extends/resets the duration, matching the class of effect this
 * system models (a single active bleed/slow/stun/burn per type).
 */
export function applyStatusEffect(
  host: StatusEffectHost,
  type: StatusEffectType,
  now: number,
  durationMs: number,
  magnitude: number,
): void {
  const effects = parseStatusEffects(host.statusEffects).filter((effect) => effect.type !== type);
  effects.push({
    type,
    expiresAtMs: now + Math.max(0, durationMs),
    magnitude,
    nextTickAtMs: now + STATUS_EFFECT_DOT_TICK_INTERVAL_MS,
  });
  host.statusEffects = serializeStatusEffects(effects);
}

/** Read-only check: is `host` currently stunned (movement/casts blocked)? */
export function isStunned(host: Pick<StatusEffectHost, "statusEffects">, now: number): boolean {
  return parseStatusEffects(host.statusEffects).some(
    (effect) => effect.type === "stun" && effect.expiresAtMs > now,
  );
}

/**
 * Read-only movement-speed multiplier from active "slow" effects
 * (0.1..1). Multiple concurrent slows stack multiplicatively, floored at
 * 10% of base speed so a slowed entity can never be fully immobilized by
 * slow alone (that's what "stun" is for).
 */
export function getSlowMultiplier(host: Pick<StatusEffectHost, "statusEffects">, now: number): number {
  const multiplier = parseStatusEffects(host.statusEffects)
    .filter((effect) => effect.type === "slow" && effect.expiresAtMs > now)
    .reduce((acc, effect) => acc * Math.max(0, 1 - effect.magnitude), 1);
  return Math.max(0.1, multiplier);
}

/**
 * Milestone 0.3 -- Street Alchemist Class Archetype. Read-only movement/
 * attack-speed multiplier from an active "haste" effect (e.g.
 * `adrenaline_stim`, magnitude 0.3 = +30%). Multiple concurrent hastes
 * stack multiplicatively, mirroring `getSlowMultiplier`'s convention.
 */
export function getHasteMultiplier(host: Pick<StatusEffectHost, "statusEffects">, now: number): number {
  return parseStatusEffects(host.statusEffects)
    .filter((effect) => effect.type === "haste" && effect.expiresAtMs > now)
    .reduce((acc, effect) => acc * (1 + Math.max(0, effect.magnitude)), 1);
}

/**
 * Advances `host`'s active effects by one tick: prunes anything expired
 * and fires any bleed/burn tick(s) that have come due, returning the
 * total DoT damage owed this call (0 if none). Must be called once per
 * room simulation tick per entity so a long tick gap doesn't lose ticks
 * that came due while the entity wasn't checked (a due tick keeps firing
 * every call until caught up, then reschedules from `now`).
 */
export function tickStatusEffectDamage(host: StatusEffectHost, now: number): number {
  const effects = parseStatusEffects(host.statusEffects);
  if (effects.length === 0) {
    return 0;
  }

  let totalDamage = 0;
  const remaining: ActiveStatusEffect[] = [];
  for (const effect of effects) {
    if (effect.expiresAtMs <= now) {
      continue;
    }

    if (effect.type === "bleed" || effect.type === "burn" || effect.type === "emp_dot") {
      let nextTickAtMs = effect.nextTickAtMs;
      while (nextTickAtMs <= now) {
        totalDamage += effect.magnitude;
        nextTickAtMs += STATUS_EFFECT_DOT_TICK_INTERVAL_MS;
      }
      remaining.push({ ...effect, nextTickAtMs });
    } else {
      remaining.push(effect);
    }
  }

  host.statusEffects = serializeStatusEffects(remaining);
  return Math.max(0, Math.floor(totalDamage));
}
