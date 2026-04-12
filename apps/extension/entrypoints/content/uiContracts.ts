export const CONTENT_UI_DROPDOWN_MENU_CLASS = "ccx-dropdown-menu-content";

export const CONTENT_UI_CAPTURE_EVENT_TYPES = [
  "pointerdown",
  "mousedown",
  "click",
  "contextmenu",
] as const;

function getEventElementTarget(target: EventTarget | null): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

export function hasContentRuntimeUiContractTarget(params: {
  target: EventTarget | null;
  containsSelectionPopupTarget: (target: Node) => boolean;
}): boolean {
  const { target, containsSelectionPopupTarget } = params;
  if (!(target instanceof Node)) return false;
  if (containsSelectionPopupTarget(target)) return true;

  const elementTarget = getEventElementTarget(target);
  if (!elementTarget) return false;

  return Boolean(elementTarget.closest(`.${CONTENT_UI_DROPDOWN_MENU_CLASS}`));
}

export function withContentUiDropdownContractClassName(
  ...classNames: Array<string | undefined>
): string {
  return [CONTENT_UI_DROPDOWN_MENU_CLASS, ...classNames.filter(Boolean)].join(" ");
}

