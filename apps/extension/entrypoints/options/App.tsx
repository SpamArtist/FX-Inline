import "@/assets/tailwind.css";
import currencies from "@/assets/currency.json";
import {
  DEFAULT_USER_SETTINGS,
  getUserSettings,
  updateUserSettings,
  UserSettings,
} from "@/utils/appStorage";
import { CurrencyCode } from "@/utils/enums";
import { useEffect, useMemo, useState } from "react";

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
    if (settings.preferredCurrency === nextCurrency) return;
    const updated = await updateUserSettings({ preferredCurrency: nextCurrency });
    setSettings(updated);
    setStatusMessage(`Preferred currency updated to ${nextCurrency}.`);
  }

  return (
    <main className="ccx-theme ccx-options-page">
      <section className="ccx-options-card">
        <div className="ccx-options-brand">
          <span className="ccx-shell__title">FX INLINE</span>
        </div>
        <h1 className="ccx-options-title">FX Inline Settings</h1>
        <p className="ccx-options-subtitle">Manage your preferred currency.</p>

        <div className="ccx-options-field">
          <label className="ccx-options-label" htmlFor="preferred-currency">
            Preferred Currency
          </label>
          <select
            className="ccx-options-select"
            id="preferred-currency"
            value={settings.preferredCurrency}
            onChange={(event) =>
              void onPreferredCurrencyChange(event.target.value as CurrencyCode)
            }
          >
            {currencyOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          {statusMessage && <p className="ccx-options-status">{statusMessage}</p>}
        </div>
      </section>
    </main>
  );
}

export default App;
