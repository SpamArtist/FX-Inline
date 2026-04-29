/**
 * Audit guardrails sourced from /tmp/fx-inline-codex-audit.md.
 *
 * Two flavours of tests live here:
 *   - `test(...)`         – defensive guardrails. Pass today and must keep
 *                           passing. Catch regressions of audit findings that
 *                           are already fixed in tree.
 *   - `test.failing(...)` – pin a finding that is *not yet* fixed. The
 *                           assertion currently throws, so `test.failing`
 *                           reports as "passed" until somebody actually fixes
 *                           the underlying bug. At that point the test starts
 *                           failing (because the assertion now succeeds, which
 *                           contradicts `failing`); the fixer should convert
 *                           it to `test()`.
 *
 * Each block carries the audit anchor it traces to. Keep that pointer fresh
 * when audit numbering shifts.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ActionType, CurrencyCode } from "../../test-dist/utils/enums.js";
import { ISO_CODES } from "../../test-dist/utils/constants.js";
import {
  DEFAULT_INLINE_RUNTIME_SETTINGS,
  DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST,
  resolveInlineRuntimeSettingsForUrl,
  sanitizeInlineRuntimeSettings,
  sanitizeInlineRuntimeSettingsManifest,
} from "../../test-dist/utils/inlineRuntimeSettings.js";
import { reduceCurrencyState } from "../../test-dist/hooks/useCurrencyReducer.state.js";
import { normalizeRates } from "../../test-dist/utils/rates/validation.js";
import {
  extractCurrencyTextMatches,
  parseCurrencyValue,
} from "../../test-dist/utils/utils.js";
import { convertAmountWithSnapshot } from "../../test-dist/utils/rateMath/index.js";
import { getMarketDayKey } from "../../test-dist/utils/ratePolicy/index.js";

import {
  DEFAULT_ALLOWED_CURRENCY_CODES,
  DEFAULT_ISO_CODES,
} from "../../../../packages/currency-detection/src/data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function readRepoFile(relPath) {
  return readFileSync(path.resolve(REPO_ROOT, relPath), "utf8");
}

const FORBIDDEN_UNIT_OF_ACCOUNT_CODES = ["BOV", "COU", "VED"];
const ACTIVE_LATAM_CODES = ["BOB", "COP", "VES"];

function getCurrencyStateFromCode(code) {
  return { code, icon: `${code.toLowerCase()}.svg` };
}

function makeReducerContext(overrides = {}) {
  let idCounter = 0;
  return {
    preferredCurrency: CurrencyCode["UNITED STATES DOLLAR"],
    rateSnapshot: {
      base: "USD",
      fetchedAt: 0,
      rates: { USD: 1, EUR: 0.9, INR: 80 },
    },
    createCurrencyId: () => `id-${++idCounter}`,
    getCurrencyStateFromCode,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// §1.1 – Currency lists triple-source-of-truth
// ---------------------------------------------------------------------------

describe("audit §1.1 currency code triple-source-of-truth", () => {
  const enumValues = Array.from(new Set(Object.values(CurrencyCode)));

  test("every CurrencyCode value is accepted by the parser allowlist (DEFAULT_ALLOWED_CURRENCY_CODES)", () => {
    const missing = enumValues.filter((code) => !DEFAULT_ALLOWED_CURRENCY_CODES.has(code));
    expect(missing).toEqual([]);
  });

  // The audit (§1.1) calls out that the parser-side regex (DEFAULT_ISO_CODES)
  // and the runtime CurrencyCode enum drifted. Today BIF/XCG/SLE/SSP are
  // present in the enum but missing from the regex set – any "BIF 1000"
  // text on a page slips past extraction.
  test.failing(
    "every CurrencyCode value is matched by the parser regex (DEFAULT_ISO_CODES)",
    () => {
      const missing = enumValues.filter((code) => !DEFAULT_ISO_CODES.has(code));
      expect(missing).toEqual([]);
    },
  );

  test.failing(
    "every CurrencyCode value is documented in the extension ISO_CODES set",
    () => {
      const missing = enumValues.filter((code) => !ISO_CODES.has(code));
      expect(missing).toEqual([]);
    },
  );

  test.failing(
    "parser allowlist agrees with parser regex on every active code",
    () => {
      const allowedNotMatched = Array.from(DEFAULT_ALLOWED_CURRENCY_CODES).filter(
        (code) => !DEFAULT_ISO_CODES.has(code),
      );
      expect(allowedNotMatched).toEqual([]);
    },
  );

  test("none of the three currency lists carry non-circulating unit-of-account codes", () => {
    for (const code of FORBIDDEN_UNIT_OF_ACCOUNT_CODES) {
      expect(DEFAULT_ALLOWED_CURRENCY_CODES.has(code)).toBe(false);
      expect(DEFAULT_ISO_CODES.has(code)).toBe(false);
      expect(ISO_CODES.has(code)).toBe(false);
      expect(enumValues.includes(code)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// §1.1 – Bolivia / Colombia / Venezuela end-to-end
// ---------------------------------------------------------------------------

describe("audit §1.1 BOB / COP / VES end-to-end", () => {
  test("CurrencyCode resolves the active country code, not the unit-of-account code", () => {
    expect(CurrencyCode.BOLIVIA).toBe("BOB");
    expect(CurrencyCode.COLOMBIA).toBe("COP");
    expect(CurrencyCode.VENEZUELA).toBe("VES");
  });

  test("parser accepts each active code with a numeric amount", () => {
    for (const code of ACTIVE_LATAM_CODES) {
      const parsed = parseCurrencyValue(`${code} 1234.56`);
      expect(parsed).toEqual({ valid: true, value: 1234.56, currency: code });
    }
  });

  test("regex-driven extraction surfaces all three codes in mixed text", () => {
    const matches = extractCurrencyTextMatches(
      "Prices: BOB 10; COP 4000; VES 37.",
    );
    expect(matches.map((match) => match.currency)).toEqual(ACTIVE_LATAM_CODES);
  });

  test("snapshot normalizer keeps active codes and drops unit-of-account codes", () => {
    const normalized = normalizeRates({
      BOB: 6.9,
      COP: 4000,
      VES: 37,
      BOV: 1,
      COU: 2,
      VED: 3,
    });
    expect(normalized.BOB).toBeCloseTo(6.9);
    expect(normalized.COP).toBeCloseTo(4000);
    expect(normalized.VES).toBeCloseTo(37);
    for (const code of FORBIDDEN_UNIT_OF_ACCOUNT_CODES) {
      expect(normalized[code]).toBeUndefined();
    }
  });

  test("conversion math round-trips active codes against EUR via USD-base snapshot", () => {
    const snapshot = {
      base: "USD",
      fetchedAt: 0,
      rates: { USD: 1, EUR: 0.9, BOB: 6.9, COP: 4000, VES: 37 },
    };
    expect(convertAmountWithSnapshot(69, "BOB", "EUR", snapshot)).toBeCloseTo(9);
    expect(convertAmountWithSnapshot(4000, "COP", "EUR", snapshot)).toBeCloseTo(0.9);
    expect(convertAmountWithSnapshot(37, "VES", "EUR", snapshot)).toBeCloseTo(0.9);
  });
});

// ---------------------------------------------------------------------------
// §3.4 – CurrencyCode key hygiene
// ---------------------------------------------------------------------------

describe("audit §3.4 CurrencyCode key hygiene", () => {
  // Currently the enum exposes "TANZANIA= UNITED REPUBLIC OF" (literal `=` typo).
  // Once the enum is reshaped (or the typo removed) flip this back to `test`.
  test.failing("no enum key contains a literal '=' typo", () => {
    const malformed = Object.keys(CurrencyCode).filter((key) => key.includes("="));
    expect(malformed).toEqual([]);
  });

  test("every key uppercases cleanly (no lower-case stragglers)", () => {
    const stragglers = Object.keys(CurrencyCode).filter(
      (key) => key !== key.toUpperCase(),
    );
    expect(stragglers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §1.8 – Generated manifest schema parity
// ---------------------------------------------------------------------------

describe("audit §1.8 generated runtime settings manifest", () => {
  const GENERATED_PATH = "apps/extension/generated/inlineRuntimeSettingsManifest.ts";

  function loadGeneratedManifest() {
    const source = readRepoFile(GENERATED_PATH);
    const match = source.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!match) {
      throw new Error("Could not extract JSON literal from generated manifest");
    }
    return JSON.parse(match[1]);
  }

  const REQUIRED_KEYS = Object.keys(DEFAULT_INLINE_RUNTIME_SETTINGS);

  // The committed generated manifest currently omits `highlightColor`, so
  // sanitizing fills it from defaults at runtime. The file claims to be the
  // source of defaults; this test pins the actual contract: every settings
  // record must serialize every InlineRuntimeSettings key.
  test(
    "every settings record in the generated manifest carries every InlineRuntimeSettings key",
    () => {
      const manifest = loadGeneratedManifest();
      const records = [
        manifest.scopes.allUrls,
        ...Object.values(manifest.scopes.domains ?? {}),
        ...Object.values(manifest.scopes.pages ?? {}),
      ];
      for (const record of records) {
        for (const key of REQUIRED_KEYS) {
          expect(record).toHaveProperty(key);
        }
      }
    },
  );

  test("generated manifest survives the runtime sanitizer without losing scopes", () => {
    const manifest = loadGeneratedManifest();
    const sanitized = sanitizeInlineRuntimeSettingsManifest(manifest);
    expect(Object.keys(sanitized.scopes.domains ?? {}).sort()).toEqual(
      Object.keys(manifest.scopes.domains ?? {})
        .map((domain) => domain.toLowerCase())
        .sort(),
    );
    expect(Object.keys(sanitized.scopes.pages ?? {}).sort()).toEqual(
      Object.keys(manifest.scopes.pages ?? {}).sort(),
    );
  });
});

// ---------------------------------------------------------------------------
// §1.7 / §1.9 – Sanitizer stability and idempotence
// ---------------------------------------------------------------------------

describe("audit §1.7 / §1.9 sanitizer stability", () => {
  function makeMessyManifest() {
    return {
      generatedAt: "2026-04-27T00:00:00.000Z",
      schemaVersion: 1,
      scopes: {
        domains: {
          "EXAMPLE.com": {
            targetCurrencies: ["GBP"],
            displayStyle: "underline",
            domain: "example.com",
            enabled: true,
            extraSettings: { foo: "bar" },
            convertedCurrencyPosition: "left",
            highlightColor: "#abcdef",
            pageUrl: "",
          },
        },
        pages: {
          "https://example.com/pricing#anchor": {
            highlightColor: "#112233",
            displayStyle: "pill",
            convertedCurrencyPosition: "top",
            enabled: false,
            extraSettings: {},
            domain: "example.com",
            pageUrl: "https://example.com/pricing#anchor",
            targetCurrencies: ["INR"],
          },
        },
        allUrls: {
          highlightColor: "#fff1a8",
          extraSettings: {},
          targetCurrencies: ["EUR"],
          enabled: true,
          domain: "",
          pageUrl: "",
          convertedCurrencyPosition: "right",
          displayStyle: "brackets",
        },
      },
    };
  }

  test("sanitizeInlineRuntimeSettingsManifest is idempotent in JSON.stringify", () => {
    const sanitizedOnce = sanitizeInlineRuntimeSettingsManifest(makeMessyManifest());
    const sanitizedTwice = sanitizeInlineRuntimeSettingsManifest(sanitizedOnce);
    expect(JSON.stringify(sanitizedTwice)).toBe(JSON.stringify(sanitizedOnce));
  });

  test("sanitizeInlineRuntimeSettings is idempotent for individual scope records", () => {
    const sanitized = sanitizeInlineRuntimeSettings({
      enabled: true,
      domain: "Example.com",
      pageUrl: "",
      targetCurrencies: ["INR", "EUR"],
      convertedCurrencyPosition: "right",
      displayStyle: "brackets",
      highlightColor: "#FFF1A8",
      extraSettings: { upcomingFlag: true },
    });
    expect(JSON.stringify(sanitizeInlineRuntimeSettings(sanitized))).toBe(
      JSON.stringify(sanitized),
    );
  });

  // The audit (§1.7) calls out that `getUserSettings` rewrites storage on
  // every read because `JSON.stringify(stored) !== JSON.stringify(sanitized)`
  // when key order differs. The fix is for the sanitizer to be a stable
  // canonical form that survives input-key reshuffling. Pin that invariant.
  test("sanitizer output JSON does not depend on input key order", () => {
    const baseline = sanitizeInlineRuntimeSettingsManifest(makeMessyManifest());
    const reshuffled = JSON.parse(JSON.stringify(makeMessyManifest()));
    // Re-emit each object's keys in reverse insertion order.
    function reverseKeys(value) {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value && typeof value === "object") {
        const reversed = {};
        for (const key of Object.keys(value).reverse()) {
          reversed[key] = reverseKeys(value[key]);
        }
        return reversed;
      }
      return value;
    }
    const reshuffledManifest = sanitizeInlineRuntimeSettingsManifest(
      reverseKeys(reshuffled),
    );
    expect(JSON.stringify(reshuffledManifest)).toBe(JSON.stringify(baseline));
  });

  test("resolveInlineRuntimeSettingsForUrl returns settings deep-equal to the sanitized manifest entry", () => {
    const sanitized = sanitizeInlineRuntimeSettingsManifest(makeMessyManifest());
    const pageResolved = resolveInlineRuntimeSettingsForUrl(
      sanitized,
      "https://example.com/pricing",
    );
    expect(pageResolved.scopeType).toBe("page");
    expect(pageResolved.settings).toEqual(
      sanitized.scopes.pages["https://example.com/pricing"],
    );

    const domainResolved = resolveInlineRuntimeSettingsForUrl(
      sanitized,
      "https://example.com/somewhere-else",
    );
    expect(domainResolved.scopeType).toBe("domain");
    expect(domainResolved.settings).toEqual(
      sanitized.scopes.domains["example.com"],
    );
  });

  // The audit (§1.9) calls out that `resolveInlineRuntimeSettingsForUrl`
  // runs `sanitizeInlineRuntimeSettingsManifest` on every invocation, even
  // when the manifest was already sanitized. The fix is to either accept a
  // pre-sanitized manifest or short-circuit when the input is already
  // canonical. Reference equality between the resolved settings object and
  // the corresponding entry in the input manifest is the cheapest way to
  // pin the absence of an extra rebuild on the hot path.
  test.failing(
    "resolveInlineRuntimeSettingsForUrl does not rebuild settings objects when the manifest is already sanitized",
    () => {
      const sanitized = sanitizeInlineRuntimeSettingsManifest(makeMessyManifest());
      const pageResolved = resolveInlineRuntimeSettingsForUrl(
        sanitized,
        "https://example.com/pricing",
      );
      expect(pageResolved.settings).toBe(
        sanitized.scopes.pages["https://example.com/pricing"],
      );
    },
  );
});

// ---------------------------------------------------------------------------
// §1.4 – Reducer state immutability on swap
// ---------------------------------------------------------------------------

describe("audit §1.4 CURRENCY_SWAP must not mutate input state", () => {
  function makeBaseState() {
    return [
      { id: "a", code: CurrencyCode["UNITED STATES DOLLAR"], amount: "10", icon: "u", seq: 1 },
      { id: "b", code: CurrencyCode.EURO, amount: "8", icon: "e", seq: 2 },
    ];
  }

  // The current implementation does `[...state]` (shallow copy) then mutates
  // `seq` on the original objects in place, leaking out of the reducer.
  test.failing("CURRENCY_SWAP leaves the input array's seq fields untouched", () => {
    const inputState = makeBaseState();
    const before = inputState.map((entry) => ({ ...entry }));

    reduceCurrencyState(
      inputState,
      { type: ActionType.CURRENCY_SWAP, payload: { id: "a" } },
      makeReducerContext(),
    );

    expect(inputState[0].seq).toBe(before[0].seq);
    expect(inputState[1].seq).toBe(before[1].seq);
  });

  test("CURRENCY_SWAP returns a new array with reordered seq values", () => {
    const inputState = makeBaseState();
    const next = reduceCurrencyState(
      inputState,
      { type: ActionType.CURRENCY_SWAP, payload: { id: "a" } },
      makeReducerContext(),
    );

    expect(next).not.toBe(inputState);
    expect(next.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});

// ---------------------------------------------------------------------------
// §1.5 – AMOUNT_UPDATE without a snapshot must not reformat siblings
// ---------------------------------------------------------------------------

describe("audit §1.5 AMOUNT_UPDATE without snapshot", () => {
  // The current implementation overwrites the sibling row with
  // `numericValue.toFixed(4)`, so typing `5` instantly turns the other box
  // into `"5.0000"` even though no rates have hydrated. The fix is to
  // preserve the previous sibling amount (or blank it) until rates arrive.
  // The expectation here is "preserve previous"; if a different UX is chosen
  // (blanking, "loading"), update this guard accordingly.
  test.failing(
    "AMOUNT_UPDATE without a rateSnapshot preserves the previous sibling amount",
    () => {
      const state = [
        { id: "a", code: CurrencyCode["UNITED STATES DOLLAR"], amount: "10", icon: "u", seq: 1 },
        { id: "b", code: CurrencyCode.EURO, amount: "8", icon: "e", seq: 2 },
      ];

      const next = reduceCurrencyState(
        state,
        { type: ActionType.AMOUNT_UPDATE, payload: { id: "a", amount: "5" } },
        makeReducerContext({ rateSnapshot: null }),
      );

      expect(next[0].amount).toBe("5");
      expect(next[1].amount).toBe("8");
    },
  );

  test("AMOUNT_UPDATE with a snapshot still recalculates the sibling amount", () => {
    const state = [
      { id: "a", code: CurrencyCode["UNITED STATES DOLLAR"], amount: "10", icon: "u", seq: 1 },
      { id: "b", code: CurrencyCode.EURO, amount: "8", icon: "e", seq: 2 },
    ];

    const next = reduceCurrencyState(
      state,
      { type: ActionType.AMOUNT_UPDATE, payload: { id: "a", amount: "20" } },
      makeReducerContext(),
    );

    expect(next[0].amount).toBe("20");
    expect(next[1].amount).toBe("18.0000");
  });
});

// ---------------------------------------------------------------------------
// §1.2 – Market-day key correctness
// ---------------------------------------------------------------------------

describe("audit §1.2 getMarketDayKey", () => {
  test("post-open Monday returns that Monday's date", () => {
    expect(getMarketDayKey(new Date("2026-04-27T18:00:00.000Z"))).toBe("2026-04-27");
  });

  test("pre-open Monday rolls back to Friday's close", () => {
    // 2026-04-27T13:00:00Z = 09:00 ET (pre-open). Friday before is 2026-04-24.
    expect(getMarketDayKey(new Date("2026-04-27T13:00:00.000Z"))).toBe("2026-04-24");
  });

  // The current implementation walks the weekend back to Friday and *then*
  // applies the "before 9:30" rule with `setHours` on the rolled-back date,
  // which incorrectly bumps Friday → Thursday because the rolled-back
  // wall-clock is still Saturday's 07:00 ET. The desired semantics: weekend
  // mornings should serve Friday's last close, never Thursday's.
  test.failing(
    "Saturday morning ET serves Friday's close, never the prior Thursday",
    () => {
      // Saturday 2026-04-25 07:00 ET (pre-9:30 wall-clock when the date
      // gets rolled back). Friday before is 2026-04-24.
      expect(getMarketDayKey(new Date("2026-04-25T11:00:00.000Z"))).toBe("2026-04-24");
    },
  );

  test("late Friday ET still serves Friday's date", () => {
    // 2026-04-24T22:00:00Z = 18:00 ET on Friday — well past close but still
    // the trading day's key.
    expect(getMarketDayKey(new Date("2026-04-24T22:00:00.000Z"))).toBe("2026-04-24");
  });
});

// ---------------------------------------------------------------------------
// §1.6 – AGENTS.md "no migration path" rule
// ---------------------------------------------------------------------------

describe("audit §1.6 AGENTS.md no-migration rule", () => {
  // AGENTS.md line 32: "We are in development phase. No backwards
  // compatibility or migration path is required." The legacy migration
  // shim in appStorage.ts contradicts that and should be removed.
  test.failing("appStorage.ts retains no legacy migration shim", () => {
    const source = readRepoFile("apps/extension/utils/appStorage.ts");
    expect(source).not.toMatch(/migrateLegacyUserSettings/);
    expect(source).not.toMatch(/isLegacyUserSettings/);
  });
});

// ---------------------------------------------------------------------------
// §3.5 – ESLint disabled rules
// ---------------------------------------------------------------------------

describe("audit §3.5 eslint config", () => {
  test("eslint.config.mjs has no removed hook lint bypass", () => {
    const source = readRepoFile("eslint.config.mjs");
    expect(source).not.toMatch(/react-hooks/);
    expect(source).not.toMatch(/react-refresh/);
  });

  test.failing(
    "eslint.config.mjs does not silence @typescript-eslint/no-duplicate-enum-values",
    () => {
      const source = readRepoFile("eslint.config.mjs");
      expect(source).not.toMatch(/"@typescript-eslint\/no-duplicate-enum-values"\s*:\s*"off"/);
    },
  );

  test.failing(
    "eslint.config.mjs does not silence @typescript-eslint/ban-ts-comment",
    () => {
      const source = readRepoFile("eslint.config.mjs");
      expect(source).not.toMatch(/"@typescript-eslint\/ban-ts-comment"\s*:\s*"off"/);
    },
  );
});

// ---------------------------------------------------------------------------
// §6.4 / §6.1 – package.json hygiene
// ---------------------------------------------------------------------------

describe("audit §6 package.json hygiene", () => {
  function readPkg() {
    return JSON.parse(readRepoFile("package.json"));
  }

  test("no dependency name appears in both dependencies and devDependencies", () => {
    const pkg = readPkg();
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
    const duplicates = deps.filter((name) => devDeps.has(name));
    expect(duplicates).toEqual([]);
  });

  // §6.1: keep dead deps from creeping back in. Each item here was
  // removed at some point because it had no importer; this test prevents
  // accidental re-introduction.
  test("no dead production dependencies are reintroduced", () => {
    const pkg = readPkg();
    const deps = pkg.dependencies ?? {};
    for (const banned of [
      "class-variance-authority",
      "rxjs",
      "@radix-ui/react-label",
      "tailwindcss",
      "tw-animate-css",
    ]) {
      expect(deps).not.toHaveProperty(banned);
    }
  });
});

// ---------------------------------------------------------------------------
// §3.2 – tsconfig.unit.json include paths must exist
// ---------------------------------------------------------------------------

describe("audit §3.2 tsconfig.unit.json include integrity", () => {
  // The audit fingered `utils/rateMath.ts` and `utils/ratePolicy.ts` as
  // missing files in the include list (now corrected to the directory
  // entrypoints). This guard makes TypeScript's "silent skip on missing
  // include" failure mode loud — every entry must resolve.
  test("every entry in apps/extension/tsconfig.unit.json `include` resolves to a real file", () => {
    const config = JSON.parse(readRepoFile("apps/extension/tsconfig.unit.json"));
    const baseDir = path.resolve(REPO_ROOT, "apps/extension");
    const missing = (config.include ?? []).filter(
      (entry) => !existsSync(path.resolve(baseDir, entry)),
    );
    expect(missing).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §6.2 – Audit-confirmed dead source trees stay removed
// ---------------------------------------------------------------------------

describe("audit §6.2 dead source trees stay deleted", () => {
  // These paths have already been deleted by earlier cleanup. If anybody
  // re-adds them by accident (revived branch, partial revert) this guard
  // fires.
  test("already-deleted dead source paths do not reappear", () => {
    const banned = [
      "apps/extension/entrypoints/content/inlineConversion",
      "apps/extension/utils/magnitudeProfiles.ts",
      "apps/extension/utils/magnitudeProfiles.types.ts",
      "apps/extension/assets/tailwind.css",
      "apps/extension/entrypoints/welcome/App.tsx",
      "apps/extension/entrypoints/welcome/main.tsx",
      "scripts/admin",
    ];
    const reintroduced = banned.filter((rel) =>
      existsSync(path.resolve(REPO_ROOT, rel)),
    );
    expect(reintroduced).toEqual([]);
  });

  // These dead files survived earlier cleanup passes and should still go.
  // Once removed, this test starts passing and should be folded into the
  // guard above.
  test.failing("audit-flagged dead source files are removed", () => {
    const banned = [
      "apps/extension/components/ui/input.tsx",
    ];
    const stillPresent = banned.filter((rel) =>
      existsSync(path.resolve(REPO_ROOT, rel)),
    );
    expect(stillPresent).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §6.3 – stale .gitignore entries
// ---------------------------------------------------------------------------

describe("audit §6.3 .gitignore hygiene", () => {
  // The audit flagged `backend/data/db.json` and `backend/dist` ignore
  // entries as stale (the backend now lives at apps/backend/). Once the
  // ignore file is updated, this test starts passing.
  test.failing(".gitignore does not retain pre-monorepo backend paths", () => {
    const source = readRepoFile(".gitignore");
    expect(source).not.toMatch(/^\s*backend\/(data\/db\.json|dist)\s*$/m);
  });
});

// ---------------------------------------------------------------------------
// Defensive: DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST stays consistent
// ---------------------------------------------------------------------------

describe("DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST", () => {
  test("the in-memory default manifest declares every InlineRuntimeSettings key", () => {
    const requiredKeys = Object.keys(DEFAULT_INLINE_RUNTIME_SETTINGS);
    for (const key of requiredKeys) {
      expect(DEFAULT_INLINE_RUNTIME_SETTINGS_MANIFEST.scopes.allUrls).toHaveProperty(key);
    }
  });
});
