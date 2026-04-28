export type DropdownOption<TValue extends string = string> = {
  label: string;
  value: TValue;
  icon?: string;
};

export type DropdownProps<TValue extends string = string> = {
  isDisabled?: boolean;
  displayOption: DropdownOption<TValue>;
  options: DropdownOption<TValue>[];
  onSelect: (option: TValue) => void;
  selectAriaLabel?: string;
};
