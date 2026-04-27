import { useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search } from "lucide-react";

export default function CurrencySearchDropdown({ value, options, onChange }) {
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) return options;

    return options.filter((currency) =>
      currency.code.includes(normalizedQuery),
    );
  }, [options, query]);
  const selected = options.find((currency) => currency.code === value);

  return (
    <DropdownMenu.Root onOpenChange={(open) => {
      if (open) setQuery("");
    }}>
      <DropdownMenu.Trigger className="currency-select-trigger">
        <span>{selected?.logo}</span>
        <strong>{value}</strong>
        <ChevronDown size={15} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="currency-select-menu"
          align="start"
          sideOffset={6}
        >
          <div className="currency-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Search currency code"
            />
          </div>
          <div className="currency-options" aria-label="Currency options">
            {filteredOptions.length ? (
              filteredOptions.map((currency) => (
                <DropdownMenu.Item
                  key={currency.code}
                  className="currency-option"
                  onSelect={() => onChange(currency.code)}
                >
                  <span>{currency.logo}</span>
                  <strong>{currency.code}</strong>
                  {currency.code === value ? <Check size={14} /> : null}
                </DropdownMenu.Item>
              ))
            ) : (
              <div className="currency-option empty">No matching currency</div>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
