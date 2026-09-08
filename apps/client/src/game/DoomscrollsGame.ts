import Phaser from "phaser";

import { AuthScene } from "./scenes/AuthScene";
import { AccountShellScene } from "./scenes/AccountShellScene";
import { BootScene } from "./scenes/BootScene";
import { PreloadScene } from "./scenes/PreloadScene";
import { WorldSessionScene } from "./scenes/WorldSessionScene";

export function createDoomscrollsGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#090706",
    scale: {
      // Core 0.25 -- RESIZE fills the actual browser viewport (no
      // letterboxing/dead space the way FIT's fixed 1280x720 logical
      // resolution did); the canvas and `scene.scale.width/height` track
      // the real viewport size, which world-area layout code
      // (`resolveWorldSessionAreaLayout`) already reads dynamically.
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight
    },
    scene: [BootScene, PreloadScene, AuthScene, AccountShellScene, WorldSessionScene]
  });
}