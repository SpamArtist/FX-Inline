import { CURRENCY_CODE_MAP } from "@/utils/constants";
import { CurrencyCode } from "@/utils/enums";
import { reducer } from "@/utils/reducer";
import { ICurrencyState } from "@/utils/types";
import {
    getConversionRatesAgainstPreferedBaseCurrency,
    getPreferedAltCurrency,
    getPreferedBaseCurrency,
} from "@/utils/utils";
import { useReducer } from "react";

export const useCurrencyReducer = ({
  number,
  currency,
}: {
  number: string;
  currency: string;
}) => {
  const initalState: ICurrencyState[] = [];

  const preferedBaseCurrency = getPreferedBaseCurrency();
  const preferedAltCurrency = getPreferedAltCurrency();

  initalState.push({
    ...CURRENCY_CODE_MAP[preferedBaseCurrency],
    seq: 1,
    amount: number,
  } as ICurrencyState);
  initalState.push({
    ...CURRENCY_CODE_MAP[preferedAltCurrency],
    seq: 2,
    amount: (
      (getConversionRatesAgainstPreferedBaseCurrency(
        preferedAltCurrency,
      ) as number) * Number(number)
    ).toFixed(4),
  } as ICurrencyState);

  return useReducer(reducer, initalState);
};
