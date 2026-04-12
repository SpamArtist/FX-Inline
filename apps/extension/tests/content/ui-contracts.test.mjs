import {
  CONTENT_UI_CAPTURE_EVENT_TYPES,
  CONTENT_UI_DROPDOWN_MENU_CLASS,
  hasContentRuntimeUiContractTarget,
  withContentUiDropdownContractClassName,
} from "../../test-dist/entrypoints/content/uiContracts.js";

test("dropdown contract class helper includes shared class name", () => {
  const className = withContentUiDropdownContractClassName("ccx-radix-dropdown-content");

  expect(className).toContain(CONTENT_UI_DROPDOWN_MENU_CLASS);
  expect(className).toContain("ccx-radix-dropdown-content");
});

test("runtime ui guard detects popup and dropdown targets", () => {
  const popupNode = document.createElement("div");
  popupNode.className = "popup-node";
  const dropdownNode = document.createElement("div");
  dropdownNode.className = CONTENT_UI_DROPDOWN_MENU_CLASS;
  const plainNode = document.createElement("div");

  expect(
    hasContentRuntimeUiContractTarget({
      target: popupNode,
      containsSelectionPopupTarget: (target) => target === popupNode,
    }),
  ).toBe(true);

  expect(
    hasContentRuntimeUiContractTarget({
      target: dropdownNode,
      containsSelectionPopupTarget: () => false,
    }),
  ).toBe(true);

  expect(
    hasContentRuntimeUiContractTarget({
      target: plainNode,
      containsSelectionPopupTarget: () => false,
    }),
  ).toBe(false);
});

test("capture event contract remains explicit and shared", () => {
  expect(CONTENT_UI_CAPTURE_EVENT_TYPES).toEqual([
    "pointerdown",
    "mousedown",
    "click",
    "contextmenu",
  ]);
});

