# docs/CORE_BUILD_0_23_RELEASE_NOTES.md — Core Build 0.23 Release Notes

---

## Task — Two Perspective-Agnostic Asset Integrations

**Date:** 2026-09-04
**Build:** Core Build 0.23
**Status:** Implemented and verified in one pass. Working-tree only — nothing committed until this note.

### Summary

Both packs confirmed present under `apps/client/public/assets/` before
starting (`items/` — Glionox items16 plus an unrelated bundled food-icon
set; `UI/` — bdragon1727 health bars plus other unused bar/GUI styles in
the same sheet), so no need to stop and ask. Both integrations extend the
same `visualAssets` registry pattern from 0.22 — semantic key → registry
→ real file, rendering code never touching a path directly. Full design
rationale, the per-item icon table, and the frame-selection reasoning
are in `docs/CORE_BUILD_0_23_PLAN.md`; this note is what was actually
observed verifying it live.

### Item icons

`items.ts` is untouched — every new `visualAssets` row is keyed by an
item's existing (previously unused) `iconKey` string. Cataloged the
1244 anonymous items16 icons via generated contact sheets (not filenames
— the pack has none) and matched 27 of 34 items to a real, visually-
confirmed reasonable icon; 7 (cloth material, all 3 amulets, all 3
belts) had no reasonable match in this pack and were left alone.

**Live-verified**: created a character, inserted a few `ItemInstance`
rows directly in the local Postgres container (equipped weapon + three
inventory items, one deliberately unmapped) as fixture data, then looked
at the actual rendered Inventory panel. Screenshot confirms: Rustbound
Ring shows its ring icon, Sealed Blood Flask shows its potion-bottle
icon, and Scrapcord Belt (no mapping) renders exactly as it did before
this build — plain text, no icon, no broken-image box. Zero console
errors throughout.

**Found, not fixed — pre-existing equipment-panel bug**: while trying to
get the same live look at the Equipment panel specifically, the panel's
per-slot list rendered every slot as "Empty" even for an item just
equipped through the real UI flow (confirmed the equip itself worked —
inventory count dropped, a stat bonus applied to the character). Traced
it: `worldSessionEquipmentView.ts` reads its slot→item mapping from
`WorldSessionScene.equipmentLoadout`, which only ever updates via a
`registerEquipmentListener` callback listening for an `"equipment_updated"`
server message — and a repo-wide grep for that message on the server
found nothing; it is never sent. So `equipmentLoadout` never leaves its
empty initial value for the life of a session, regardless of how an item
gets equipped. This is a real, pre-existing bug unrelated to this
build's icon change (the icon `<img>` is inserted in the same branch
that already reads `loadout[slot]`, using the separately-and-correctly-
refreshed `equippedItems` array for the item's own data) — confirmed by
the fact it also explains why the equipment panel's item *labels* were
already always blank before this build, not just its now-missing icons.
Left unfixed (out of scope — would mean adding real server-side
broadcast wiring, not part of "wire icons into the existing UI"), noted
here as a found issue for a future build.

### Enemy HP bars

The bar was already real and server-driven before this build —
`getHpRatio()` off live `TownRoomEnemySnapshot.hp`/`maxHp` already fed a
flat-rectangle fill's `setScale()`. This build reskins it: checked the
pack's `05.png` strip pixel-by-pixel (via a scratch `pngjs` script, not
assumed) and found frames 0–5 share a consistent 48×25 footprint while
frames 6–7 are a smaller, differently-proportioned variant — so only
frames 0–5 are used, mapped from `hpRatio` as 6 discrete tiers rather
than a continuous crop (the frames aren't a uniform left-anchored
gradient that crops cleanly).

**Live-verified with the actual regression-check discipline the task
asked for, not just a before/after look:**

1. Routed a fresh character directly into Blackwire Sewers (same local-
   DB zone-assignment technique as 0.22's verification) and attacked a
   Trashboar Skitter via the real click-to-attack flow. Screenshot
   sequence over ~12s: bar starts full (green→orange gradient, matching
   the pack's own baked-in "100%" look), enemy transitions to its
   `chasing` state as it takes damage, and the bar visibly shrinks and
   shifts toward red — real HP driving a real frame change.
2. **Broke it on purpose**: temporarily hardcoded `resolveHpBarFrame` to
   always return frame 0, reran the identical attack sequence. Result:
   the enemy still visibly took damage and aggroed (chasing state,
   HP text unaffected), but the bar stayed frozen at the full-HP frame
   throughout — the exact "bar not updating on damage" failure mode
   the discipline check is for, and the same screenshot-based look that
   caught the real, working version would have caught this immediately.
3. Restored the real `resolveHpBarFrame`, reran once more, confirmed the
   bar tracks damage again (same shrink-and-redden pattern as step 1).

No client-side automated test was added for this — `apps/server/test`'s
"permanent verification" mandate is scoped to server-authoritative logic
(this repo has no client rendering test infrastructure to extend the way
0.22 extended the content-registry test), so the revert/confirm/restore
sequence above is the verification artifact for this specific piece.

A boss-specific bar variant was considered and explicitly not built —
nothing in the current enemy roster needs one, and forcing it in without
a real use would be exactly the kind of manufactured scope this repo's
build notes have repeatedly declined elsewhere. Noted as a future option
in the plan doc.

### Verified

- `pnpm typecheck` clean across all 5 workspace packages.
- `pnpm --filter @doomscrolls/content lint` and
  `pnpm --filter @doomscrolls/client lint` clean.
- `apps/server/test/content/contentRegistryValidation.test.ts` passes
  with the new `visualAssets` rows (27 item icons + 1 HP bar sheet) and
  two new generic validation rules exercised for free: an `item_icon`
  row's id must match a real item's `iconKey` (catches an orphaned/
  typo'd mapping), and spritesheet dimensions must be internally
  consistent (`frameWidth * frameCount === sourceWidth`).
- Live Playwright checks as described above for both features, with the
  HP bar specifically going through the revert/confirm/restore
  discipline the task asked for.

---

## Follow-up — Equipment Panel Fix (the bug found above)

**Date:** 2026-09-04
**Status:** Fixed, live-verified, regression-tested. Working-tree only — nothing committed until this note.

The "found, not fixed" bug from this same build's icon integration
(above) is fixed: `equipment_updated` is now actually sent, and the
equipment panel reliably reflects real equip/unequip state — labels and
0.23's icons both. Three distinct defects had to be closed, not one;
fixing only the first would have left the panel looking broken in the
most common case (logging in).

1. **The reported bug**: `EquipmentService.equip`/`unequip` (called from
   the HTTP `/equip`/`/unequip` routes) mutated the database correctly
   but never notified the connected client. Since equip/unequip run
   entirely outside any Colyseus room's message loop, there was no
   existing "the room already has this client" path to send through.
   Added `connectedPlayerRegistry.ts` — `TownRoom`/`CombatRoom.onJoin`
   register the joining client by `characterId`, `onLeave` unregisters —
   so `EquipmentService` can look up the character's live session and
   push `equipment_updated` (shape: `{ type, equipment: EquipmentLoadout }`,
   matching the client's already-built, previously-unfed
   `registerEquipmentListener`) after every equip/unequip, from outside
   any room.

2. **Found while live-verifying #1**: a character who joins with gear
   already equipped (the ordinary "log in and play" case, not just
   "equip something new this session") still saw every slot as empty,
   because the client never learns the current loadout except through
   this same message — and nothing sent it at join. Both rooms'
   `onJoin` now also send `equipment_updated` (via a new shared
   `buildEquipmentLoadout` helper, reused by `EquipmentService` too, so
   the slot-mapping logic exists in exactly one place).

3. **Found while live-verifying #2**: sending it on join didn't actually
   fix anything at first — Playwright showed the panel still empty, with
   the browser console logging `onMessage() not registered for type
   'equipment_updated'`. The server's join-time send arrives before
   `WorldSessionScene` exists to register a handler for it (there's a
   real gap: the Phaser scene transition between the room join
   resolving and the new scene's `create()` running), and Colyseus drops
   a message with no handler registered for its type instead of queuing
   it. Fixed with `equipmentUpdateBuffer.ts`: `joinTownRoom`/
   `joinCombatRoom` register a capture-and-buffer handler immediately
   after `joinOrCreate` resolves (the earliest point client code can
   run), and `registerEquipmentListener` consumes whatever landed in the
   buffer before wiring up the live handler for later updates.

4. **Found while live-verifying #3**: with the message now reliably
   delivered, the panel *still* intermittently went blank a second or
   two after correctly showing the equipped item — not on every render,
   but often enough to reproduce in a 10-sample/2.7s window every time.
   Root cause: `updateEquipmentPanelSection`'s "skip rebuild if nothing
   changed" version check (`worldSessionEquipmentView.ts`, originally
   Task 275) compared against a single **module-level** version number,
   but `syncUtilityView` rebuilds a brand-new equipment `<details>`
   element from scratch on every overlay sync (movement ticks, any room
   state patch). The very next sync after a correct render would create
   a fresh, empty content `<div>`, compute the same version number
   (nothing in the data had changed), see it match the stale
   module-level value, and skip populating the new element — leaving it
   permanently empty until the next actual equipment change. Fixed by
   keying the version cache to the specific content element via a
   `WeakMap<HTMLElement, number>` instead of one shared variable, so a
   freshly created (always-empty) element is never mistaken for an
   already-populated one.

### Live verification

Registered a real test account and character through the actual HTTP
`/auth/register` + `/characters` routes, seeded one real `ItemInstance`
row (`starter_pipe`, a real weapon from content) directly in the local
Postgres container as fixture data (same category as 0.23's own
icon-verification setup above — no started currency/loot path exists
yet to buy or drop one), then drove the real client end-to-end with
Playwright:

- Equipped the item through the real Inventory panel "Equip" button:
  Equipment panel updated live, `Weapon: Starter Pipe (+3 damage)` with
  its real icon and an "Unequip" button. Inventory correctly dropped to
  0 items.
- Unequipped it: slot correctly reverted to "Empty", item returned to
  inventory.
- Logged out and back in (fresh room join) with the item already
  equipped from the previous step: Equipment panel showed the real item
  immediately on entering the world, and stayed correct across a 2-second
  window of natural render churn (the exact condition that used to blank
  it — see defect #4 above).
- Zero console errors throughout any of the above.

Regression-checked each of the three follow-on defects (#2–#4) by
reproducing the broken state first (confirmed empty/dropped/blanking),
then applying its fix and reconfirming — not just a single before/after
look.

Test account, character, and seeded item instance deleted from the
database after verification.

### Regression tests added

- `apps/server/test/character/equipmentService.test.ts` — equip and
  unequip each send `equipment_updated` with the correct per-slot
  mapping (fake in-memory Prisma client, no live DB). Reverted the
  `notifyEquipmentUpdated` call, confirmed both tests fail with "expected
  spy to be called 1 times, but got 0 times", restored, confirmed green.
- `apps/server/test/character/equipmentUpdatedOnJoin.test.ts` — both
  `TownRoom` and `CombatRoom` send `equipment_updated` on join (via the
  real in-process Colyseus test harness).

The client-side fixes (#3's message buffer, #4's per-element version
cache) have no automated coverage — this repo has no client rendering
test infrastructure (see 0.23's HP bar section above for the same
gap) — so the Playwright revert/confirm/restore sequence above is their
verification artifact.

### Verified

- `pnpm typecheck` clean across all 5 workspace packages.
- `apps/server` full test suite: 27 files / 44 tests passing (the 2 new
  tests are additional; no existing test regressed).
- Live Playwright checks as described above, including the
  regression-check discipline for all three follow-on defects.

### File footprint (this follow-up)

Server: `apps/server/src/realtime/rooms/connectedPlayerRegistry.ts`
(new), `apps/server/src/character/buildEquipmentLoadout.ts` (new),
`EquipmentService.ts` (sends `equipment_updated` after equip/unequip),
`TownRoom.ts`/`CombatRoom.ts` (register/unregister connected players,
send `equipment_updated` on join). Client:
`apps/client/src/net/equipmentUpdateBuffer.ts` (new), `RealtimeClient.ts`
(buffers the join-time message), `worldSessionEquipmentView.ts`
(consumes the buffer; per-element version cache instead of module-level).
No protocol/shape changes — `EquipmentUpdatedServerMessage` and
`EquipmentLoadout` already existed, unused, from the original build.

### File footprint

`packages/content/src/data/types.ts` (`item_icon`/`hp_bar` categories,
optional spritesheet fields), `visualAssets.ts` (28 new rows),
`ContentValidation.ts` (new checks). `apps/client/src/game/
itemIconResolver.ts` (new), `visualAssetLoader.ts`
(`queueEnemyHpBarLoad`), `WorldSessionScene.ts` (preload wiring),
`worldSessionEquipmentView.ts` and `worldSessionOverlayView.ts`
(inventory/equipment icon rendering), `worldSessionEnemyPlaceholderView.ts`
(rectangle → sprite). `items.ts` and every other item/enemy content file:
untouched. No server or protocol changes.
