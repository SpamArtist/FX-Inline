import type { CurrencyCode } from "@/utils/enums";
import type { ICurrencyState } from "@/utils/types";

export type CurrencyBoxVariant = "popup" | "selection";
export type AmountPresentationMode = "displayThenEdit" | "directInput";

export type CurrencyBoxProps = {
  data: ICurrencyState;
  variant: CurrencyBoxVariant;
  isCurrencySelectable: boolean;
  amountPresentationMode?: AmountPresentationMode;
  localeHint?: string | null;
  amountChange: (amount: string) => void;
  currencyChange: (currency: CurrencyCode) => void;
};
