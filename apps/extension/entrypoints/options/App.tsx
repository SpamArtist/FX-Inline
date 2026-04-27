import currencies from "@/assets/currency.json";
import {
  DEFAULT_USER_SETTINGS,
  getUserSettings,
  setUserSettings,
} from "@/utils/appStorage";
import {
  cloneInlineRuntimeSettings,
  getPrimaryTargetCurrency,
} from "@/utils/inlineRuntimeSettings";
import { CurrencyCode } from "@/utils/enums";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import type { UserSettings } from "@/utils/appStorage.types";

function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [statusMessage, setStatusMessage] = useState("");

  const currencyOptions = useMemo(() => {
    const displayNames =
      typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames(["en"], { type: "currency" })
        : null;

    return currencies
      .map((entry) => {
        const code = entry.code as CurrencyCode;
        const currencyName =
          displayNames?.of(code)?.trim() || entry.name?.trim() || code;

        return {
          code,
          label: `${entry.logo ? `${entry.logo} ` : ""}${code} - ${currencyName}`,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, []);

  useEffect(() => {
    let canceled = false;

    const loadSettings = async () => {
      const persisted = await getUserSettings();
      if (canceled) return;

      setSettings(persisted);
    };

    void loadSettings();

    return () => {
      canceled = true;
    };
  }, []);

  async function onPreferredCurrencyChange(nextCurrency: CurrencyCode) {
    if (getPrimaryTargetCurrency(settings.scopes.allUrls) === nextCurrency) return;
    const updated = await setUserSettings({
      ...settings,
      scopes: {
        ...settings.scopes,
        allUrls: {
          ...cloneInlineRuntimeSettings(settings.scopes.allUrls),
          targetCurrencies: [nextCurrency],
        },
      },
    });
    setSettings(updated);
    setStatusMessage(`Preferred currency updated to ${nextCurrency}.`);
  }

  function handlePreferredCurrencyInputChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    void onPreferredCurrencyChange(event.target.value as CurrencyCode);
  }

  return (
    <main className="fx-inline-theme fx-inline-options-page">
      <section className="fx-inline-options-card">
        <div className="fx-inline-options-brand">
          <span className="fx-inline-shell__title">FX INLINE</span>
        </div>

        <div className="fx-inline-options-field">
          <label className="fx-inline-options-label" htmlFor="preferred-currency">
            Preferred Currency
          </label>
          <select
            className="fx-inline-options-select"
            id="preferred-currency"
            value={getPrimaryTargetCurrency(settings.scopes.allUrls)}
            onChange={handlePreferredCurrencyInputChange}
          >
            {currencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          {statusMessage && <p className="fx-inline-options-status">{statusMessage}</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
