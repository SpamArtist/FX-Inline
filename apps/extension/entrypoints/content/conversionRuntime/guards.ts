import type { UserSettings } from "@/utils/appStorage.types";

export function isUserSettingsSnapshot(
  value: UserSettings | null | undefined,
): value is UserSettings {
  return value?.schemaVersion === 1 && typeof value.scopes === "object";
}
