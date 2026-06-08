import Phaser from "phaser";

/**
 * Task 245 — Basic Player Combat Readability Batch.
 *
 * Adds clearer readability channels for local player combat events
 * without changing any combat systems, formulas, or server authority.
 *
 * The dedicated "vital feedback" channel is now variant-aware:
 *   - "damage" (red)   — incoming damage, with optional "DOWNED" header
 *   - "heal"   (green) — healing flask recovery
 *   - "dodge"  (cyan)  — dodge sent / accepted / cooldown / downed
 *
 * A separate small label text above the vital feedback renders the
 * "DOWNED" header when the player is downed, making the downed
 * transition instantly readable. No new UI system is added; the
 * existing container is reused.
 */

// Task 246 -- Distinct dodge rejection reason feedback.
//   - "sent"        -> dodge intent dispatched to the server
//   - "accepted"    -> server accepted the dodge
//   - "cooldown"    -> server rejected with `dodge_on_cooldown`
//   - "downed"      -> server rejected with `player_downed` (downed header shown)
//   - "no_direction"-> client could not derive a dodge direction (no recent move)
//   - "rejected"    -> generic server rejection or client-send failure
export type WorldSessionFeedbackVariant = "damage" | "heal" | "dodge";

export type WorldSessionDodgeFeedbackState =
  | "sent"
  | "accepted"
  | "cooldown"
  | "downed"
  | "no_direction"
  | "rejected";

export interface WorldSessionFeedbackView {
  readonly showNotice: (message: string) => void;
  readonly showAttackFeedback: (message: string) => void;
  readonly showDamageFeedback: (message: string, options?: { readonly isDowned?: boolean }) => void;
  readonly showHealFeedback: (message: string) => void;
  readonly showDodgeFeedback: (state: WorldSessionDodgeFeedbackState, message: string) => void;
  readonly showRareDropNotice: (message: string) => void;
  readonly clearDamageFeedback: () => void;
  readonly destroy: () => void;
}

export function createWorldSessionFeedbackView(scene: Phaser.Scene): WorldSessionFeedbackView {
  const container = scene.add.container(scene.scale.width / 2, 36);
  container.setDepth(1000);

  const noticeText = scene.add.text(0, 0, "", {
    color: "#f0ddbb",
    fontFamily: "Arial, sans-serif",
    fontSize: "13px",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 460 },
    backgroundColor: "rgba(20, 14, 10, 0.92)",
    padding: { left: 10, right: 10, top: 6, bottom: 6 },
  }).setOrigin(0.5, 0);

  const attackText = scene.add.text(0, 34, "", {
    color: "#ffd27e",
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
    align: "center",
    wordWrap: { width: 380 },
    backgroundColor: "rgba(48, 28, 12, 0.92)",
    padding: { left: 8, right: 8, top: 5, bottom: 5 },
  }).setOrigin(0.5, 0);

  // Small "DOWNED" header that only shows up when the player is downed.
  const downedHeader = scene.add.text(0, 66, "", {
    color: "#ffd0d0",
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 320 },
    backgroundColor: "rgba(92, 16, 16, 0.97)",
    padding: { left: 10, right: 10, top: 4, bottom: 4 },
  }).setOrigin(0.5, 0);

  // Shared vital feedback body — recolored per variant.
  const damageText = scene.add.text(0, 96, "", {
    color: "#ff9b9b",
    fontFamily: "Arial, sans-serif",
    fontSize: "15px",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 320 },
    backgroundColor: "rgba(68, 12, 12, 0.9)",
    padding: { left: 10, right: 10, top: 7, bottom: 7 },
  }).setOrigin(0.5, 0);

  const rareDropText = scene.add.text(0, 138, "", {
    color: "#8fc7ff",
    fontFamily: "Arial, sans-serif",
    fontSize: "15px",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 420 },
    backgroundColor: "rgba(10, 24, 48, 0.94)",
    padding: { left: 12, right: 12, top: 7, bottom: 7 },
  }).setOrigin(0.5, 0);

  container.add([noticeText, attackText, downedHeader, damageText, rareDropText]);

  let noticeTimer: Phaser.Time.TimerEvent | null = null;
  let attackTimer: Phaser.Time.TimerEvent | null = null;
  let damageTimer: Phaser.Time.TimerEvent | null = null;
  let downedHeaderTimer: Phaser.Time.TimerEvent | null = null;
  let rareDropTimer: Phaser.Time.TimerEvent | null = null;

  const clearTimer = (timer: Phaser.Time.TimerEvent | null): void => {
    if (timer !== null) {
      scene.time.removeEvent(timer);
    }
  };

  const clearDamageFeedback = (): void => {
    damageText.setText("");
    downedHeader.setText("");
    clearTimer(damageTimer);
    damageTimer = null;
    clearTimer(downedHeaderTimer);
    downedHeaderTimer = null;
  };

  const applyVariantStyle = (variant: WorldSessionFeedbackVariant, isDowned: boolean): void => {
    if (variant === "heal") {
      damageText.setColor("#bff5c0");
      damageText.setBackgroundColor("rgba(12, 56, 28, 0.94)");
      return;
    }
    if (variant === "dodge") {
      damageText.setColor("#bce8ff");
      damageText.setBackgroundColor("rgba(10, 36, 60, 0.94)");
      return;
    }
    // damage
    damageText.setColor(isDowned ? "#ffd0d0" : "#ff9b9b");
    damageText.setBackgroundColor(isDowned ? "rgba(92, 16, 16, 0.97)" : "rgba(68, 12, 12, 0.94)");
  };

  const showDownedHeader = (): void => {
    downedHeader.setText("DOWNED");
    clearTimer(downedHeaderTimer);
    downedHeaderTimer = scene.time.delayedCall(2500, () => {
      downedHeader.setText("");
      downedHeaderTimer = null;
    });
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
      const isDowned = options?.isDowned === true;
      applyVariantStyle("damage", isDowned);
      damageText.setText(message);
      clearTimer(damageTimer);
      if (isDowned) {
        showDownedHeader();
      } else {
        downedHeader.setText("");
        clearTimer(downedHeaderTimer);
        downedHeaderTimer = null;
      }
      damageTimer = scene.time.delayedCall(isDowned ? 2500 : 1400, () => {
        damageText.setText("");
        damageTimer = null;
        if (isDowned) {
          downedHeader.setText("");
          downedHeaderTimer = null;
        }
      });
    },
    showHealFeedback: (message: string) => {
      applyVariantStyle("heal", false);
      downedHeader.setText("");
      clearTimer(downedHeaderTimer);
      downedHeaderTimer = null;
      damageText.setText(message);
      clearTimer(damageTimer);
      damageTimer = scene.time.delayedCall(1500, () => {
        damageText.setText("");
        damageTimer = null;
      });
    },
    showDodgeFeedback: (state, message) => {
      applyVariantStyle("dodge", false);
      downedHeader.setText("");
      clearTimer(downedHeaderTimer);
      downedHeaderTimer = null;
      damageText.setText(message);
      clearTimer(damageTimer);
      if (state === "downed") {
        showDownedHeader();
      }
      damageTimer = scene.time.delayedCall(state === "accepted" ? 900 : 1500, () => {
        damageText.setText("");
        damageTimer = null;
        if (state === "downed") {
          downedHeader.setText("");
          downedHeaderTimer = null;
        }
      });
    },
    showRareDropNotice: (message: string) => {
      rareDropText.setText(message);
      clearTimer(rareDropTimer);
      rareDropTimer = scene.time.delayedCall(4000, () => {
        rareDropText.setText("");
        rareDropTimer = null;
      });
    },
    clearDamageFeedback,
    destroy: () => {
      clearTimer(noticeTimer);
      clearTimer(attackTimer);
      clearTimer(damageTimer);
      clearTimer(downedHeaderTimer);
      clearTimer(rareDropTimer);
      container.destroy(true);
    },
  };
}
