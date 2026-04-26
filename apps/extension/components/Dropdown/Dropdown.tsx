import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { DropdownProps } from "./Dropdown.types";
export type { DropdownOption } from "./Dropdown.types";

const CURRENCY_ICON_FALLBACK = "$";

export default function Dropdown<TValue extends string>({
  isDisabled = false,
  displayOption,
  options,
  onSelect,
}: DropdownProps<TValue>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="fx-inline-dropdown-trigger" disabled={isDisabled}>
        <span className="fx-inline-dropdown-trigger__icon" aria-hidden>
          {displayOption.icon || CURRENCY_ICON_FALLBACK}
        </span>
        <span className="fx-inline-dropdown-trigger__label">{displayOption.label}</span>
        {!isDisabled && <ChevronDown className="fx-inline-dropdown-trigger__arrow" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="fx-inline-dropdown-menu-content fx-inline-dropdown-content">
        {options.map(({ label, value, icon }) => (
          <DropdownMenuItem
            key={value}
            className="fx-inline-dropdown-item"
            onSelect={() => onSelect(value)}
            textValue={label}
          >
            <span className="fx-inline-dropdown-item__icon" aria-hidden>
              {icon || CURRENCY_ICON_FALLBACK}
            </span>
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
