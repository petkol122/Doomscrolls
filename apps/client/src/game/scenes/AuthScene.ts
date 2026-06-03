import { t } from "@doomscrolls/localization";
import Phaser from "phaser";

import { clearStoredSessionToken, readStoredSessionToken, storeSessionToken } from "../../auth/sessionStorage";
import { clientEnv } from "../../config/env";
import { ApiClient, ApiClientError, type AccountState, type ApiErrorCode } from "../../net/ApiClient";

type AuthMode = "register" | "login";

interface AuthFormElements {
  readonly root: HTMLDivElement;
  readonly status: HTMLParagraphElement;
  readonly registerUsername: HTMLInputElement;
  readonly registerDisplayName: HTMLInputElement;
  readonly registerPassword: HTMLInputElement;
  readonly registerButton: HTMLButtonElement;
  readonly loginUsername: HTMLInputElement;
  readonly loginPassword: HTMLInputElement;
  readonly loginButton: HTMLButtonElement;
}

export class AuthScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null;
  private apiClient: ApiClient | null = null;

  public constructor() {
    super("AuthScene");
  }

  public create(): void {
    this.cameras.main.setBackgroundColor("#090706");
    this.apiClient = clientEnv.apiUrl === undefined ? null : new ApiClient(clientEnv.apiUrl);

    this.add
      .text(640, 94, "Doomscrolls", {
        color: "#d8c6a3",
        fontFamily: "Georgia, serif",
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
      storeSessionToken(result.session.token);

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
      storeSessionToken(result.session.token);

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
    const root = document.createElement("div");
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.display = "flex";
    root.style.alignItems = "center";
    root.style.justifyContent = "center";
    root.style.pointerEvents = "none";
    root.style.fontFamily = "Arial, sans-serif";

    const panel = document.createElement("div");
    panel.style.width = "min(920px, calc(100vw - 32px))";
    panel.style.marginTop = "80px";
    panel.style.padding = "24px";
    panel.style.border = "1px solid #4d3f2a";
    panel.style.borderRadius = "12px";
    panel.style.background = "rgba(13, 10, 8, 0.94)";
    panel.style.color = "#d8c6a3";
    panel.style.boxShadow = "0 20px 70px rgba(0, 0, 0, 0.45)";
    panel.style.pointerEvents = "auto";
    root.appendChild(panel);

    const title = document.createElement("h1");
    title.textContent = t("auth.title");
    title.style.margin = "0 0 18px";
    title.style.fontFamily = "Georgia, serif";
    panel.appendChild(title);

    const columns = document.createElement("div");
    columns.style.display = "grid";
    columns.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    columns.style.gap = "20px";
    panel.appendChild(columns);

    const registerForm = this.createFormSection(t("auth.register_title"));
    const registerUsername = this.createInput(t("auth.username"), "text", "doomscrolls-register-username");
    const registerDisplayName = this.createInput(t("profile.display_name"), "text", "doomscrolls-register-display-name");
    const registerPassword = this.createInput(t("auth.password"), "password", "doomscrolls-register-password");
    const registerButton = this.createButton(t("auth.register"));
    registerForm.append(registerUsername.wrapper, registerDisplayName.wrapper, registerPassword.wrapper, registerButton);

    const loginForm = this.createFormSection(t("auth.login_title"));
    const loginUsername = this.createInput(t("auth.username"), "text", "doomscrolls-login-username");
    const loginPassword = this.createInput(t("auth.password"), "password", "doomscrolls-login-password");
    const loginButton = this.createButton(t("auth.login"));
    loginForm.append(loginUsername.wrapper, loginPassword.wrapper, loginButton);

    columns.append(registerForm, loginForm);

    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.style.minHeight = "24px";
    status.style.margin = "18px 0 0";
    status.style.color = "#d8c6a3";
    panel.appendChild(status);

    document.body.appendChild(root);

    return {
      root,
      status,
      registerUsername: registerUsername.input,
      registerDisplayName: registerDisplayName.input,
      registerPassword: registerPassword.input,
      registerButton,
      loginUsername: loginUsername.input,
      loginPassword: loginPassword.input,
      loginButton
    };
  }

  private createFormSection(titleText: string): HTMLElement {
    const section = document.createElement("section");
    section.style.display = "flex";
    section.style.flexDirection = "column";
    section.style.gap = "12px";

    const title = document.createElement("h2");
    title.textContent = titleText;
    title.style.margin = "0 0 4px";
    title.style.fontFamily = "Georgia, serif";
    title.style.fontSize = "24px";
    section.appendChild(title);

    return section;
  }

  private createInput(
    labelText: string,
    type: "password" | "text",
    id: string
  ): { readonly wrapper: HTMLElement; readonly input: HTMLInputElement } {
    const wrapper = document.createElement("label");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "6px";
    wrapper.style.fontSize = "14px";
    wrapper.setAttribute("for", id);
    wrapper.textContent = labelText;

    const input = document.createElement("input");
    input.id = id;
    input.type = type;
    input.autocomplete = type === "password" ? "current-password" : "username";
    input.style.padding = "10px 12px";
    input.style.border = "1px solid #5f4a2f";
    input.style.borderRadius = "8px";
    input.style.background = "#130f0c";
    input.style.color = "#f0dec0";
    input.style.font = "inherit";
    wrapper.appendChild(input);

    return { wrapper, input };
  }

  private createButton(label: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.marginTop = "4px";
    button.style.padding = "11px 14px";
    button.style.border = "1px solid #8d6a35";
    button.style.borderRadius = "8px";
    button.style.background = "#5a311f";
    button.style.color = "#ffe6bd";
    button.style.cursor = "pointer";
    button.style.font = "inherit";
    return button;
  }

  private setButtonsDisabled(elements: AuthFormElements, disabled: boolean): void {
    elements.registerButton.disabled = disabled;
    elements.loginButton.disabled = disabled;
  }

  private setStatus(elements: AuthFormElements, message: string, tone: "error" | "info"): void {
    elements.status.textContent = message;
    elements.status.style.color = tone === "error" ? "#ff9c8a" : "#d8c6a3";
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