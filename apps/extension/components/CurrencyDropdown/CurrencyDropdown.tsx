import { getCurrencyIcon } from "@/utils/currencyPresentation";
import { CurrencyCode } from "@/utils/enums";
import { useMemo } from "react";
import currencies from "../../assets/currency.json";
import Dropdown from "../Dropdown/Dropdown";
import type { DropdownOption } from "../Dropdown/Dropdown.types";
import type { CurrencyDropdownProps } from "./CurrencyDropdown.types";

function CurrencyDropdown({
  selectedCurrency,
  selectedIcon,
  isDisabled = false,
  onCurrencySelection,
}: CurrencyDropdownProps) {
  const currencyOptions = useMemo<DropdownOption<CurrencyCode>[]>(
    () =>
      currencies.map((entry) => ({
        label: entry.code,
        value: entry.code as CurrencyCode,
        icon: entry.logo,
      })),
    [],
  );

  return (
    <Dropdown
      isDisabled={isDisabled}
      displayOption={{
        label: selectedCurrency,
        value: selectedCurrency,
        icon: selectedIcon || getCurrencyIcon(selectedCurrency),
      }}
      options={currencyOptions}
      onSelect={onCurrencySelection}
    />
  );
}

export default CurrencyDropdown;
