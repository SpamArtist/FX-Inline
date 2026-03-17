import { getRates } from "@/utils/rates";
import { browser } from "wxt/browser";

const RATE_REFRESH_ALARM = "ccx-refresh-rates";
const RATE_REFRESH_INTERVAL_MINUTES = 30;

async function refreshRates(forceRefresh = false) {
  await getRates({ forceRefresh });
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
    await refreshRates(true);
  });

  browser.runtime.onStartup.addListener(async () => {
    await scheduleRateRefreshAlarm();
    await refreshRates();
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== RATE_REFRESH_ALARM) return;

    await refreshRates();
  });
});
