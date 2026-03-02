import { CurrencyCode } from "@/utils/enums";
import currencies from "../../assets/currency.json";
import Dropdown from "../Dropdown/Dropdown";

type Props = {
  isDisabled?: boolean;
  selectedOption: string;
  onCurrencySelection: (currency: CurrencyCode) => void;
};

function CurrencyDropdown({
  selectedOption,
  isDisabled = false,
  onCurrencySelection,
}: Props) {
  const currencyOptions = currencies.map((x) => ({
    label: `${x.logo} ${x.code}`,
    value: x.code,
  }));

  return (
    <Dropdown
      isDisabled={isDisabled}
      displayOption={selectedOption}
      options={currencyOptions}
      onSelect={(currency) => onCurrencySelection(currency as CurrencyCode)}
    />
  );
}

export default CurrencyDropdown;
