const DEFAULT_API_ORIGIN = "http://127.0.0.1:8787";
const STORAGE_KEYS = {
  apiOrigin: "fxi:cp:api-origin",
  activeClientId: "fxi:cp:active-client-id",
};

const appRoot = document.getElementById("app");

const state = {
  apiOrigin: localStorage.getItem(STORAGE_KEYS.apiOrigin) || DEFAULT_API_ORIGIN,
  user: null,
  clients: [],
  activeClientId: localStorage.getItem(STORAGE_KEYS.activeClientId) || null,
  csrfToken: null,
  settingsSnapshot: null,
  error: "",
  notice: "",
};

function getHashRoute() {
  const rawHash = window.location.hash.replace(/^#/u, "") || "/login";
  return rawHash.startsWith("/") ? rawHash : `/${rawHash}`;
}

function setHashRoute(route) {
  window.location.hash = route;
}

function setNotice(message = "") {
  state.notice = message;
  state.error = "";
}

function setError(message = "") {
  state.error = message;
  state.notice = "";
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${state.apiOrigin}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(state.csrfToken ? { "x-csrf-token": state.csrfToken } : {}),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function loadSession() {
  try {
    const payload = await apiRequest("/api/v1/auth/me");
    state.user = payload.user;
    state.clients = payload.clients || [];

    if (!state.activeClientId && state.clients[0]?.id) {
      state.activeClientId = state.clients[0].id;
      localStorage.setItem(STORAGE_KEYS.activeClientId, state.activeClientId);
    }

    return true;
  } catch (error) {
    if (error.status !== 401) {
      setError(error.message);
    }

    state.user = null;
    state.clients = [];
    state.activeClientId = null;
    return false;
  }
}

async function ensureCsrfToken() {
  if (!state.user) {
    state.csrfToken = null;
    return;
  }

  const payload = await apiRequest("/api/v1/auth/csrf");
  state.csrfToken = payload.csrfToken;
}

function clientOptionsMarkup() {
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

function authLayout(content) {
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

function appLayout(content) {
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

function renderLoginPage() {
  appRoot.innerHTML = authLayout(`
    <section class="grid">
      <article class="panel">
        <h2>Login</h2>
        <form id="login-form">
          <label>Email</label>
          <input name="email" type="email" required />
          <label>Password</label>
          <input name="password" type="password" minlength="10" required />
          <button class="primary" type="submit">Login</button>
        </form>
      </article>
      <article class="panel">
        <h2>Create account</h2>
        <form id="register-form">
          <label>Display name</label>
          <input name="displayName" required />
          <label>Email</label>
          <input name="email" type="email" required />
          <label>Password (min 10 chars)</label>
          <input name="password" type="password" minlength="10" required />
          <button class="primary" type="submit">Register</button>
        </form>
      </article>
      <article class="panel">
        <h2>Google login</h2>
        <p class="notice">Use live OAuth in configured environments or mock mode locally.</p>
        <form id="google-mock-form">
          <label>Google email</label>
          <input name="email" type="email" value="demo-google-user@example.com" required />
          <button type="submit">Login with Google (Mock)</button>
        </form>
        <hr />
        <button id="google-live-btn">Start Google OAuth</button>
      </article>
    </section>
  `);

  document.getElementById("login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    try {
      await apiRequest("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || ""),
        }),
      });

      await loadSession();
      await ensureCsrfToken();
      setNotice("Logged in successfully.");
      setHashRoute("/settings");
    } catch (error) {
      setError(error.message);
      render();
    }
  });

  document.getElementById("register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    try {
      await apiRequest("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({
          displayName: String(formData.get("displayName") || ""),
          email: String(formData.get("email") || ""),
          password: String(formData.get("password") || ""),
        }),
      });

      await loadSession();
      await ensureCsrfToken();
      setNotice("Account created.");
      setHashRoute("/settings");
    } catch (error) {
      setError(error.message);
      render();
    }
  });

  document.getElementById("google-mock-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      await apiRequest("/api/v1/auth/google/mock", {
        method: "POST",
        body: JSON.stringify({
          email: String(formData.get("email") || ""),
        }),
      });

      await loadSession();
      await ensureCsrfToken();
      setNotice("Google mock login successful.");
      setHashRoute("/settings");
    } catch (error) {
      setError(error.message);
      render();
    }
  });

  document.getElementById("google-live-btn")?.addEventListener("click", () => {
    const returnTo = `${window.location.origin}${window.location.pathname}#/settings`;
    const url = `${state.apiOrigin}/api/v1/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.assign(url);
  });
}

async function fetchSettings() {
  if (!state.activeClientId) {
    throw new Error("No active client selected");
  }

  const payload = await apiRequest(`/api/v1/clients/${state.activeClientId}/settings/current`);
  state.settingsSnapshot = payload;
  return payload;
}

function renderSettingsPage() {
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

    const formData = new FormData(event.currentTarget);

    try {
      const updated = await apiRequest(`/api/v1/clients/${state.activeClientId}/settings`, {
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
      setError(error.message);
      render();
    }
  });
}

async function renderInstallPage() {
  const payload = await apiRequest(`/api/v1/clients/${state.activeClientId}/install-snippet`);

  appRoot.innerHTML = appLayout(`
    <section class="panel">
      <h2>Install Runtime Script</h2>
      <p class="notice">Copy this client-scoped script tag into the pricing or store page template.</p>
      <div class="code" id="snippet-block">${payload.snippet.replace(/</gu, "&lt;")}</div>
      <div class="row" style="margin-top: 0.7rem">
        <button id="copy-snippet" class="primary">Copy Snippet</button>
        <a href="http://127.0.0.1:5173/b2b-demo.html" target="_blank" rel="noreferrer">Open B2B Demo Page</a>
      </div>
    </section>
  `);

  wireCommonAppEvents();

  document.getElementById("copy-snippet")?.addEventListener("click", async () => {
    const text = payload.snippet;
    await navigator.clipboard.writeText(text);
    setNotice("Snippet copied to clipboard.");
    render();
  });
}

function renderPluginsPage() {
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

    const formData = new FormData(event.currentTarget);

    try {
      const payload = await apiRequest(`/api/v1/clients/${state.activeClientId}/plugins/publish`, {
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
      setError(error.message);
      render();
    }
  });
}

function wireCommonAppEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      setHashRoute(button.getAttribute("data-route"));
    });
  });

  document.getElementById("active-client")?.addEventListener("change", (event) => {
    state.activeClientId = event.target.value || null;

    if (state.activeClientId) {
      localStorage.setItem(STORAGE_KEYS.activeClientId, state.activeClientId);
    }

    render().catch((error) => {
      setError(error.message);
      render();
    });
  });

  document.querySelector("[data-action='save-api-origin']")?.addEventListener("click", async () => {
    const input = document.getElementById("api-origin");
    const value = input?.value?.trim();

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
      setError(error.message);
      render();
    }
  });
}

async function render() {
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
    setError(error.message);
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
