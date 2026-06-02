import Phaser from "phaser";

export class ShellScene extends Phaser.Scene {
  public constructor() {
    super("ShellScene");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#090706");

    this.add
      .text(640, 360, "Doomscrolls client booted", {
        color: "#d8c6a3",
        fontFamily: "Georgia, serif",
        fontSize: "32px"
      })
      .setOrigin(0.5);
  }
}