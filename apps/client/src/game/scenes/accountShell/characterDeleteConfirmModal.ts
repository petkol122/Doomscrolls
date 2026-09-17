import { t } from "@doomscrolls/localization";
import type { CharacterSummary } from "@doomscrolls/shared";
import { createButton } from "./accountShellDom";

export function createCharacterDeleteConfirmModal(
  character: CharacterSummary,
  onConfirm: () => void,
  onCancel: () => void
): HTMLElement {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "flex";
  root.style.alignItems = "center";
  root.style.justifyContent = "center";
  root.style.background = "rgba(0, 0, 0, 0.6)";
  root.style.zIndex = "10";
  root.style.fontFamily = "Arial, sans-serif";

  const panel = document.createElement("section");
  panel.style.width = "min(420px, calc(100vw - 32px))";
  panel.style.padding = "22px";
  panel.style.border = "1px solid #8d3a2f";
  panel.style.borderRadius = "12px";
  panel.style.background = "rgba(18, 12, 10, 0.98)";
  panel.style.color = "#d8c6a3";
  panel.style.boxShadow = "0 20px 70px rgba(0, 0, 0, 0.55)";

  const title = document.createElement("h2");
  title.textContent = t("character.delete_confirm_title");
  title.style.margin = "0 0 12px";
  title.style.fontFamily = "Georgia, serif";
  title.style.color = "#ff9c8a";
  panel.appendChild(title);

  const body = document.createElement("p");
  body.textContent = t("character.delete_confirm_body", { characterName: character.characterName });
  body.style.margin = "0 0 18px";
  panel.appendChild(body);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "10px";
  actions.style.justifyContent = "flex-end";

  const cancelButton = createButton(t("character.delete_cancel"));
  cancelButton.style.marginTop = "0";
  cancelButton.style.background = "#3a2f22";
  cancelButton.addEventListener("click", onCancel);
  actions.appendChild(cancelButton);

  const confirmButton = createButton(t("character.delete_confirm_action"));
  confirmButton.style.marginTop = "0";
  confirmButton.style.background = "#7a2418";
  confirmButton.style.borderColor = "#c14a35";
  confirmButton.addEventListener("click", onConfirm);
  actions.appendChild(confirmButton);

  panel.appendChild(actions);
  root.appendChild(panel);

  return root;
}
