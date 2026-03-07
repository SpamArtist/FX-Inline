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
import "../popup/App.css";

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
    <main className="options-shell">
      <h1 className="options-title">Currency Converter Settings</h1>
      <p className="options-subtitle">
        Manage your preferred currency.
      </p>

      <div className="settings-panel">
        <label htmlFor="preferred-currency">Preferred currency</label>
        <select
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
        {statusMessage && <p className="status-message">{statusMessage}</p>}
      </div>
    </main>
  );
}

export default App;
