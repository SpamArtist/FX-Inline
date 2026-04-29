import currencies from "../../assets/currency.json";
import type { UserSettings } from "../../utils/appStorage.types";
import type { CurrencyListEntry } from "../../utils/currencyPresentation.types";
import { CurrencyCode } from "../../utils/enums";
import type {
  CurrencyOption,
  MountedOptionsPage,
  MountOptionsPageParams,
} from "./optionsPage.types";

const DEFAULT_OPTIONS_PREFERRED_CURRENCY = CurrencyCode.EURO;
const VALID_CURRENCY_CODES: ReadonlySet<string> = new Set(
  Object.values(CurrencyCode),
);

function isCurrencyCode(value: string): value is CurrencyCode {
  return VALID_CURRENCY_CODES.has(value);
}

function getDisplayNames(): Pick<Intl.DisplayNames, "of"> | null {
  try {
    return typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "currency" })
      : null;
  } catch {
    return null;
  }
}

export function createCurrencyOptions(
  displayNames: Pick<Intl.DisplayNames, "of"> | null = getDisplayNames(),
): CurrencyOption[] {
  return (currencies as CurrencyListEntry[])
    .map((entry) => {
      const currencyName =
        displayNames?.of(entry.code)?.trim() || entry.name?.trim() || entry.code;

      return {
        code: entry.code,
        label: `${entry.logo ? `${entry.logo} ` : ""}${entry.code} - ${currencyName}`,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

function getPrimaryTargetCurrency(settings: UserSettings): CurrencyCode {
  const [currency] = settings.scopes.allUrls.targetCurrencies;
  return currency && isCurrencyCode(currency)
    ? currency
    : DEFAULT_OPTIONS_PREFERRED_CURRENCY;
}

function createSettingsWithPreferredCurrency(
  settings: UserSettings,
  nextCurrency: CurrencyCode,
): UserSettings {
  return {
    ...settings,
    scopes: {
      ...settings.scopes,
      allUrls: {
        ...settings.scopes.allUrls,
        targetCurrencies: [nextCurrency],
      },
    },
  };
}

function appendOptionElements(select: HTMLSelectElement, options: CurrencyOption[]) {
  const ownerDocument = select.ownerDocument;
  const fragment = ownerDocument.createDocumentFragment();

  for (const option of options) {
    const optionElement = ownerDocument.createElement("option");
    optionElement.value = option.code;
    optionElement.textContent = option.label;
    fragment.append(optionElement);
  }

  select.append(fragment);
}

function setStatus(statusElement: HTMLParagraphElement, message: string) {
  statusElement.textContent = message;
  statusElement.hidden = !message;
}

export function mountOptionsPage(
  root: HTMLElement | null,
  params: MountOptionsPageParams,
): MountedOptionsPage {
  if (!root) {
    throw new Error("Options page root element was not found.");
  }

  const ownerDocument = root.ownerDocument;
  const main = ownerDocument.createElement("main");
  main.className = "fx-inline-theme fx-inline-options-page";

  const section = ownerDocument.createElement("section");
  section.className = "fx-inline-options-card";

  const brand = ownerDocument.createElement("div");
  brand.className = "fx-inline-options-brand";

  const title = ownerDocument.createElement("span");
  title.className = "fx-inline-shell__title";
  title.textContent = "FX INLINE";

  const field = ownerDocument.createElement("div");
  field.className = "fx-inline-options-field";

  const label = ownerDocument.createElement("label");
  label.className = "fx-inline-options-label";
  label.htmlFor = "preferred-currency";
  label.textContent = "Preferred Currency";

  const select = ownerDocument.createElement("select");
  select.className = "fx-inline-options-select";
  select.id = "preferred-currency";
  appendOptionElements(select, createCurrencyOptions());

  const status = ownerDocument.createElement("p");
  status.className = "fx-inline-options-status";
  status.hidden = true;

  brand.append(title);
  field.append(label, select, status);
  section.append(brand, field);
  main.append(section);
  root.replaceChildren(main);

  let destroyed = false;
  let currentSettings: UserSettings | null = null;
  let currentCurrency =
    params.initialPreferredCurrency ?? DEFAULT_OPTIONS_PREFERRED_CURRENCY;
  select.value = currentCurrency;
  select.disabled = true;

  const loadSettings = async () => {
    try {
      const persistedSettings = await params.readUserSettings();
      if (destroyed) return;

      currentSettings = persistedSettings;
      currentCurrency = getPrimaryTargetCurrency(persistedSettings);
      select.value = currentCurrency;
      setStatus(status, "");
    } catch {
      if (!destroyed) {
        setStatus(status, "Unable to load preferred currency.");
      }
    } finally {
      if (!destroyed) {
        select.disabled = false;
      }
    }
  };

  const handlePreferredCurrencyChange = async () => {
    const nextCurrency = select.value;
    if (!isCurrencyCode(nextCurrency)) {
      select.value = currentCurrency;
      return;
    }

    if (nextCurrency === currentCurrency) return;

    select.disabled = true;

    try {
      const baseSettings = currentSettings ?? (await params.readUserSettings());
      const persistedSettings = await params.writeUserSettings(
        createSettingsWithPreferredCurrency(baseSettings, nextCurrency),
      );
      if (destroyed) return;

      currentSettings = persistedSettings;
      currentCurrency = getPrimaryTargetCurrency(persistedSettings);
      select.value = currentCurrency;
      setStatus(status, `Preferred currency updated to ${currentCurrency}.`);
    } catch {
      if (!destroyed) {
        select.value = currentCurrency;
        setStatus(status, "Unable to update preferred currency.");
      }
    } finally {
      if (!destroyed) {
        select.disabled = false;
      }
    }
  };

  select.addEventListener("change", handlePreferredCurrencyChange);
  void loadSettings();

  return {
    destroy() {
      destroyed = true;
      select.removeEventListener("change", handlePreferredCurrencyChange);
    },
  };
}
