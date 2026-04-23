import { mergeUiSettings, sanitizeUiSettings } from "../../b2b-runtime/settings.js";

test("sanitizeUiSettings clamps values and rejects unsafe CSS tokens", () => {
  const sanitized = sanitizeUiSettings({
    fontScalePct: 999,
    fontWeight: 100,
    fontFamily: "Bad Font, url(javascript:alert(1))",
    fontColor: "background:url(javascript:1)",
    spacingEm: -3,
  });

  expect(sanitized.fontScalePct).toBe(200);
  expect(sanitized.fontWeight).toBe(300);
  expect(sanitized.fontFamily).toBe("inherit");
  expect(sanitized.fontColor).toBe("currentColor");
  expect(sanitized.spacingEm).toBe(0);
});

test("mergeUiSettings applies precedence defaults -> manifest -> remote -> runtime", () => {
  const merged = mergeUiSettings({
    manifestDefaults: {
      fontScalePct: 95,
      fontFamily: "Arial, sans-serif",
    },
    remoteSettings: {
      fontWeight: 650,
    },
    runtimeOverrides: {
      fontScalePct: 120,
    },
  });

  expect(merged.fontScalePct).toBe(120);
  expect(merged.fontFamily).toBe("Arial, sans-serif");
  expect(merged.fontWeight).toBe(650);
});
