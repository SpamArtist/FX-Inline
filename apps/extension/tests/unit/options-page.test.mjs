/** @jest-environment jsdom */

import {
  createCurrencyOptions,
  mountOptionsPage,
} from "../../test-dist/entrypoints/options/optionsPage.js";

function createSettings(targetCurrency = "EUR") {
  return {
    schemaVersion: 1,
    generatedAt: "2026-04-28T00:00:00.000Z",
    scopes: {
      allUrls: {
        enabled: true,
        domain: "",
        pageUrl: "",
        targetCurrencies: [targetCurrency],
        convertedCurrencyPosition: "right",
        displayStyle: "brackets",
        highlightColor: "#fff1a8",
        extraSettings: {},
      },
      domains: {},
      pages: {},
    },
  };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("createCurrencyOptions sorts and labels currencies without UI framework coupling", () => {
  const options = createCurrencyOptions({
    of: (code) => `Currency ${code}`,
  });

  expect(options[0].code).toBe("AED");
  expect(options.map((option) => option.code)).toContain("INR");
  expect(options.find((option) => option.code === "INR")?.label).toBe(
    "🇮🇳 INR - Currency INR",
  );
});

test("mountOptionsPage loads persisted settings and writes preferred currency changes", async () => {
  document.body.innerHTML = "<div id=\"root\"></div>";
  const root = document.getElementById("root");
  let storedSettings = createSettings("INR");
  const writtenSettings = [];

  const mountedPage = mountOptionsPage(root, {
    readUserSettings: async () => storedSettings,
    writeUserSettings: async (settings) => {
      writtenSettings.push(settings);
      storedSettings = settings;
      return settings;
    },
  });

  await flushAsyncWork();

  const select = document.querySelector("#preferred-currency");
  expect(select.value).toBe("INR");

  select.value = "GBP";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await flushAsyncWork();

  expect(writtenSettings).toHaveLength(1);
  expect(writtenSettings[0].scopes.allUrls.targetCurrencies).toEqual(["GBP"]);
  expect(select.value).toBe("GBP");
  expect(
    document.querySelector(".fx-inline-options-status")?.textContent,
  ).toBe("Preferred currency updated to GBP.");

  mountedPage.destroy();
});
