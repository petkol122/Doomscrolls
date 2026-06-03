import type { AccountState } from "../../../net/ApiClient";

export function createAccountHeader(account: AccountState): HTMLElement {
  const container = document.createElement("div");

  const title = document.createElement("h1");
  title.textContent = account.profile.displayName;
  title.style.margin = "0";
  title.style.fontFamily = "Georgia, serif";
  container.appendChild(title);

  const username = document.createElement("p");
  username.textContent = `@${account.user.username}`;
  username.style.margin = "8px 0 18px";
  username.style.color = "#a88d63";
  container.appendChild(username);

  return container;
}