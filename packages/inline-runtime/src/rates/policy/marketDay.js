function toEasternDate(now = new Date()) {
  return new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function getPreviousBusinessDay(date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);

  while (isWeekend(copy)) {
    copy.setDate(copy.getDate() - 1);
  }

  return copy;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMarketDayKey(now = new Date()) {
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

export function shouldUseMarketDayCache(marketDayKey, now = new Date()) {
  return marketDayKey === getMarketDayKey(now);
}
