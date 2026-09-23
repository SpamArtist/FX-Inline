import { getMessage, localizeDocument } from "@/utils/i18n";
import { attachSharedThemeStylesheet } from "@/utils/sharedThemeStylesheet";
import { browser } from "wxt/browser";
import "./style.css";

attachSharedThemeStylesheet();
localizeDocument(document, "welcomeTitle");

const root = document.getElementById("root");

if (!root) {
  throw new Error("[fx-inline] Missing #root element in welcome page");
}

const page = document.createElement("main");
page.className = "fx-inline-theme fx-inline-welcome-page";

const shell = document.createElement("section");
shell.className = "fx-inline-shell fx-inline-welcome-shell";

const shellInner = document.createElement("div");
shellInner.className = "fx-inline-shell__inner fx-inline-welcome-shell-inner";

const header = document.createElement("header");
header.className = "fx-inline-welcome-header";

const brand = document.createElement("p");
brand.className = "fx-inline-shell__title fx-inline-welcome-brand";
brand.textContent = "FX Inline";

const heading = document.createElement("h1");
heading.className = "fx-inline-welcome-heading";
heading.textContent = getMessage("welcomeTitle");

const copy = document.createElement("p");
copy.className = "fx-inline-welcome-copy";
copy.textContent = getMessage("welcomeIntroduction");

header.append(brand, heading, copy);

const guide = document.createElement("section");
guide.className = "fx-inline-welcome-guide";

const guideTitle = document.createElement("h2");
guideTitle.className = "fx-inline-welcome-guide-title";
guideTitle.textContent = getMessage("welcomeGuideTitle");

const guideList = document.createElement("ul");
guideList.className = "fx-inline-welcome-guide-list";

const firstGuideItem = document.createElement("li");
firstGuideItem.textContent = getMessage("welcomeChooseCurrency");
const secondGuideItem = document.createElement("li");
secondGuideItem.textContent = getMessage("welcomeOpenPage");
const thirdGuideItem = document.createElement("li");
thirdGuideItem.textContent = getMessage("welcomeOpenPopup");

guideList.append(firstGuideItem, secondGuideItem, thirdGuideItem);
guide.append(guideTitle, guideList);

const actions = document.createElement("div");
actions.className = "fx-inline-welcome-actions";

const settingsButton = document.createElement("button");
settingsButton.className = "fx-inline-welcome-primary-button";
settingsButton.id = "fx-inline-welcome-open-settings";
settingsButton.type = "button";
settingsButton.textContent = getMessage("openSettings");

const note = document.createElement("p");
note.className = "fx-inline-welcome-note";
note.textContent = getMessage("welcomeRevisit");

const statusText = document.createElement("p");
statusText.className = "fx-inline-welcome-status";
statusText.id = "fx-inline-welcome-status";
statusText.setAttribute("role", "status");
statusText.setAttribute("aria-live", "polite");
statusText.hidden = true;

actions.append(settingsButton, note, statusText);

shellInner.append(header, guide, actions);
shell.append(shellInner);
page.append(shell);
root.replaceChildren(page);

function setStatus(message: string) {
  statusText.textContent = message;
  statusText.hidden = message.length === 0;
}

async function openSettingsPage() {
  setStatus("");
  settingsButton.disabled = true;
  settingsButton.textContent = getMessage("openingSettings");

  try {
    try {
      await browser.runtime.openOptionsPage();
    } catch {
      await browser.tabs.create({
        url: browser.runtime.getURL("/options.html"),
      });
    }

    setStatus(getMessage("settingsOpened"));
  } catch (error) {
    console.warn("[fx-inline] Failed to open options page from welcome page", error);
    setStatus(getMessage("openSettingsError"));
  } finally {
    settingsButton.disabled = false;
    settingsButton.textContent = getMessage("openSettings");
  }
}

settingsButton.addEventListener("click", () => {
  void openSettingsPage();
});
