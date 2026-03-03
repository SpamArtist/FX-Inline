import "@/assets/tailwind.css";
import currencies from "@/assets/currency.json";
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
import { CurrencyCode } from "@/utils/enums";
import { browser } from "wxt/browser";
import { useEffect, useMemo, useState } from "react";
import "../popup/App.css";

function toFriendlyDate(epochMs: number | null): string {
  if (!epochMs) return "-";

  try {
    return new Date(epochMs).toLocaleDateString();
  } catch {
    return "-";
  }
}

function App() {
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

    void loadSettings();

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
    <main className="options-shell">
      <h1 className="options-title">Currency Converter Settings</h1>
      <p className="options-subtitle">
        Manage your preferred currency, account, and billing.
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
          <button type="button" disabled={isBusy} onClick={() => void runAuth("signup")}>
            Sign Up
          </button>
          <button type="button" disabled={isBusy} onClick={() => void runAuth("signin")}>
            Sign In
          </button>
          <button type="button" disabled={isBusy || !signedIn} onClick={() => void onSignOut()}>
            Sign Out
          </button>
        </div>

        <div className="subscription-actions">
          <button
            type="button"
            disabled={isBusy || !signedIn}
            onClick={() => void onRefreshEntitlement()}
          >
            Sync Plan
          </button>
          <button type="button" disabled={isBusy || !signedIn} onClick={() => void onCheckout()}>
            Checkout
          </button>
          <button
            type="button"
            disabled={isBusy || !signedIn}
            onClick={() => void onManageBilling()}
          >
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
    </main>
  );
}

export default App;
