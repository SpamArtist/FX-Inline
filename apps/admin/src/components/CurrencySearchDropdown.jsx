import { Check, ChevronDown, Search } from "lucide-preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

export default function CurrencySearchDropdown({ value, options, onChange }) {
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) return options;

    return options.filter((currency) =>
      currency.code.includes(normalizedQuery),
    );
  }, [options, query]);
  const selected = options.find((currency) => currency.code === value);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) return;

      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    searchInputRef.current?.focus();
  }, [isOpen]);

  function toggleMenu() {
    setIsOpen((current) => {
      const next = !current;
      if (next) setQuery("");
      return next;
    });
  }

  function closeMenu() {
    setIsOpen(false);
  }

  function chooseCurrency(code) {
    onChange(code);
    closeMenu();
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }

    event.stopPropagation();
  }

  return (
    <div
      ref={containerRef}
      className="currency-select"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="currency-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <span>{selected?.logo}</span>
        <strong>{value}</strong>
        <ChevronDown size={15} />
      </button>

      {isOpen ? (
        <div className="currency-select-menu">
          <div className="currency-search">
            <Search size={15} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search currency code"
            />
          </div>
          <div
            className="currency-options"
            role="listbox"
            aria-label="Currency options"
          >
            {filteredOptions.length ? (
              filteredOptions.map((currency) => (
                <button
                  type="button"
                  key={currency.code}
                  className="currency-option"
                  role="option"
                  aria-selected={currency.code === value}
                  data-highlighted={currency.code === value ? "" : undefined}
                  onClick={() => chooseCurrency(currency.code)}
                >
                  <span>{currency.logo}</span>
                  <strong>{currency.code}</strong>
                  {currency.code === value ? <Check size={14} /> : null}
                </button>
              ))
            ) : (
              <div className="currency-option empty">No matching currency</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
