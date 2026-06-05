export function shouldIgnoreWorldSessionCombatHotkey(): boolean {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return false;
  }

  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    return true;
  }

  if (activeElement instanceof HTMLSelectElement) {
    return true;
  }

  return activeElement.isContentEditable;
}