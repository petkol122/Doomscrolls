import L from "leaflet";

/**
 * Core 0.32 — local-cache-primary, live-OSM-fallback tile layer.
 *
 * Serves tiles from the locally cached path
 * (`apps/client/public/assets/map_tiles/pilsen/{z}/{x}/{y}.png`, see
 * `apps/client/scripts/downloadMapTiles.js`) as the primary path. A
 * tile request outside the cached box/zoom range 404s locally; this
 * layer catches that per-tile load failure and swaps that one tile's
 * request to the equivalent live `tile.openstreetmap.org` URL, so
 * panning slightly beyond the cached area still shows real map data
 * instead of a blank gap. The map's own `minZoom`/`maxZoom`/`maxBounds`
 * (set where this layer is used) keep that fallback a narrow, bounded
 * edge case rather than an open door to fetching the rest of the
 * world live — see docs/CORE_BUILD_0_32_PLAN.md, Question 6.
 */
const LIVE_OSM_URL_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const LocalWithLiveFallbackTileLayer = L.TileLayer.extend({
  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement("img");

    const localUrl = this.getTileUrl(coords);
    const fallbackUrl = LIVE_OSM_URL_TEMPLATE
      .replace("{z}", String(coords.z))
      .replace("{x}", String(coords.x))
      .replace("{y}", String(coords.y));

    tile.onload = () => done(undefined, tile);
    tile.onerror = () => {
      // Only fall back once per tile -- if the live server also fails,
      // let Leaflet's normal tileerror handling take over.
      tile.onerror = null;
      tile.src = fallbackUrl;
    };

    tile.src = localUrl;
    return tile;
  },
});

export function createLocalWithLiveFallbackTileLayer(localUrlTemplate: string): L.TileLayer {
  return new (LocalWithLiveFallbackTileLayer as unknown as new (url: string, options?: L.TileLayerOptions) => L.TileLayer)(
    localUrlTemplate,
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 13,
    },
  );
}
