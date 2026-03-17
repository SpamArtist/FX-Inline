import { getRates } from "@/utils/rates";
import { browser } from "wxt/browser";

const RATE_REFRESH_ALARM = "ccx-refresh-rates";
const RATE_REFRESH_INTERVAL_MINUTES = 30;

async function scheduleRateRefreshAlarm() {
  await browser.alarms.clear(RATE_REFRESH_ALARM);

  await browser.alarms.create(RATE_REFRESH_ALARM, {
    periodInMinutes: RATE_REFRESH_INTERVAL_MINUTES,
  });
}

async function initializeRateRefresh(forceRefresh = false) {
  await scheduleRateRefreshAlarm();
  await getRates({ forceRefresh });
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async () => {
    await initializeRateRefresh(true);
  });

  browser.runtime.onStartup.addListener(async () => {
    await initializeRateRefresh();
  });

  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== RATE_REFRESH_ALARM) return;

    await getRates();
  });
});
