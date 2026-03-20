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
  await Promise.all([
    scheduleRateRefreshAlarm(),
    getRates({ forceRefresh }),
  ]);
}

function logRateRefreshError(context: string, error: unknown) {
  console.warn(`[ccx] Failed to refresh rates during ${context}`, error);
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    void initializeRateRefresh(true).catch((error) => {
      logRateRefreshError("onInstalled", error);
    });
  });

  browser.runtime.onStartup.addListener(() => {
    void initializeRateRefresh().catch((error) => {
      logRateRefreshError("onStartup", error);
    });
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== RATE_REFRESH_ALARM) return;

    void getRates().catch((error) => {
      logRateRefreshError("alarm", error);
    });
  });
});
