import type { MapSchema } from "@colyseus/schema";
import { GroundEffectPresence, type EnemyPresence } from "@doomscrolls/shared";
import { applyEnemyDamage, type ApplyEnemyDamageResult } from "./applyEnemyDamage";
import { applySkillEffectIfDefined } from "./skillSlotContent";

/**
 * Milestone 0.2 -- Server-Authoritative Projectiles & Ground-Targeted AoE
 * Skills. Same structural-state convention as `projectileSimulation.ts`.
 */
export interface GroundAoeSimulationState {
  readonly enemies: MapSchema<EnemyPresence>;
  readonly groundEffects: MapSchema<GroundEffectPresence>;
}

let nextGroundEffectSequence = 0;
const GROUND_EFFECT_VISUAL_DURATION_MS = 400;

export interface ResolveGroundAoeCastParams {
  readonly skillId: string;
  readonly ownerSessionId: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly damage: number;
  readonly appliesEffect?: "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste" | undefined;
  readonly effectDurationMs?: number | undefined;
  readonly effectMagnitude?: number | undefined;
  /** Milestone 0.3 -- Street Alchemist's aerosol_flash second effect (Slow, alongside Burn). */
  readonly appliesSecondaryEffect?: "bleed" | "slow" | "stun" | "burn" | "emp_dot" | "haste" | undefined;
  readonly secondaryEffectDurationMs?: number | undefined;
  readonly secondaryEffectMagnitude?: number | undefined;
  readonly now: number;
}

export interface GroundAoeHit {
  readonly enemy: EnemyPresence;
  readonly damageResult: ApplyEnemyDamageResult;
}

/**
 * Resolves a ground-targeted AoE cast instantly: every non-defeated enemy
 * within `radius` of `(x, y)` takes `damage` and (if defined) the skill's
 * status effect, and a purely-visual `GroundEffectPresence` marker is
 * spawned for clients to render a fading circle.
 */
export function resolveGroundAoeCast(
  state: GroundAoeSimulationState,
  params: ResolveGroundAoeCastParams,
): { readonly hits: readonly GroundAoeHit[] } {
  const hits: GroundAoeHit[] = [];

  state.enemies.forEach((enemy) => {
    if (enemy.defeated || enemy.hp <= 0) {
      return;
    }
    if (Math.hypot(enemy.x - params.x, enemy.y - params.y) > params.radius) {
      return;
    }

    const damageResult = applyEnemyDamage(enemy, params.damage);
    if (!damageResult.defeated && (params.appliesEffect !== undefined || params.appliesSecondaryEffect !== undefined)) {
      applySkillEffectIfDefined(enemy, {
        ...(params.appliesEffect !== undefined
          ? {
              appliesEffect: params.appliesEffect,
              effectDurationMs: params.effectDurationMs ?? 0,
              effectMagnitude: params.effectMagnitude ?? 0,
            }
          : {}),
        ...(params.appliesSecondaryEffect !== undefined
          ? {
              appliesSecondaryEffect: params.appliesSecondaryEffect,
              secondaryEffectDurationMs: params.secondaryEffectDurationMs ?? 0,
              secondaryEffectMagnitude: params.secondaryEffectMagnitude ?? 0,
            }
          : {}),
      }, params.now);
    }
    hits.push({ enemy, damageResult });
  });

  const marker = new GroundEffectPresence();
  marker.id = `ground_effect:${params.ownerSessionId}:${params.now}:${nextGroundEffectSequence++}`;
  marker.skillId = params.skillId;
  marker.ownerSessionId = params.ownerSessionId;
  marker.x = params.x;
  marker.y = params.y;
  marker.radius = params.radius;
  marker.spawnedAtMs = params.now;
  marker.expiresAtMs = params.now + GROUND_EFFECT_VISUAL_DURATION_MS;
  state.groundEffects.set(marker.id, marker);

  return { hits };
}

export function cleanupExpiredGroundEffects(state: GroundAoeSimulationState, now: number): void {
  const toRemove: string[] = [];
  state.groundEffects.forEach((effect) => {
    if (effect.expiresAtMs <= now) {
      toRemove.push(effect.id);
    }
  });
  for (const id of toRemove) {
    state.groundEffects.delete(id);
  }
}
