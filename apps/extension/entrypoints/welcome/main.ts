import { browser } from "wxt/browser";
import "./style.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("[ccx] Missing #root element in welcome page");
}

root.innerHTML = `
  <main class="ccx-theme ccx-welcome-page">
    <section class="ccx-shell ccx-welcome-shell">
      <div class="ccx-shell__inner ccx-welcome-shell-inner">
        <header class="ccx-welcome-header">
          <p class="ccx-shell__title ccx-welcome-brand">FX Inline</p>
          <h1 class="ccx-welcome-heading">Welcome to FX Inline</h1>
          <p class="ccx-welcome-copy">
            Thank you for installing FX Inline. We convert prices directly on
            the pages you visit so you can evaluate costs quickly and
            confidently in your preferred currency.
          </p>
        </header>

        <section class="ccx-welcome-guide">
          <h2 class="ccx-welcome-guide-title">Get started in under a minute</h2>
          <ul class="ccx-welcome-guide-list">
            <li>Choose your preferred currency in Settings.</li>
            <li>Open any shopping, travel, or marketplace page with prices.</li>
            <li>Use the FX Inline icon anytime to open the converter popup.</li>
          </ul>
        </section>

        <div class="ccx-welcome-actions">
          <button class="ccx-welcome-primary-button" id="ccx-welcome-open-settings" type="button">
            Open Settings
          </button>
          <p class="ccx-welcome-note">
            You can revisit this page anytime from the extension files.
          </p>
          <p class="ccx-welcome-status" id="ccx-welcome-status" role="status" aria-live="polite" hidden></p>
        </div>
      </div>
    </section>
  </main>
`;

const openSettingsButton = root.querySelector<HTMLButtonElement>(
  "#ccx-welcome-open-settings",
);
const statusElement = root.querySelector<HTMLParagraphElement>("#ccx-welcome-status");

if (!openSettingsButton || !statusElement) {
  throw new Error("[ccx] Missing welcome page controls");
}

const settingsButton = openSettingsButton;
const statusText = statusElement;

function setStatus(message: string) {
  statusText.textContent = message;
  statusText.hidden = message.length === 0;
}

async function openSettingsPage() {
  setStatus("");
  settingsButton.disabled = true;
  settingsButton.textContent = "Opening Settings...";

  try {
    try {
      await browser.runtime.openOptionsPage();
    } catch {
      await browser.tabs.create({
        url: browser.runtime.getURL("/options.html"),
      });
    }

    setStatus("Settings opened in a new tab.");
  } catch (error) {
    console.warn("[ccx] Failed to open options page from welcome page", error);
    setStatus(
      "Could not open settings automatically. Open FX Inline Settings from the extension menu.",
    );
  } finally {
    settingsButton.disabled = false;
    settingsButton.textContent = "Open Settings";
  }
}

settingsButton.addEventListener("click", () => {
  void openSettingsPage();
});
