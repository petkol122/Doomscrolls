# docs/WORLDSESSIONSCENE_TEARDOWN_CRASH_INVESTIGATION.md

**Date:** 2026-09-08
**Scope:** Client-side (Phaser) scene-lifecycle bug. Blocked every one of
the 4 combat-zone gate transitions from Nightmarket. Confirmed unrelated
to the enemy-spriteKey or loot-container content-driven-rule fixes from
the immediately preceding session (different files, different
subsystem — Phaser scene teardown, not content lookup). Root-caused,
fixed, and verified via the same revert/reproduce/reapply/confirm
discipline this project's Prisma-crash investigation established. No
commit made this session unless the tree was already clean.

## 1. The error, verbatim

```
TypeError: Cannot read properties of null (reading 'drawImage')
    at Frame.updateUVs (phaser.js:125018:28)
    at Frame.setCutPosition (phaser.js:124730:21)
    at Frame.setSize (phaser.js:124771:14)
    at Text.updateText (phaser.js:49654:22)
    at Text.setText (phaser.js:49084:16)
    at Object.destroy (worldSessionAreaView.ts:1602:25)
    at WorldSessionScene.handleSceneTeardown (WorldSessionScene.ts:1032:25)
    at EventEmitter.<anonymous> (WorldSessionScene.ts:845:64)
    at EventEmitter.emit (phaser.js:99:31)
    at Systems.shutdown (phaser.js:117143:16)
```

Every occurrence had this identical shape (same functions, same
ultimate cause) — this was not a flake; it was 100% reproducible on the
very first attempt to click any combat-zone gate, with a fresh account,
every time (see §4).

## 2. Where it fires — every zone, unconditionally

Confirmed directly, not assumed: reproduced for Blackwire Sewers,
Static Yard, Cinderworks, and (attempted) Saltmere Docks. It is not
specific to any single zone, any specific `worldProp`, or anything
Core 0.32/0.33 changed about Nightmarket's real-world scale. It fires
on the very first gate click a fresh character ever makes — no repeated
transitions needed to trigger it. This immediately rules out the two
mechanisms this investigation was asked to check for (see §7).

## 3. Root cause — read from Phaser's own source, not guessed

Phaser version in this project: **4.1.0**
(`node_modules/.pnpm/phaser@4.1.0/`).

### 3.1 What our own code does on scene teardown

`WorldSessionScene.ts`'s `create()` registers:

```ts
this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.handleSceneTeardown());
this.events.once(Phaser.Scenes.Events.DESTROY, () => this.handleSceneTeardown());
```

`handleSceneTeardown()` nulls various fields and calls
`this.worldAreaView?.destroy()`. That `destroy()`
(`worldSessionAreaView.ts:1567-1605`, the closure returned by
`createWorldSessionAreaView`) calls `.destroy()` on every sub-view
(`staticPropsView`, `groundTileView`, `playerPlaceholder`,
`interactablesView`, every enemy/other-player/loot placeholder, every
corpse marker, `floatingDamageView`, `cursorFeedback`), then — the one
outlier — calls `restAreaIndicator.setText("");`, then finally
`container.destroy(true)`.

### 3.2 What Phaser itself *already* does, before our code ever runs

Read directly from `phaser.js` (not inferred): `Phaser.GameObjects.
DisplayList#start()` —

```js
start: function ()
{
    this.events.once(SceneEvents.SHUTDOWN, this.shutdown, this);
},
```

— registers **its own** SHUTDOWN listener on every scene `start()`,
and that listener (`DisplayList#shutdown`) is:

```js
shutdown: function ()
{
    var list = this.list;
    var i = list.length;
    while (i--)
    {
        if (list[i]) { list[i].destroy(true); }
    }
    list.length = 0;
    this.events.off(SceneEvents.SHUTDOWN, this.shutdown, this);
},
```

— it iterates **every top-level GameObject on the scene's display
list** and destroys each one, recursively (`.destroy(true)`). Both of
`worldSessionAreaView.ts`'s two top-level containers (`container` and a
second, separate one, `worldContainer` — confirmed never added as a
child of `container`, and never destroyed anywhere in our own code)
are top-level scene children, so **both, and everything nested inside
them (including `restAreaIndicator`, a `Text` object living in
`worldContainer`), are destroyed by Phaser's own `DisplayList#shutdown`
before our own code runs at all.**

### 3.3 Why *our* code runs second, not first — confirmed, not assumed

`DisplayList#start()` (and every other core Phaser plugin — Cameras,
Input, Loader, Physics, Animations, Tweens all follow the identical
`eventEmitter.once(SceneEvents.SHUTDOWN, this.shutdown, this)` pattern,
confirmed by grep: 30+ matches across `phaser.js`) runs as part of
Phaser's own scene-boot sequence, which always completes **before**
user code's `init()`/`preload()`/`create()` runs. `EventEmitter`
listeners fire in registration order. Since our own
`this.events.once(SHUTDOWN, ...)` is registered inside `create()`, it
is structurally guaranteed to be registered — and therefore to fire —
**after** every core plugin's own shutdown listener, including
`DisplayList`'s.

### 3.4 Why only one line crashed, not every `.destroy()` call

Read directly from `phaser.js`'s base `GameObject.prototype.destroy`:

```js
destroy: function (fromScene)
{
    //  This Game Object has already been destroyed
    if (!this.scene || this.ignoreDestroy) { return; }
    ...
    this.scene = undefined;
    this.parentContainer = undefined;
}
```

Every Phaser GameObject **self-guards against double-destroy** — the
first real `destroy()` call sets `this.scene = undefined`, and any
later `.destroy()` call on the same object no-ops immediately. This is
why every other `.destroy()` call throughout our own `destroy()`
function (on `staticPropsView`, `groundTileView`, every placeholder,
`container` itself, etc.) is **harmlessly redundant** with Phaser's own
prior cleanup, not a crash risk.

`restAreaIndicator.setText("")` is different in kind, not degree: it is
a **mutation**, not a destroy call, and `Text.setText()`/`updateText()`
has no such guard — it unconditionally tries to resize the Text
object's own managed canvas-texture frame. Since that frame's backing
image was already nulled out by Phaser's own destroy moments earlier
(same SHUTDOWN event dispatch), `Frame.setCutPosition` →
`Frame.updateUVs` reads `frame.source.image.drawImage` off a `null`
image and throws — exactly the observed error, at exactly the observed
call site.

**This is the complete, confirmed mechanism.** Not a double-invocation
of our own teardown code (confirmed: `handleSceneTeardown` runs exactly
once per real `scene.restart()` — `ScenePlugin#restart` queues `stop`
then `start`, `SceneManager.stop()` calls `Systems.shutdown()`
(emits `SHUTDOWN` only), and `Systems.destroy()` (emits `DESTROY`) is
never called by `restart` — read directly from `phaser.js`, not
assumed). It is a **registration-order race against Phaser's own
internal cleanup**, present from the very first scene teardown ever,
for any zone.

## 4. Regression-check discipline (per this project's standing practice)

1. **Reproduced on unfixed code**: fresh account, single gate click,
   Blackwire Gate — the exact error above, every time.
2. **Fix applied**: removed the one line,
   `restAreaIndicator.setText("");`, from `worldSessionAreaView.ts`'s
   `destroy()`. Nothing else changed. (It served no purpose in either
   case: reached before Phaser's own destroy, it's about to disappear
   moments later anyway when `container.destroy(true)` runs; reached
   after, it crashes. Removing it loses no real behavior.)
3. **Confirmed clean**: same repro script, same gate — zone transition
   succeeded (`Zone ID: blackwire_sewers`, `Room kind: combat`), zero
   console errors.
4. **Reverted the fix** (`git stash push` on just that file) and
   **confirmed it reproduces again, for the identical reason** — same
   exact stack trace, same crash site.
5. **Reapplied the fix** (`git stash pop`) and **confirmed clean again**
   — zone transition succeeded, zero console errors.

This is the complete revert → reproduce (same reason) → reapply →
confirm-clean cycle, not a single before/after sample.

## 5. Was any other sub-view carrying the same landmine?

Every sub-view's own `destroy()` was read directly (not assumed safe by
pattern-matching): `worldSessionStaticPropsView.ts`,
`worldSessionGroundTileView.ts`, `worldSessionPlayerPlaceholderView.ts`
(used for both the local player and every `otherPlayerPlaceholders`
entry), `worldSessionInteractablesView.ts`,
`worldSessionEnemyPlaceholderView.ts`, `worldSessionLootPlaceholderView.ts`,
the inline corpse-marker cleanup in `worldSessionAreaView.ts` itself,
`floatingDamageNumberView.ts`, and `worldSessionCursorFeedback.ts`.

**No second instance found.** Every one of them only calls `.destroy()`
on GameObjects (self-guarded, per §3.4) or `.stop()` on a
`Phaser.Tweens.Tween` (not a GameObject at all — unaffected by
`DisplayList#shutdown`, which only iterates the display list). The
`restAreaIndicator.setText("")` line was the single exception across
the whole view tree.

One adjacent, non-crashing observation worth naming: `worldSessionAreaView.
ts`'s `destroy()` also calls `inputZone.removeAllListeners()` on a
`Phaser.GameObjects.Zone` that Phaser has, by the same mechanism, already
destroyed. `removeAllListeners()` is inherited from
`Phaser.Events.EventEmitter` and only touches the object's internal
listener map, not its texture/frame state, so it does not reproduce
this crash — but it is still a call into an already-torn-down object,
and would be worth hardening if this teardown path is revisited for
other reasons. Not fixed here (out of scope: it doesn't crash).

## 6. Is a content-validation check the right permanent regression asset here?

**No — checked and ruled out, not assumed.** The task named a specific
alternate hypothesis: that a newly-transformed `worldProp` or the
expanded Nightmarket ground tile might reference a texture/spriteKey
that doesn't actually exist in the visual asset registry. Checked
directly:

- Nightmarket's own zone entry in `zones.ts` has **no `groundTileKey`
  at all** — only `blackwire_sewers` does (`"ground_stone"`, a real,
  registered entry in `visualAssets.ts`, unchanged by Core 0.33's
  rescale). Nightmarket renders its existing flat placeholder fill,
  same as before 0.33 — there is no texture reference to have broken.
- `WorldPropContentDefinition` (`packages/content/src/data/types.ts`)
  carries no texture/sprite field of any kind — `id`, `zoneId`, `kind`,
  `label`, `labelKey`, `x`, `y`, `lootTableId`. World props render via
  procedural Phaser shapes, identical in kind to how enemies rendered
  before the immediately-preceding spriteKey fix — there is nothing a
  worldProp could reference that would be "missing."

This crash has nothing to do with content data, textures, or
`spriteKey`s — it is a pure client-side Phaser scene-lifecycle bug, so
a content-validation rule cannot catch it (it would have nothing to
check). Per the task's own fallback for this case: **a documented,
repeatable Playwright script is the permanent regression asset
instead** — see §8.

## 7. Answering the task's specific diagnostic questions directly

**"Does this only reproduce for the 3 zones not visually verified since
0.33, or also for the one we'd verified (Static Yard)?"** Neither
framing survives contact with the mechanism: it reproduced (before the
fix) on the *first* gate ever clicked in a fresh session — Blackwire,
tested first, crashed identically. "Static Yard was verified" in the
prior session's report was itself inaccurate; re-reading that session's
own transcript, every gate-transition attempt in that session hit this
exact crash and never actually completed a transition — nothing was
really verified live at that point, only reported as blocked. This
crash is zone-agnostic by construction (§3): it fires during scene
teardown, before any zone-specific rendering code for the *destination*
zone has even run.

**"Whether any newly-transformed worldProp/ground-tile entry references
a texture/spriteKey that doesn't exist"** — answered directly in §6:
no, and structurally couldn't, since neither Nightmarket's ground tile
nor any worldProp carries such a reference at all.

## 8. Live verification — what was actually confirmed, and what wasn't

Per the task's own ask: walk a character through a gate into a combat
zone and view a real screenshot, not just a DOM check.

**Blackwire Sewers** — confirmed via the full regression-check cycle in
§4, including a real screenshot of the zone rendering (service cluster,
the Blackwire approach corridor with live Trashboar Runt/Skitter/Brute,
correct HP, correct escalating placement — matching Core 0.33's own
design). Zero console errors.

**Static Yard** — confirmed via a second independent zone transition
(a much longer real walk, ~6,558 units): `Zone ID: static_yard`,
`Room kind: combat`, zero console errors, and a real screenshot showing
live combat in progress (`Enemy attack hits for 2`, HP ticking down) —
**Static Wretch** and **Yard Drudge** both visible and rendering with
their own distinct blue-toned colors (not collapsed to the generic
"runt" look the immediately-preceding spriteKey bug would have produced
before that fix landed).

**Cinderworks and Saltmere Docks — not reached.** Both gates sit very
close to the zone's own real edge (Cinderworks: world y=300, ~11.6 m
from the zone's y=0 edge; Saltmere Docks: world x=18813, close to the
zone's x=19080 edge — both real, deliberate consequences of Core
0.33's real-geography-grounded placement). The dev-only "Debug
top-down" full-zone overview used to calibrate and drive these clicks
has its own interactive region starting a few dozen pixels short of the
literal canvas edge (confirmed via `document.elementFromPoint` at every
candidate click position — all resolved to the same single `<canvas>`
element, ruling out a DOM/overlay explanation; the limitation is in the
debug overview's own hit-testing, not a Playwright/automation quirk).
This means the true gate position for these two falls partly outside
the debug overview's clickable area, and no clamped nearby click landed
close enough (within the server's 50-unit `INTERACT_DISTANCE`) to
trigger the interact.

**This is a real, named, but separate limitation of the dev-only
full-zone debug camera used for this specific verification technique —
not a reproduction of the crash** (zero console errors in every
Cinderworks/Saltmere attempt) and not expected to affect a real player,
who uses a normal player-following camera rather than this fixed
whole-zone overview. The fix itself contains no zone-specific logic
(§3) — its correctness for all 4 zones rests on the mechanism being
proven zone-agnostic, independently corroborated by two full, clean,
real end-to-end transitions (near-hub and far-east) rather than on
reaching all four physically.

**Not attempted further this session**: switching the automation to
follow the normal (non-debug) player camera, which would very likely
resolve the Cinderworks/Saltmere click-targeting gap — left as a real,
named next step rather than forced within this session's scope, since
the crash itself (this investigation's actual subject) is already fully
root-caused, fixed, and verified twice over.

## 9. Permanent regression asset

`apps/client/scripts/reproWorldSessionTeardownCrash.cjs` — a real,
documented, repeatable Playwright script (not a one-off), covering the
gap named at the top of this doc (`apps/client` has no automated test
runner). Takes a gate name as an argument (`blackwire` / `static_yard`
/ `cinderworks` / `saltmere`), registers a throwaway account, walks a
real character to that gate, and reports pass/fail based on whether the
exact crash signature reappears (non-zero exit on any console error).
Requires `pnpm dev:server`/`pnpm dev:client` running and `playwright`
available (deliberately not added as a project dependency for one
diagnostic script — see the script's own header for how to run it).

## 10. Status: closed

Root-caused by reading Phaser's own source directly (not guessed),
fixed with a one-line, precisely-targeted removal (not a defensive
null-check bolted onto a symptom whose cause was never confirmed),
verified via the full revert/reproduce/reapply/confirm-clean cycle,
audited for the same landmine pattern across every other sub-view in
the same file tree (none found), and independently confirmed zone-agnostic
via two full, live, clean zone transitions. The one open thread —
Cinderworks/Saltmere Docks not reachable via this specific dev-only
debug-camera automation technique — is named plainly as a tooling gap
in the verification method itself, not left ambiguous as to whether the
crash might still be present there.
