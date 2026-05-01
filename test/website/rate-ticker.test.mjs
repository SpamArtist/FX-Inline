import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JSDOM } from "jsdom";

import {
  formatTickerDelta,
  formatTickerRate,
  getDailyRateTickerCacheKey,
  initializeRateTicker,
  loadDailyUsdRateSnapshot,
  RATE_TICKER_PROVIDER_CONFIGS,
} from "../../apps/website/rateTicker.js";

function createStorage(initialValue = null) {
  const store = new Map();

  if (initialValue) {
    store.set("fx-inline-rate-ticker-cache-v1", initialValue);
  }

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    read(key) {
      return store.get(key) ?? null;
    },
  };
}

function createTickerDocument() {
  const dom = new JSDOM(`
    <aside class="rate-ticker">
      <div class="rate-ticker-track">
        <ul class="rate-ticker-list">
          <li>
            <span class="ticker-dot"></span>
            <span>USD/EUR</span>
            <data value="0.9214">0.9214</data>
            <data class="rate-delta is-up" value="0.12">+0.12%</data>
          </li>
          <li>
            <span class="ticker-dot"></span>
            <span>USD/JPY</span>
            <data value="151.24">151.24</data>
            <data class="rate-delta is-down" value="-0.05">-0.05%</data>
          </li>
        </ul>
        <ul class="rate-ticker-list" aria-hidden="true">
          <li>
            <span class="ticker-dot"></span>
            <span>USD/EUR</span>
            <data value="0.9214">0.9214</data>
            <data class="rate-delta is-up" value="0.12">+0.12%</data>
          </li>
          <li>
            <span class="ticker-dot"></span>
            <span>USD/JPY</span>
            <data value="151.24">151.24</data>
            <data class="rate-delta is-down" value="-0.05">-0.05%</data>
          </li>
        </ul>
      </div>
    </aside>
  `);

  return dom.window.document;
}

describe("website rate ticker", () => {
  it("uses the same free USD provider endpoints as the extension runtime", () => {
    assert.deepEqual(
      RATE_TICKER_PROVIDER_CONFIGS.map((provider) => [provider.name, provider.url]),
      [
        ["client-er-api", "https://open.er-api.com/v6/latest/USD"],
        ["client-exchange-rate-api", "https://api.exchangerate-api.com/v4/latest/USD"],
      ],
    );
  });

  it("formats rates and deltas for ticker display", () => {
    assert.equal(formatTickerRate(151.244), "151.24");
    assert.equal(formatTickerRate(0.92137), "0.9214");
    assert.equal(formatTickerDelta(2.377), "+2.38%");
    assert.equal(formatTickerDelta(-0.504), "-0.50%");
    assert.equal(formatTickerDelta(0.001), "0.00%");
  });

  it("returns a cached snapshot without refetching during the same UTC day", async () => {
    const cachedSnapshot = {
      base: "USD",
      rates: {
        EUR: 0.91,
        JPY: 150.5,
      },
      fetchedAt: Date.parse("2026-05-01T02:00:00.000Z"),
      source: "client-er-api",
    };
    const cachedValue = JSON.stringify({
      dayKey: "2026-05-01",
      snapshot: cachedSnapshot,
      previousSnapshot: null,
    });
    const storage = createStorage(cachedValue);
    let fetchCount = 0;

    const result = await loadDailyUsdRateSnapshot({
      storage,
      now: new Date("2026-05-01T18:00:00.000Z"),
      fetchImpl: async () => {
        fetchCount += 1;
        throw new Error("same-day cache should prevent fetch");
      },
    });

    assert.equal(fetchCount, 0);
    assert.equal(result.fromCache, true);
    assert.deepEqual(result.snapshot, cachedSnapshot);
  });

  it("falls back to the second provider and stores the previous snapshot for daily deltas", async () => {
    const previousSnapshot = {
      base: "USD",
      rates: {
        EUR: 0.9,
        JPY: 152,
      },
      fetchedAt: Date.parse("2026-04-30T02:00:00.000Z"),
      source: "client-er-api",
    };
    const storage = createStorage(
      JSON.stringify({
        dayKey: "2026-04-30",
        snapshot: previousSnapshot,
        previousSnapshot: null,
      }),
    );
    const requestedUrls = [];

    const result = await loadDailyUsdRateSnapshot({
      storage,
      now: new Date("2026-05-01T02:00:00.000Z"),
      fetchImpl: async (url) => {
        requestedUrls.push(url);

        if (requestedUrls.length === 1) {
          return {
            ok: true,
            json: async () => ({ result: "error" }),
          };
        }

        return {
          ok: true,
          json: async () => ({
            rates: {
              eur: "0.9214",
              JPY: 151.24,
            },
          }),
        };
      },
    });

    assert.deepEqual(requestedUrls, [
      "https://open.er-api.com/v6/latest/USD",
      "https://api.exchangerate-api.com/v4/latest/USD",
    ]);
    assert.equal(result.fromCache, false);
    assert.equal(result.snapshot.source, "client-exchange-rate-api");
    assert.equal(result.snapshot.rates.EUR, 0.9214);
    assert.deepEqual(result.previousSnapshot, previousSnapshot);

    const storedValue = JSON.parse(storage.read("fx-inline-rate-ticker-cache-v1"));
    assert.equal(storedValue.dayKey, "2026-05-01");
    assert.deepEqual(storedValue.previousSnapshot, previousSnapshot);
  });

  it("updates every duplicated ticker list with daily rates and cached deltas", async () => {
    const document = createTickerDocument();
    const storage = createStorage(
      JSON.stringify({
        dayKey: "2026-04-30",
        snapshot: {
          base: "USD",
          rates: {
            EUR: 0.9,
            JPY: 152,
          },
          fetchedAt: Date.parse("2026-04-30T02:00:00.000Z"),
          source: "client-er-api",
        },
        previousSnapshot: null,
      }),
    );

    await initializeRateTicker(document, {
      storage,
      now: new Date("2026-05-01T02:00:00.000Z"),
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          result: "success",
          rates: {
            EUR: 0.9214,
            JPY: 151.24,
          },
        }),
      }),
    });

    const eurItems = Array.from(document.querySelectorAll(".rate-ticker-list li")).filter(
      (item) => item.textContent.includes("USD/EUR"),
    );
    const jpyItems = Array.from(document.querySelectorAll(".rate-ticker-list li")).filter(
      (item) => item.textContent.includes("USD/JPY"),
    );

    assert.equal(getDailyRateTickerCacheKey(new Date("2026-05-01T20:30:00.000Z")), "2026-05-01");
    assert.equal(eurItems.length, 2);
    assert.equal(jpyItems.length, 2);

    for (const item of eurItems) {
      const [rate, delta] = item.querySelectorAll("data");

      assert.equal(rate.textContent, "0.9214");
      assert.equal(delta.textContent, "+2.38%");
      assert.equal(delta.classList.contains("is-up"), true);
    }

    for (const item of jpyItems) {
      const [rate, delta] = item.querySelectorAll("data");

      assert.equal(rate.textContent, "151.24");
      assert.equal(delta.textContent, "-0.50%");
      assert.equal(delta.classList.contains("is-down"), true);
    }
  });
});
