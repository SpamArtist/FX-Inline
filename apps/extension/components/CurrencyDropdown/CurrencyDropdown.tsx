import { getCurrencyIcon } from "@/utils/currencyPresentation";
import { CurrencyCode } from "@/utils/enums";
import currencies from "../../assets/currency.json";
import Dropdown from "../Dropdown/Dropdown";
import type { DropdownOption } from "../Dropdown/Dropdown.types";
import type { CurrencyDropdownProps } from "./CurrencyDropdown.types";

const CURRENCY_OPTIONS: DropdownOption<CurrencyCode>[] = currencies.map((entry) => ({
  label: entry.code,
  value: entry.code as CurrencyCode,
  icon: entry.logo,
}));

function CurrencyDropdown({
  selectedCurrency,
  selectedIcon,
  isDisabled = false,
  onCurrencySelection,
}: CurrencyDropdownProps) {
  return (
    <Dropdown
      isDisabled={isDisabled}
      displayOption={{
        label: selectedCurrency,
        value: selectedCurrency,
        icon: selectedIcon || getCurrencyIcon(selectedCurrency),
      }}
      options={CURRENCY_OPTIONS}
      onSelect={onCurrencySelection}
    />
  );
}

export default CurrencyDropdown;
