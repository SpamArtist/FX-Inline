import { t, localizeDocument } from "@/utils/i18n";
import { attachSharedThemeStylesheet } from "@/utils/sharedThemeStylesheet";
import { mountOptionsPage } from "./optionsPage";
import "./style.css";

attachSharedThemeStylesheet();
localizeDocument(document, t("FX Inline Settings"));

void mountOptionsPage(document.getElementById("root"), {
  readUserSettings: async () => {
    const { getUserSettings } = await import("../../utils/appStorage");
    return getUserSettings();
  },
  writeUserSettings: async (settings) => {
    const { setUserSettings } = await import("../../utils/appStorage");
    return setUserSettings(settings);
  },
});
