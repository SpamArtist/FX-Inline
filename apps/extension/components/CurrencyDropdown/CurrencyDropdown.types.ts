import type { CurrencyCode } from "@/utils/enums";

export type CurrencyDropdownProps = {
  isDisabled?: boolean;
  selectedCurrency: CurrencyCode;
  selectedIcon?: string;
  onCurrencySelection: (currency: CurrencyCode) => void;
};
