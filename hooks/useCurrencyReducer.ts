import currencies from "@/assets/currency.json";
import { CURRENCY_CODE_MAP } from "@/utils/constants";
import { CurrencyCode } from "@/utils/enums";
import { reducer } from "@/utils/reducer";
import { ICurrencyState } from "@/utils/types";
import {
  getConversionRatesAgainstPreferedBaseCurrency,
  getPreferedAltCurrency,
} from "@/utils/utils";
import { useReducer } from "react";

export const useCurrencyReducer = ({
  number,
  currency,
}: {
  number: string;
  currency: CurrencyCode;
}) => {
  const getCurrencyStateFromCode = (code: CurrencyCode) => {
    const currencyFromMap = CURRENCY_CODE_MAP[code];
    if (currencyFromMap) {
      return currencyFromMap;
    }

    const currencyFromList = currencies.find((x) => x.code === code);

    return {
      code,
      icon: currencyFromList?.logo || "",
    };
  };

  const convertAmount = (
    value: string,
    sourceCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
  ): string => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return value;

    const sourceRate =
      getConversionRatesAgainstPreferedBaseCurrency(sourceCurrency);
    const targetRate =
      getConversionRatesAgainstPreferedBaseCurrency(targetCurrency);

    if (
      typeof sourceRate === "number" &&
      sourceRate > 0 &&
      typeof targetRate === "number"
    ) {
      return ((numericValue * targetRate) / sourceRate).toFixed(4);
    }

    return numericValue.toFixed(4);
  };

  const initalState: ICurrencyState[] = [];

  const baseCurrency = currency;
  const preferedAltCurrency = getPreferedAltCurrency();
  const altCurrency =
    baseCurrency === CurrencyCode.EURO
      ? preferedAltCurrency === baseCurrency
        ? CurrencyCode["UNITED STATES DOLLAR"]
        : preferedAltCurrency
      : CurrencyCode.EURO;

  initalState.push({
    ...getCurrencyStateFromCode(baseCurrency),
    seq: 1,
    amount: number,
  } as ICurrencyState);
  initalState.push({
    ...getCurrencyStateFromCode(altCurrency),
    seq: 2,
    amount: convertAmount(number, baseCurrency, altCurrency),
  } as ICurrencyState);

  return useReducer(reducer, initalState);
};
