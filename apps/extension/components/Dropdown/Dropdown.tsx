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
      <DropdownMenuTrigger className="ccx-dropdown-trigger" disabled={isDisabled}>
        <span className="ccx-dropdown-trigger__icon" aria-hidden>
          {displayOption.icon || CURRENCY_ICON_FALLBACK}
        </span>
        <span className="ccx-dropdown-trigger__label">{displayOption.label}</span>
        {!isDisabled && <ChevronDown className="ccx-dropdown-trigger__arrow" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="ccx-dropdown-menu-content ccx-dropdown-content">
        {options.map(({ label, value, icon }) => (
          <DropdownMenuItem
            key={value}
            className="ccx-dropdown-item"
            onSelect={() => onSelect(value)}
            textValue={label}
          >
            <span className="ccx-dropdown-item__icon" aria-hidden>
              {icon || CURRENCY_ICON_FALLBACK}
            </span>
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
