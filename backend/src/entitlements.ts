import { config } from "./config.js";
import { mutateDb, readDb } from "./db.js";
import {
  EntitlementRecord,
  EntitlementStatus,
  EntitlementView,
  PlanTier,
} from "./types.js";

function toDayKey(time = Date.now()): string {
  const now = new Date(time);
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveDerivedEntitlement(record: EntitlementRecord): EntitlementRecord {
  const now = Date.now();
  if (record.status === "trial" && record.trialEndsAt && now > record.trialEndsAt) {
    return {
      ...record,
      status: "free",
      planTier: "free",
      trialEndsAt: null,
      updatedAt: now,
      source: "system",
    };
  }

  if (record.status === "canceled") {
    return {
      ...record,
      planTier: "free",
    };
  }

  return record;
}

function getDailyLimit(status: EntitlementStatus, planTier: PlanTier): number {
  if (status === "paid" || status === "trial" || planTier === "paid") {
    return config.paidDailyLimit;
  }

  return config.freeDailyLimit;
}

async function getTodaysUsage(userId: string): Promise<number> {
  const db = await readDb();
  const dayKey = toDayKey();

  const usage = db.usageCounters.find(
    (entry) => entry.userId === userId && entry.dayKey === dayKey,
  );

  if (!usage) return 0;
  return usage.inlineConversions + usage.selectionConversions;
}

export async function getEntitlementRecord(userId: string): Promise<EntitlementRecord> {
  const db = await readDb();
  const existing = db.entitlements.find((entry) => entry.userId === userId);

  if (existing) {
    const resolved = resolveDerivedEntitlement(existing);
    if (resolved !== existing) {
      await mutateDb((draft) => {
        const index = draft.entitlements.findIndex((entry) => entry.userId === userId);
        if (index >= 0) {
          draft.entitlements[index] = resolved;
        }
      });
    }

    return resolved;
  }

  const now = Date.now();
  const trialEndsAt = now + config.trialPeriodDays * 24 * 60 * 60 * 1000;

  const initial: EntitlementRecord = {
    userId,
    status: "trial",
    planTier: "paid",
    trialEndsAt,
    currentPeriodEnd: null,
    canceledAt: null,
    updatedAt: now,
    source: "system",
  };

  await mutateDb((draft) => {
    draft.entitlements.push(initial);
  });

  return initial;
}

export async function setEntitlement(
  userId: string,
  patch: Partial<EntitlementRecord>,
): Promise<EntitlementRecord> {
  const current = await getEntitlementRecord(userId);

  const next: EntitlementRecord = {
    ...current,
    ...patch,
    userId,
    updatedAt: Date.now(),
  };

  await mutateDb((draft) => {
    const index = draft.entitlements.findIndex((entry) => entry.userId === userId);

    if (index >= 0) {
      draft.entitlements[index] = next;
      return;
    }

    draft.entitlements.push(next);
  });

  return next;
}

export async function getEntitlementView(userId: string): Promise<EntitlementView> {
  const entitlement = await getEntitlementRecord(userId);
  const usageToday = await getTodaysUsage(userId);
  const dailyLimit = getDailyLimit(entitlement.status, entitlement.planTier);

  return {
    status: entitlement.status,
    planTier: entitlement.planTier,
    trialEndsAt: entitlement.trialEndsAt,
    currentPeriodEnd: entitlement.currentPeriodEnd,
    checkedAt: Date.now(),
    dailyLimit,
    remainingToday: Math.max(dailyLimit - usageToday, 0),
  };
}

export async function recordUsage(userId: string, payload: {
  inlineConversions: number;
  selectionConversions: number;
}): Promise<{
  limited: boolean;
  consumedToday: number;
  dailyLimit: number;
  remainingToday: number;
  entitlement: EntitlementView;
}> {
  const dayKey = toDayKey();

  const normalizedInline = Number.isFinite(payload.inlineConversions)
    ? Math.max(0, Math.min(Math.floor(payload.inlineConversions), 10_000))
    : 0;

  const normalizedSelection = Number.isFinite(payload.selectionConversions)
    ? Math.max(0, Math.min(Math.floor(payload.selectionConversions), 10_000))
    : 0;

  await mutateDb((draft) => {
    const existing = draft.usageCounters.find(
      (entry) => entry.userId === userId && entry.dayKey === dayKey,
    );

    if (existing) {
      existing.inlineConversions += normalizedInline;
      existing.selectionConversions += normalizedSelection;
      existing.updatedAt = Date.now();
      return;
    }

    draft.usageCounters.push({
      userId,
      dayKey,
      inlineConversions: normalizedInline,
      selectionConversions: normalizedSelection,
      updatedAt: Date.now(),
    });
  });

  const entitlement = await getEntitlementView(userId);
  const consumedToday =
    entitlement.dailyLimit - (entitlement.remainingToday ?? entitlement.dailyLimit);

  return {
    limited: consumedToday >= entitlement.dailyLimit,
    consumedToday,
    dailyLimit: entitlement.dailyLimit,
    remainingToday: entitlement.remainingToday ?? 0,
    entitlement,
  };
}
