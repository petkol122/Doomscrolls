# docs/CORE_BUILD_0_21_PLAN.md — Core Build 0.21 Plan

## Theme: The Bottom HUD Becomes an ARPG HUD

## Why the bottom HUD, not a broader pass

`worldSessionOverlayView.ts`'s HUD panel (`createHudSection`) is the one
piece of screen every player looks at every second of combat: it is the
only place current HP is rendered during play. Today it reads as a
debug status card — a labelled progress bar in a rounded rectangle,
flask charges as a row of dots and text, a skill-cooldown card, and two
quest-tracker cards, all left-aligned text blocks stacked in a grid.
Nothing else in the overlay (the side utility panel's collapsible
sections, the character chip) carries comparable at-a-glance weight or
comparable distance from the Diablo/PoE target described in
`docs/GAME_DESIGN.md`. Redoing the bottom HUD properly buys more
readability than a shallow re-skin of every panel, so this build touches
one screen and finishes it rather than touching all of them lightly.

Out of scope, deliberately: the side utility panel (equipment/inventory/
controls/debug — functional, not visual-priority), the character chip,
and the area/travel banners. None of those are where a PoE-style pass
pays off first.

## Visual direction

Target composition, bottom-center, stacked and centered (ASCII, not to
scale):

```
                 ┌───────────────┐  ┌───────────────┐
                 │  Objective 1  │  │  Objective 2  │   (0, 1, or 2 — only if active)
                 └───────────────┘  └───────────────┘

              ┌──────────────────────────────────────┐
              │  RMB   Grave Spark   •   Ready         │              (existing skill-slot card, unchanged logic)
              └──────────────────────────────────────┘

      ╭───────────╮   ┌────┬────┬────┬────┬────┐   ╭───────────╮
     ╱             ╲  │ Q  │ 🔒 │ 🔒 │ 🔒 │ 🔒 │  ╱             ╲
    │   HP  ORB     │  │flask│soon│soon│soon│soon│ │  RESOURCE     │
    │  ⬤⬤⬤ 734/900  │  └────┴────┴────┴────┴────┘ │  ORB (soon)   │
     ╲             ╱                                ╲             ╱
      ╰───────────╯                                  ╰───────────╯

                       Lv 3  •  128 XP
```

This is the PoE reference shape: two circular vessels anchoring the
corners of the action bar, a horizontal belt strip between them. The
skill-cooldown card and quest trackers keep their existing function but
move to sit *above* the orb/belt row instead of interleaved with it, so
the orb cluster itself stays visually clean the way it does in the
reference games — quest tracking is not part of PoE's orb HUD, and
folding it in was diluting the read.

### The orbs

Both orbs are the same shape: a circular vessel (`border-radius: 50%`,
fixed diameter, dark metal-ring border) containing a liquid fill — an
absolutely-positioned rectangle pinned to the bottom of the circle whose
`height` is the live ratio, giving the classic "liquid rising in a round
flask" read with plain CSS (no images, no SVG, no canvas — consistent
with how the rest of this overlay is already built as styled DOM nodes).

- **HP orb (real, wired):** fill ratio is `currentHp / maxHp` off the
  same synced presence data the current HP bar already reads. Deep red
  gradient, numeric `current/max` centered over the fill, ring and fill
  shift to the existing "downed" red when `lifeState === "downed"`. This
  is a restyle of real data, not a new system — same source, same
  update path, new shape.
- **Resource orb (stub, visual-only):** no backing field exists —
  `docs/GAME_DESIGN.md` is explicit that Core 0.1 (and nothing since)
  has a mana/resource system, and `PlayerPresenceEntry` has no such
  field to read. The orb renders with a flat, unfilled vessel (no liquid
  animation, no numbers implying a value), a lock glyph, and a "Coming
  Later" label reusing the already-unused `world_session.resource` /
  `world_session.resource_placeholder` localization keys. Ring color and
  saturation are visibly duted (grey, not the HP orb's saturated red) so
  the two orbs read as different *kinds* of thing at a glance, not one
  broken copy of the other. `cursor: not-allowed`, no click handler, no
  hover state change — nothing about it invites a click.

### The belt strip

Five square slots between the orbs, matching Core 0.1's real belt
identity from `docs/GAME_DESIGN.md` ("one belt slot, one starter
healing flask"):

- **Slot 1 — `flask_1` (real, wired):** restyled version of the current
  flask-charge display — same `flaskCharges`/`maxFlaskCharges` presence
  fields, same `[Q]` keybind — now drawn as an item-slot tile (flask
  glyph, charge pips along the bottom, `Q` badge) instead of a standalone
  text-and-dots line.
- **Slots 2–5 (stub, visual-only):** Core 0.1 has exactly one flask
  slot; these represent belt capacity the itemization doesn't have yet.
  Rendered visibly locked: ~45% opacity, dashed border, a lock glyph, a
  small "Soon" label, `cursor: not-allowed`, no keybind badge (there is
  no key bound to a slot that doesn't exist), no hover affordance. The
  goal is a tile that reads as "not yet available" on sight, not as a
  live control that quietly no-ops.

### Level/XP

Stays a single small chip under the orb row (`Lv {level} • {xp} XP`,
reusing the existing `world_session.level_xp_format` key — no new
string). No progress bar: there is no `xpToNextLevel` field anywhere in
`CharacterSummary`/`PlayerPresenceEntry` to compute a fill ratio from,
and inventing a denominator to draw a bar would be exactly the kind of
fake-looking-real element this build is supposed to avoid introducing.

## What does not change

- No flask-refill logic, no second resource system, no new belt-slot
  equip flow. Everything stubbed here is paint only.
- `PlayerPresenceEntry`, `CharacterSummary`, and the server are
  untouched — this build reads the same fields the old HUD read.
- The skill-slot card's cooldown/targeting logic (`createSkillSlotPlaceholder`)
  is unchanged internally; it only moves position in the new layout.
- The side utility panel, character chip, and objective *data* (still
  the real synced objective/objective2 state) are unchanged — only the
  objective cards' position within the HUD panel moves.

## File footprint

- `worldSessionOverlayView.ts` — `createHudSection` rebuilt around the
  new orb/belt composition; new helpers for the orb shell and belt
  slots; the old flat `createFlaskChargesLine` is replaced by the belt
  slot renderer (no longer has a caller).
- `worldSessionOverlayLayout.ts` — widen the `hud` grid-area panel to
  fit the belt strip; allow wrapping on narrow viewports.
- `en.ts` — a handful of new keys for the stub belt slots (lock hint,
  "Soon" label); the stub-orb keys already exist and were unused.

## Verification

This is a visual-only client change with no server-authoritative logic
to unit-test. Verification is `pnpm typecheck` clean plus an actual look
at the running client (via the `run`/Playwright tooling if reachable
this session) confirming: HP orb tracks real HP and the downed-state
color, the flask slot tracks real charges and empties/fills correctly,
and every stub element (resource orb, belt slots 2-5) is unmistakably
inert on hover/click — not a silently-dead control.
