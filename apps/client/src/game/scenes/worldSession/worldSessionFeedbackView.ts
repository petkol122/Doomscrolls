import Phaser from "phaser";

export interface WorldSessionFeedbackView {
  readonly showNotice: (message: string) => void;
  readonly showAttackFeedback: (message: string) => void;
  readonly showDamageFeedback: (message: string, options?: { readonly isDowned?: boolean }) => void;
  readonly clearDamageFeedback: () => void;
  readonly destroy: () => void;
}

export function createWorldSessionFeedbackView(scene: Phaser.Scene): WorldSessionFeedbackView {
  const container = scene.add.container(scene.scale.width / 2, 26);
  container.setDepth(1000);

  const noticeText = scene.add.text(0, 0, "", {
    color: "#d8c6a3",
    fontFamily: "Arial, sans-serif",
    fontSize: "13px",
    align: "center",
    wordWrap: { width: 420 },
    backgroundColor: "rgba(13, 10, 8, 0.88)",
    padding: { left: 10, right: 10, top: 6, bottom: 6 },
  }).setOrigin(0.5, 0);

  const attackText = scene.add.text(0, 30, "", {
    color: "#e0b870",
    fontFamily: "Arial, sans-serif",
    fontSize: "13px",
    align: "center",
    wordWrap: { width: 320 },
    backgroundColor: "rgba(32, 19, 10, 0.92)",
    padding: { left: 10, right: 10, top: 6, bottom: 6 },
  }).setOrigin(0.5, 0);

  const damageText = scene.add.text(0, 60, "", {
    color: "#ff9b9b",
    fontFamily: "Arial, sans-serif",
    fontSize: "15px",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 360 },
    backgroundColor: "rgba(68, 12, 12, 0.94)",
    padding: { left: 12, right: 12, top: 8, bottom: 8 },
  }).setOrigin(0.5, 0);

  container.add([noticeText, attackText, damageText]);

  let noticeTimer: Phaser.Time.TimerEvent | null = null;
  let attackTimer: Phaser.Time.TimerEvent | null = null;
  let damageTimer: Phaser.Time.TimerEvent | null = null;

  const clearTimer = (timer: Phaser.Time.TimerEvent | null): void => {
    if (timer !== null) {
      scene.time.removeEvent(timer);
    }
  };

  const clearDamageFeedback = (): void => {
    damageText.setText("");
    clearTimer(damageTimer);
    damageTimer = null;
  };

  return {
    showNotice: (message: string) => {
      noticeText.setText(message);
      clearTimer(noticeTimer);
      noticeTimer = scene.time.delayedCall(3000, () => {
        noticeText.setText("");
        noticeTimer = null;
      });
    },
    showAttackFeedback: (message: string) => {
      attackText.setText(message);
      clearTimer(attackTimer);
      attackTimer = scene.time.delayedCall(1500, () => {
        attackText.setText("");
        attackTimer = null;
      });
    },
    showDamageFeedback: (message: string, options) => {
      damageText.setColor(options?.isDowned ? "#ffd0d0" : "#ff9b9b");
      damageText.setBackgroundColor(options?.isDowned ? "rgba(92, 16, 16, 0.97)" : "rgba(68, 12, 12, 0.94)");
      damageText.setText(message);
      clearTimer(damageTimer);
      damageTimer = scene.time.delayedCall(options?.isDowned ? 2500 : 1400, () => {
        damageText.setText("");
        damageTimer = null;
      });
    },
    clearDamageFeedback,
    destroy: () => {
      clearTimer(noticeTimer);
      clearTimer(attackTimer);
      clearTimer(damageTimer);
      container.destroy(true);
    },
  };
}