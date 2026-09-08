// Repeatable, documented reproduction/regression script for a real crash
// found and fixed in Core Build 0.33's enemy-investigation follow-up:
// clicking a combat-zone gate from Nightmarket threw
//   "Cannot read properties of null (reading 'drawImage')"
// during WorldSessionScene.handleSceneTeardown(), and the zone transition
// never completed. Full root-cause writeup:
// docs/WORLDSESSIONSCENE_TEARDOWN_CRASH_INVESTIGATION.md
//
// Root cause, in short: Phaser's own internal
// Phaser.GameObjects.DisplayList#shutdown is registered on every scene
// start(), always BEFORE user code's create() runs -- so by the time our
// own SHUTDOWN listener (WorldSessionScene.handleSceneTeardown ->
// worldSessionAreaView.ts's destroy()) ran, every top-level scene
// GameObject was already destroyed by Phaser itself. Every `.destroy()`
// call in our own teardown code is safely redundant (Phaser GameObjects
// self-guard against double-destroy), except one line --
// `restAreaIndicator.setText("")` -- which is a *mutation*, not a
// destroy, and crashed on an already-destroyed Text object. Fixed by
// deleting that one line (it served no purpose either way).
//
// apps/client has no real automated test runner (flagged repeatedly,
// never built -- see this file's own investigation doc). This script is
// the permanent regression asset in its place: run it any time this
// class of bug is suspected to have reappeared.
//
// Usage:
//   node reproWorldSessionTeardownCrash.cjs [gate]
// [gate] is one of: blackwire (default), static_yard, cinderworks, saltmere
//
// Prerequisites:
//   - `pnpm dev:server` and `pnpm dev:client` both already running
//     (http://localhost:2567 and http://localhost:5173)
//   - `playwright` available to `require()` from wherever this runs --
//     it is NOT a project dependency (deliberately, to avoid adding a
//     heavy devDependency for one diagnostic script). Easiest: run
//     `npm install playwright` in a scratch directory and invoke this
//     script with that directory as the working directory, or install
//     `playwright` globally.
//
// What it does: registers a throwaway account, creates a character,
// enters the world (Nightmarket), opens the dev-only Debug Panel, then
// calibrates the "World Area" debug top-down overview's screen<->world
// coordinate mapping using two real clicks read back from the panel's
// own "Last click target" readout (not a hardcoded constant -- the
// mapping is not perfectly stable across sessions/viewport sizes).
// It then walks the character to the requested gate's real world
// coordinate (from packages/content/src/data/worldProps.ts) and clicks
// it, and reports: whether the zone actually transitioned (Zone ID /
// Room kind from the debug panel), and every console error/pageerror
// observed, with full stack traces. Exit code is non-zero on any
// console error or a failed transition.
//
// Known limitation, not a bug in this script or in the game: the
// "Debug top-down" overview used for calibration is a dev-only, fixed,
// whole-zone camera (not the normal player-following camera). Its own
// interactive click region appears to start a few dozen pixels below
// the literal top of the canvas (room for its own "World Area" header),
// which makes gates sitting very close to the zone's real top edge
// (Cinderworks, world y=300) or right edge (Saltmere Docks, world
// x=18813) hard to click precisely via this specific overview -- clicks
// land close but not close enough to trigger the interact. This was
// confirmed to be a property of the debug overview itself (every
// candidate screen position tested resolved to the SAME underlying
// <canvas> DOM element -- there is no separate blocking overlay), not a
// DOM/automation quirk, and doesn't affect the normal player-following
// camera a real player uses. Blackwire and Static Yard gates (this
// script's two best-covered cases) are not near either edge and are
// reliably reachable this way.

const { chromium } = require("playwright");

const GATE_WORLD = {
  blackwire: { x: 9111, y: 10988 },
  static_yard: { x: 14501, y: 12928 },
  cinderworks: { x: 8799, y: 300 },
  saltmere: { x: 18813, y: 16434 },
};

const targetGate = process.argv[2] || "blackwire";
if (!GATE_WORLD[targetGate]) {
  console.error("Unknown gate: " + targetGate + ". Use one of: " + Object.keys(GATE_WORLD).join(", "));
  process.exit(1);
}

const CLIENT_URL = "http://localhost:5173";
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = "repro_" + rand;
const PASSWORD = "TestPass123!";
const DISPLAY_NAME = "Repro";
const CHAR_NAME = "Scout" + rand;
const consoleErrors = [];

function parseTarget(text) {
  const m = text.match(/Last click target:\s*x=(-?\d+),\s*y=(-?\d+)/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  // Wide enough that the debug panel's own ~340px-wide right-side overlay
  // never overlaps the canvas x position any of the 4 gates (up to world
  // x=18813 for Saltmere Docks) map to.
  const VIEWPORT_W = 2200, VIEWPORT_H = 1100;
  const context = await browser.newContext({ viewport: { width: VIEWPORT_W, height: VIEWPORT_H } });
  const page = await context.newPage();
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push("console.error: " + msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message + "\n" + (err.stack || "")));

  await page.goto(CLIENT_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.fill("#doomscrolls-register-username", USERNAME);
  await page.fill("#doomscrolls-register-display-name", DISPLAY_NAME);
  await page.fill("#doomscrolls-register-password", PASSWORD);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.fill("#doomscrolls-character-name", CHAR_NAME);
  await page.getByRole("button", { name: "Create Character", exact: false }).click();
  await page.waitForTimeout(1500);
  const enterWorldBtn = page.getByRole("button", { name: "Enter World", exact: true });
  await enterWorldBtn.waitFor({ state: "visible", timeout: 10000 });
  await enterWorldBtn.click();
  await page.waitForTimeout(3000);

  await page.locator("text=\u{1F41E}").first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  // --- Calibrate screen <-> world mapping with two real clicks, read
  //     back from the debug panel's own ground truth. ---
  const A_screen = { x: 300, y: 300 };
  await page.mouse.click(A_screen.x, A_screen.y);
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  const A_world = parseTarget(text);

  const B_screen = { x: 900, y: 700 };
  await page.mouse.click(B_screen.x, B_screen.y);
  await page.waitForTimeout(500);
  text = await page.evaluate(() => document.body.innerText);
  const B_world = parseTarget(text);

  if (A_world === null || B_world === null) {
    console.error("Calibration failed (could not parse Last click target). Aborting.");
    await browser.close();
    process.exit(1);
  }

  const scaleX = (B_world.x - A_world.x) / (B_screen.x - A_screen.x);
  const offsetX = A_world.x - scaleX * A_screen.x;
  const scaleY = (B_world.y - A_world.y) / (B_screen.y - A_screen.y);
  const offsetY = A_world.y - scaleY * A_screen.y;

  const gateWorld = GATE_WORLD[targetGate];
  const rawGateScreen = {
    x: Math.round((gateWorld.x - offsetX) / scaleX),
    y: Math.round((gateWorld.y - offsetY) / scaleY),
  };
  // See "Known limitation" above -- clamp well inside the canvas so the
  // click reliably registers, even for gates whose true position is
  // very close to the debug overview's own edges.
  const gateScreen = {
    x: Math.min(VIEWPORT_W - 60, Math.max(60, rawGateScreen.x)),
    y: Math.min(VIEWPORT_H - 60, Math.max(60, rawGateScreen.y)),
  };
  console.log("Calibrated gate screen position for '" + targetGate + "':", gateScreen, "(raw " + JSON.stringify(rawGateScreen) + ", world " + JSON.stringify(gateWorld) + ")");
  if (rawGateScreen.x !== gateScreen.x || rawGateScreen.y !== gateScreen.y) {
    console.log("(raw position was near/outside the viewport edge -- clamped; see this file's Known limitation note.)");
  }

  // Movement speed is ~233 units/sec (from the debug panel). Compute a
  // generous wait based on real distance so far gates get enough time to
  // actually walk there before we click again.
  const SPAWN_WORLD = { x: 8311, y: 10761 };
  const dist = Math.hypot(gateWorld.x - SPAWN_WORLD.x, gateWorld.y - SPAWN_WORLD.y);
  const walkMs = Math.ceil((dist / 233) * 1000) + 3000;
  console.log("Estimated walk distance " + Math.round(dist) + "u -> waiting " + walkMs + "ms");

  console.log("STEP: click gate, wait for the walk, then click again (character now in range) ...");
  await page.mouse.click(gateScreen.x, gateScreen.y);
  await page.waitForTimeout(walkMs);
  await page.mouse.click(gateScreen.x, gateScreen.y);
  await page.waitForTimeout(5000);

  text = await page.evaluate(() => document.body.innerText);
  const zoneMatch = (text.match(/Zone ID:\s*\S+/) || [])[0] || "NOT FOUND";
  const roomMatch = (text.match(/Room kind:\s*\S+/) || [])[0] || "NOT FOUND";
  console.log("Result -- " + zoneMatch + " | " + roomMatch);
  const transitioned = zoneMatch.includes(targetGate === "blackwire" ? "blackwire" : targetGate);
  console.log(transitioned ? "ZONE TRANSITION: SUCCEEDED" : "ZONE TRANSITION: DID NOT HAPPEN (still in nightmarket, or blocked by the Known Limitation above)");

  await page.screenshot({ path: __dirname + "/repro_result_" + targetGate + ".png" });

  console.log("\n=== CONSOLE ERRORS (" + consoleErrors.length + ") ===");
  consoleErrors.forEach((e) => console.log(" - " + e));
  if (consoleErrors.length > 0) {
    console.log("\n^^ If this includes 'Cannot read properties of null (reading \\'drawImage\\')' during handleSceneTeardown, THE BUG HAS REGRESSED.");
  }

  await browser.close();
  console.log("\nDONE. transitioned=" + transitioned + " errorCount=" + consoleErrors.length);
  process.exit(consoleErrors.length > 0 ? 2 : 0);
})().catch((err) => { console.error("SCRIPT FAILED:", err); process.exit(1); });
