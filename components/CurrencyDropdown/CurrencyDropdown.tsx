import currencies from '../../assets/currency.json';
import Dropdown from '../Dropdown/Dropdown';

type Props = {
    selectedOption: string;
    onCurrencySelection: (currency: string) => void
}

function CurrencyDropdown({ selectedOption, onCurrencySelection }: Props) {

    const currencyOptions = currencies.map((x) => ({ label: `${x.logo} ${x.code}`, value: x.code }));

    return (
        <Dropdown
            displayOption={selectedOption}
            options={currencyOptions}
            onSelect={(currency) => onCurrencySelection(currency)}
        />
    )
}

export default CurrencyDropdown