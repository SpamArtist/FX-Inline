import type { JSX } from "preact";
import { ChevronDownIcon } from "../icons/NativeIcons";
import type { DropdownProps } from "./Dropdown.types";
export type { DropdownOption } from "./Dropdown.types";

const CURRENCY_ICON_FALLBACK = "$";
const DEFAULT_SELECT_ARIA_LABEL = "Currency";

export default function Dropdown<TValue extends string>({
  isDisabled = false,
  displayOption,
  options,
  onSelect,
  selectAriaLabel = DEFAULT_SELECT_ARIA_LABEL,
}: DropdownProps<TValue>) {
  function onCurrencyChange(event: JSX.TargetedEvent<HTMLSelectElement>) {
    onSelect(event.currentTarget.value as TValue);
  }

  return (
    <label
      className="fx-inline-dropdown-trigger fx-inline-native-select"
      data-disabled={isDisabled ? "true" : undefined}
    >
      <span className="fx-inline-dropdown-trigger__icon" aria-hidden>
        {displayOption.icon || CURRENCY_ICON_FALLBACK}
      </span>
      <select
        className="fx-inline-native-select__control"
        aria-label={selectAriaLabel}
        disabled={isDisabled}
        value={displayOption.value}
        onChange={onCurrencyChange}
      >
        {options.map(({ label, value }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {!isDisabled && (
        <ChevronDownIcon className="fx-inline-dropdown-trigger__arrow" aria-hidden />
      )}
    </label>
  );
}
