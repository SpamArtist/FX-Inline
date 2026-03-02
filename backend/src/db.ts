import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { DatabaseState } from "./types.js";

const DEFAULT_DB: DatabaseState = {
  users: [],
  refreshSessions: [],
  entitlements: [],
  usageCounters: [],
  rateCaches: {
    free: null,
    paid: null,
  },
  providerHealth: [],
  alerts: [],
  webhookEvents: [],
};

let memoryDb: DatabaseState | null = null;
let initPromise: Promise<void> | null = null;
let writeQueue = Promise.resolve();

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeDb(value: unknown): DatabaseState {
  if (!value || typeof value !== "object") {
    return clone(DEFAULT_DB);
  }

  const parsed = value as Partial<DatabaseState>;

  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    refreshSessions: Array.isArray(parsed.refreshSessions)
      ? parsed.refreshSessions
      : [],
    entitlements: Array.isArray(parsed.entitlements) ? parsed.entitlements : [],
    usageCounters: Array.isArray(parsed.usageCounters) ? parsed.usageCounters : [],
    rateCaches: {
      free: parsed.rateCaches?.free ?? null,
      paid: parsed.rateCaches?.paid ?? null,
    },
    providerHealth: Array.isArray(parsed.providerHealth) ? parsed.providerHealth : [],
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    webhookEvents: Array.isArray(parsed.webhookEvents) ? parsed.webhookEvents : [],
  };
}

async function initDb() {
  await mkdir(path.dirname(config.dbFile), { recursive: true });

  try {
    const existing = await readFile(config.dbFile, "utf8");
    memoryDb = normalizeDb(JSON.parse(existing));
  } catch {
    memoryDb = clone(DEFAULT_DB);
    await writeFile(config.dbFile, JSON.stringify(memoryDb, null, 2), "utf8");
  }
}

async function ensureInit() {
  if (!initPromise) {
    initPromise = initDb();
  }

  await initPromise;
}

async function persistCurrentDb() {
  if (!memoryDb) return;

  const data = JSON.stringify(memoryDb, null, 2);
  writeQueue = writeQueue.then(() => writeFile(config.dbFile, data, "utf8"));
  await writeQueue;
}

export async function readDb(): Promise<DatabaseState> {
  await ensureInit();
  return clone(memoryDb as DatabaseState);
}

export async function mutateDb<T>(mutator: (db: DatabaseState) => T): Promise<T> {
  await ensureInit();

  const db = memoryDb as DatabaseState;
  const result = mutator(db);

  await persistCurrentDb();
  return result;
}
