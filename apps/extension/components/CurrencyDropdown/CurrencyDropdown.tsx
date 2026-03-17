import { getCurrencyIcon } from "@/utils/currencyPresentation";
import { CurrencyCode } from "@/utils/enums";
import currencies from "../../assets/currency.json";
import Dropdown from "../Dropdown/Dropdown";

type Props = {
  isDisabled?: boolean;
  selectedCurrency: CurrencyCode;
  selectedIcon?: string;
  onCurrencySelection: (currency: CurrencyCode) => void;
};

function CurrencyDropdown({
  selectedCurrency,
  selectedIcon,
  isDisabled = false,
  onCurrencySelection,
}: Props) {
  const currencyOptions = currencies.map((entry) => ({
    label: entry.code,
    value: entry.code,
    icon: entry.logo,
  }));

  return (
    <Dropdown
      isDisabled={isDisabled}
      displayOption={{
        label: selectedCurrency,
        value: selectedCurrency,
        icon: selectedIcon || getCurrencyIcon(selectedCurrency),
      }}
      options={currencyOptions}
      onSelect={(currency) => onCurrencySelection(currency as CurrencyCode)}
    />
  );
}

export default CurrencyDropdown;
