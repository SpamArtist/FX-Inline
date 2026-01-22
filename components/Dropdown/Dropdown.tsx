import DropdownSVG from '@/assets/drop_down.svg';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

type Props = {
    displayOption: string;
    options: Array<{ label: string, value: string }>
    onSelect: (option: string) => void
}

export default function Dropdown({ displayOption, options, onSelect }: Props) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger className='flex items-center'>{displayOption}<DropdownSVG /></DropdownMenuTrigger>
            <DropdownMenuContent>
                {options.map(({ label, value }) => (<DropdownMenuItem onSelect={() => onSelect(value)} textValue={label}>{label}</DropdownMenuItem>))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
