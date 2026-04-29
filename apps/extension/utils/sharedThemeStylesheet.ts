import { browser } from "wxt/browser";

const SHARED_THEME_STYLESHEET_ID = "fx-inline-shared-theme-stylesheet";
const SHARED_THEME_STYLESHEET_PATH = "/theme.css";

export function attachSharedThemeStylesheet(documentRef: Document = document) {
  if (documentRef.getElementById(SHARED_THEME_STYLESHEET_ID)) return;

  const stylesheet = documentRef.createElement("link");
  stylesheet.id = SHARED_THEME_STYLESHEET_ID;
  stylesheet.rel = "stylesheet";
  stylesheet.href = browser.runtime.getURL(SHARED_THEME_STYLESHEET_PATH);

  documentRef.head.append(stylesheet);
}
