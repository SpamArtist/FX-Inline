import { ConvertorHOD } from "@/components/Convertor/Convertor";
import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import {
  DEFAULT_USER_SETTINGS,
  getOriginFromUrl,
  getUserSettings,
  isLocalAutoConversionEnabledForOrigin,
  updateUserSettings,
} from "@/utils/appStorage";
import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { ActionType, type CurrencyCode } from "@/utils/enums";
import SwitchIcon from "@/assets/switch.svg";
import ToggleOffIcon from "@/assets/toggle-off.svg";
import ToggleOnIcon from "@/assets/toggle-on.svg";
import { ArrowLeftRight, Cog } from "lucide-react";
import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import "./App.css";

function App() {
  const [currenciesState, dispatch] = useCurrencyReducer({
    number: "100",
    currency: DEFAULT_STARTING_CURRENCY,
  });
  const [globalAutoConversionEnabled, setGlobalAutoConversionEnabled] = useState(
    DEFAULT_USER_SETTINGS.globalAutoConversionEnabled,
  );
  const [localAutoConversionEnabled, setLocalAutoConversionEnabled] = useState(true);
  const [currentTabOrigin, setCurrentTabOrigin] = useState<string | null>(null);
  const [isGlobalTogglePending, setIsGlobalTogglePending] = useState(false);
  const [isLocalTogglePending, setIsLocalTogglePending] = useState(false);
  const currentYear = new Date().getFullYear();

  async function onOpenSettings() {
    try {
      await browser.runtime.openOptionsPage();
    } catch {
      await browser.tabs.create({
        url: browser.runtime.getURL("/options.html"),
      });
    }
  }

  useEffect(() => {
    let canceled = false;

    const loadSettings = async () => {
      const [persisted, activeTabOrigin] = await Promise.all([
        getUserSettings(),
        getActiveTabOrigin(),
      ]);
      if (canceled) return;

      setCurrentTabOrigin(activeTabOrigin);
      setGlobalAutoConversionEnabled(
        persisted.globalAutoConversionEnabled !== false,
      );
      setLocalAutoConversionEnabled(
        isLocalAutoConversionEnabledForOrigin(persisted, activeTabOrigin),
      );
    };

    void loadSettings();

    return () => {
      canceled = true;
    };
  }, []);

  async function onToggleGlobalAutoConversion() {
    if (isGlobalTogglePending) return;

    const nextGlobalAutoConversionEnabled = !globalAutoConversionEnabled;
    setGlobalAutoConversionEnabled(nextGlobalAutoConversionEnabled);
    setIsGlobalTogglePending(true);

    try {
      const persisted = await updateUserSettings({
        globalAutoConversionEnabled: nextGlobalAutoConversionEnabled,
      });
      setGlobalAutoConversionEnabled(
        persisted.globalAutoConversionEnabled !== false,
      );
    } catch {
      const fallback = await getUserSettings();
      setGlobalAutoConversionEnabled(
        fallback.globalAutoConversionEnabled !== false,
      );
    } finally {
      setIsGlobalTogglePending(false);
    }
  }

  async function onToggleLocalAutoConversion() {
    if (!currentTabOrigin || isLocalTogglePending) return;

    const nextLocalAutoConversionEnabled = !localAutoConversionEnabled;
    setLocalAutoConversionEnabled(nextLocalAutoConversionEnabled);
    setIsLocalTogglePending(true);

    try {
      const currentSettings = await getUserSettings();
      const nextLocalSettingsByOrigin = {
        ...currentSettings.localAutoConversionByOrigin,
        [currentTabOrigin]: nextLocalAutoConversionEnabled,
      };

      if (nextLocalAutoConversionEnabled) {
        delete nextLocalSettingsByOrigin[currentTabOrigin];
      }

      const persisted = await updateUserSettings({
        localAutoConversionByOrigin: nextLocalSettingsByOrigin,
      });
      setLocalAutoConversionEnabled(
        isLocalAutoConversionEnabledForOrigin(persisted, currentTabOrigin),
      );
    } catch {
      const fallback = await getUserSettings();
      setLocalAutoConversionEnabled(
        isLocalAutoConversionEnabledForOrigin(fallback, currentTabOrigin),
      );
    } finally {
      setIsLocalTogglePending(false);
    }
  }

  const sourceCurrency = currenciesState[0];
  const targetCurrency = currenciesState[1];
  const LocalToggleIcon = localAutoConversionEnabled ? ToggleOnIcon : ToggleOffIcon;

  function onSwapCurrencies() {
    if (!sourceCurrency?.id) return;

    dispatch({
      type: ActionType.CURRENCY_SWAP,
      payload: {
        id: sourceCurrency.id,
      },
    });
  }

  function updateAmount(id: string | undefined, amount: string) {
    if (!id) return;
    dispatch({
      type: ActionType.AMOUNT_UPDATE,
      payload: { id, amount },
    });
  }

  function updateCurrency(id: string | undefined, currency: CurrencyCode) {
    if (!id) return;
    dispatch({
      type: ActionType.CURRENCY_UPDATE,
      payload: {
        id,
        currency,
      },
    });
  }

  return (
    <main className="ccx-popup-page">
      <ConvertorHOD
        variant="popup"
        headerActions={(
          <>
            <button
              type="button"
              className={`ccx-settings-button ccx-toggle-button ${
                localAutoConversionEnabled ? "is-on" : "is-off"
              }`}
              onClick={onToggleLocalAutoConversion}
              disabled={!currentTabOrigin || isLocalTogglePending}
              aria-label={`Local auto conversion ${localAutoConversionEnabled ? "on" : "off"}`}
              title={
                currentTabOrigin
                  ? `Local auto conversion on this page: ${
                    localAutoConversionEnabled ? "On" : "Off"
                  }`
                  : "Local auto conversion is unavailable on this page"
              }
            >
              <LocalToggleIcon aria-hidden />
            </button>

            <button
              type="button"
              className={`ccx-settings-button ccx-toggle-button ${
                globalAutoConversionEnabled ? "is-on" : "is-off"
              }`}
              onClick={onToggleGlobalAutoConversion}
              disabled={isGlobalTogglePending}
              aria-label={`Global auto conversion ${globalAutoConversionEnabled ? "on" : "off"}`}
              title={`Global auto conversion: ${globalAutoConversionEnabled ? "On" : "Off"}`}
            >
              <SwitchIcon aria-hidden />
            </button>

            <button
              type="button"
              className="ccx-settings-button"
              onClick={onOpenSettings}
              aria-label="Open extension options"
              title="Open extension options"
            >
              <Cog size={16} aria-hidden />
            </button>
          </>
        )}
      >
        {sourceCurrency && targetCurrency ? (
          <div className="ccx-converter-layout ccx-popup-layout">
            <button
              type="button"
              className="ccx-converter-swap"
              onClick={onSwapCurrencies}
              aria-label="Swap currencies"
              title="Swap currencies"
            >
              <ArrowLeftRight size={16} aria-hidden />
            </button>

            <CurrencyBox
              variant="popup"
              isCurrencySelectable
              amountPresentationMode="displayThenEdit"
              data={sourceCurrency}
              amountChange={(updatedAmount) => updateAmount(sourceCurrency.id, updatedAmount)}
              currencyChange={(updatedCurrency) =>
                updateCurrency(sourceCurrency.id, updatedCurrency)
              }
            />

            <div className="ccx-converter-divider" aria-hidden />

            <CurrencyBox
              variant="popup"
              isCurrencySelectable
              amountPresentationMode="displayThenEdit"
              data={targetCurrency}
              amountChange={(updatedAmount) => updateAmount(targetCurrency.id, updatedAmount)}
              currencyChange={(updatedCurrency) =>
                updateCurrency(targetCurrency.id, updatedCurrency)
              }
            />
          </div>
        ) : null}
        <p className="ccx-popup-meta">© {currentYear} FX Inline</p>
      </ConvertorHOD>
    </main>
  );
}

export default App;

async function getActiveTabOrigin(): Promise<string | null> {
  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  return getOriginFromUrl(activeTab?.url);
}
