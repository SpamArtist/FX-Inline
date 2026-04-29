import { ConvertorHOD } from "@/components/Convertor/Convertor";
import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import {
  DEFAULT_USER_SETTINGS,
  getOriginFromUrl,
  getUserSettings,
  setUserSettings,
} from "@/utils/appStorage";
import {
  cloneInlineRuntimeSettings,
  normalizeDomainScope,
  resolveInlineRuntimeSettingsForUrl,
} from "@/utils/inlineRuntimeSettings";
import { DEFAULT_STARTING_CURRENCY } from "@/utils/constants";
import { ActionType, type CurrencyCode } from "@/utils/enums";
import SwitchIcon from "@/assets/switch.svg?component";
import ToggleOffIcon from "@/assets/toggle-off.svg?component";
import ToggleOnIcon from "@/assets/toggle-on.svg?component";
import { ArrowLeftRightIcon, CogIcon } from "@/components/icons/NativeIcons";
import { useEffect, useState } from "preact/hooks";
import { browser } from "wxt/browser";
import "./App.css";

const FEEDBACK_URL = "https://share.formgrid.com/9C13psBXtryfGlHL";

function App() {
  const [currenciesState, dispatch] = useCurrencyReducer({
    number: "100",
    currency: DEFAULT_STARTING_CURRENCY,
  });
  const [globalAutoConversionEnabled, setGlobalAutoConversionEnabled] = useState(
    DEFAULT_USER_SETTINGS.scopes.allUrls.enabled,
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

  async function onOpenFeedback() {
    try {
      await browser.tabs.create({
        url: FEEDBACK_URL,
      });
    } catch {
      window.open(FEEDBACK_URL, "_blank", "noopener,noreferrer");
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
        persisted.scopes.allUrls.enabled !== false,
      );
      setLocalAutoConversionEnabled(
        resolveInlineRuntimeSettingsForUrl(persisted, activeTabOrigin).settings.enabled,
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
      const currentSettings = await getUserSettings();
      const persisted = await setUserSettings({
        ...currentSettings,
        scopes: {
          ...currentSettings.scopes,
          allUrls: {
            ...currentSettings.scopes.allUrls,
            enabled: nextGlobalAutoConversionEnabled,
          },
        },
      });
      setGlobalAutoConversionEnabled(
        persisted.scopes.allUrls.enabled !== false,
      );
    } catch {
      const fallback = await getUserSettings();
      setGlobalAutoConversionEnabled(
        fallback.scopes.allUrls.enabled !== false,
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
      const domain = normalizeDomainScope(currentTabOrigin);
      if (!domain) return;

      const existingDomainSettings = currentSettings.scopes.domains[domain];
      const nextDomainSettings = {
        ...cloneInlineRuntimeSettings(
          existingDomainSettings ?? currentSettings.scopes.allUrls,
        ),
        domain,
        pageUrl: "",
        enabled: nextLocalAutoConversionEnabled,
      };

      const persisted = await setUserSettings({
        ...currentSettings,
        scopes: {
          ...currentSettings.scopes,
          domains: {
            ...currentSettings.scopes.domains,
            [domain]: nextDomainSettings,
          },
        },
      });
      setLocalAutoConversionEnabled(
        resolveInlineRuntimeSettingsForUrl(persisted, currentTabOrigin).settings.enabled,
      );
    } catch {
      const fallback = await getUserSettings();
      setLocalAutoConversionEnabled(
        resolveInlineRuntimeSettingsForUrl(fallback, currentTabOrigin).settings.enabled,
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
    <main className="fx-inline-popup-page">
      <ConvertorHOD
        variant="popup"
        headerActions={(
          <>
            <button
              type="button"
              className={`fx-inline-settings-button fx-inline-toggle-button ${
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
              className={`fx-inline-settings-button fx-inline-toggle-button ${
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
              className="fx-inline-settings-button"
              onClick={onOpenSettings}
              aria-label="Open extension options"
              title="Open extension options"
            >
              <CogIcon size={16} aria-hidden />
            </button>
          </>
        )}
      >
        {sourceCurrency && targetCurrency ? (
          <div className="fx-inline-converter-layout fx-inline-popup-layout">
            <button
              type="button"
              className="fx-inline-converter-swap"
              onClick={onSwapCurrencies}
              aria-label="Swap currencies"
              title="Swap currencies"
            >
              <ArrowLeftRightIcon size={16} aria-hidden />
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

            <div className="fx-inline-converter-divider" aria-hidden />

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
        <div className="fx-inline-popup-footer">
          <button
            type="button"
            className="fx-inline-popup-feedback-button"
            onClick={onOpenFeedback}
            aria-label="Share feedback (opens in a new tab)"
            title="Share feedback (opens in a new tab)"
          >
            Feedback ↗
          </button>
          <p className="fx-inline-popup-meta">© {currentYear} FX Inline</p>
        </div>
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
