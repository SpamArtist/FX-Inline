import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import type {
  ApiErrorPayload,
  AuthMeResponse,
  CsrfTokenResponse,
  DashboardRoute,
  DashboardState,
  InstallSnippetResponse,
  PublishPluginResponse,
  SettingsSnapshot,
  UiSettings,
} from "./types";

const DEFAULT_API_ORIGIN = "http://127.0.0.1:8787";
const STORAGE_KEYS = {
  apiOrigin: "fxi:cp:api-origin",
  activeClientId: "fxi:cp:active-client-id",
} as const;

const SETTINGS_FONT_FAMILIES = [
  "inherit",
  "Inter, sans-serif",
  "ui-sans-serif, system-ui, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "'IBM Plex Sans', sans-serif",
] as const;

const DEFAULT_SETTINGS: UiSettings = {
  fontScalePct: 90,
  fontWeight: 600,
  fontFamily: "inherit",
  fontColor: "#355aa8",
  spacingEm: 0.1,
};

class ApiRequestError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

function toApiPayloadError(payload: unknown): ApiErrorPayload {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  return payload as ApiErrorPayload;
}

function getHashRoute(): DashboardRoute {
  const rawHash = window.location.hash.replace(/^#/u, "") || "/login";
  const normalized = rawHash.startsWith("/") ? rawHash : `/${rawHash}`;

  if (normalized === "/install" || normalized === "/plugins" || normalized === "/settings") {
    return normalized;
  }

  return "/login";
}

function setHashRoute(route: DashboardRoute): void {
  window.location.hash = route;
}

async function requestJson<T>({
  apiOrigin,
  csrfToken,
  path,
  options = {},
}: {
  apiOrigin: string;
  csrfToken: string | null;
  path: string;
  options?: RequestInit;
}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch(`${apiOrigin}${path}`, {
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

export function App(): ReactElement {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    apiOrigin: localStorage.getItem(STORAGE_KEYS.apiOrigin) || DEFAULT_API_ORIGIN,
    user: null,
    clients: [],
    activeClientId: localStorage.getItem(STORAGE_KEYS.activeClientId) || null,
    csrfToken: null,
    settingsSnapshot: null,
    error: "",
    notice: "",
  });
  const [route, setRoute] = useState<DashboardRoute>(getHashRoute());
  const [apiOriginInput, setApiOriginInput] = useState<string>(
    localStorage.getItem(STORAGE_KEYS.apiOrigin) || DEFAULT_API_ORIGIN,
  );
  const [clerkSessionTokenInput, setClerkSessionTokenInput] = useState("");
  const [clerkUserIdInput, setClerkUserIdInput] = useState("");
  const [installSnippet, setInstallSnippet] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  const setNotice = useCallback((message = "") => {
    setDashboardState((previousState) => ({
      ...previousState,
      notice: message,
      error: "",
    }));
  }, []);

  const setError = useCallback((message = "") => {
    setDashboardState((previousState) => ({
      ...previousState,
      error: message,
      notice: "",
    }));
  }, []);

  useEffect(() => {
    const handleHashChange = (): void => {
      setRoute(getHashRoute());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const apiRequest = useCallback(
    async <T,>(
      path: string,
      options: RequestInit = {},
      overrides: {
        apiOrigin?: string;
        csrfToken?: string | null;
      } = {},
    ): Promise<T> =>
      requestJson<T>({
        apiOrigin: overrides.apiOrigin ?? dashboardState.apiOrigin,
        csrfToken:
          overrides.csrfToken !== undefined ? overrides.csrfToken : dashboardState.csrfToken,
        path,
        options,
      }),
    [dashboardState.apiOrigin, dashboardState.csrfToken],
  );

  const loadSession = useCallback(
    async (apiOriginOverride?: string): Promise<boolean> => {
      const currentApiOrigin = apiOriginOverride ?? dashboardState.apiOrigin;

      try {
        const payload = await apiRequest<AuthMeResponse>(
          "/api/v1/auth/me",
          {},
          { apiOrigin: currentApiOrigin, csrfToken: null },
        );

        setDashboardState((previousState) => {
          const nextActiveClientId =
            previousState.activeClientId || payload.clients[0]?.id || null;

          if (nextActiveClientId) {
            localStorage.setItem(STORAGE_KEYS.activeClientId, nextActiveClientId);
          }

          return {
            ...previousState,
            apiOrigin: currentApiOrigin,
            user: payload.user,
            clients: payload.clients || [],
            activeClientId: nextActiveClientId,
          };
        });

        return true;
      } catch (error) {
        if (!(error instanceof ApiRequestError) || error.status !== 401) {
          setError(getErrorMessage(error));
        }

        setDashboardState((previousState) => ({
          ...previousState,
          apiOrigin: currentApiOrigin,
          user: null,
          clients: [],
          activeClientId: null,
          csrfToken: null,
        }));

        return false;
      }
    },
    [apiRequest, dashboardState.apiOrigin, setError],
  );

  const ensureCsrfToken = useCallback(
    async (apiOriginOverride?: string): Promise<void> => {
      const currentApiOrigin = apiOriginOverride ?? dashboardState.apiOrigin;
      const payload = await apiRequest<CsrfTokenResponse>(
        "/api/v1/auth/csrf",
        {},
        {
          apiOrigin: currentApiOrigin,
          csrfToken: null,
        },
      );

      setDashboardState((previousState) => ({
        ...previousState,
        csrfToken: payload.csrfToken,
      }));
    },
    [apiRequest, dashboardState.apiOrigin],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const hasSession = await loadSession();
      if (cancelled) return;

      if (hasSession) {
        try {
          await ensureCsrfToken();
          if (cancelled) return;
        } catch (error) {
          if (!cancelled) {
            setError(getErrorMessage(error));
          }
        }
      }

      if (!window.location.hash) {
        setHashRoute(hasSession ? "/settings" : "/login");
      }

      if (!cancelled) {
        setRoute(getHashRoute());
        setIsInitializing(false);
      }
    })().catch((error) => {
      if (!cancelled) {
        setError(getErrorMessage(error));
        setIsInitializing(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [ensureCsrfToken, loadSession, setError]);

  useEffect(() => {
    if (!isInitializing && !dashboardState.user && route !== "/login") {
      setHashRoute("/login");
    }
  }, [dashboardState.user, isInitializing, route]);

  useEffect(() => {
    if (!dashboardState.user || isInitializing) {
      return;
    }

    if (!dashboardState.activeClientId && dashboardState.clients[0]?.id) {
      const firstClientId = dashboardState.clients[0].id;
      localStorage.setItem(STORAGE_KEYS.activeClientId, firstClientId);
      setDashboardState((previousState) => ({
        ...previousState,
        activeClientId: firstClientId,
      }));
      return;
    }

    if (!dashboardState.activeClientId) {
      return;
    }

    if (route === "/plugins") {
      return;
    }

    let cancelled = false;

    (async () => {
      setIsRouteLoading(true);

      try {
        if (route === "/install") {
          const payload = await apiRequest<InstallSnippetResponse>(
            `/api/v1/clients/${dashboardState.activeClientId}/install-snippet`,
          );
          if (!cancelled) {
            setInstallSnippet(payload.snippet);
          }
        } else {
          const payload = await apiRequest<SettingsSnapshot>(
            `/api/v1/clients/${dashboardState.activeClientId}/settings/current`,
          );

          if (!cancelled) {
            setDashboardState((previousState) => ({
              ...previousState,
              settingsSnapshot: payload,
            }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          setError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsRouteLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    apiRequest,
    dashboardState.activeClientId,
    dashboardState.clients,
    dashboardState.user,
    isInitializing,
    route,
    setError,
  ]);

  useEffect(() => {
    setApiOriginInput(dashboardState.apiOrigin);
  }, [dashboardState.apiOrigin]);

  const activeSettings = dashboardState.settingsSnapshot?.settings || DEFAULT_SETTINGS;

  const userBadgeLabel = useMemo(
    () => dashboardState.user?.email || "anonymous",
    [dashboardState.user?.email],
  );

  const onLoginSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();

      try {
        await apiRequest("/api/v1/auth/login", {
          method: "POST",
          body: JSON.stringify({
            clerkSessionToken: clerkSessionTokenInput.trim(),
            clerkUserId: clerkUserIdInput.trim(),
          }),
        });

        const hasSession = await loadSession();
        if (hasSession) {
          await ensureCsrfToken();
        }
        setNotice("Logged in successfully via Clerk.");
        setHashRoute("/settings");
      } catch (error) {
        setError(getErrorMessage(error));
      }
    },
    [
      apiRequest,
      clerkSessionTokenInput,
      clerkUserIdInput,
      ensureCsrfToken,
      loadSession,
      setError,
      setNotice,
    ],
  );

  const onSaveApiOrigin = useCallback(async (): Promise<void> => {
    const nextApiOrigin = apiOriginInput.trim();
    if (!nextApiOrigin.length) {
      return;
    }

    localStorage.setItem(STORAGE_KEYS.apiOrigin, nextApiOrigin);

    setDashboardState((previousState) => ({
      ...previousState,
      apiOrigin: nextApiOrigin,
      csrfToken: null,
    }));

    const hasSession = await loadSession(nextApiOrigin);
    if (hasSession) {
      await ensureCsrfToken(nextApiOrigin);
    }

    setNotice(`API origin updated to ${nextApiOrigin}`);
  }, [apiOriginInput, ensureCsrfToken, loadSession, setNotice]);

  const onLogout = useCallback(async (): Promise<void> => {
    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
      setDashboardState((previousState) => ({
        ...previousState,
        user: null,
        clients: [],
        activeClientId: null,
        csrfToken: null,
      }));
      setNotice("Logged out.");
      setHashRoute("/login");
    } catch (error) {
      setError(getErrorMessage(error));
    }
  }, [apiRequest, setError, setNotice]);

  const onSaveSettings = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();

      if (!dashboardState.activeClientId) {
        setError("No active client selected");
        return;
      }

      const formData = new FormData(event.currentTarget);

      try {
        const updated = await apiRequest<SettingsSnapshot>(
          `/api/v1/clients/${dashboardState.activeClientId}/settings`,
          {
            method: "PUT",
            body: JSON.stringify({
              fontScalePct: Number(formData.get("fontScalePct")),
              fontWeight: Number(formData.get("fontWeight")),
              fontFamily: String(formData.get("fontFamily") || "inherit"),
              fontColor: String(formData.get("fontColor") || "#355aa8"),
              spacingEm: Number(formData.get("spacingEm")),
            }),
          },
        );

        setDashboardState((previousState) => ({
          ...previousState,
          settingsSnapshot: updated,
        }));
        setNotice(`Settings saved. New version: ${updated.version}`);
      } catch (error) {
        setError(getErrorMessage(error));
      }
    },
    [apiRequest, dashboardState.activeClientId, setError, setNotice],
  );

  const onPublishPlugin = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();

      if (!dashboardState.activeClientId) {
        setError("No active client selected");
        return;
      }

      const formData = new FormData(event.currentTarget);

      try {
        const payload = await apiRequest<PublishPluginResponse>(
          `/api/v1/clients/${dashboardState.activeClientId}/plugins/publish`,
          {
            method: "POST",
            body: JSON.stringify({
              kind: String(formData.get("kind")),
              artifactUrl: String(formData.get("artifactUrl")),
              integrity: String(formData.get("integrity")),
            }),
          },
        );

        setNotice(`Published ${payload.kind} plugin v${payload.version}.`);
      } catch (error) {
        setError(getErrorMessage(error));
      }
    },
    [apiRequest, dashboardState.activeClientId, setError, setNotice],
  );

  const onCopySnippet = useCallback(async (): Promise<void> => {
    if (!installSnippet.length) {
      return;
    }

    await navigator.clipboard.writeText(installSnippet);
    setNotice("Snippet copied to clipboard.");
  }, [installSnippet, setNotice]);

  const isLoggedIn = Boolean(dashboardState.user);

  const renderRouteContent = (): ReactElement => {
    if (!isLoggedIn) {
      return (
        <section className="grid">
          <article className="panel">
            <h2>Login With Clerk Session</h2>
            <form onSubmit={onLoginSubmit}>
              <label htmlFor="clerk-session-token">Clerk session token</label>
              <textarea
                id="clerk-session-token"
                name="clerkSessionToken"
                rows={5}
                placeholder="Paste Clerk __session JWT or mock-clerk token"
                value={clerkSessionTokenInput}
                onChange={(event) => {
                  setClerkSessionTokenInput(event.target.value);
                }}
                required
              />
              <label htmlFor="clerk-user-id">Clerk user ID (optional)</label>
              <input
                id="clerk-user-id"
                name="clerkUserId"
                placeholder="user_..."
                value={clerkUserIdInput}
                onChange={(event) => {
                  setClerkUserIdInput(event.target.value);
                }}
              />
              <button className="primary" type="submit">
                Login
              </button>
            </form>
            <p className="notice">
              Use Clerk to obtain a valid session token, then exchange it with
              the control-plane API.
            </p>
          </article>
          <article className="panel">
            <h2>Local Mock Token (Dev/Test)</h2>
            <p className="notice">
              If mock Clerk mode is enabled in the API, you can log in with
              token value <code>mock-clerk</code>.
            </p>
            <button
              onClick={() => {
                setClerkSessionTokenInput("mock-clerk");
              }}
            >
              Use mock-clerk token
            </button>
          </article>
        </section>
      );
    }

    if (route === "/install") {
      return (
        <section className="panel">
          <h2>Install Runtime Script</h2>
          <p className="notice">
            Copy this client-scoped script tag into the pricing or store page
            template.
          </p>
          <div className="code">{installSnippet}</div>
          <div className="row" style={{ marginTop: "0.7rem" }}>
            <button id="copy-snippet" className="primary" onClick={onCopySnippet}>
              Copy Snippet
            </button>
            <a
              href="http://127.0.0.1:5173/b2b-demo.html"
              target="_blank"
              rel="noreferrer"
            >
              Open B2B Demo Page
            </a>
          </div>
        </section>
      );
    }

    if (route === "/plugins") {
      return (
        <section className="panel">
          <h2>Publish Plugin Artifact</h2>
          <p className="notice">
            Use this after your deterministic plugin build pipeline emits
            artifact URL + integrity.
          </p>
          <form onSubmit={onPublishPlugin}>
            <label htmlFor="plugin-kind">Kind</label>
            <select id="plugin-kind" name="kind" defaultValue="pre">
              <option value="pre">Pre plugin</option>
              <option value="post">Post plugin</option>
            </select>
            <label htmlFor="artifact-url">Artifact URL</label>
            <input
              id="artifact-url"
              name="artifactUrl"
              required
              placeholder="/b2b/clients/acme/pre.v2.js"
            />
            <label htmlFor="artifact-integrity">Integrity</label>
            <input
              id="artifact-integrity"
              name="integrity"
              required
              placeholder="sha256-..."
            />
            <button className="primary" type="submit">
              Publish
            </button>
          </form>
        </section>
      );
    }

    return (
      <section className="panel">
        <h2>Client Runtime Settings</h2>
        <p className="notice">
          Settings are versioned. A page reload should pick up the latest
          version.
        </p>
        <form
          key={dashboardState.settingsSnapshot?.version || 0}
          onSubmit={onSaveSettings}
        >
          <label htmlFor="font-scale-pct">Font scale percent</label>
          <input
            id="font-scale-pct"
            name="fontScalePct"
            type="number"
            min="60"
            max="200"
            defaultValue={activeSettings.fontScalePct}
            required
          />

          <label htmlFor="font-weight">Font weight</label>
          <input
            id="font-weight"
            name="fontWeight"
            type="number"
            min="300"
            max="800"
            defaultValue={activeSettings.fontWeight}
            required
          />

          <label htmlFor="font-family">Font family</label>
          <select
            id="font-family"
            name="fontFamily"
            defaultValue={activeSettings.fontFamily}
          >
            {SETTINGS_FONT_FAMILIES.map((fontFamily) => (
              <option key={fontFamily} value={fontFamily}>
                {fontFamily}
              </option>
            ))}
          </select>

          <label htmlFor="font-color">Font color</label>
          <input
            id="font-color"
            name="fontColor"
            defaultValue={activeSettings.fontColor}
            required
          />

          <label htmlFor="spacing-em">Spacing (em)</label>
          <input
            id="spacing-em"
            name="spacingEm"
            type="number"
            step="0.01"
            min="0"
            max="0.5"
            defaultValue={activeSettings.spacingEm}
            required
          />

          <button className="primary" type="submit">
            Save Settings
          </button>
        </form>
        <p className="notice">
          Current version: {dashboardState.settingsSnapshot?.version ?? "unknown"}
        </p>
      </section>
    );
  };

  return (
    <div className="layout">
      <header>
        <h1>FX Inline Control Plane Dashboard</h1>
        {isLoggedIn ? (
          <>
            <p>Signed-manifest runtime operations for client pricing pages.</p>
            <div className="nav">
              <button
                data-route="/settings"
                onClick={() => {
                  setHashRoute("/settings");
                }}
              >
                Settings
              </button>
              <button
                data-route="/install"
                onClick={() => {
                  setHashRoute("/install");
                }}
              >
                Install
              </button>
              <button
                data-route="/plugins"
                onClick={() => {
                  setHashRoute("/plugins");
                }}
              >
                Plugins
              </button>
              <button
                data-action="logout"
                className="ghost"
                onClick={() => {
                  void onLogout();
                }}
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          <p>
            Manage runtime settings and install snippets for each client
            workspace.
          </p>
        )}
      </header>

      {isLoggedIn ? (
        <>
          <section className="panel">
            <div className="row">
              <label htmlFor="api-origin" style={{ margin: 0 }}>
                API origin
              </label>
              <input
                id="api-origin"
                value={apiOriginInput}
                style={{ maxWidth: "320px", margin: 0 }}
                onChange={(event) => {
                  setApiOriginInput(event.target.value);
                }}
              />
              <button
                data-action="save-api-origin"
                onClick={() => {
                  void onSaveApiOrigin();
                }}
              >
                Save
              </button>
              <span className="badge">{userBadgeLabel}</span>
            </div>
          </section>

          <section className="panel">
            <label htmlFor="active-client">Active client</label>
            <select
              id="active-client"
              value={dashboardState.activeClientId ?? ""}
              onChange={(event) => {
                const nextClientId = event.target.value || null;
                setDashboardState((previousState) => ({
                  ...previousState,
                  activeClientId: nextClientId,
                }));
                if (nextClientId) {
                  localStorage.setItem(STORAGE_KEYS.activeClientId, nextClientId);
                }
              }}
            >
              {dashboardState.clients.length ? (
                dashboardState.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.role})
                  </option>
                ))
              ) : (
                <option value="">No clients</option>
              )}
            </select>
          </section>
        </>
      ) : null}

      {isInitializing || isRouteLoading ? (
        <section className="panel">
          <p className="notice">Loading...</p>
        </section>
      ) : (
        renderRouteContent()
      )}

      {dashboardState.error ? <p className="error">{dashboardState.error}</p> : null}
      {dashboardState.notice ? (
        <p className="notice">{dashboardState.notice}</p>
      ) : null}
    </div>
  );
}
