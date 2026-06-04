import Phaser from "phaser";

export interface WorldSessionFeedbackView {
  readonly showNotice: (message: string) => void;
  readonly showAttackFeedback: (message: string) => void;
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

  container.add([noticeText, attackText]);

  let noticeTimer: Phaser.Time.TimerEvent | null = null;
  let attackTimer: Phaser.Time.TimerEvent | null = null;

  const clearTimer = (timer: Phaser.Time.TimerEvent | null): void => {
    if (timer !== null) {
      scene.time.removeEvent(timer);
    }
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
    destroy: () => {
      clearTimer(noticeTimer);
      clearTimer(attackTimer);
      container.destroy(true);
    },
  };
}