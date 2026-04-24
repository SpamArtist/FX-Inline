import type {
  ApiErrorPayload,
  AuthMeResponse,
  CsrfTokenResponse,
  DashboardState,
  DashboardUser,
  InstallSnippetResponse,
  PublishPluginResponse,
  SettingsSnapshot,
} from "./types";

const DEFAULT_API_ORIGIN = "http://127.0.0.1:8787";
const STORAGE_KEYS = {
  apiOrigin: "fxi:cp:api-origin",
  activeClientId: "fxi:cp:active-client-id",
} as const;

class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const appRoot = document.getElementById("app");
if (!(appRoot instanceof HTMLElement)) {
  throw new Error("Dashboard root element #app not found");
}

const state: DashboardState = {
  apiOrigin: localStorage.getItem(STORAGE_KEYS.apiOrigin) || DEFAULT_API_ORIGIN,
  user: null,
  clients: [],
  activeClientId: localStorage.getItem(STORAGE_KEYS.activeClientId) || null,
  csrfToken: null,
  settingsSnapshot: null,
  error: "",
  notice: "",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

function getHashRoute(): string {
  const rawHash = window.location.hash.replace(/^#/u, "") || "/login";
  return rawHash.startsWith("/") ? rawHash : `/${rawHash}`;
}

function setHashRoute(route: string): void {
  window.location.hash = route;
}

function setNotice(message = ""): void {
  state.notice = message;
  state.error = "";
}

function setError(message = ""): void {
  state.error = message;
  state.notice = "";
}

function toApiPayloadError(payload: unknown): ApiErrorPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return payload as ApiErrorPayload;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (state.csrfToken) {
    headers.set("x-csrf-token", state.csrfToken);
  }

  const response = await fetch(`${state.apiOrigin}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const parsed = toApiPayloadError(payload);
    const message = parsed.error?.message || `Request failed (${response.status})`;
    throw new ApiRequestError(message, response.status, payload);
  }

  return payload as T;
}

async function loadSession(): Promise<boolean> {
  try {
    const payload = await apiRequest<AuthMeResponse>("/api/v1/auth/me");
    state.user = payload.user;
    state.clients = payload.clients || [];

    if (!state.activeClientId && state.clients[0]?.id) {
      state.activeClientId = state.clients[0].id;
      localStorage.setItem(STORAGE_KEYS.activeClientId, state.activeClientId);
    }

    return true;
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401) {
      setError(getErrorMessage(error));
    }

    state.user = null;
    state.clients = [];
    state.activeClientId = null;
    return false;
  }
}

async function ensureCsrfToken(): Promise<void> {
  if (!state.user) {
    state.csrfToken = null;
    return;
  }

  const payload = await apiRequest<CsrfTokenResponse>("/api/v1/auth/csrf");
  state.csrfToken = payload.csrfToken;
}

function clientOptionsMarkup(): string {
  if (!state.clients.length) {
    return `<option value="">No clients</option>`;
  }

  return state.clients
    .map((client) => {
      const selected = client.id === state.activeClientId ? "selected" : "";
      return `<option value="${client.id}" ${selected}>${client.name} (${client.role})</option>`;
    })
    .join("\n");
}

function authLayout(content: string): string {
  return `
    <div class="layout">
      <header>
        <h1>FX Inline Control Plane Dashboard</h1>
        <p>Manage runtime settings and install snippets for each client workspace.</p>
      </header>
      ${content}
      ${state.error ? `<p class="error">${state.error}</p>` : ""}
      ${state.notice ? `<p class="notice">${state.notice}</p>` : ""}
    </div>
  `;
}

function appLayout(content: string): string {
  return `
    <div class="layout">
      <header>
        <h1>FX Inline Control Plane Dashboard</h1>
        <p>Signed-manifest runtime operations for client pricing pages.</p>
        <div class="nav">
          <button data-route="/settings">Settings</button>
          <button data-route="/install">Install</button>
          <button data-route="/plugins">Plugins</button>
          <button data-action="logout" class="ghost">Logout</button>
        </div>
      </header>
      <section class="panel">
        <div class="row">
          <label for="api-origin" style="margin: 0">API origin</label>
          <input id="api-origin" value="${state.apiOrigin}" style="max-width: 320px; margin: 0" />
          <button data-action="save-api-origin">Save</button>
          <span class="badge">${state.user?.email || "anonymous"}</span>
        </div>
      </section>
      <section class="panel">
        <label for="active-client">Active client</label>
        <select id="active-client">${clientOptionsMarkup()}</select>
      </section>
      ${content}
      ${state.error ? `<p class="error">${state.error}</p>` : ""}
      ${state.notice ? `<p class="notice">${state.notice}</p>` : ""}
    </div>
  `;
}

function eventForm(event: Event): HTMLFormElement {
  const target = event.currentTarget;
  if (!(target instanceof HTMLFormElement)) {
    throw new Error("Expected form event target");
  }

  return target;
}

function renderLoginPage(): void {
  appRoot.innerHTML = authLayout(`
    <section class="grid">
      <article class="panel">
        <h2>Login With Clerk Session</h2>
        <form id="login-form">
          <label>Clerk session token</label>
          <textarea name="clerkSessionToken" rows="5" placeholder="Paste Clerk __session JWT or mock-clerk token" required></textarea>
          <label>Clerk user ID (optional)</label>
          <input name="clerkUserId" placeholder="user_..." />
          <button class="primary" type="submit">Login</button>
        </form>
        <p class="notice">Use Clerk to obtain a valid session token, then exchange it with the control-plane API.</p>
      </article>
      <article class="panel">
        <h2>Local Mock Token (Dev/Test)</h2>
        <p class="notice">If mock Clerk mode is enabled in the API, you can log in with token value <code>mock-clerk</code>.</p>
        <button id="use-mock-token">Use mock-clerk token</button>
      </article>
    </section>
  `);

  document.getElementById("login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(eventForm(event));

    try {
      await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          clerkSessionToken: String(formData.get("clerkSessionToken") || ""),
          clerkUserId: String(formData.get("clerkUserId") || ""),
        }),
      });

      await loadSession();
      await ensureCsrfToken();
      setNotice("Logged in successfully via Clerk.");
      setHashRoute("/settings");
    } catch (error) {
      setError(getErrorMessage(error));
      render();
    }
  });

  document.getElementById("use-mock-token")?.addEventListener("click", () => {
    const tokenField = document.querySelector("textarea[name='clerkSessionToken']");
    if (tokenField instanceof HTMLTextAreaElement) {
      tokenField.value = "mock-clerk";
    }
  });
}

async function fetchSettings(): Promise<SettingsSnapshot> {
  if (!state.activeClientId) {
    throw new Error("No active client selected");
  }

  const payload = await apiRequest<SettingsSnapshot>(`/api/v1/clients/${state.activeClientId}/settings/current`);
  state.settingsSnapshot = payload;
  return payload;
}

function renderSettingsPage(): void {
  const settings = state.settingsSnapshot?.settings || {
    fontScalePct: 90,
    fontWeight: 600,
    fontFamily: "inherit",
    fontColor: "#355aa8",
    spacingEm: 0.1,
  };

  appRoot.innerHTML = appLayout(`
    <section class="panel">
      <h2>Client Runtime Settings</h2>
      <p class="notice">Settings are versioned. A page reload should pick up the latest version.</p>
      <form id="settings-form">
        <label>Font scale percent</label>
        <input name="fontScalePct" type="number" min="60" max="200" value="${settings.fontScalePct}" required />

        <label>Font weight</label>
        <input name="fontWeight" type="number" min="300" max="800" value="${settings.fontWeight}" required />

        <label>Font family</label>
        <select name="fontFamily">
          ${[
            "inherit",
            "Inter, sans-serif",
            "ui-sans-serif, system-ui, sans-serif",
            "Arial, sans-serif",
            "Georgia, serif",
            "'IBM Plex Sans', sans-serif",
          ]
            .map((family) => `<option value="${family}" ${family === settings.fontFamily ? "selected" : ""}>${family}</option>`)
            .join("")}
        </select>

        <label>Font color</label>
        <input name="fontColor" value="${settings.fontColor}" required />

        <label>Spacing (em)</label>
        <input name="spacingEm" type="number" step="0.01" min="0" max="0.5" value="${settings.spacingEm}" required />

        <button class="primary" type="submit">Save Settings</button>
      </form>
      <p class="notice">Current version: ${state.settingsSnapshot?.version ?? "unknown"}</p>
    </section>
  `);

  wireCommonAppEvents();

  document.getElementById("settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(eventForm(event));

    try {
      const updated = await apiRequest<SettingsSnapshot>(`/api/v1/clients/${state.activeClientId}/settings`, {
        method: "PUT",
        body: JSON.stringify({
          fontScalePct: Number(formData.get("fontScalePct")),
          fontWeight: Number(formData.get("fontWeight")),
          fontFamily: String(formData.get("fontFamily") || "inherit"),
          fontColor: String(formData.get("fontColor") || "#355aa8"),
          spacingEm: Number(formData.get("spacingEm")),
        }),
      });

      state.settingsSnapshot = updated;
      setNotice(`Settings saved. New version: ${updated.version}`);
      render();
    } catch (error) {
      setError(getErrorMessage(error));
      render();
    }
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&#39;");
}

async function renderInstallPage(): Promise<void> {
  const payload = await apiRequest<InstallSnippetResponse>(`/api/v1/clients/${state.activeClientId}/install-snippet`);

  appRoot.innerHTML = appLayout(`
    <section class="panel">
      <h2>Install Runtime Script</h2>
      <p class="notice">Copy this client-scoped script tag into the pricing or store page template.</p>
      <div class="code" id="snippet-block">${escapeHtml(payload.snippet)}</div>
      <div class="row" style="margin-top: 0.7rem">
        <button id="copy-snippet" class="primary">Copy Snippet</button>
        <a href="http://127.0.0.1:5173/b2b-demo.html" target="_blank" rel="noreferrer">Open B2B Demo Page</a>
      </div>
    </section>
  `);

  wireCommonAppEvents();

  document.getElementById("copy-snippet")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(payload.snippet);
    setNotice("Snippet copied to clipboard.");
    render();
  });
}

function renderPluginsPage(): void {
  appRoot.innerHTML = appLayout(`
    <section class="panel">
      <h2>Publish Plugin Artifact</h2>
      <p class="notice">Use this after your deterministic plugin build pipeline emits artifact URL + integrity.</p>
      <form id="plugin-form">
        <label>Kind</label>
        <select name="kind">
          <option value="pre">Pre plugin</option>
          <option value="post">Post plugin</option>
        </select>
        <label>Artifact URL</label>
        <input name="artifactUrl" required placeholder="/b2b/clients/acme/pre.v2.js" />
        <label>Integrity</label>
        <input name="integrity" required placeholder="sha256-..." />
        <button class="primary" type="submit">Publish</button>
      </form>
    </section>
  `);

  wireCommonAppEvents();

  document.getElementById("plugin-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(eventForm(event));

    try {
      const payload = await apiRequest<PublishPluginResponse>(`/api/v1/clients/${state.activeClientId}/plugins/publish`, {
        method: "POST",
        body: JSON.stringify({
          kind: String(formData.get("kind")),
          artifactUrl: String(formData.get("artifactUrl")),
          integrity: String(formData.get("integrity")),
        }),
      });

      setNotice(`Published ${payload.kind} plugin v${payload.version}.`);
      render();
    } catch (error) {
      setError(getErrorMessage(error));
      render();
    }
  });
}

function wireCommonAppEvents(): void {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = button.getAttribute("data-route");
      if (route) {
        setHashRoute(route);
      }
    });
  });

  document.getElementById("active-client")?.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    state.activeClientId = target.value || null;

    if (state.activeClientId) {
      localStorage.setItem(STORAGE_KEYS.activeClientId, state.activeClientId);
    }

    render().catch((error) => {
      setError(getErrorMessage(error));
      render();
    });
  });

  document.querySelector("[data-action='save-api-origin']")?.addEventListener("click", async () => {
    const input = document.getElementById("api-origin");
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const value = input.value.trim();
    if (!value) return;

    state.apiOrigin = value;
    localStorage.setItem(STORAGE_KEYS.apiOrigin, value);
    state.csrfToken = null;

    await loadSession();
    if (state.user) {
      await ensureCsrfToken();
    }

    setNotice(`API origin updated to ${value}`);
    render();
  });

  document.querySelector("[data-action='logout']")?.addEventListener("click", async () => {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
      state.user = null;
      state.clients = [];
      state.activeClientId = null;
      state.csrfToken = null;
      setNotice("Logged out.");
      setHashRoute("/login");
    } catch (error) {
      setError(getErrorMessage(error));
      render();
    }
  });
}

async function render(): Promise<void> {
  const route = getHashRoute();

  if (!state.user) {
    if (route !== "/login") {
      setHashRoute("/login");
      return;
    }

    renderLoginPage();
    return;
  }

  if (!state.activeClientId && state.clients[0]?.id) {
    state.activeClientId = state.clients[0].id;
    localStorage.setItem(STORAGE_KEYS.activeClientId, state.activeClientId);
  }

  if (route === "/install") {
    await renderInstallPage();
    return;
  }

  if (route === "/plugins") {
    renderPluginsPage();
    return;
  }

  await fetchSettings();
  renderSettingsPage();
}

window.addEventListener("hashchange", () => {
  render().catch((error) => {
    setError(getErrorMessage(error));
    renderLoginPage();
  });
});

(async () => {
  await loadSession();
  if (state.user) {
    await ensureCsrfToken();
  }

  if (!window.location.hash) {
    setHashRoute(state.user ? "/settings" : "/login");
  }

  await render();
})();
