import type { Browser } from "wxt/browser";

export type LocalStorageChanges = Record<string, Browser.storage.StorageChange>;

export type LocalStorageAreaName = Browser.storage.AreaName;

export type LocalStorageWatchCallback<T> = (
  newValue: T | null,
  oldValue: T | null,
) => void;
