# docs/CORE_BUILD_0_25_RELEASE_NOTES.md — Core Build 0.25 Release Notes

---

## Task — Fullscreen Viewport, Corner Menu, Floating HUD

**Date:** 2026-09-06
**Build:** Core Build 0.25
**Status:** Implemented and verified in one pass. Working tree was
**not** clean going in — Core 0.24's combat-retaliation port
(`CombatRoom.ts` + its new `test/combat/*` files) was already sitting
uncommitted from a prior session, intentionally so (see
`docs/CORE_BUILD_0_24_CHECKLIST.md`: "no commit made — working tree was
clean before that session began; committing was not requested"). Per
the standing no-commit-unless-clean-going-in rule, this build's changes
are also left uncommitted alongside it.

### Summary

Three fixes, all client-only, per `docs/CORE_BUILD_0_25_PLAN.md`:

1. **Corner menu → icon toolbar.** The six utility sections (Controls,
   Objectives, Equipment, Derived Stats, Inventory, Debug) each already
   built the same `<details><summary>...</summary><content/></details>`
   shape, so the redesign is one generic transform
   (`toIconMenuItem` in `worldSessionOverlayView.ts`) applied to all
   six: `<summary>` becomes a 40px circular icon button, every other
   child moves into one absolutely-positioned flyout card anchored
   below it. No section's internal content or open/close wiring
   changed. **Debug Panel** is now gated behind a new
   `clientEnv.isDevBuild` (`config/env.ts`, reading Vite's
   `import.meta.env.DEV`) — built every render (harmless) but only
   wrapped into an icon and appended to the toolbar in a dev build; a
   production bundle never attaches it to the DOM at all.
2. **Bottom HUD floats free.** `renderHudContent`'s card wrapper
   (`createCardSection()`, border+background+shadow+padding) is
   replaced with a new borderless `createFloatingHudSection()` —
   every child (HP orb, belt slots, resource-orb stub, trackers,
   skill-cooldown card, level/xp chip) already carried its own chrome
   from 0.21/0.15, so the redundant outer box was the only thing
   making it read as "boxed" rather than floating over the world.
3. **Fullscreen viewport.** `DoomscrollsGame.ts` swaps
   `Phaser.Scale.FIT` (fixed 1280x720, letterboxed) for
   `Phaser.Scale.RESIZE` (canvas tracks the real viewport). The world
   layout code (`resolveWorldSessionAreaLayout`) already read
   `scene.scale.width`/`height` dynamically, so this is wiring an
   already-adaptive layout to an actually-adaptive canvas. Two
   hardcoded `640` title x-coordinates (`AuthScene`, `AccountShellScene`,
   both assuming the old fixed 1280-wide canvas) now read
   `this.scale.width / 2`.

### Bug found after shipping, by actually using the feature: menu clicks leaked to world movement

Reported after the first pass: the corner-menu icons "work once, then
stop responding" — later clicks appeared to fall through to the game
world's click-to-move handler (the character walks toward the click
position) instead of toggling the menu.

**Reproduced live first, before touching any code.** A Playwright pass
against the running dev stack, clicking the Controls icon with a real
`page.mouse.down()`/`up()` at its exact on-screen center and reading the
Debug panel's own "Last click target" / "Synced position" lines,
confirmed the actual failure mode directly: the click landed squarely
on the icon (`document.elementFromPoint` at that coordinate returned
the `<summary>` itself, both before and after), yet the world's synced
click-target debug line changed on the *same* click — a real
click-to-move fired underneath the menu, not just a UI-side failure to
reopen.

**Root cause, confirmed by comparing against the pre-0.25 code, not
assumed:** the old vertical list's outer wrapper was
`createScrollableCardSection()`, which (via
`applyWorldSessionOverlayPanelStyles`) calls
`makeInteractiveAndStopWorldInput` — this attaches capture-phase
`pointerdown`/`mousedown` listeners that call `stopPropagation()`
*before* the event can bubble out to Phaser's own window-level pointer
listener (Phaser does its own hit-testing against its camera/display
list, entirely independent of DOM z-order, so a click that isn't
stopped in capture phase reaches Phaser as a world click regardless of
what DOM element visually received it). The 0.25 redesign replaced that
wrapper with a plain `<div>` carrying only `makePassive` (pointer-events
CSS, no listeners at all) so the icon row could let clicks in the gaps
*between* icons fall through to the world — but this silently dropped
the capture-phase protection for the icons themselves too, since it
was previously supplied by that same now-removed ancestor.

This also explains an earlier verification artifact from this build's
first pass, now corrected: Playwright's simulated clicks appeared unable
to toggle `<summary>` at all. That wasn't a Playwright/Chromium
limitation as first concluded — it was this exact bug: the leaked
world-click was triggering a `renderOverlay()` → `syncUtilityView()`
rebuild (`replaceChildren`) that raced with and discarded the toggle's
visible effect on the same DOM node. With the leak fixed, plain
`page.mouse.down()`/`up()` toggles the native `<details>` correctly and
repeatably — no `element.click()` workaround needed anymore.

**Fix:** `createStableUtilityContent`'s toolbar `root` now calls
`makeInteractiveAndStopWorldInput(root)` before `makePassive(root)` —
the same two-call idiom `createCardSection`/`createScrollableCardSection`
already used. The capture-phase listeners stay attached regardless of
the later `pointer-events: none`, so every icon click (each icon has
its own `pointer-events: auto`) is intercepted before reaching Phaser,
while clicks in the empty gaps between icons still fall through to the
world. One-line root cause, one-line fix, once actually confirmed.

**Verified live:** all 5 non-debug icons, 3 full rounds each (open then
close, 30 real `page.mouse` clicks total), via Playwright against the
running dev stack. Every open/close toggled correctly every time; the
world's synced position never changed across any of the 30 clicks;
zero console/page errors. Screenshotted each icon's flyout open to
confirm the menu itself still renders correctly post-fix.

**Regression test:** not added. `@doomscrolls/client` has no test
runner today (`package.json`'s `test` script is a literal placeholder,
`vite` is the only dev dependency) — there is no jsdom/vitest harness
to hang a DOM-level assertion on, and standing up a whole new client
test framework as a side effect of this one fix would be
disproportionate, unrequested scope. The bug is also specifically about
real browser event capture/bubble timing racing a DOM rebuild against
Phaser's own window-level input handling — not something jsdom (no real
Phaser/WebGL, no real capture-phase timing against a canvas) would
exercise faithfully even if a harness existed. Saying so plainly rather
than forcing a weak test: this class of regression is only realistically
caught by the same live-Playwright check performed above, which should
be re-run whenever the toolbar's root wrapper or its interactive-input
wiring changes again.

### Verified

- `pnpm -r typecheck` clean across all 6 workspace projects.
- `pnpm --filter @doomscrolls/client build` (production bundle) succeeds.
  Static check of the built bundle: the `isDevBuild`-gated branch is
  folded away entirely (property name doesn't survive minification —
  Vite/esbuild constant-propagated `import.meta.env.DEV → false` through
  it), and a live pass against the production preview build (registered
  a fresh account through it) showed the icon toolbar with the Debug
  icon absent.
- Live Playwright pass against the dev stack (Docker Postgres/Redis
  already up, client+server dev servers already running), fresh
  account/character each time, two viewports:
  - **1440x900 desktop:** fullscreen canvas fills the viewport with no
    dead space; screenshotted all six flyouts open (Controls,
    Objectives, Equipment slot list, Derived Stats chips, Inventory
    summary+detail, Debug's room-info/movement-debug/projection-toggle
    panel) — each renders as a clean anchored card below its icon, not
    a stacked list; zero console/page errors across the whole pass.
  - **480x800 narrow (0.21's stated case):** fullscreen canvas still
    fills the viewport; the six-icon row and the floating HUD both stay
    within bounds with no clipping; opened the widest flyout (Equipment)
    and confirmed it stays on-screen rather than overflowing past the
    viewport edge; zero console/page errors.
- Not re-covered live: mid-session browser window resize (the world
  layout is computed once at scene-create time from
  `resolveWorldSessionAreaLayout`, not recomputed on a live resize
  event) — out of scope for this pass, which targeted the load-time
  dead-space bug the screenshot showed, not runtime window-resize
  handling. Flagged here rather than silently assumed to work.

### File footprint

`worldSessionOverlayView.ts` (`toIconMenuItem` new; `createStableUtilityContent`/
`syncUtilityView` wrap each section through it and gate Debug behind
`clientEnv.isDevBuild`; `renderHudContent` uses new
`createFloatingHudSection`; dead `createScrollableCardSection` removed),
`worldSessionOverlayLayout.ts` (`applyWorldSessionOverlayUtilityStyles`
now a flex row; new `applyWorldSessionOverlayFloatingHudStyles`),
`config/env.ts` (`clientEnv.isDevBuild`), `DoomscrollsGame.ts` (`Scale.RESIZE`),
`AuthScene.ts`/`AccountShellScene.ts` (title x-position). No server,
protocol, or content changes.
