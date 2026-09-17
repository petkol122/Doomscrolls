import { theme } from "./theme";

export function createInfoLine(label: string, value: string): HTMLElement {
  const line = document.createElement("p");
  line.style.margin = "8px 0";

  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  line.appendChild(strong);
  line.append(document.createTextNode(value));

  return line;
}

function styleInput(input: HTMLInputElement | HTMLSelectElement): void {
  input.style.padding = "10px 12px";
  input.style.border = `1px solid ${theme.color.inputBorder}`;
  input.style.borderRadius = theme.radius.control;
  input.style.background = theme.color.inputBg;
  input.style.color = "#f0dec0";
  input.style.font = "inherit";
  input.style.transition = "border-color 120ms ease";
}

export function createInput(
  labelText: string,
  id: string,
  type: "password" | "text" = "text"
): { readonly wrapper: HTMLElement; readonly input: HTMLInputElement; readonly errorLine: HTMLParagraphElement } {
  const wrapper = document.createElement("label");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "6px";
  wrapper.style.fontSize = "14px";
  wrapper.setAttribute("for", id);

  const labelSpan = document.createElement("span");
  labelSpan.textContent = labelText;
  wrapper.appendChild(labelSpan);

  const input = document.createElement("input");
  input.id = id;
  input.type = type;
  input.autocomplete = type === "password" ? "current-password" : "off";
  styleInput(input);
  input.addEventListener("focus", () => {
    input.style.borderColor = theme.color.inputBorderFocus;
  });
  input.addEventListener("blur", () => {
    input.style.borderColor = theme.color.inputBorder;
  });
  wrapper.appendChild(input);

  const errorLine = document.createElement("p");
  errorLine.style.margin = "0";
  errorLine.style.minHeight = "16px";
  errorLine.style.fontSize = "12px";
  errorLine.style.color = theme.color.textError;
  wrapper.appendChild(errorLine);

  return { wrapper, input, errorLine };
}

export function setInputError(
  input: HTMLInputElement,
  errorLine: HTMLParagraphElement,
  message: string
): void {
  errorLine.textContent = message;
  input.style.borderColor = message === "" ? theme.color.inputBorder : theme.color.inputBorderError;
}

export function createFixedOptionSelect(
  labelText: string,
  id: string,
  value: string,
  optionText: string
): { readonly wrapper: HTMLElement; readonly select: HTMLSelectElement } {
  const wrapper = document.createElement("label");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "6px";
  wrapper.style.fontSize = "14px";
  wrapper.setAttribute("for", id);
  wrapper.textContent = labelText;

  const select = document.createElement("select");
  select.id = id;
  styleInput(select);

  const option = document.createElement("option");
  option.value = value;
  option.textContent = optionText;
  select.appendChild(option);
  wrapper.appendChild(select);

  return { wrapper, select };
}

export function createButton(
  label: string,
  variant: "primary" | "danger" | "ghost" = "primary"
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.marginTop = "12px";
  button.style.padding = "11px 14px";
  button.style.borderRadius = theme.radius.control;
  button.style.cursor = "pointer";
  button.style.font = "inherit";
  button.style.fontWeight = "600";
  button.style.transition = "opacity 120ms ease";

  if (variant === "danger") {
    button.style.border = `1px solid ${theme.color.buttonDangerBorder}`;
    button.style.background = theme.color.buttonDangerBg;
    button.style.color = theme.color.buttonDangerText;
  } else if (variant === "ghost") {
    button.style.border = `1px solid ${theme.color.borderSubtle}`;
    button.style.background = "transparent";
    button.style.color = theme.color.textBody;
  } else {
    button.style.border = `1px solid ${theme.color.buttonBorder}`;
    button.style.background = theme.color.buttonBg;
    button.style.color = theme.color.buttonText;
  }

  return button;
}

export function createToggleSwitch(
  labelText: string,
  id: string,
  checked: boolean
): { readonly wrapper: HTMLElement; readonly checkbox: HTMLInputElement } {
  const wrapper = document.createElement("label");
  wrapper.setAttribute("for", id);
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";
  wrapper.style.fontSize = "13px";
  wrapper.style.color = theme.color.textSecondary;
  wrapper.style.cursor = "pointer";
  wrapper.style.userSelect = "none";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = id;
  checkbox.checked = checked;
  checkbox.style.width = "16px";
  checkbox.style.height = "16px";
  checkbox.style.accentColor = theme.color.buttonBorder;
  wrapper.appendChild(checkbox);

  const labelSpan = document.createElement("span");
  labelSpan.textContent = labelText;
  wrapper.appendChild(labelSpan);

  return { wrapper, checkbox };
}
