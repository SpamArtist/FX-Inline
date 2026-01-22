import { type ChangeEvent } from "react";
import CurrencyDropdown from "../CurrencyDropdown/CurrencyDropdown";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type Props = {
    data: {
        id: string
        amount: string;
        currency: string;
        logo: string;
    }
    amountChange: (amount: string) => void
    currencyChange: (currency: string) => void
}

function CurrencyBox({ data, amountChange, currencyChange }: Props) {
    function onAmountChange(e: ChangeEvent<HTMLInputElement>) {
        if (/^[0-9]{0,}\.?[0-9]{0,4}$/.test(e.target.value)) {
            amountChange(e.target.value);
        }
    }

    return (
        <div className="flex items-center px-[0.8em] py-[1.5em] rounded-xl shadow-lg outline outline-black/5 
        dark:bg-white-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 gap-x-[0.5em]">
            <div className="flex-[1.2] mt-[0.875em]">
                <CurrencyDropdown selectedOption={data.logo + ' ' + data.currency} onCurrencySelection={currencyChange} />
            </div>
            <div className="flex flex-col gap-[0.35em] flex-3">
                <Label htmlFor={data.id} className="text-gray-500 dark:text-gray-400 text-[small]">Amount</Label>
                <Input id={data.id} type="text" onChange={onAmountChange} value={data.amount} />
            </div>
        </div>
    )
}

export default CurrencyBox