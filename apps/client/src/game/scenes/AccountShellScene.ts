import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import { clearStoredSessionToken } from "../../auth/sessionStorage";
import type { AccountState } from "../../net/ApiClient";

interface AccountShellSceneData {
  readonly account: AccountState;
}

export class AccountShellScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private account: AccountState | null = null;

  public constructor() {
    super("AccountShellScene");
  }

  public init(data: AccountShellSceneData): void {
    this.account = data.account;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#090706");

    this.add
      .text(640, 96, "Doomscrolls", {
        color: "#d8c6a3",
        fontFamily: "Georgia, serif",
        fontSize: "44px"
      })
      .setOrigin(0.5);

    if (this.account === null) {
      clearStoredSessionToken();
      this.scene.start("AuthScene");
      return;
    }

    this.overlay = this.createAccountOverlay(this.account);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyOverlay());
  }

  private createAccountOverlay(account: AccountState): HTMLDivElement {
    const root = document.createElement("div");
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.display = "flex";
    root.style.alignItems = "center";
    root.style.justifyContent = "center";
    root.style.pointerEvents = "none";
    root.style.fontFamily = "Arial, sans-serif";

    const panel = document.createElement("section");
    panel.style.width = "min(620px, calc(100vw - 32px))";
    panel.style.marginTop = "72px";
    panel.style.padding = "24px";
    panel.style.border = "1px solid #4d3f2a";
    panel.style.borderRadius = "12px";
    panel.style.background = "rgba(13, 10, 8, 0.94)";
    panel.style.color = "#d8c6a3";
    panel.style.boxShadow = "0 20px 70px rgba(0, 0, 0, 0.45)";
    panel.style.pointerEvents = "auto";
    root.appendChild(panel);

    const title = document.createElement("h1");
    title.textContent = account.profile.displayName;
    title.style.margin = "0";
    title.style.fontFamily = "Georgia, serif";
    panel.appendChild(title);

    const username = document.createElement("p");
    username.textContent = `@${account.user.username}`;
    username.style.margin = "8px 0 18px";
    username.style.color = "#a88d63";
    panel.appendChild(username);

    panel.appendChild(this.createInfoLine(t("profile.display_name"), account.profile.displayName));
    panel.appendChild(this.createInfoLine(t("profile.avatar"), account.profile.avatarKey));

    const loaded = document.createElement("p");
    loaded.textContent = t("auth.account_loaded");
    loaded.style.margin = "18px 0";
    loaded.style.color = "#b9d49a";
    panel.appendChild(loaded);

    const characters = document.createElement("p");
    characters.textContent = account.characters.length === 0 ? t("auth.no_characters") : `${account.characters.length} character(s)`;
    characters.style.margin = "0 0 22px";
    panel.appendChild(characters);

    const logout = document.createElement("button");
    logout.type = "button";
    logout.textContent = t("auth.logout");
    logout.style.padding = "11px 14px";
    logout.style.border = "1px solid #8d6a35";
    logout.style.borderRadius = "8px";
    logout.style.background = "#5a311f";
    logout.style.color = "#ffe6bd";
    logout.style.cursor = "pointer";
    logout.style.font = "inherit";
    logout.addEventListener("click", () => {
      clearStoredSessionToken();
      this.destroyOverlay();
      this.scene.start("AuthScene");
    });
    panel.appendChild(logout);

    document.body.appendChild(root);
    return root;
  }

  private createInfoLine(label: string, value: string): HTMLElement {
    const line = document.createElement("p");
    line.style.margin = "8px 0";

    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    line.append(document.createTextNode(value));

    return line;
  }

  private destroyOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}