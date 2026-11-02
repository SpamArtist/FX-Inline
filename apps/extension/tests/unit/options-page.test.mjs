/** @jest-environment jsdom */

import { jest } from "@jest/globals";

const getUILanguage = jest.fn(() => "en-US");
const getMessage = jest.fn(() => "");

jest.unstable_mockModule("wxt/browser", () => ({
  browser: { i18n: { getUILanguage, getMessage } },
}));

const {
  createCurrencyOptions,
  mountOptionsPage,
} = await import("../../test-dist/entrypoints/options/optionsPage.js");

beforeEach(() => {
  getUILanguage.mockReturnValue("en-US");
  getMessage.mockReturnValue("");
});

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

test("Swedish browser language selects built-in currency names with English message fallback", async () => {
  getUILanguage.mockReturnValue("sv-FI");
  document.body.innerHTML = "<div id=\"root\"></div>";
  const mountedPage = mountOptionsPage(document.getElementById("root"), {
    readUserSettings: async () => createSettings("SEK"),
    writeUserSettings: async (settings) => settings,
  });
  await flushAsyncWork();

  const sekOption = document.querySelector("option[value=SEK]");
  const expectedName = new Intl.DisplayNames(["sv"], { type: "currency" }).of("SEK");
  expect(sekOption.textContent).toContain(expectedName);
  expect(document.querySelector("label").textContent).toBe("Preferred Currency");

  mountedPage.destroy();
});
