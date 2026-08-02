import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@jest/globals";

import {
  ALLOWED_ISO_CURRENCY_CODES,
  AMBIGUOUS_ISO_CURRENCY_CODES,
} from "../src/iso-data.js";
import {
  DEFAULT_ALLOWED_CURRENCY_CODES,
  DEFAULT_WORD_LIKE_ISO_CODES,
} from "../src/data.js";
import * as packageIsoData from "@fx-inline/currency-detection/iso-data";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("token-only ISO data exports allowed and ambiguous codes", () => {
  expect(ALLOWED_ISO_CURRENCY_CODES).toHaveLength(146);
  expect(new Set(ALLOWED_ISO_CURRENCY_CODES).size).toBe(146);

  expect(AMBIGUOUS_ISO_CURRENCY_CODES).toEqual([
    "ALL",
    "TOP",
    "TRY",
    "MAD",
    "BAM",
    "BOB",
    "COP",
    "CUP",
    "GEL",
    "PEN",
  ]);

  for (const code of AMBIGUOUS_ISO_CURRENCY_CODES) {
    expect(ALLOWED_ISO_CURRENCY_CODES).toContain(code);
  }
});

test("package exposes token-only ISO data submodule", () => {
  expect(packageIsoData.ALLOWED_ISO_CURRENCY_CODES).toBe(ALLOWED_ISO_CURRENCY_CODES);
  expect(packageIsoData.AMBIGUOUS_ISO_CURRENCY_CODES).toBe(
    AMBIGUOUS_ISO_CURRENCY_CODES,
  );
});

test("parser data shares token-only ISO source", () => {
  expect(DEFAULT_ALLOWED_CURRENCY_CODES).toEqual(new Set(ALLOWED_ISO_CURRENCY_CODES));
  expect(DEFAULT_WORD_LIKE_ISO_CODES).toEqual(new Set(AMBIGUOUS_ISO_CURRENCY_CODES));
});

test("token-only ISO submodule does not import parser or magnitude runtime", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(packageRoot, "package.json"), "utf8"),
  );
  const isoSubmodule = packageJson.exports["./iso-data"];
  const isoDataSource = await readFile(resolve(packageRoot, isoSubmodule.import), "utf8");

  expect(isoSubmodule.import).toBe("./src/iso-data.js");
  expect(isoDataSource).not.toMatch(/parser-core|magnitude-profiles|data\.js/u);
});
