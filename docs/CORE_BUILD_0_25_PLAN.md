# docs/CORE_BUILD_0_25_PLAN.md — Core Build 0.25 Plan

## Theme: Fullscreen Viewport, Corner Menu, Floating HUD

## Why this pass

Concrete feedback from a real screenshot, not abstract direction — three
things read as "dev tools", not "game":

1. The top-right utility menu (Controls/Help, Objective Book, Equipment,
   Derived Stats, Inventory, Debug Panel) is six identical bordered
   `<details>` boxes stacked vertically — a settings list, not a game
   menu. Debug Panel in particular is visible to every player, including
   in a shipped build, which is wrong regardless of how it looks.
2. The bottom HUD orb cluster (0.21) sits inside a second, redundant
   bordered card (`createCardSection()`), even though every element
   inside it — orbs, belt slots, trackers — already carries its own
   border/background. The outer box was never removed when 0.21 built
   the individually-chromed pieces.
3. `DoomscrollsGame.ts` runs Phaser in `Scale.FIT` at a fixed 1280x720
   logical resolution. FIT letterboxes/pillarboxes to preserve that
   aspect ratio instead of filling the actual browser viewport — visible
   as dead black bars on any window that isn't exactly 16:9.

## Corner menu — icon toolbar, not a settings list

Every section (`createControlsSection`, `createObjectivesSection`,
`createEquipmentPanelSection`, `createDerivedStatsSection`,
`createInventoryPanelSection`, `createDebugPanel`) already returns the
same shape: a native `<details>` with a `<summary>` first child and one
content child. That uniformity means the redesign is a single generic
transform (`toIconMenuItem` in `worldSessionOverlayView.ts`), not six
bespoke rewrites:

- `<summary>` becomes a 40px circular icon button (❓📜🛡📊🎒🐞), its text
  replaced by the icon, its accessible label moved to `title`/
  `aria-label`.
- Every other child of `<details>` is moved into one new absolutely-
  positioned flyout `<div>` anchored below the icon (`top: calc(100% +
  8px); right: 0`), carrying the dark card chrome the whole `<details>`
  used to wear.
- The existing `open`/`onOpenChange`/`toggle`-event wiring is untouched
  — clicking the icon still natively opens/closes its own `<details>`,
  independent of the others (collapsible, one at a time or all six at
  once, same as before).
- `root` (the toolbar itself) becomes a plain flex row, no card
  background — it only lays out icons; each icon's own flyout carries
  its own chrome.

**Debug Panel** is gated behind `clientEnv.isDevBuild`
(`import.meta.env.DEV`, a new field alongside `apiUrl`/`wsUrl` in
`config/env.ts` — Vite's own build-mode flag, not a custom convention).
`createDebugPanel(...)` is still called every render (cheap, harmless)
but only wrapped into an icon and appended to the toolbar when
`isDevBuild` is true — in a production build the panel is built but
never attached to the DOM, so it is neither visible nor reachable. Vite
statically folds `import.meta.env.DEV` to `false` in a prod build, so
this is provably unreachable there, not just runtime-gated.

## Bottom HUD — remove the outer card

`renderHudContent`'s `panel = createCardSection()` is swapped for a new
`createFloatingHudSection()` / `applyWorldSessionOverlayFloatingHudStyles`
— same `makeInteractiveAndStopWorldInput` click-capture behavior (still
needed so clicks on the flask/respawn button don't leak to the world),
but transparent background, no border, no shadow, no padding. Every
child (HP orb, belt slots, resource-orb stub, objective trackers,
skill-cooldown card, level/xp chip) already has its own visible chrome
from 0.21/0.15/etc. — removing the redundant outer box is what makes it
read as a floating ARPG HUD instead of a HUD-in-a-box.

## Fullscreen viewport — RESIZE, not FIT

`DoomscrollsGame.ts` switches `scale.mode` from `Phaser.Scale.FIT`
(fixed 1280x720 logical size, letterboxed to fit) to
`Phaser.Scale.RESIZE` (canvas and `scene.scale.width`/`height` track the
actual viewport size, no letterboxing). This is a low-risk swap because
the world-area layout code already reads `scene.scale.width`/`height`
dynamically (`resolveWorldSessionAreaLayout`, already written to adapt
to any size) rather than assuming 1280x720 — this build is wiring an
already-adaptive layout to an actually-adaptive canvas, not writing new
responsive logic.

Two scenes (`AuthScene`, `AccountShellScene`) had one hardcoded `640`
x-coordinate each for their centered "Doomscrolls" title text, assuming
a fixed 1280-wide canvas; both now read `this.scale.width / 2`. Every
other login/account-shell element is a `position:fixed` DOM overlay,
already independent of canvas size.

## What does not change

- No content, protocol, or server changes — this is a client-only DOM/
  Phaser-config pass.
- Every menu section's internal content/logic (equipment slots,
  inventory list, debug's projection toggle, objective trackers) is
  unchanged — only the outer chrome and positioning move.
- The 0.21 "Soon"/"Coming Later" stub styling (dashed border, lock
  glyph, `not-allowed` cursor) is untouched.

## Verification

Client-only visual/layout change — no new server-authoritative logic to
unit-test. `pnpm -r typecheck` clean plus a live Playwright pass:
register → create character → enter The Nightmarket, at both a 1440x900
desktop viewport and a 480x800 narrow viewport (0.21's stated narrow
case), screenshotting the fullscreen canvas, each of the six flyouts
open, and the floating HUD. Confirm zero console/page errors, and
confirm a production (`vite build`) bundle only ever ships five icons
(Debug Panel un-reachable).
