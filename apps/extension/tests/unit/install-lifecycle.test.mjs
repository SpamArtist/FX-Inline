import { shouldOpenWelcomePage } from "../../test-dist/utils/installLifecycle.js";

test("shouldOpenWelcomePage returns true for a fresh install reason", () => {
  expect(shouldOpenWelcomePage("install")).toBe(true);
});

test("shouldOpenWelcomePage returns false for update reasons", () => {
  expect(shouldOpenWelcomePage("update")).toBe(false);
  expect(shouldOpenWelcomePage("browser_update")).toBe(false);
  expect(shouldOpenWelcomePage("shared_module_update")).toBe(false);
});

test("shouldOpenWelcomePage returns false when reason is missing", () => {
  expect(shouldOpenWelcomePage(undefined)).toBe(false);
});
