#!/usr/bin/env node
/**
 * Core 0.32 — World Map Foundation.
 *
 * Reusable tile-caching tool: given a real-world bounding box and a
 * list of zoom levels, computes the exact Slippy Map tile list,
 * fetches every tile from the public OpenStreetMap tile server, and
 * writes each PNG to `<out>/{z}/{x}/{y}.png` — the standard Slippy
 * Map directory layout, which is also exactly the URL template shape
 * Leaflet's `L.tileLayer` expects.
 *
 * This is a plain Node.js dev-only CLI tool -- not part of the
 * client's browser-targeted TypeScript build, not bundled, not run at
 * build/runtime. Run it once, by hand, whenever a real area's tiles
 * need (re-)caching.
 *
 * Reports the real tile count and real total/average byte size it
 * just fetched on every run -- the same "measure, don't estimate"
 * discipline this build's own plan (docs/CORE_BUILD_0_32_PLAN.md,
 * Question 6) was held to for Pilsen's own 179-tile set.
 *
 * Usage:
 *   node apps/client/scripts/downloadMapTiles.js \
 *     --minLat=<number> --maxLat=<number> \
 *     --minLon=<number> --maxLon=<number> \
 *     --zooms=<comma-separated zoom levels> \
 *     --out=<output directory> \
 *     [--concurrency=4] [--delayMs=60]
 *
 * Exact invocation used to produce Pilsen's real 179-tile cache
 * (two bands, run as two separate invocations into the same --out):
 *
 *   node apps/client/scripts/downloadMapTiles.js \
 *     --minLat=48.0 --maxLat=51.5 --minLon=11.5 --maxLon=19.0 \
 *     --zooms=5,6,7,8 \
 *     --out=apps/client/public/assets/map_tiles/pilsen
 *
 *   node apps/client/scripts/downloadMapTiles.js \
 *     --minLat=49.6184 --maxLat=49.8584 --minLon=13.1736 --maxLon=13.5736 \
 *     --zooms=9,10,11,12,13 \
 *     --out=apps/client/public/assets/map_tiles/pilsen
 *
 * OpenStreetMap usage-policy expectations for a run like this (see
 * https://operations.osmfoundation.org/policies/tiles/): identify with
 * a real User-Agent (done below), keep concurrency and request rate
 * modest (defaults below are deliberately conservative), and treat
 * this as a one-time or infrequent batch fetch, not sustained/scheduled
 * load -- this build's own design keeps the cached tiles as the
 * primary serving path specifically so normal play never repeats this
 * traffic (see docs/CORE_BUILD_0_32_PLAN.md, Question 6).
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

function parseArgs(argv) {
  const args = {};
  for (const raw of argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(raw);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

function requireNumberArg(args, name) {
  const value = Number(args[name]);
  if (!Number.isFinite(value)) {
    throw new Error(`Missing or invalid required argument: --${name}=<number>`);
  }
  return value;
}

function requireStringArg(args, name) {
  const value = args[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required argument: --${name}=<value>`);
  }
  return value;
}

// Standard Slippy Map tile math (Web Mercator).
function lonToTileX(lonDeg, zoom) {
  const n = Math.pow(2, zoom);
  return Math.floor(((lonDeg + 180) / 360) * n);
}
function latToTileY(latDeg, zoom) {
  const n = Math.pow(2, zoom);
  const latRad = (latDeg * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
}

function tilesForBBox(minLat, maxLat, minLon, maxLon, zoom) {
  const xMin = lonToTileX(minLon, zoom);
  const xMax = lonToTileX(maxLon, zoom);
  // Tile Y increases as latitude decreases (north is at the top).
  const yMin = latToTileY(maxLat, zoom);
  const yMax = latToTileY(minLat, zoom);
  const tiles = [];
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) {
      tiles.push({ z: zoom, x, y });
    }
  }
  return tiles;
}

function fetchTile(z, x, y) {
  return new Promise((resolve, reject) => {
    const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    https
      .get(
        url,
        {
          headers: {
            "User-Agent": "Doomscrolls-map-tile-cache-tool/1.0 (one-time/infrequent batch fetch; see apps/client/scripts/downloadMapTiles.js)"
          }
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`${url} -> HTTP ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve({ z, x, y, buffer: Buffer.concat(chunks) }));
        }
      )
      .on("error", reject);
  });
}

async function main() {
  const args = parseArgs(process.argv);

  const minLat = requireNumberArg(args, "minLat");
  const maxLat = requireNumberArg(args, "maxLat");
  const minLon = requireNumberArg(args, "minLon");
  const maxLon = requireNumberArg(args, "maxLon");
  const zooms = requireStringArg(args, "zooms")
    .split(",")
    .map((z) => Number(z.trim()))
    .filter((z) => Number.isFinite(z));
  const outDir = requireStringArg(args, "out");
  const concurrency = args.concurrency !== undefined ? Number(args.concurrency) : 4;
  const delayMs = args.delayMs !== undefined ? Number(args.delayMs) : 60;

  if (zooms.length === 0) {
    throw new Error("--zooms must list at least one zoom level, e.g. --zooms=5,6,7");
  }

  let tiles = [];
  for (const z of zooms) {
    tiles = tiles.concat(tilesForBBox(minLat, maxLat, minLon, maxLon, z));
  }

  console.log(`Computed ${tiles.length} tile(s) across zoom levels [${zooms.join(", ")}] for bbox ` +
    `lat [${minLat}, ${maxLat}], lon [${minLon}, ${maxLon}].`);

  const results = [];
  const errors = [];
  let index = 0;

  async function worker() {
    while (index < tiles.length) {
      const tile = tiles[index++];
      try {
        const fetched = await fetchTile(tile.z, tile.x, tile.y);
        const dir = path.join(outDir, String(tile.z), String(tile.x));
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${tile.y}.png`);
        fs.writeFileSync(filePath, fetched.buffer);
        results.push({ z: tile.z, x: tile.x, y: tile.y, bytes: fetched.buffer.length });
      } catch (err) {
        errors.push({ tile, error: String(err) });
      }
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);

  console.log(`Fetched: ${results.length} / ${tiles.length}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    console.log(JSON.stringify(errors, null, 2));
  }
  console.log(`Total bytes: ${totalBytes} (${(totalBytes / 1024).toFixed(1)} KB, ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
  if (results.length > 0) {
    console.log(`Average tile size: ${Math.round(totalBytes / results.length)} bytes`);
  }
  console.log(`Written under: ${path.resolve(outDir)}`);

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("downloadMapTiles failed:", err);
  process.exitCode = 1;
});
