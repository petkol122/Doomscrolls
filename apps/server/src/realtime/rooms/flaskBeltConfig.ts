import { buildFlaskChargesJson, type FlaskBeltPersistedCharges, type FlaskBeltSlotNumber } from "@doomscrolls/shared";
import type { PlayerPresence } from "./PlayerPresence";

// ---------------------------------------------------------------------------
// Milestone 0.3 -- 4-Slot Flask Belt.
//
// Server-owned accessors for the four flask belt slots on a
// PlayerPresence. All 4 slots are packed into the single
// `PlayerPresence.flaskBelt` string (Colyseus schema instances cap out
// at 64 `@type` fields, and this class was already at 63 before this
// feature -- one flat field per slot property, as the
// primary/secondary/tertiary skill-cooldown fields do, would need
// ~20 fields and blow the cap). One "effectType,effectValue,charges,
// maxCharges,nextReadyAt" segment per slot, joined by "|" -- the same
// idiom `PlayerPresence.statusEffects` already uses for a
// variable-length collection of per-entry fields.
//
// Each slot is derived from whatever flask item is equipped in
// `flask_1`..`flask_4` (see `syncFlaskBeltSlotFromEquippedItem`). An
// empty slot has `effectType === ""` and `maxCharges === 0`, so it can
// never be activated.
// ---------------------------------------------------------------------------

export const FLASK_SLOT_COOLDOWN_MS = 1500;

interface FlaskBeltSlotState {
  effectType: string;
  effectValue: number;
  charges: number;
  maxCharges: number;
  nextReadyAt: number;
}

const EMPTY_SLOT: FlaskBeltSlotState = { effectType: "", effectValue: 0, charges: 0, maxCharges: 0, nextReadyAt: 0 };
const EMPTY_SLOT_SEGMENT = serializeSlot(EMPTY_SLOT);
export const EMPTY_FLASK_BELT = [EMPTY_SLOT_SEGMENT, EMPTY_SLOT_SEGMENT, EMPTY_SLOT_SEGMENT, EMPTY_SLOT_SEGMENT].join("|");

function serializeSlot(slot: FlaskBeltSlotState): string {
  return [slot.effectType, slot.effectValue, slot.charges, slot.maxCharges, slot.nextReadyAt].join(",");
}

function parseSlot(segment: string | undefined): FlaskBeltSlotState {
  if (segment === undefined) {
    return { ...EMPTY_SLOT };
  }
  const parts = segment.split(",");
  const effectType = parts[0] ?? "";
  const effectValue = Number(parts[1]);
  const charges = Number(parts[2]);
  const maxCharges = Number(parts[3]);
  const nextReadyAt = Number(parts[4]);
  return {
    effectType,
    effectValue: Number.isFinite(effectValue) ? effectValue : 0,
    charges: Number.isFinite(charges) ? charges : 0,
    maxCharges: Number.isFinite(maxCharges) ? maxCharges : 0,
    nextReadyAt: Number.isFinite(nextReadyAt) ? nextReadyAt : 0,
  };
}

function readBelt(player: PlayerPresence): [FlaskBeltSlotState, FlaskBeltSlotState, FlaskBeltSlotState, FlaskBeltSlotState] {
  const segments = (player.flaskBelt ?? EMPTY_FLASK_BELT).split("|");
  return [parseSlot(segments[0]), parseSlot(segments[1]), parseSlot(segments[2]), parseSlot(segments[3])];
}

function writeBelt(player: PlayerPresence, slots: readonly FlaskBeltSlotState[]): void {
  player.flaskBelt = slots.map(serializeSlot).join("|");
}

function readSlot(player: PlayerPresence, slot: FlaskBeltSlotNumber): FlaskBeltSlotState {
  const [slot1, slot2, slot3, slot4] = readBelt(player);
  switch (slot) {
    case 1: return slot1;
    case 2: return slot2;
    case 3: return slot3;
    case 4: return slot4;
  }
}

function writeSlot(player: PlayerPresence, slot: FlaskBeltSlotNumber, next: FlaskBeltSlotState): void {
  const slots = readBelt(player);
  switch (slot) {
    case 1: slots[0] = next; break;
    case 2: slots[1] = next; break;
    case 3: slots[2] = next; break;
    case 4: slots[3] = next; break;
  }
  writeBelt(player, slots);
}

export function getFlaskSlotCharges(player: PlayerPresence, slot: FlaskBeltSlotNumber): number {
  return readSlot(player, slot).charges;
}

export function setFlaskSlotCharges(player: PlayerPresence, slot: FlaskBeltSlotNumber, value: number): void {
  writeSlot(player, slot, { ...readSlot(player, slot), charges: value });
}

export function getFlaskSlotMaxCharges(player: PlayerPresence, slot: FlaskBeltSlotNumber): number {
  return readSlot(player, slot).maxCharges;
}

export function getFlaskSlotNextReadyAt(player: PlayerPresence, slot: FlaskBeltSlotNumber): number {
  return readSlot(player, slot).nextReadyAt;
}

export function setFlaskSlotNextReadyAt(player: PlayerPresence, slot: FlaskBeltSlotNumber, value: number): void {
  writeSlot(player, slot, { ...readSlot(player, slot), nextReadyAt: value });
}

export function getFlaskSlotEffectType(player: PlayerPresence, slot: FlaskBeltSlotNumber): string {
  return readSlot(player, slot).effectType;
}

export function getFlaskSlotEffectValue(player: PlayerPresence, slot: FlaskBeltSlotNumber): number {
  return readSlot(player, slot).effectValue;
}

export function isFlaskSlotReady(player: PlayerPresence, slot: FlaskBeltSlotNumber, now: number): boolean {
  return now >= getFlaskSlotNextReadyAt(player, slot);
}

export function consumeFlaskSlotCooldown(
  player: PlayerPresence,
  slot: FlaskBeltSlotNumber,
  now: number,
  cooldownMs: number = FLASK_SLOT_COOLDOWN_MS,
): number {
  const nextReadyAt = now + cooldownMs;
  setFlaskSlotNextReadyAt(player, slot, nextReadyAt);
  return nextReadyAt;
}

/**
 * Sync one belt slot's max charges / effect type / effect value from
 * the flask item now equipped in it (or clear it when `useEffect` is
 * `undefined`, meaning the slot is empty or holds a non-flask item).
 * `persistedCharges` restores a previously-saved charge count (clamped
 * to the new max); omitted means "fill to max" (a freshly equipped
 * flask always starts full).
 */
export function syncFlaskBeltSlotFromEquippedItem(
  player: PlayerPresence,
  slot: FlaskBeltSlotNumber,
  useEffect: { readonly type: string; readonly value: number; readonly charges: number } | undefined,
  persistedCharges?: number,
): void {
  if (useEffect === undefined) {
    writeSlot(player, slot, { ...EMPTY_SLOT });
    return;
  }

  const max = Math.max(0, Math.floor(useEffect.charges));
  const charges = persistedCharges === undefined
    ? max
    : Math.min(max, Math.max(0, Math.floor(persistedCharges)));
  writeSlot(player, slot, {
    effectType: useEffect.type,
    effectValue: useEffect.value,
    charges,
    maxCharges: max,
    nextReadyAt: 0,
  });
}

/** Restores every equipped belt slot to full charges (town rest / respawn). Empty slots stay empty. */
export function restoreFlaskBeltToFull(player: PlayerPresence): void {
  const slots = readBelt(player).map((slot) => ({ ...slot, charges: slot.maxCharges, nextReadyAt: 0 }));
  writeBelt(player, slots);
}

/** Sum of charges across all 4 belt slots -- used for HUD/feedback totals, not gameplay decisions. */
export function sumFlaskBeltCharges(player: PlayerPresence): number {
  return readBelt(player).reduce((total, slot) => total + Math.floor(slot.charges), 0);
}

/** Builds the `Character.flaskChargesJson` persistence payload from a presence's current belt state. */
export function buildFlaskChargesJsonForPresence(player: PlayerPresence): string {
  const [slot1, slot2, slot3, slot4] = readBelt(player);
  const clamp = (s: FlaskBeltSlotState): number => Math.max(0, Math.min(s.maxCharges, Math.floor(s.charges)));
  const charges: FlaskBeltPersistedCharges = [clamp(slot1), clamp(slot2), clamp(slot3), clamp(slot4)];
  return buildFlaskChargesJson(charges);
}
