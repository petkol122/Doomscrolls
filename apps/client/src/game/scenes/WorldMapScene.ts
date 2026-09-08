import Phaser from "phaser";
import { t } from "@doomscrolls/localization";
import type { CharacterId, SessionToken } from "@doomscrolls/shared";

import { readStoredSessionToken } from "../../auth/sessionStorage";
import type { AccountState } from "../../net/ApiClient";
import { enterWorldForCharacter } from "../../net/RealtimeClient";
import { createWorldMapView, type WorldMapView } from "./worldMap/worldMapView";

interface WorldMapSceneData {
  readonly account: AccountState;
  readonly characterId: CharacterId;
}

/**
 * Core 0.32 — World Map Foundation. A new, secondary, optional entry
 * point alongside `AccountShellScene`'s untouched "Enter World" button
 * (see docs/CORE_BUILD_0_32_PLAN.md, Question 4). Clicking an area's
 * marker performs the exact same real join `enterWorldForCharacter`
 * already performs for "Enter World" -- not a narrowed or mocked
 * version of it.
 */
export class WorldMapScene extends Phaser.Scene {
  private account: AccountState | null = null;
  private characterId: CharacterId | null = null;
  private view: WorldMapView | null = null;
  private joining = false;

  public constructor() {
    super("WorldMapScene");
  }

  public init(data: WorldMapSceneData): void {
    this.account = data.account;
    this.characterId = data.characterId;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#090706");

    this.view = createWorldMapView(
      (areaId) => {
        void this.handleAreaSelected(areaId);
      },
      () => {
        this.handleBack();
      },
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyView());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyView());
  }

  private async handleAreaSelected(_areaId: string): Promise<void> {
    if (this.joining || this.account === null || this.characterId === null) {
      return;
    }

    const sessionToken = readStoredSessionToken();
    if (sessionToken === null) {
      return;
    }

    this.joining = true;

    try {
      const joinedRoom = await enterWorldForCharacter(
        this.account.characters,
        this.characterId,
        sessionToken as SessionToken,
      );

      this.destroyView();
      this.scene.start("WorldSessionScene", {
        account: this.account,
        characterId: this.characterId,
        room: joinedRoom,
      });
    } catch {
      this.joining = false;
      window.alert(t("world_entry.join_failed"));
    }
  }

  private handleBack(): void {
    if (this.account === null) {
      return;
    }

    this.destroyView();
    this.scene.start("AccountShellScene", { account: this.account });
  }

  private destroyView(): void {
    this.view?.destroy();
    this.view = null;
  }
}
