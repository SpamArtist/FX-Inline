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
  hasAuthSession,
  updateUserSettings,
  UserSettings,
} from "@/utils/appStorage";
import {
  authenticateWithBackend,
  createCheckoutSession,
  createCustomerPortalSession,
  signOutFromBackend,
  syncEntitlementWithBackend,
} from "@/utils/accountService";
import { ActionType, CurrencyCode } from "@/utils/enums";
import { browser } from "wxt/browser";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

const DEFAULT_STARTING_CURRENCY = CurrencyCode["UNITED STATES DOLLAR"];

function toFriendlyDate(epochMs: number | null): string {
  if (!epochMs) return "-";

  try {
    return new Date(epochMs).toLocaleDateString();
  } catch {
    return "-";
  }
}

function App() {
  const [currenciesState, dispatch] = useCurrencyReducer({
    number: "100",
    currency: DEFAULT_STARTING_CURRENCY,
  });

  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

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
      setEmailInput(persisted.auth.email || "");
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

  async function runAuth(mode: "signup" | "signin") {
    if (!emailInput.trim() || !passwordInput.trim()) {
      setStatusMessage("Email and password are required.");
      return;
    }

    setIsBusy(true);

    try {
      const updated = await authenticateWithBackend({
        mode,
        email: emailInput,
        password: passwordInput,
      });

      setSettings(updated);
      setPasswordInput("");
      setStatusMessage(
        mode === "signup"
          ? "Account created and signed in."
          : "Signed in successfully.",
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function onRefreshEntitlement() {
    setIsBusy(true);

    try {
      const updated = await syncEntitlementWithBackend();
      setSettings(updated);
      setStatusMessage("Entitlement synced from backend.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to sync entitlement.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function onSignOut() {
    setIsBusy(true);

    try {
      const updated = await signOutFromBackend();
      setSettings(updated);
      setPasswordInput("");
      setStatusMessage("Signed out. Free tier is active.");
    } catch {
      setStatusMessage("Failed to sign out cleanly, local session cleared.");
    } finally {
      setIsBusy(false);
    }
  }

  async function onCheckout() {
    setIsBusy(true);

    try {
      const session = await createCheckoutSession();
      await browser.tabs.create({ url: session.checkoutUrl });
      setStatusMessage("Opened checkout in a new tab.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to open checkout.");
    } finally {
      setIsBusy(false);
    }
  }

  async function onManageBilling() {
    setIsBusy(true);

    try {
      const session = await createCustomerPortalSession();
      await browser.tabs.create({ url: session.portalUrl });
      setStatusMessage("Opened billing portal in a new tab.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to open billing portal.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  const signedIn = hasAuthSession(settings);

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

        <div className="auth-grid">
          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <label htmlFor="account-password">Password</label>
          <input
            id="account-password"
            type="password"
            value={passwordInput}
            onChange={(event) => setPasswordInput(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="current-password"
          />
        </div>

        <div className="subscription-actions">
          <button type="button" disabled={isBusy} onClick={() => runAuth("signup")}>
            Sign Up
          </button>
          <button type="button" disabled={isBusy} onClick={() => runAuth("signin")}>
            Sign In
          </button>
          <button type="button" disabled={isBusy || !signedIn} onClick={onSignOut}>
            Sign Out
          </button>
        </div>

        <div className="subscription-actions">
          <button type="button" disabled={isBusy || !signedIn} onClick={onRefreshEntitlement}>
            Sync Plan
          </button>
          <button type="button" disabled={isBusy || !signedIn} onClick={onCheckout}>
            Checkout
          </button>
          <button type="button" disabled={isBusy || !signedIn} onClick={onManageBilling}>
            Billing Portal
          </button>
        </div>

        <p className="plan-hint">
          Plan: <strong>{settings.entitlement.status}</strong> ({settings.entitlement.planTier})
        </p>
        <p className="plan-hint">
          Trial ends: <strong>{toFriendlyDate(settings.entitlement.trialEndsAt)}</strong>
        </p>
        <p className="plan-hint">
          Remaining today: <strong>{settings.entitlement.remainingToday ?? "-"}</strong> /
          {" "}
          {settings.entitlement.dailyLimit}
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
