import type { UserSettings } from "@/utils/appStorage.types";

export function isUserSettingsSnapshot(
  value: UserSettings | null | undefined,
): value is UserSettings {
  return typeof value?.preferredCurrency === "string";
}
