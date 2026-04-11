import {
  createSelectionPopupStateStore,
} from "../../test-dist/entrypoints/content/selectionPopup/state.js";
import { CurrencyCode } from "../../test-dist/utils/enums.js";

function createRateSnapshot(overrides = {}) {
  const base = {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.5,
      INR: 80,
    },
  };

  return {
    ...base,
    ...overrides,
    rates: {
      ...base.rates,
      ...(overrides.rates || {}),
    },
  };
}

async function waitForCondition(assertion, timeoutMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => {
        setTimeout(resolve, 5);
      });
    }
  }

  assertion();
}

function createFailingHydrationDeps() {
  return {
    readUserSettings: async () => {
      throw new Error("No hydration in this test");
    },
    readRates: async () => {
      throw new Error("No hydration in this test");
    },
  };
}

test("store initializes with source currency and default secondary row", () => {
  const store = createSelectionPopupStateStore({
    amount: "10",
    sourceCurrency: CurrencyCode.EURO,
    hydrationDeps: createFailingHydrationDeps(),
  });

  const snapshot = store.getSnapshot();

  expect(snapshot.currencies).toHaveLength(2);
  expect(snapshot.currencies[0]).toMatchObject({
    code: CurrencyCode.EURO,
    amount: "10",
    seq: 1,
  });
  expect(snapshot.currencies[1]).toMatchObject({
    code: CurrencyCode["UNITED STATES DOLLAR"],
    amount: "10",
    seq: 2,
  });

  store.destroy();
});

test("updateAmount recalculates dependent row values", () => {
  const store = createSelectionPopupStateStore({
    amount: "10",
    sourceCurrency: CurrencyCode.EURO,
    hydrationDeps: createFailingHydrationDeps(),
  });

  const sourceRow = store.getSnapshot().currencies[0];
  if (!sourceRow?.id) {
    throw new Error("Expected source row with id");
  }

  store.updateAmount(sourceRow.id, "25");

  const snapshot = store.getSnapshot();

  expect(snapshot.currencies[0].amount).toBe("25");
  expect(snapshot.currencies[1].amount).toBe("25.0000");

  store.destroy();
});

test("hydration applies preferred currency and rate snapshot conversion", async () => {
  const notifications = [];

  const store = createSelectionPopupStateStore({
    amount: "5",
    sourceCurrency: CurrencyCode.EURO,
    hydrationDeps: {
      readUserSettings: async () => ({ preferredCurrency: CurrencyCode.INDIA }),
      readRates: async () => createRateSnapshot(),
    },
  });

  const unsubscribe = store.subscribe((snapshot) => {
    notifications.push(snapshot);
  });

  await waitForCondition(() => {
    const snapshot = store.getSnapshot();
    expect(snapshot.currencies[1].code).toBe(CurrencyCode.INDIA);
    expect(snapshot.currencies[1].amount).toBe("800.0000");
    expect(snapshot.rateSnapshot).not.toBeNull();
  });

  expect(notifications.length).toBeGreaterThanOrEqual(1);

  unsubscribe();
  store.destroy();
});
