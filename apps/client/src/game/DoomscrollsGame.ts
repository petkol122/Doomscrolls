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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720
    },
    scene: [BootScene, PreloadScene, AuthScene, AccountShellScene, WorldSessionScene]
  });
}