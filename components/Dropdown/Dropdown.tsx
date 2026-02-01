import DropdownSVG from "@/assets/drop_down.svg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type Props = {
  isDisabled?: boolean;
  displayOption: string;
  options: Array<{ label: string; value: string }>;
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
      <DropdownMenuTrigger className="flex items-center" disabled={isDisabled}>
        {displayOption}
        {!isDisabled && <DropdownSVG />}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map(({ label, value }) => (
          <DropdownMenuItem onSelect={() => onSelect(value)} textValue={label}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
