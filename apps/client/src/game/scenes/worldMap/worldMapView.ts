import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { contentRegistry } from "@doomscrolls/content";
import { t } from "@doomscrolls/localization";
import { createLocalWithLiveFallbackTileLayer } from "./worldMapTileLayer";

// Core 0.32 — World Map Foundation. A full-screen, always-interactive
// DOM overlay (no Phaser world content behind it to click through to,
// unlike WorldSessionScene's passive-root convention -- see
// docs/CORE_BUILD_0_32_PLAN.md, Question 4) hosting a real Leaflet map
// centered on the regional context around Pilsen, with exactly one
// marker (read from the content registry, not hardcoded), bounded
// pan/zoom, and a Back control that returns without joining anything.

const REGIONAL_CONTEXT_CENTER: L.LatLngTuple = [49.9, 15.0];
const REGIONAL_CONTEXT_ZOOM = 6;
const MIN_ZOOM = 5;
const MAX_ZOOM = 13;
// Padded regional box (Czech Republic + margins), matching the cached
// regional-context band with a small pad -- see Question 6's "Bounded
// panning and zoom".
const MAX_BOUNDS: L.LatLngBoundsExpression = [
  [47.0, 10.5],
  [52.5, 20.0],
];

export interface WorldMapView {
  readonly root: HTMLDivElement;
  destroy(): void;
}

export function createWorldMapView(onAreaSelected: (areaId: string) => void, onBack: () => void): WorldMapView {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.pointerEvents = "auto";
  root.style.fontFamily = "Arial, sans-serif";

  const header = document.createElement("div");
  header.style.position = "absolute";
  header.style.top = "16px";
  header.style.left = "16px";
  header.style.zIndex = "1000";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.gap = "10px";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.textContent = t("world_map.back");
  backButton.style.padding = "10px 14px";
  backButton.style.border = "1px solid #8d6a35";
  backButton.style.borderRadius = "8px";
  backButton.style.background = "#5a311f";
  backButton.style.color = "#ffe6bd";
  backButton.style.cursor = "pointer";
  backButton.style.font = "inherit";
  backButton.addEventListener("click", () => {
    onBack();
  });
  header.appendChild(backButton);

  const title = document.createElement("span");
  title.textContent = t("world_map.title");
  title.style.color = "#d8c6a3";
  title.style.fontSize = "16px";
  title.style.fontWeight = "bold";
  title.style.textShadow = "0 1px 4px rgba(0,0,0,0.6)";
  header.appendChild(title);

  const mapContainer = document.createElement("div");
  mapContainer.style.position = "absolute";
  mapContainer.style.inset = "0";
  mapContainer.id = "doomscrolls-world-map";

  root.appendChild(mapContainer);
  root.appendChild(header);
  document.body.appendChild(root);

  const map = L.map(mapContainer, {
    center: REGIONAL_CONTEXT_CENTER,
    zoom: REGIONAL_CONTEXT_ZOOM,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    maxBounds: MAX_BOUNDS,
    maxBoundsViscosity: 1.0,
  });

  const tileLayer = createLocalWithLiveFallbackTileLayer("/assets/map_tiles/pilsen/{z}/{x}/{y}.png");
  tileLayer.addTo(map);

  // Every area currently in the registry gets a marker -- today that's
  // exactly one (Pilsen). No drill-down navigation: with one entry at
  // every level of the world/continent/area hierarchy there is nothing
  // to navigate between yet (Question 4).
  for (const area of contentRegistry.areas.all) {
    const marker = L.marker([area.latitude, area.longitude]).addTo(map);
    marker.bindPopup(t(area.nameKey));
    marker.on("click", () => {
      onAreaSelected(area.id);
    });
  }

  return {
    root,
    destroy(): void {
      map.remove();
      root.remove();
    },
  };
}
