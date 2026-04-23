function toEasternDate(now = new Date()): Date {
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getPreviousBusinessDay(date: Date): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);

  while (isWeekend(copy)) {
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

export function getMarketDayKey(now = new Date()): string {
  const easternNow = toEasternDate(now);

  while (isWeekend(easternNow)) {
    easternNow.setDate(easternNow.getDate() - 1);
  }

  const marketOpen = new Date(easternNow);
  marketOpen.setHours(9, 30, 0, 0);

  if (easternNow < marketOpen) {
    return toDateKey(getPreviousBusinessDay(easternNow));
  }

  return toDateKey(easternNow);
}
