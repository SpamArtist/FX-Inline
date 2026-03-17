import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type DropdownOption = {
  label: string;
  value: string;
  icon?: string;
};

type Props = {
  isDisabled?: boolean;
  displayOption: DropdownOption;
  options: DropdownOption[];
  onSelect: (option: string) => void;
};

export default function Dropdown({
  isDisabled = false,
  displayOption,
  options,
  onSelect,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ccx-dropdown-trigger" disabled={isDisabled}>
        <span className="ccx-dropdown-trigger__icon" aria-hidden>
          {displayOption.icon || "$"}
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
              {icon || "$"}
            </span>
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
