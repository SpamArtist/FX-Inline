import type { UserSettings } from "../../utils/appStorage.types";
import type { CurrencyCode } from "../../utils/enums";

export type CurrencyOption = {
  code: CurrencyCode;
  label: string;
};

export type OptionsPageStorage = {
  readUserSettings: () => Promise<UserSettings>;
  writeUserSettings: (settings: UserSettings) => Promise<UserSettings>;
};

export type MountOptionsPageParams = OptionsPageStorage & {
  initialPreferredCurrency?: CurrencyCode;
};

export type MountedOptionsPage = {
  destroy: () => void;
};
