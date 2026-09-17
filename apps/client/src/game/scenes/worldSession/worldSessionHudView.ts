import type { Room } from "@colyseus/sdk";
import type { CharacterSummary, RoomState as DoomscrollsRoomState } from "@doomscrolls/shared";

import { getCurrentPlayerPresence } from "../../../net/townRoomPresence";
import { makePassive } from "./worldSessionPointerEvents";

/**
 * Diablo-style resource globes: Health bottom-left, Mana bottom-right,
 * fixed to the viewport corners independent of the center HUD cluster
 * (belt/objectives/skill card in worldSessionOverlayView.ts). Kept in
 * its own module since it's a self-contained, purely-visual read of the
 * same synced `hp`/`maxHp`/`mana`/`maxMana` presence fields the old
 * center-cluster orbs used.
 */

const GLOBE_DIAMETER = "clamp(56px, 13vw, 96px)";
const GLOBE_CORNER_OFFSET = "clamp(10px, 3vw, 24px)";

export interface WorldSessionHudGlobesView {
  readonly root: HTMLElement;
  readonly update: (character: CharacterSummary | null, room: Room<DoomscrollsRoomState>) => void;
}

interface GlobeRefs {
  readonly shell: HTMLElement;
  readonly fill: HTMLElement;
  readonly text: HTMLElement;
}

export function createWorldSessionHudGlobesView(
  character: CharacterSummary | null,
  room: Room<DoomscrollsRoomState>,
): WorldSessionHudGlobesView {
  const root = document.createElement("div");
  makePassive(root);
  root.style.display = "contents";

  const health = createGlobe("left", "#7a2c2c", "linear-gradient(180deg, #d46262 0%, #7a1f1f 100%)");
  const mana = createGlobe("right", "#2c3c5a", "linear-gradient(180deg, #4a7ac4 0%, #1f3a6e 100%)");
  root.append(health.shell, mana.shell);

  const update = (nextCharacter: CharacterSummary | null, nextRoom: Room<DoomscrollsRoomState>): void => {
    const presence = getCurrentPlayerPresence(
      nextRoom.state as unknown as Record<string, unknown>,
      nextRoom.sessionId,
    );
    syncGlobe(health, presence?.hp, presence?.maxHp, presence?.lifeState === "downed");
    syncGlobe(mana, presence?.mana, presence?.maxMana, false);
  };

  update(character, room);

  return { root, update };
}

function createGlobe(corner: "left" | "right", ringColor: string, fillGradient: string): GlobeRefs {
  const shell = document.createElement("div");
  shell.style.position = "fixed";
  shell.style.bottom = GLOBE_CORNER_OFFSET;
  shell.style[corner] = GLOBE_CORNER_OFFSET;
  shell.style.width = GLOBE_DIAMETER;
  shell.style.height = GLOBE_DIAMETER;
  shell.style.borderRadius = "50%";
  shell.style.border = `3px solid ${ringColor}`;
  shell.style.background = "radial-gradient(circle at 50% 30%, rgba(20, 16, 16, 0.9) 0%, rgba(8, 8, 10, 0.95) 100%)";
  shell.style.overflow = "hidden";
  shell.style.boxShadow = "inset 0 0 14px rgba(0, 0, 0, 0.7), 0 4px 12px rgba(0, 0, 0, 0.45)";
  shell.style.pointerEvents = "none";
  shell.style.zIndex = "5";

  const fill = document.createElement("div");
  fill.style.position = "absolute";
  fill.style.left = "0";
  fill.style.right = "0";
  fill.style.bottom = "0";
  fill.style.height = "0%";
  fill.style.background = fillGradient;
  fill.style.transition = "height 0.3s ease, background 0.3s ease";
  shell.appendChild(fill);

  const text = document.createElement("div");
  text.style.position = "absolute";
  text.style.inset = "0";
  text.style.display = "flex";
  text.style.alignItems = "center";
  text.style.justifyContent = "center";
  text.style.textAlign = "center";
  text.style.color = "#f3e2c4";
  text.style.fontWeight = "bold";
  text.style.fontFamily = "monospace";
  text.style.fontSize = "clamp(9px, 2.4vw, 12px)";
  text.style.textShadow = "0 1px 3px rgba(0, 0, 0, 0.9)";
  text.style.padding = "0 4px";
  shell.appendChild(text);

  return { shell, fill, text };
}

function syncGlobe(refs: GlobeRefs, current: number | undefined, max: number | undefined, isDowned: boolean): void {
  const ratio = current !== undefined && max !== undefined && max > 0
    ? Math.max(0, Math.min(1, current / max))
    : null;

  refs.fill.style.height = ratio === null ? "0%" : `${ratio * 100}%`;
  if (isDowned) {
    refs.fill.style.background = "linear-gradient(180deg, #bf5252 0%, #7a1f1f 100%)";
  }

  refs.text.textContent = current === undefined || max === undefined
    ? "…"
    : `${Math.max(0, Math.round(current))} / ${Math.max(0, Math.round(max))}`;
  refs.shell.title = refs.text.textContent;
}
