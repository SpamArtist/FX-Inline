import { config } from "./config.js";
import { readDb } from "./db.js";
import { getAlerts } from "./alerts.js";

function assertAdminAccess(headerValue: string | undefined): void {
  if (!config.adminApiKey) {
    return;
  }

  if (!headerValue || headerValue !== config.adminApiKey) {
    throw new Error("Forbidden");
  }
}

export async function getAdminStats(headerValue: string | undefined) {
  assertAdminAccess(headerValue);

  const db = await readDb();
  const alerts = await getAlerts();

  const paidCount = db.entitlements.filter(
    (entry) => entry.status === "paid" || entry.status === "trial",
  ).length;

  const canceledCount = db.entitlements.filter(
    (entry) => entry.status === "canceled",
  ).length;

  return {
    generatedAt: Date.now(),
    users: {
      total: db.users.length,
      paidOrTrial: paidCount,
      canceled: canceledCount,
    },
    rates: {
      freeLastFetchAt: db.rateCaches.free?.fetchedAt || null,
      paidLastFetchAt: db.rateCaches.paid?.fetchedAt || null,
      freeSource: db.rateCaches.free?.source || null,
      paidSource: db.rateCaches.paid?.source || null,
    },
    operations: {
      unresolvedAlerts: alerts.filter((entry) => entry.resolvedAt === null).length,
      providerHealth: db.providerHealth,
      webhookFailures: db.webhookEvents.filter((entry) => entry.status === "failed")
        .length,
    },
  };
}

export async function getAdminAlerts(headerValue: string | undefined) {
  assertAdminAccess(headerValue);
  return getAlerts();
}

export async function getAdminDashboardHtml(
  headerValue: string | undefined,
): Promise<string> {
  const stats = await getAdminStats(headerValue);
  const alerts = await getAdminAlerts(headerValue);

  const unresolved = alerts.filter((entry) => entry.resolvedAt === null);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Currency SaaS Admin</title>
    <style>
      body { font-family: ui-sans-serif, system-ui; background:#0b1220; color:#e5e7eb; margin:0; padding:24px; }
      h1 { margin:0 0 16px; font-size:22px; }
      .grid { display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .card { background:#111a2e; border:1px solid #26324a; border-radius:10px; padding:12px; }
      .label { color:#93a4c2; font-size:12px; margin-bottom:6px; }
      .value { font-size:18px; font-weight:700; }
      table { width:100%; border-collapse: collapse; margin-top: 16px; }
      td, th { border:1px solid #26324a; padding:8px; text-align:left; font-size:13px; }
      th { color:#93a4c2; }
      .warn { color:#fbbf24; }
      .crit { color:#fb7185; }
    </style>
  </head>
  <body>
    <h1>Currency SaaS Admin Dashboard</h1>
    <div class="grid">
      <div class="card"><div class="label">Total Users</div><div class="value">${stats.users.total}</div></div>
      <div class="card"><div class="label">Paid + Trial</div><div class="value">${stats.users.paidOrTrial}</div></div>
      <div class="card"><div class="label">Canceled</div><div class="value">${stats.users.canceled}</div></div>
      <div class="card"><div class="label">Unresolved Alerts</div><div class="value">${stats.operations.unresolvedAlerts}</div></div>
    </div>
    <h2>Unresolved Alerts</h2>
    <table>
      <thead>
        <tr><th>Level</th><th>Code</th><th>Message</th><th>Created</th></tr>
      </thead>
      <tbody>
        ${
          unresolved.length
            ? unresolved
                .map(
                  (entry) => `<tr>
                    <td class="${entry.level === "critical" ? "crit" : "warn"}">${entry.level}</td>
                    <td>${entry.code}</td>
                    <td>${entry.message}</td>
                    <td>${new Date(entry.createdAt).toISOString()}</td>
                  </tr>`,
                )
                .join("\n")
            : `<tr><td colspan="4">No unresolved alerts</td></tr>`
        }
      </tbody>
    </table>
  </body>
</html>`;
}
