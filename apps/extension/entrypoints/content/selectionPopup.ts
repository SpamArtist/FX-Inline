import {
  cancelAmountEdit,
  commitAmountDraft,
  formatCurrencyHeadlineAmount,
  getCurrencyDisplayName,
  getNextAmountDraft,
} from "@/utils/currencyPresentation";
import type { CurrencyCode } from "@/utils/enums";
import type { CurrencyState } from "@/utils/types";
import type { SelectionPopupController } from "./content.types";
import {
  createSelectionPopupStateStore,
  type SelectionPopupStateStore,
} from "./selectionPopup/state";

type PopupView = {
  root: HTMLElement;
  destroy: () => void;
};

type AmountRowView = {
  rowRoot: HTMLElement;
  nameLabel: HTMLParagraphElement;
  currencyLabel: HTMLSpanElement;
  currencyIcon: HTMLSpanElement;
  amountArea: HTMLDivElement;
  isEditing: boolean;
  draftAmount: string;
  skipBlurCommit: boolean;
};

const SELECTION_META_TEXT = "Click amount to edit";

function resolveLocale(localeHint?: string | null): string {
  if (localeHint && localeHint.trim().length > 0) {
    return localeHint;
  }

  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.language || "en";
}

function createAmountRowView(): AmountRowView {
  const rowRoot = document.createElement("section");
  rowRoot.className = "fx-inline-currency-box fx-inline-currency-box--selection";

  const top = document.createElement("div");
  top.className = "fx-inline-currency-box__top";

  const nameLabel = document.createElement("p");
  nameLabel.className = "fx-inline-currency-box__name";
  top.appendChild(nameLabel);

  const currencyChip = document.createElement("button");
  currencyChip.type = "button";
  currencyChip.className = "fx-inline-dropdown-trigger";
  currencyChip.disabled = true;

  const currencyIcon = document.createElement("span");
  currencyIcon.className = "fx-inline-dropdown-trigger__icon";
  currencyIcon.setAttribute("aria-hidden", "true");

  const currencyLabel = document.createElement("span");
  currencyLabel.className = "fx-inline-dropdown-trigger__label";

  currencyChip.append(currencyIcon, currencyLabel);
  top.appendChild(currencyChip);

  const amountArea = document.createElement("div");
  amountArea.className = "fx-inline-currency-box__amount-area";

  const meta = document.createElement("p");
  meta.className = "fx-inline-currency-box__amount-meta";
  meta.textContent = SELECTION_META_TEXT;

  rowRoot.append(top, amountArea, meta);

  return {
    rowRoot,
    nameLabel,
    currencyLabel,
    currencyIcon,
    amountArea,
    isEditing: false,
    draftAmount: "",
    skipBlurCommit: false,
  };
}

function createSelectionPopupView(
  amount: string,
  currency: CurrencyCode,
): PopupView {
  const root = document.createElement("section");
  root.className = "fx-inline-theme fx-inline-shell fx-inline-shell--selection";

  const shellInner = document.createElement("div");
  shellInner.className = "fx-inline-shell__inner";

  const header = document.createElement("header");
  header.className = "fx-inline-shell__header";

  const title = document.createElement("h2");
  title.className = "fx-inline-shell__title";
  title.textContent = "FX INLINE";
  header.appendChild(title);

  const layout = document.createElement("div");
  layout.className = "fx-inline-converter-layout fx-inline-converter-layout--selection";

  const sourceRow = createAmountRowView();
  const divider = document.createElement("div");
  divider.className = "fx-inline-converter-divider";
  divider.setAttribute("aria-hidden", "true");
  const targetRow = createAmountRowView();

  layout.append(sourceRow.rowRoot, divider, targetRow.rowRoot);
  shellInner.append(header, layout);
  root.appendChild(shellInner);

  const rows: AmountRowView[] = [sourceRow, targetRow];
  const locale = resolveLocale(null);
  const store = createSelectionPopupStateStore({
    amount,
    sourceCurrency: currency,
  });

  function renderRow(
    row: AmountRowView,
    currencyState: CurrencyState,
    rowIndex: number,
  ) {
    if (!row.isEditing) {
      row.draftAmount = currencyState.amount;
    }

    row.nameLabel.textContent = getCurrencyDisplayName(currencyState.code, locale);
    row.currencyLabel.textContent = currencyState.code;
    row.currencyIcon.textContent = currencyState.icon || "$";

    row.amountArea.replaceChildren();

    if (row.isEditing) {
      const input = document.createElement("input");
      input.className = "fx-inline-currency-box__amount-input";
      input.type = "text";
      input.inputMode = "decimal";
      input.value = row.draftAmount;
      input.setAttribute("aria-label", `${row.nameLabel.textContent || currencyState.code} amount`);

      input.addEventListener("input", () => {
        const nextDraft = getNextAmountDraft(row.draftAmount, input.value);
        if (nextDraft === row.draftAmount) {
          input.value = row.draftAmount;
          return;
        }

        row.draftAmount = nextDraft;
      });

      input.addEventListener("blur", () => {
        const snapshot = store.getSnapshot();
        const nextState = snapshot.currencies[rowIndex];
        if (!nextState?.id) return;

        if (row.skipBlurCommit) {
          row.skipBlurCommit = false;
          return;
        }

        row.isEditing = false;
        const committedAmount = commitAmountDraft(row.draftAmount, nextState.amount);
        row.draftAmount = committedAmount;

        if (committedAmount !== nextState.amount) {
          store.updateAmount(nextState.id, committedAmount);
          return;
        }

        render();
      });

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          input.blur();
          return;
        }

        if (event.key !== "Escape") return;

        event.preventDefault();
        row.skipBlurCommit = true;
        row.isEditing = false;
        row.draftAmount = cancelAmountEdit(currencyState.amount);
        render();
      });

      row.amountArea.appendChild(input);
      window.setTimeout(() => {
        input.focus();
        input.select();
      }, 0);
      return;
    }

    const amountButton = document.createElement("button");
    amountButton.type = "button";
    amountButton.className = "fx-inline-currency-box__amount-display";
    amountButton.textContent = formatCurrencyHeadlineAmount(
      currencyState.amount,
      currencyState.code,
      locale,
    );
    amountButton.setAttribute(
      "aria-label",
      `Edit ${row.nameLabel.textContent || currencyState.code} amount`,
    );

    amountButton.addEventListener("click", () => {
      row.skipBlurCommit = false;
      row.draftAmount = currencyState.amount;
      row.isEditing = true;
      render();
    });

    row.amountArea.appendChild(amountButton);
  }

  function render() {
    const snapshot = store.getSnapshot();
    const sourceCurrency = snapshot.currencies[0];
    const targetCurrency = snapshot.currencies[1];

    if (!sourceCurrency || !targetCurrency) {
      layout.replaceChildren();
      return;
    }

    renderRow(sourceRow, sourceCurrency, 0);
    renderRow(targetRow, targetCurrency, 1);
  }

  const unsubscribe = store.subscribe(() => {
    render();
  });

  render();

  return {
    root,
    destroy: () => {
      unsubscribe();
      store.destroy();
    },
  };
}

export function createSelectionPopupController(
  contentStyleText: string,
): SelectionPopupController {
  let popupRoot: HTMLDivElement | null = null;
  let popupView: PopupView | null = null;

  function removePopup() {
    if (!popupRoot || !document.body.contains(popupRoot)) return;

    popupView?.destroy();
    popupView = null;

    document.body.removeChild(popupRoot);
    popupRoot = null;
  }

  function showPopup(
    x: number,
    y: number,
    amount: string,
    currency: CurrencyCode,
  ) {
    removePopup();

    popupRoot = document.createElement("div");
    popupRoot.id = "popup-root";

    const shadowRoot = popupRoot.attachShadow({
      mode: "open",
    });

    const contentStyleTag = document.createElement("style");
    contentStyleTag.id = "content-styles";
    contentStyleTag.textContent = contentStyleText;
    shadowRoot.appendChild(contentStyleTag);

    popupRoot.style.position = "absolute";
    popupRoot.style.top = `${y}px`;
    popupRoot.style.left = `${x}px`;
    popupRoot.style.zIndex = "9999999";
    popupRoot.style.pointerEvents = "auto";

    const popupContainer = document.createElement("div");
    popupContainer.id = "popup-react-container";
    popupContainer.className = "fx-inline-selection-popup-host";
    shadowRoot.appendChild(popupContainer);

    document.body.appendChild(popupRoot);

    popupView = createSelectionPopupView(amount, currency);
    popupContainer.appendChild(popupView.root);
  }

  return {
    showPopup,
    removePopup,
    containsTarget: (target) => Boolean(popupRoot?.contains(target)),
    getRoot: () => popupRoot,
    destroy: () => removePopup(),
  };
}
