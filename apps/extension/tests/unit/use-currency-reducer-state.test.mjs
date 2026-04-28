import {
  applyPreferredCurrencyPreference,
  createCurrencyIdFactory,
  createInitialCurrenciesState,
  reduceCurrencyState,
} from "../../test-dist/hooks/useCurrencyReducer.state.js";
import { ActionType, CurrencyCode } from "../../test-dist/utils/enums.js";

function createRateSnapshot(overrides = {}) {
  const base = {
    base: "USD",
    fetchedAt: Date.now(),
    rates: {
      USD: 1,
      EUR: 0.8,
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

function getCurrencyStateFromCode(code) {
  return { code, icon: `${code.toLowerCase()}.svg` };
}

function createContext(overrides = {}) {
  let idCounter = 0;

  return {
    preferredCurrency: CurrencyCode["UNITED STATES DOLLAR"],
    rateSnapshot: createRateSnapshot(),
    createCurrencyId: () => {
      idCounter += 1;
      return `currency-${idCounter}`;
    },
    getCurrencyStateFromCode,
    ...overrides,
  };
}

test("createCurrencyIdFactory scopes ids to each reducer instance", () => {
  const firstCreateCurrencyId = createCurrencyIdFactory();
  const secondCreateCurrencyId = createCurrencyIdFactory();

  expect(firstCreateCurrencyId()).toBe("currency-1");
  expect(firstCreateCurrencyId()).toBe("currency-2");
  expect(secondCreateCurrencyId()).toBe("currency-1");
  expect(secondCreateCurrencyId()).toBe("currency-2");
});

test("createInitialCurrenciesState creates two baseline rows with generated ids", () => {
  const context = createContext({
    preferredCurrency: CurrencyCode.EURO,
  });

  const state = createInitialCurrenciesState({
    amount: "100",
    sourceCurrency: CurrencyCode["UNITED STATES DOLLAR"],
    preferredCurrency: context.preferredCurrency,
    createCurrencyId: context.createCurrencyId,
    getCurrencyStateFromCode: context.getCurrencyStateFromCode,
  });

  expect(state).toHaveLength(2);
  expect(state[0]).toMatchObject({
    id: "currency-1",
    code: CurrencyCode["UNITED STATES DOLLAR"],
    amount: "100",
  });
  expect(state[1]).toMatchObject({
    id: "currency-2",
    code: CurrencyCode.EURO,
    amount: "100",
  });
});

test("reduceCurrencyState AMOUNT_UPDATE recalculates other currencies", () => {
  const context = createContext();

  const state = [
    {
      id: "a",
      code: CurrencyCode["UNITED STATES DOLLAR"],
      amount: "10",
      icon: "usd.svg",
      seq: 1,
    },
    {
      id: "b",
      code: CurrencyCode.EURO,
      amount: "8",
      icon: "eur.svg",
      seq: 2,
    },
  ];

  const next = reduceCurrencyState(state, {
    type: ActionType.AMOUNT_UPDATE,
    payload: { id: "a", amount: "20" },
  }, context);

  expect(next[0].amount).toBe("20");
  expect(next[1].amount).toBe("16.0000");
});

test("reduceCurrencyState CURRENCY_UPDATE changes code and recalculates", () => {
  const context = createContext();

  const state = [
    {
      id: "a",
      code: CurrencyCode["UNITED STATES DOLLAR"],
      amount: "10",
      icon: "usd.svg",
      seq: 1,
    },
    {
      id: "b",
      code: CurrencyCode.EURO,
      amount: "8",
      icon: "eur.svg",
      seq: 2,
    },
  ];

  const next = reduceCurrencyState(state, {
    type: ActionType.CURRENCY_UPDATE,
    payload: { id: "b", currency: CurrencyCode.INDIA },
  }, context);

  expect(next[1].code).toBe(CurrencyCode.INDIA);
  expect(next[1].icon).toBe("inr.svg");
  expect(next[0].amount).toBe("0.1000");
});

test("reduceCurrencyState CURRENCY_ADD appends a new row and recalculates", () => {
  const context = createContext({ preferredCurrency: CurrencyCode.EURO });

  const state = [
    {
      id: "a",
      code: CurrencyCode["UNITED STATES DOLLAR"],
      amount: "10",
      icon: "usd.svg",
      seq: 1,
    },
    {
      id: "b",
      code: CurrencyCode.EURO,
      amount: "8",
      icon: "eur.svg",
      seq: 2,
    },
  ];

  const next = reduceCurrencyState(state, {
    type: ActionType.CURRENCY_ADD,
    payload: {},
  }, context);

  expect(next).toHaveLength(3);
  expect(next[2]).toMatchObject({
    id: "currency-1",
    code: CurrencyCode.EURO,
    amount: "8.0000",
    seq: 3,
  });
});

test("reduceCurrencyState invalid payloads are no-op", () => {
  const context = createContext();

  const state = [
    {
      id: "a",
      code: CurrencyCode["UNITED STATES DOLLAR"],
      amount: "10",
      icon: "usd.svg",
      seq: 1,
    },
    {
      id: "b",
      code: CurrencyCode.EURO,
      amount: "8",
      icon: "eur.svg",
      seq: 2,
    },
  ];

  const invalidAmount = reduceCurrencyState(state, {
    type: ActionType.AMOUNT_UPDATE,
    payload: { id: "a" },
  }, context);

  const invalidCurrency = reduceCurrencyState(state, {
    type: ActionType.CURRENCY_UPDATE,
    payload: { id: "a", currency: "BAD" },
  }, context);

  const invalidSwap = reduceCurrencyState(state, {
    type: ActionType.CURRENCY_SWAP,
    payload: { id: "b" },
  }, context);

  expect(invalidAmount).toBe(state);
  expect(invalidCurrency).toBe(state);
  expect(invalidSwap).toBe(state);
});

test("applyPreferredCurrencyPreference updates second row when preferred changes", () => {
  const state = [
    {
      id: "a",
      code: CurrencyCode["UNITED STATES DOLLAR"],
      amount: "10",
      icon: "usd.svg",
      seq: 1,
    },
    {
      id: "b",
      code: CurrencyCode.EURO,
      amount: "8",
      icon: "eur.svg",
      seq: 2,
    },
  ];

  const next = applyPreferredCurrencyPreference(
    state,
    CurrencyCode.INDIA,
    createRateSnapshot(),
    getCurrencyStateFromCode,
  );

  expect(next[1].code).toBe(CurrencyCode.INDIA);
  expect(next[1].amount).toBe("800.0000");
});
