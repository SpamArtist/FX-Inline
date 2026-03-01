import PlusIcon from "@/assets/add_outline.svg";
import SwapVerticalIcon from "@/assets/swap_vertical_outline.svg";
import "@/assets/tailwind.css";
import currencies from "@/assets/currency.json";
import { ConvertorHOD } from "@/components/Convertor/Convertor";
import CurrencyBox from "@/components/CurrencyBox/CurrencyBox";
import { useCurrencyReducer } from "@/hooks/useCurrencyReducer";
import {
  DEFAULT_USER_SETTINGS,
  getUserSettings,
  updateUserSettings,
  UserSettings,
} from "@/utils/appStorage";
import { ActionType, CurrencyCode } from "@/utils/enums";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./App.css";

const DEFAULT_STARTING_CURRENCY = CurrencyCode["UNITED STATES DOLLAR"];

function App() {
  const [currenciesState, dispatch] = useCurrencyReducer({
    number: "100",
    currency: DEFAULT_STARTING_CURRENCY,
  });

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [subscriptionTokenInput, setSubscriptionTokenInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const currencyOptions = useMemo(
    () =>
      currencies
        .map((entry) => ({
          code: entry.code as CurrencyCode,
          label: `${entry.logo ? `${entry.logo} ` : ""}${entry.code}`,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [],
  );

  useEffect(() => {
    let canceled = false;

    const loadSettings = async () => {
      const persisted = await getUserSettings();
      if (canceled) return;

      setSettings(persisted);
      setSubscriptionTokenInput(persisted.subscription.token || "");
    };

    loadSettings();

    return () => {
      canceled = true;
    };
  }, []);

  async function onPreferredCurrencyChange(nextCurrency: CurrencyCode) {
    const updated = await updateUserSettings({ preferredCurrency: nextCurrency });
    setSettings(updated);
    setStatusMessage(`Preferred currency updated to ${nextCurrency}.`);
  }

  async function onPlanChange(nextPlan: UserSettings["planTier"]) {
    const updated = await updateUserSettings({ planTier: nextPlan });
    setSettings(updated);

    if (nextPlan === "free") {
      setStatusMessage("Free plan enabled. Rates refresh once per market day.");
      return;
    }

    setStatusMessage(
      "Paid plan selected. Add a subscription token and activate paid access.",
    );
  }

  async function onActivatePaidAccess(event: FormEvent) {
    event.preventDefault();

    if (!subscriptionTokenInput.trim()) {
      setStatusMessage("Subscription token is required to activate paid access.");
      return;
    }

    const updated = await updateUserSettings({
      planTier: "paid",
      subscription: {
        token: subscriptionTokenInput.trim(),
        isActive: true,
      },
    });

    setSettings(updated);
    setStatusMessage("Paid access activated. Rates now refresh continuously.");
  }

  async function onDowngradeToFree() {
    const updated = await updateUserSettings({
      planTier: "free",
      subscription: {
        ...settings.subscription,
        isActive: false,
      },
    });

    setSettings(updated);
    setStatusMessage("Switched to free plan.");
  }

  return (
    <ConvertorHOD shouldDisplayHeader>
      <div className="settings-panel">
        <label htmlFor="preferred-currency">Preferred currency</label>
        <select
          id="preferred-currency"
          value={settings.preferredCurrency}
          onChange={(event) =>
            onPreferredCurrencyChange(event.target.value as CurrencyCode)
          }
        >
          {currencyOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>

        <label htmlFor="plan-tier">Plan</label>
        <select
          id="plan-tier"
          value={settings.planTier}
          onChange={(event) =>
            onPlanChange(event.target.value as UserSettings["planTier"])
          }
        >
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>

        <form onSubmit={onActivatePaidAccess} className="subscription-form">
          <label htmlFor="subscription-token">Subscription token</label>
          <input
            id="subscription-token"
            type="password"
            value={subscriptionTokenInput}
            onChange={(event) => setSubscriptionTokenInput(event.target.value)}
            placeholder="Paste paid subscription token"
          />
          <div className="subscription-actions">
            <button type="submit">Activate Paid</button>
            <button type="button" onClick={onDowngradeToFree}>
              Use Free
            </button>
          </div>
        </form>

        <p className="plan-hint">
          {settings.planTier === "paid" && settings.subscription.isActive
            ? "Paid is active: latest rates are fetched frequently."
            : "Free is active: one rate snapshot is used per market day."}
        </p>
        {statusMessage && <p className="status-message">{statusMessage}</p>}
      </div>

      <div className="relative flex flex-col items-center mb-2.5 mx-2.5 pb-[1.2em] py-0 bg-inherit text-[wheat]">
        {currenciesState.map((currentCurrency, i) => (
          <div
            key={currentCurrency.id}
            className="relative flex flex-col items-center w-72.5"
          >
            <CurrencyBox
              isDisabled={false}
              key={currentCurrency.id}
              data={currentCurrency}
              containerStyle="px-[0.8em] py-[1.5em] rounded-xl shadow-lg outline outline-black/5 dark:bg-white-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 gap-x-[0.5em]"
              dropDownContainerStyle="flex-[1.2] mt-[0.875em]"
              inputContainerStyle="flex flex-col gap-[0.35em] flex-3"
              amountChange={(updatedAmount) =>
                dispatch({
                  type: ActionType.AMOUNT_UPDATE,
                  payload: { id: currentCurrency.id, amount: updatedAmount },
                })
              }
              currencyChange={(updatedCurrency) =>
                dispatch({
                  type: ActionType.CURRENCY_UPDATE,
                  payload: {
                    id: currentCurrency.id,
                    currency: updatedCurrency,
                  },
                })
              }
            />
            {i !== currenciesState.length - 1 && (
              <button
                className="absolute -bottom-4 z-10 cursor-pointer"
                onClick={() =>
                  dispatch({
                    type: ActionType.CURRENCY_SWAP,
                    payload: {
                      id: currentCurrency.id,
                    },
                  })
                }
              >
                <SwapVerticalIcon />
              </button>
            )}
          </div>
        ))}
        <button
          className="absolute -bottom-4 z-10 cursor-pointer"
          onClick={() =>
            dispatch({
              type: ActionType.CURRENCY_ADD,
              payload: {},
            })
          }
        >
          <PlusIcon />
        </button>
      </div>
    </ConvertorHOD>
  );
}

export default App;
