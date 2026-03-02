import { createId } from "./crypto.js";
import { mutateDb, readDb } from "./db.js";
import { AlertRecord } from "./types.js";

export async function openAlert(payload: {
  code: string;
  level: AlertRecord["level"];
  message: string;
}): Promise<void> {
  await mutateDb((draft) => {
    const existing = draft.alerts.find(
      (entry) => entry.code === payload.code && entry.resolvedAt === null,
    );

    if (existing) {
      existing.message = payload.message;
      existing.createdAt = Date.now();
      return;
    }

    draft.alerts.push({
      id: createId("alert"),
      code: payload.code,
      level: payload.level,
      message: payload.message,
      createdAt: Date.now(),
      resolvedAt: null,
    });
  });
}

export async function resolveAlert(code: string): Promise<void> {
  await mutateDb((draft) => {
    draft.alerts.forEach((entry) => {
      if (entry.code !== code || entry.resolvedAt !== null) return;
      entry.resolvedAt = Date.now();
    });
  });
}

export async function getAlerts(): Promise<AlertRecord[]> {
  const db = await readDb();
  return db.alerts;
}
