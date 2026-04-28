import { browser } from "wxt/browser";
import type {
  LocalStorageAreaName,
  LocalStorageChanges,
  LocalStorageWatchCallback,
} from "./localStorage.types";

type LocalStorageRecord<T> = Record<string, T | null | undefined>;

function normalizeStoredValue<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}

function normalizeChangedValue<T>(value: unknown): T | null {
  return value == null ? null : (value as T);
}

export async function readLocalStorageValue<T>(
  key: string,
  fallback: T,
): Promise<T> {
  const stored = await browser.storage.local.get<LocalStorageRecord<T>>(key);

  return normalizeStoredValue(stored[key], fallback);
}

export async function writeLocalStorageValue<T>(
  key: string,
  value: T,
): Promise<void> {
  await browser.storage.local.set<LocalStorageRecord<T>>({ [key]: value });
}

export function watchLocalStorageValue<T>(
  key: string,
  callback: LocalStorageWatchCallback<T>,
): () => void {
  const listener = (
    changes: LocalStorageChanges,
    areaName: LocalStorageAreaName,
  ) => {
    if (areaName !== "local") return;

    const change = changes[key];
    if (!change) return;

    callback(
      normalizeChangedValue<T>(change.newValue),
      normalizeChangedValue<T>(change.oldValue),
    );
  };

  browser.storage.onChanged.addListener(listener);

  return () => {
    browser.storage.onChanged.removeListener(listener);
  };
}
