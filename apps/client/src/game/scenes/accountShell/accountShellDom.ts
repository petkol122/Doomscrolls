export function createInfoLine(label: string, value: string): HTMLElement {
  const line = document.createElement("p");
  line.style.margin = "8px 0";

  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  line.appendChild(strong);
  line.append(document.createTextNode(value));

  return line;
}

export function createInput(
  labelText: string,
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
  input.type = "text";
  input.autocomplete = "off";
  input.style.padding = "10px 12px";
  input.style.border = "1px solid #5f4a2f";
  input.style.borderRadius = "8px";
  input.style.background = "#130f0c";
  input.style.color = "#f0dec0";
  input.style.font = "inherit";
  wrapper.appendChild(input);

  return { wrapper, input };
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
  select.style.padding = "10px 12px";
  select.style.border = "1px solid #5f4a2f";
  select.style.borderRadius = "8px";
  select.style.background = "#130f0c";
  select.style.color = "#f0dec0";
  select.style.font = "inherit";

  const option = document.createElement("option");
  option.value = value;
  option.textContent = optionText;
  select.appendChild(option);
  wrapper.appendChild(select);

  return { wrapper, select };
}

/**
 * Core 0.9 -- a real multi-option select, for fields that now have more
 * than one choice (e.g. character class). `createFixedOptionSelect`
 * above stays as-is for fields that genuinely have exactly one choice
 * today (e.g. origin).
 */
export function createOptionSelect(
  labelText: string,
  id: string,
  options: readonly { readonly value: string; readonly label: string }[]
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
  select.style.padding = "10px 12px";
  select.style.border = "1px solid #5f4a2f";
  select.style.borderRadius = "8px";
  select.style.background = "#130f0c";
  select.style.color = "#f0dec0";
  select.style.font = "inherit";

  for (const optionDefinition of options) {
    const option = document.createElement("option");
    option.value = optionDefinition.value;
    option.textContent = optionDefinition.label;
    select.appendChild(option);
  }
  wrapper.appendChild(select);

  return { wrapper, select };
}

export function createButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.marginTop = "12px";
  button.style.padding = "11px 14px";
  button.style.border = "1px solid #8d6a35";
  button.style.borderRadius = "8px";
  button.style.background = "#5a311f";
  button.style.color = "#ffe6bd";
  button.style.cursor = "pointer";
  button.style.font = "inherit";
  return button;
}
