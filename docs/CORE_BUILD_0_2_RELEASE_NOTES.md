# docs/CORE_BUILD_0_2_RELEASE_NOTES.md — Core Build 0.2 Release Notes

## Status

**In Development.** Core Build 0.2 active development has begun from the stable 0.1 RC baseline.

---

## What's Included

### Task 284 — Development Baseline

- 0.2 marked as active development in planning docs
- First task row added to checklist
- `pnpm validate:0.2` script added (same checks as 0.1; will diverge as 0.2 work accumulates)
- Previously fixed UI/input/reconnect/loot/enemy reliability issues documented as regression-watch items (not active blockers)
- First 0.2 implementation lane defined: **Lane 1 — UI / Input Reliability** (Pillar 1)

### Task 290 — Remove Nightmarket-Specific Town Interactable Hardcoding

- `apps/server/src/realtime/rooms/initializeTownInteractables.ts`: Rewritten to filter `contentRegistry.worldProps.all` by `zoneId` and interactable-relevant `kind` values, removing the hardcoded `if (zoneId === "nightmarket")` branch
- `apps/server/src/realtime/rooms/interactValidation.ts`: Updated notice board ID from `"nightmarket_notice_board"` to `"nightmarket_notice_board_01"` to match the world prop definition
- `apps/server/src/realtime/rooms/TownRoom.ts`: Updated notice board reference `"nightmarket_notice_board"` to `"nightmarket_notice_board_01"`
- `docs/TECH_DEBT.md`: Marked the hardcoded Nightmarket interactable item as resolved
- Nightmarket town interactables still appear/work as before
- The new path is zone-driven: any zone with matching world prop definitions (`town_service`, `vendor`, `waypoint`, `loot_container`) gets its interactables populated automatically

### Task 291 — Replace Hardcoded `"nightmarket"` Zone Fallback in TownRoom

- `apps/server/src/realtime/rooms/resolveTownZoneId.ts`: New helper module that resolves town zone ID from `contentRegistry.zones`, replacing the earlier `options.requestedZoneId ?? ("nightmarket" as ZoneId)` pattern
  - If `requestedZoneId` is provided and exists as a `town`-type zone, returns it
  - If no `requestedZoneId` is provided, falls back to the first registered town-type zone from content  - Unknown or wrong-room-kind zones are rejected with a safe error
  - This is data-driven: adding a new town zone to `zones.ts` automatically surfaces through the resolver
- `apps/server/src/realtime/rooms/TownRoom.ts`: Replaced `options.requestedZoneId ?? ("nightmarket" as ZoneId)` with `resolveTownZoneId(options.requestedZoneId)` 

---

## Validation Status

- `pnpm validate:0.1` — passing (same known warnings as 0.1 RC)
- `pnpm validate:0.2` — passing (identical to 0.1 at baseline)

---

## Known Deferred Items

*(To be completed at candidate time.)*
