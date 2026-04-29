import { attachSharedThemeStylesheet } from "@/utils/sharedThemeStylesheet";
import { mountOptionsPage } from "./optionsPage";
import "./style.css";

attachSharedThemeStylesheet();

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
