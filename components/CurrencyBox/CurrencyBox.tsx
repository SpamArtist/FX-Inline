import { CurrencyCode } from "@/utils/enums";
import { ICurrencyState } from "@/utils/types";
import { type ChangeEvent } from "react";
import CurrencyDropdown from "../CurrencyDropdown/CurrencyDropdown";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type Props = {
  data: ICurrencyState;
  isDisabled: boolean;
  containerStyle: string;
  dropDownContainerStyle: string;
  inputContainerStyle: string;
  amountChange: (amount: string) => void;
  currencyChange: (currency: CurrencyCode) => void;
};

function CurrencyBox({
  data,
  isDisabled = true,
  containerStyle,
  dropDownContainerStyle,
  inputContainerStyle,
  amountChange,
  currencyChange,
}: Props) {
  function onAmountChange(e: ChangeEvent<HTMLInputElement>) {
    if (/^[0-9]{0,}\.?[0-9]{0,4}$/.test(e.target.value)) {
      amountChange(e.target.value);
    }
  }

  return (
    <div className={`flex items-center ${containerStyle}`}>
      <div className={dropDownContainerStyle}>
        <CurrencyDropdown
          isDisabled={isDisabled}
          selectedOption={data.icon + " " + data.code}
          onCurrencySelection={currencyChange}
        />
      </div>
      <div className={inputContainerStyle}>
        <Label
          htmlFor={data.id}
          className="text-gray-500 dark:text-gray-400 text-[0.875em]"
        >
          Amount
        </Label>
        <Input
          id={data.id}
          type="text"
          onChange={onAmountChange}
          value={data.amount}
        />
      </div>
    </div>
  );
}

export default CurrencyBox;
