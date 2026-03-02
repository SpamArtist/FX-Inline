function toEasternDate(now = new Date()): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getPreviousBusinessDay(date: Date): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);

  while (copy.getDay() === 0 || copy.getDay() === 6) {
    copy.setDate(copy.getDate() - 1);
  }

  return copy;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getFreeTierMarketDayKey(now = new Date()): string {
  const easternNow = toEasternDate(now);

  while (easternNow.getDay() === 0 || easternNow.getDay() === 6) {
    easternNow.setDate(easternNow.getDate() - 1);
  }

  const marketOpen = new Date(easternNow);
  marketOpen.setHours(9, 30, 0, 0);

  if (easternNow < marketOpen) {
    return toDateKey(getPreviousBusinessDay(easternNow));
  }

  return toDateKey(easternNow);
}

export function shouldUsePaidTierCache(
  fetchedAt: number,
  ttlMs: number,
  now = Date.now(),
): boolean {
  return now - fetchedAt <= ttlMs;
}

export function shouldUseFreeTierCache(
  marketDayKey: string | undefined,
  now = new Date(),
): boolean {
  return Boolean(marketDayKey && marketDayKey === getFreeTierMarketDayKey(now));
}
