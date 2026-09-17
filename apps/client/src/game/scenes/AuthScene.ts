import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import {
  clearStoredSessionToken,
  readRememberAccountPreference,
  readStoredSessionToken,
  storeSessionToken
} from "../../auth/sessionStorage";
import { clientEnv } from "../../config/env";
import { ApiClient, ApiClientError, type AccountState, type ApiErrorCode } from "../../net/ApiClient";
import { createButton, createInput, createToggleSwitch } from "./accountShell/accountShellDom";
import { theme } from "./accountShell/theme";
import { makeOverlayInteractive } from "./worldSession/worldSessionPointerEvents";

type AuthMode = "register" | "login";

interface AuthFormElements {
  readonly root: HTMLDivElement;
  readonly status: HTMLParagraphElement;
  readonly tabs: Readonly<Record<AuthMode, HTMLButtonElement>>;
  readonly panes: Readonly<Record<AuthMode, HTMLElement>>;
  readonly registerUsername: HTMLInputElement;
  readonly registerDisplayName: HTMLInputElement;
  readonly registerPassword: HTMLInputElement;
  readonly registerButton: HTMLButtonElement;
  readonly loginUsername: HTMLInputElement;
  readonly loginPassword: HTMLInputElement;
  readonly loginButton: HTMLButtonElement;
  readonly rememberAccount: HTMLInputElement;
}

export class AuthScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private apiClient: ApiClient | null = null;
  private mode: AuthMode = "login";

  public constructor() {
    super("AuthScene");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#090706");
    this.apiClient = clientEnv.apiUrl === undefined ? null : new ApiClient(clientEnv.apiUrl);

    this.add
      .text(this.scale.width / 2, 94, "Doomscrolls", {
        color: theme.color.textBody,
        fontFamily: theme.font.heading,
        fontSize: "44px"
      })
      .setOrigin(0.5);

    const elements = this.createAuthOverlay();
    this.overlay = elements.root;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyOverlay());

    if (this.apiClient === null) {
      this.setStatus(elements, t("auth.api_url_missing"), "error");
      this.setButtonsDisabled(elements, true);
      return;
    }

    elements.registerButton.addEventListener("click", () => {
      void this.submitRegister(elements);
    });
    elements.loginButton.addEventListener("click", () => {
      void this.submitLogin(elements);
    });

    void this.tryResumeSession(elements);
  }

  private async tryResumeSession(elements: AuthFormElements): Promise<void> {
    const token = readStoredSessionToken();
    if (token === null || this.apiClient === null) {
      return;
    }

    this.setButtonsDisabled(elements, true);
    this.setStatus(elements, t("auth.loading_session"), "info");

    try {
      const account = await this.apiClient.getMe(token);
      this.startAccountShell(account);
    } catch (error: unknown) {
      clearStoredSessionToken();
      this.setButtonsDisabled(elements, false);
      this.setStatus(elements, this.toSafeErrorMessage(error, "login"), "error");
    }
  }

  private async submitRegister(elements: AuthFormElements): Promise<void> {
    if (this.apiClient === null) {
      this.setStatus(elements, t("auth.api_url_missing"), "error");
      return;
    }

    this.setButtonsDisabled(elements, true);
    this.setStatus(elements, "", "info");

    try {
      const result = await this.apiClient.register({
        username: elements.registerUsername.value,
        displayName: elements.registerDisplayName.value,
        password: elements.registerPassword.value
      });
      storeSessionToken(result.session.token, elements.rememberAccount.checked);

      const account = await this.apiClient.getMe(result.session.token);
      this.startAccountShell(account);
    } catch (error: unknown) {
      this.setButtonsDisabled(elements, false);
      this.setStatus(elements, this.toSafeErrorMessage(error, "register"), "error");
    }
  }

  private async submitLogin(elements: AuthFormElements): Promise<void> {
    if (this.apiClient === null) {
      this.setStatus(elements, t("auth.api_url_missing"), "error");
      return;
    }

    this.setButtonsDisabled(elements, true);
    this.setStatus(elements, "", "info");

    try {
      const result = await this.apiClient.login({
        username: elements.loginUsername.value,
        password: elements.loginPassword.value
      });
      storeSessionToken(result.session.token, elements.rememberAccount.checked);

      const account = await this.apiClient.getMe(result.session.token);
      this.startAccountShell(account);
    } catch (error: unknown) {
      this.setButtonsDisabled(elements, false);
      this.setStatus(elements, this.toSafeErrorMessage(error, "login"), "error");
    }
  }

  private startAccountShell(account: AccountState): void {
    this.destroyOverlay();
    this.scene.start("AccountShellScene", { account });
  }

  private createAuthOverlay(): AuthFormElements {
    const root = makeOverlayInteractive(document.createElement("div"));
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "1000";
    root.style.display = "flex";
    root.style.alignItems = "center";
    root.style.justifyContent = "center";
    root.style.fontFamily = theme.font.body;

    const panel = makeOverlayInteractive(document.createElement("div"));
    panel.style.width = "min(420px, calc(100vw - 32px))";
    panel.style.marginTop = "80px";
    panel.style.padding = "24px";
    panel.style.border = `1px solid ${theme.color.border}`;
    panel.style.borderRadius = theme.radius.panel;
    panel.style.background = theme.color.panelBg;
    panel.style.color = theme.color.textBody;
    panel.style.boxShadow = theme.color.shadow;
    root.appendChild(panel);

    const title = document.createElement("h1");
    title.textContent = t("auth.title");
    title.style.margin = "0 0 18px";
    title.style.fontFamily = theme.font.heading;
    title.style.fontSize = "24px";
    title.style.color = theme.color.textHeading;
    panel.appendChild(title);

    const tabRow = document.createElement("div");
    tabRow.style.display = "flex";
    tabRow.style.gap = "8px";
    tabRow.style.marginBottom = "16px";
    panel.appendChild(tabRow);

    const loginTab = this.createTabButton(t("auth.login_title"));
    const registerTab = this.createTabButton(t("auth.register_title"));
    tabRow.append(loginTab, registerTab);

    const loginPane = this.createFormSection();
    const loginUsername = createInput(t("auth.username"), "doomscrolls-login-username");
    const loginPassword = createInput(t("auth.password"), "doomscrolls-login-password", "password");
    const loginButton = createButton(t("auth.login"));
    loginButton.style.width = "100%";
    loginPane.append(loginUsername.wrapper, loginPassword.wrapper, loginButton);

    const registerPane = this.createFormSection();
    const registerUsername = createInput(t("auth.username"), "doomscrolls-register-username");
    const registerDisplayName = createInput(t("profile.display_name"), "doomscrolls-register-display-name");
    const registerPassword = createInput(t("auth.password"), "doomscrolls-register-password", "password");
    const registerButton = createButton(t("auth.register"));
    registerButton.style.width = "100%";
    registerPane.append(
      registerUsername.wrapper,
      registerDisplayName.wrapper,
      registerPassword.wrapper,
      registerButton
    );

    panel.append(loginPane, registerPane);

    const rememberAccount = createToggleSwitch(
      t("auth.remember_account"),
      "doomscrolls-remember-account",
      readRememberAccountPreference()
    );
    rememberAccount.wrapper.style.margin = "14px 0 0";
    panel.appendChild(rememberAccount.wrapper);

    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.style.minHeight = "24px";
    status.style.margin = "14px 0 0";
    status.style.color = theme.color.textBody;
    panel.appendChild(status);

    document.body.appendChild(root);

    const elements: AuthFormElements = {
      root,
      status,
      tabs: { login: loginTab, register: registerTab },
      panes: { login: loginPane, register: registerPane },
      registerUsername: registerUsername.input,
      registerDisplayName: registerDisplayName.input,
      registerPassword: registerPassword.input,
      registerButton,
      loginUsername: loginUsername.input,
      loginPassword: loginPassword.input,
      loginButton,
      rememberAccount: rememberAccount.checkbox
    };

    loginTab.addEventListener("click", () => {
      this.setMode(elements, "login");
    });
    registerTab.addEventListener("click", () => {
      this.setMode(elements, "register");
    });
    this.setMode(elements, this.mode);

    return elements;
  }

  private setMode(elements: AuthFormElements, mode: AuthMode): void {
    this.mode = mode;
    for (const key of ["login", "register"] as const) {
      const isActive = key === mode;
      elements.panes[key].style.display = isActive ? "flex" : "none";
      elements.tabs[key].style.borderBottomColor = isActive ? theme.color.borderSelected : "transparent";
      elements.tabs[key].style.color = isActive ? theme.color.textHeading : theme.color.textMuted;
    }
  }

  private createTabButton(label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.flex = "1";
    button.style.padding = "8px 4px";
    button.style.border = "none";
    button.style.borderBottom = "2px solid transparent";
    button.style.background = "transparent";
    button.style.cursor = "pointer";
    button.style.font = "inherit";
    button.style.fontWeight = "600";
    return button;
  }

  private createFormSection(): HTMLElement {
    const section = document.createElement("section");
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "12px";
    return section;
  }

  private setButtonsDisabled(elements: AuthFormElements, disabled: boolean): void {
    elements.registerButton.disabled = disabled;
    elements.loginButton.disabled = disabled;
  }

  private setStatus(elements: AuthFormElements, message: string, tone: "error" | "info"): void {
    elements.status.textContent = message;
    elements.status.style.color = tone === "error" ? theme.color.textError : theme.color.textBody;
  }

  private toSafeErrorMessage(error: unknown, mode: AuthMode): string {
    if (!(error instanceof ApiClientError)) {
      return t("error.generic");
    }

    return this.toSafeApiErrorMessage(error.code, mode);
  }

  private toSafeApiErrorMessage(code: ApiErrorCode, mode: AuthMode): string {
    switch (code) {
      case "SERVER_UNAVAILABLE":
        return t("error.server_unavailable");
      case "VALIDATION_ERROR":
      case "INVALID_USERNAME":
      case "INVALID_PASSWORD":
      case "INVALID_DISPLAY_NAME":
        return mode === "register" ? t("error.invalid_register_input") : t("error.invalid_credentials");
      case "USERNAME_TAKEN":
        return t("error.duplicate_username");
      case "INVALID_CHARACTER_NAME":
      case "CHARACTER_NAME_TAKEN":
      case "INVALID_ORIGIN":
      case "INVALID_CLASS":
      case "ORIGIN_CLASS_NOT_ALLOWED":
      case "CHARACTER_NOT_FOUND":
        return t("error.generic");
      case "INVALID_CREDENTIALS":
        return t("error.invalid_credentials");
      case "SESSION_INVALID":
      case "SESSION_EXPIRED":
      case "AUTH_ERROR":
        return t("error.invalid_token");
      case "API_URL_MISSING":
        return t("auth.api_url_missing");
      case "ITEM_NOT_FOUND":
      case "ITEM_NOT_IN_INVENTORY":
      case "ITEM_NOT_EQUIPPABLE":
      case "SLOT_MISMATCH":
      case "INVENTORY_FULL":
      case "INTERNAL_ERROR":
      case "UNKNOWN_ERROR":
        return t("error.generic");
    }
  }

  private destroyOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }
}
