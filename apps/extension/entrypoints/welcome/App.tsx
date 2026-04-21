import { useState } from "react";
import { browser } from "wxt/browser";

function App() {
  const [statusMessage, setStatusMessage] = useState("");
  const [isOpeningSettings, setIsOpeningSettings] = useState(false);

  async function openSettingsPage() {
    setStatusMessage("");
    setIsOpeningSettings(true);

    try {
      try {
        await browser.runtime.openOptionsPage();
      } catch {
        await browser.tabs.create({
          url: browser.runtime.getURL("/options.html"),
        });
      }

      setStatusMessage("Settings opened in a new tab.");
    } catch (error) {
      console.warn("[ccx] Failed to open options page from welcome page", error);
      setStatusMessage(
        "Could not open settings automatically. Open FX Inline Settings from the extension menu.",
      );
    } finally {
      setIsOpeningSettings(false);
    }
  }

  return (
    <main className="ccx-theme ccx-welcome-page">
      <section className="ccx-shell ccx-welcome-shell">
        <div className="ccx-shell__inner ccx-welcome-shell-inner">
          <header className="ccx-welcome-header">
            <p className="ccx-shell__title ccx-welcome-brand">FX Inline</p>
            <h1 className="ccx-welcome-heading">Welcome to FX Inline</h1>
            <p className="ccx-welcome-copy">
              Thank you for installing FX Inline. We convert prices directly on
              the pages you visit so you can evaluate costs quickly and
              confidently in your preferred currency.
            </p>
          </header>

          <section className="ccx-welcome-guide">
            <h2 className="ccx-welcome-guide-title">Get started in under a minute</h2>
            <ul className="ccx-welcome-guide-list">
              <li>Choose your preferred currency in Settings.</li>
              <li>Open any shopping, travel, or marketplace page with prices.</li>
              <li>Use the FX Inline icon anytime to open the converter popup.</li>
            </ul>
          </section>

          <div className="ccx-welcome-actions">
            <button
              className="ccx-welcome-primary-button"
              type="button"
              onClick={() => {
                void openSettingsPage();
              }}
              disabled={isOpeningSettings}
            >
              {isOpeningSettings ? "Opening Settings..." : "Open Settings"}
            </button>
            <p className="ccx-welcome-note">
              You can revisit this page anytime from the extension files.
            </p>
            {statusMessage ? (
              <p className="ccx-welcome-status" role="status" aria-live="polite">
                {statusMessage}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
