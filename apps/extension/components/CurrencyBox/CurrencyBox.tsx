import {
  cancelAmountEdit,
  commitAmountDraft,
  formatCurrencyHeadlineAmount,
  getCurrencyDisplayName,
  getNextAmountDraft,
} from "@/utils/currencyPresentation";
import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import CurrencyDropdown from "../CurrencyDropdown/CurrencyDropdown";
import type { CurrencyBoxProps } from "./CurrencyBox.types";
export type { AmountPresentationMode, CurrencyBoxVariant } from "./CurrencyBox.types";

function CurrencyBox({
  data,
  variant,
  isCurrencySelectable,
  amountPresentationMode = "displayThenEdit",
  localeHint,
  amountChange,
  currencyChange,
}: CurrencyBoxProps) {
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [draftAmount, setDraftAmount] = useState(data.amount);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipBlurCommitRef = useRef(false);
  const isDirectInput = amountPresentationMode === "directInput";

  useEffect(() => {
    if (!isEditingAmount) {
      setDraftAmount(data.amount);
    }
  }, [data.amount, isEditingAmount]);

  useEffect(() => {
    if (!isEditingAmount) return;

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isEditingAmount]);

  const resolvedLocale = useMemo(() => {
    if (localeHint && localeHint.trim().length > 0) {
      return localeHint;
    }

    if (typeof navigator === "undefined") {
      return "en";
    }

    return navigator.language || "en";
  }, [localeHint]);

  const displayAmount = useMemo(
    () => formatCurrencyHeadlineAmount(data.amount, data.code, resolvedLocale),
    [data.amount, data.code, resolvedLocale],
  );

  const currencyName = useMemo(
    () => getCurrencyDisplayName(data.code, resolvedLocale),
    [data.code, resolvedLocale],
  );

  const shouldDisplayInput = isDirectInput || isEditingAmount;

  function beginAmountEdit() {
    if (amountPresentationMode !== "displayThenEdit") return;

    skipBlurCommitRef.current = false;
    setDraftAmount(data.amount);
    setIsEditingAmount(true);
  }

  function handleAmountChange(event: JSX.TargetedEvent<HTMLInputElement>) {
    const nextDraft = getNextAmountDraft(draftAmount, event.currentTarget.value);
    if (nextDraft === draftAmount) return;

    setDraftAmount(nextDraft);

    if (isDirectInput) {
      amountChange(nextDraft);
    }
  }

  function finalizeAmountEdit() {
    if (isDirectInput) return;
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }

    const committedAmount = commitAmountDraft(draftAmount, data.amount);
    setDraftAmount(committedAmount);
    setIsEditingAmount(false);

    if (committedAmount !== data.amount) {
      amountChange(committedAmount);
    }
  }

  function revertAmountEdit() {
    if (isDirectInput) return;

    skipBlurCommitRef.current = true;
    setDraftAmount(cancelAmountEdit(data.amount));
    setIsEditingAmount(false);
  }

  function onAmountInputKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      finalizeAmountEdit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      revertAmountEdit();
    }
  }

  return (
    <section className={`fx-inline-currency-box fx-inline-currency-box--${variant}`}>
      <div className="fx-inline-currency-box__top">
        <p className="fx-inline-currency-box__name">{currencyName}</p>
        <CurrencyDropdown
          isDisabled={!isCurrencySelectable}
          selectedCurrency={data.code}
          selectedIcon={data.icon}
          onCurrencySelection={currencyChange}
        />
      </div>

      <div className="fx-inline-currency-box__amount-area">
        {shouldDisplayInput ? (
          <input
            ref={inputRef}
            className="fx-inline-currency-box__amount-input"
            type="text"
            inputMode="decimal"
            value={draftAmount}
            onInput={handleAmountChange}
            onBlur={finalizeAmountEdit}
            onKeyDown={onAmountInputKeyDown}
            aria-label={`${currencyName} amount`}
          />
        ) : (
          <button
            type="button"
            className="fx-inline-currency-box__amount-display"
            onClick={beginAmountEdit}
            aria-label={`Edit ${currencyName} amount`}
          >
            {displayAmount}
          </button>
        )}
      </div>

      <p className="fx-inline-currency-box__amount-meta">
        {amountPresentationMode === "displayThenEdit"
          ? "Click amount to edit"
          : "Amount updates instantly"}
      </p>
    </section>
  );
}

export default CurrencyBox;
