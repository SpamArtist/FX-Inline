import { getUserSettings, hasPaidAccess } from "@/utils/appStorage";
import { getFreeTierRates, getPaidTierRates } from "@/utils/rates";
import { browser } from "wxt/browser";

const RATE_REFRESH_ALARM = "ccx-refresh-rates";
const RATE_REFRESH_INTERVAL_MINUTES = 30;

async function refreshRatesForCurrentPlan(forceRefresh = false) {
  const settings = await getUserSettings();

  if (hasPaidAccess(settings)) {
    await getPaidTierRates({ forceRefresh });
    return;
  }

  await getFreeTierRates({ forceRefresh });
}

async function scheduleRateRefreshAlarm() {
  await browser.alarms.clear(RATE_REFRESH_ALARM);

  await browser.alarms.create(RATE_REFRESH_ALARM, {
    periodInMinutes: RATE_REFRESH_INTERVAL_MINUTES,
  });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await scheduleRateRefreshAlarm();
    await refreshRatesForCurrentPlan(true);
  });

  browser.runtime.onStartup.addListener(async () => {
    await scheduleRateRefreshAlarm();
    await refreshRatesForCurrentPlan();
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== RATE_REFRESH_ALARM) return;

    await refreshRatesForCurrentPlan();
  });
});
