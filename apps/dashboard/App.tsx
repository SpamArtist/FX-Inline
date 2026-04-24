import { Clerk } from "@clerk/clerk-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import type {
  AddAllowedDomainResponse,
  AllowedDomain,
  AllowedDomainsResponse,
  ApiErrorPayload,
  AuthMeResponse,
  ClerkConfigResponse,
  CsrfTokenResponse,
  DashboardRoute,
  DashboardState,
  InstallSnippetResponse,
  PublishPluginResponse,
  RemoveAllowedDomainResponse,
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

  if (
    normalized === "/install" ||
    normalized === "/plugins" ||
    normalized === "/settings" ||
    normalized === "/admin"
  ) {
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

function loadingPanel(label: string): ReactElement {
  return (
    <section className="surface-panel loading-panel">
      <div className="loading-shimmer" />
      <p>{label}</p>
    </section>
  );
}

function sortAllowedDomains(domains: AllowedDomain[]): AllowedDomain[] {
  return [...domains].sort((left, right) => left.domain.localeCompare(right.domain));
}

function uniqueAllowedDomains(domains: AllowedDomain[]): AllowedDomain[] {
  const uniqueMap = new Map<string, AllowedDomain>();
  for (const domain of domains) {
    uniqueMap.set(domain.domain, domain);
  }

  return sortAllowedDomains(Array.from(uniqueMap.values()));
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
  const [installSnippet, setInstallSnippet] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [isSavingApiOrigin, setIsSavingApiOrigin] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);
  const [isAdminMutating, setIsAdminMutating] = useState(false);
  const [clerkConfig, setClerkConfig] = useState<ClerkConfigResponse | null>(null);
  const [clerkClient, setClerkClient] = useState<Clerk | null>(null);
  const [allowedDomains, setAllowedDomains] = useState<AllowedDomain[]>([]);
  const [allowedDomainInput, setAllowedDomainInput] = useState("");
  const hasInitializedRef = useRef(false);

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

  const loadClerkConfig = useCallback(
    async (apiOriginOverride?: string): Promise<ClerkConfigResponse | null> => {
      const currentApiOrigin = apiOriginOverride ?? dashboardState.apiOrigin;

      try {
        const payload = await apiRequest<ClerkConfigResponse>(
          "/api/v1/auth/clerk/config",
          {},
          { apiOrigin: currentApiOrigin, csrfToken: null },
        );
        setClerkConfig(payload);
        return payload;
      } catch {
        setClerkConfig(null);
        setClerkClient(null);
        return null;
      }
    },
    [apiRequest, dashboardState.apiOrigin],
  );

  const initializeClerkClient = useCallback(
    async (config: ClerkConfigResponse | null): Promise<Clerk | null> => {
      if (!config?.publishableKey.length) {
        setClerkClient(null);
        return null;
      }

      const client = new Clerk(config.publishableKey);
      await client.load();
      setClerkClient(client);
      return client;
    },
    [],
  );

  const loadSession = useCallback(
    async (apiOriginOverride?: string): Promise<AuthMeResponse | null> => {
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

        return payload;
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

        return null;
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

  const exchangeClerkSession = useCallback(
    async (client: Clerk): Promise<void> => {
      const clerkSessionToken = await client.session?.getToken();
      if (!clerkSessionToken || !clerkSessionToken.length) {
        throw new Error("No active Clerk session found. Start sign-in from the buttons below.");
      }

      await apiRequest(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            clerkSessionToken,
            clerkUserId: client.user?.id ?? null,
          }),
        },
        { csrfToken: null },
      );
    },
    [apiRequest],
  );

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    let cancelled = false;

    (async () => {
      const config = await loadClerkConfig();

      let initializedClerkClient: Clerk | null = null;
      if (config?.publishableKey.length) {
        try {
          initializedClerkClient = await initializeClerkClient(config);
        } catch {
          initializedClerkClient = null;
          setClerkClient(null);
        }
      }

      let sessionPayload = await loadSession();

      if (!sessionPayload && initializedClerkClient?.session) {
        try {
          await exchangeClerkSession(initializedClerkClient);
          sessionPayload = await loadSession();
        } catch {
          // Ignore silent exchange failures so the hosted auth buttons remain usable.
        }
      }

      if (cancelled) return;

      if (sessionPayload) {
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
        if (sessionPayload?.user.isPlatformAdmin) {
          setHashRoute("/admin");
        } else {
          setHashRoute(sessionPayload ? "/settings" : "/login");
        }
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
  }, [
    ensureCsrfToken,
    exchangeClerkSession,
    initializeClerkClient,
    loadClerkConfig,
    loadSession,
    setError,
  ]);

  useEffect(() => {
    if (!isInitializing && !dashboardState.user && route !== "/login") {
      setHashRoute("/login");
    }
  }, [dashboardState.user, isInitializing, route]);

  useEffect(() => {
    if (
      !isInitializing &&
      route === "/admin" &&
      dashboardState.user &&
      !dashboardState.user.isPlatformAdmin
    ) {
      setHashRoute("/settings");
    }
  }, [dashboardState.user, isInitializing, route]);

  useEffect(() => {
    const currentUser = dashboardState.user;

    if (!currentUser || isInitializing) {
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

    if (route !== "/admin" && !dashboardState.activeClientId) {
      return;
    }

    if (route === "/plugins") {
      setIsRouteLoading(false);
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
          return;
        }

        if (route === "/admin") {
          if (!currentUser.isPlatformAdmin) {
            return;
          }

          const payload = await apiRequest<AllowedDomainsResponse>("/api/v1/admin/allowed-domains");
          if (!cancelled) {
            setAllowedDomains(sortAllowedDomains(payload.domains || []));
          }
          return;
        }

        const payload = await apiRequest<SettingsSnapshot>(
          `/api/v1/clients/${dashboardState.activeClientId}/settings/current`,
        );

        if (!cancelled) {
          setDashboardState((previousState) => ({
            ...previousState,
            settingsSnapshot: payload,
          }));
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

  const hostedSignInRedirect = useCallback(async (): Promise<void> => {
    if (!clerkClient) {
      setError("Clerk hosted login is not configured. Check publishable key and API origin.");
      return;
    }

    setIsSubmittingLogin(true);

    try {
      await clerkClient.redirectToSignIn({
        redirectUrl: window.location.href,
        signInFallbackRedirectUrl: window.location.href,
      });
    } catch (error) {
      setError(getErrorMessage(error));
      setIsSubmittingLogin(false);
    }
  }, [clerkClient, setError]);

  const hostedSignUpRedirect = useCallback(async (): Promise<void> => {
    if (!clerkClient) {
      setError("Clerk hosted signup is not configured. Check publishable key and API origin.");
      return;
    }

    setIsSubmittingLogin(true);

    try {
      await clerkClient.redirectToSignUp({
        redirectUrl: window.location.href,
        signUpFallbackRedirectUrl: window.location.href,
      });
    } catch (error) {
      setError(getErrorMessage(error));
      setIsSubmittingLogin(false);
    }
  }, [clerkClient, setError]);

  const onMockLogin = useCallback(async (): Promise<void> => {
    setIsSubmittingLogin(true);

    try {
      await apiRequest(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            clerkSessionToken: "mock-clerk",
          }),
        },
        { csrfToken: null },
      );

      const sessionPayload = await loadSession();
      if (sessionPayload) {
        await ensureCsrfToken();
        setHashRoute(sessionPayload.user.isPlatformAdmin ? "/admin" : "/settings");
      }
      setNotice("Logged in successfully via mock Clerk.");
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsSubmittingLogin(false);
    }
  }, [apiRequest, ensureCsrfToken, loadSession, setError, setNotice]);

  const onSaveApiOrigin = useCallback(async (): Promise<void> => {
    const nextApiOrigin = apiOriginInput.trim();
    if (!nextApiOrigin.length) {
      return;
    }

    setIsSavingApiOrigin(true);
    localStorage.setItem(STORAGE_KEYS.apiOrigin, nextApiOrigin);

    setDashboardState((previousState) => ({
      ...previousState,
      apiOrigin: nextApiOrigin,
      csrfToken: null,
    }));

    try {
      const config = await loadClerkConfig(nextApiOrigin);
      await initializeClerkClient(config);

      const sessionPayload = await loadSession(nextApiOrigin);
      if (sessionPayload) {
        await ensureCsrfToken(nextApiOrigin);
      }

      setNotice(`API origin updated to ${nextApiOrigin}`);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsSavingApiOrigin(false);
    }
  }, [
    apiOriginInput,
    ensureCsrfToken,
    initializeClerkClient,
    loadClerkConfig,
    loadSession,
    setError,
    setNotice,
  ]);

  const onLogout = useCallback(async (): Promise<void> => {
    let logoutError: string | null = null;

    try {
      await apiRequest("/api/v1/auth/logout", { method: "POST" });
    } catch (error) {
      logoutError = getErrorMessage(error);
    }

    try {
      if (clerkClient) {
        await clerkClient.signOut();
      }
    } catch {
      // Dashboard logout still completes even if upstream Clerk sign-out fails.
    }

    setDashboardState((previousState) => ({
      ...previousState,
      user: null,
      clients: [],
      activeClientId: null,
      csrfToken: null,
      settingsSnapshot: null,
    }));
    setAllowedDomains([]);

    if (logoutError) {
      setError(logoutError);
    } else {
      setNotice("Logged out.");
    }

    setHashRoute("/login");
  }, [apiRequest, clerkClient, setError, setNotice]);

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

    try {
      await navigator.clipboard.writeText(installSnippet);
      setNotice("Snippet copied to clipboard.");
    } catch {
      setError("Clipboard access failed. Copy manually from the snippet block.");
    }
  }, [installSnippet, setError, setNotice]);

  const onAddAllowedDomain = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();

      if (!allowedDomainInput.trim().length) {
        setError("Domain is required");
        return;
      }

      setIsAdminMutating(true);

      try {
        const payload = await apiRequest<AddAllowedDomainResponse>(
          "/api/v1/admin/allowed-domains",
          {
            method: "POST",
            body: JSON.stringify({
              domain: allowedDomainInput,
            }),
          },
        );

        setAllowedDomains((previousDomains) =>
          uniqueAllowedDomains([...previousDomains, payload.domain]),
        );
        setAllowedDomainInput("");
        setNotice(`Allowed domain added: ${payload.domain.domain}`);
      } catch (error) {
        setError(getErrorMessage(error));
      } finally {
        setIsAdminMutating(false);
      }
    },
    [allowedDomainInput, apiRequest, setError, setNotice],
  );

  const onRemoveAllowedDomain = useCallback(
    async (domain: string): Promise<void> => {
      setIsAdminMutating(true);

      try {
        const payload = await apiRequest<RemoveAllowedDomainResponse>(
          `/api/v1/admin/allowed-domains/${encodeURIComponent(domain)}`,
          {
            method: "DELETE",
          },
        );

        if (payload.removed) {
          setAllowedDomains((previousDomains) =>
            previousDomains.filter((entry) => entry.domain !== payload.domain),
          );
        }

        setNotice(
          payload.removed
            ? `Removed allowed domain: ${payload.domain}`
            : `Domain not found: ${payload.domain}`,
        );
      } catch (error) {
        setError(getErrorMessage(error));
      } finally {
        setIsAdminMutating(false);
      }
    },
    [apiRequest, setError, setNotice],
  );

  const isLoggedIn = Boolean(dashboardState.user);

  const renderRouteContent = (): ReactElement => {
    if (route === "/install") {
      if (isRouteLoading) {
        return loadingPanel("Preparing your install snippet...");
      }

      return (
        <section className="surface-panel route-install motion-rise">
          <header className="panel-header">
            <p className="eyebrow">Client Runtime</p>
            <h2>Install Loader Script</h2>
            <p>
              Embed this client-scoped snippet in pricing, checkout, or catalog
              templates.
            </p>
          </header>

          <div className="snippet-box">{installSnippet}</div>

          <div className="panel-actions">
            <button type="button" className="btn-primary" onClick={onCopySnippet}>
              Copy Snippet
            </button>
            <a
              href="http://127.0.0.1:5173/b2b-demo.html"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              Open Demo Page
            </a>
          </div>
        </section>
      );
    }

    if (route === "/plugins") {
      return (
        <section className="surface-panel route-plugins motion-rise">
          <header className="panel-header">
            <p className="eyebrow">Artifact Registry</p>
            <h2>Publish Plugin Artifact</h2>
            <p>
              Register immutable plugin build artifacts for deterministic runtime
              loading.
            </p>
          </header>

          <form className="form-grid" onSubmit={onPublishPlugin}>
            <label htmlFor="plugin-kind">Plugin Kind</label>
            <select id="plugin-kind" name="kind" defaultValue="pre" required>
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

            <label htmlFor="artifact-integrity">Integrity Hash</label>
            <input
              id="artifact-integrity"
              name="integrity"
              required
              placeholder="sha256-..."
            />

            <div className="panel-actions compact">
              <button className="btn-primary" type="submit">
                Publish Artifact
              </button>
            </div>
          </form>
        </section>
      );
    }

    if (route === "/admin") {
      if (isRouteLoading) {
        return loadingPanel("Loading allowed domains...");
      }

      if (!dashboardState.user?.isPlatformAdmin) {
        return (
          <section className="surface-panel motion-rise">
            <header className="panel-header">
              <p className="eyebrow">Admin Access</p>
              <h2>Access Denied</h2>
              <p>This route is available only to platform admins.</p>
            </header>
          </section>
        );
      }

      return (
        <section className="surface-panel route-admin motion-rise">
          <header className="panel-header">
            <p className="eyebrow">Platform Access Policy</p>
            <h2>Allowed Email Domains</h2>
            <p>
              Non-admin users can sign in only when their email domain exactly
              matches one of these entries.
            </p>
          </header>

          <form className="admin-domain-form" onSubmit={onAddAllowedDomain}>
            <label htmlFor="allowed-domain-input">Add domain</label>
            <div className="admin-domain-row">
              <input
                id="allowed-domain-input"
                placeholder="example.com"
                value={allowedDomainInput}
                onChange={(event) => {
                  setAllowedDomainInput(event.target.value);
                }}
              />
              <button className="btn-primary" type="submit" disabled={isAdminMutating}>
                {isAdminMutating ? "Saving..." : "Add Domain"}
              </button>
            </div>
          </form>

          <div className="domain-list">
            {allowedDomains.length ? (
              allowedDomains.map((entry) => (
                <article key={entry.domain} className="domain-item">
                  <div>
                    <h3>{entry.domain}</h3>
                    <p>Added at {new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={isAdminMutating}
                    onClick={() => {
                      void onRemoveAllowedDomain(entry.domain);
                    }}
                  >
                    Remove
                  </button>
                </article>
              ))
            ) : (
              <p className="meta-inline">
                No allowed domains configured. Non-admin users will be denied login.
              </p>
            )}
          </div>
        </section>
      );
    }

    if (isRouteLoading) {
      return loadingPanel("Loading client settings...");
    }

    return (
      <section className="surface-panel route-settings motion-rise">
        <header className="panel-header">
          <p className="eyebrow">Presentation Controls</p>
          <h2>Converted Currency Appearance</h2>
          <p>
            Versioned typography and spacing controls for post-plugin conversion
            rendering.
          </p>
        </header>

        <form
          className="settings-grid"
          key={dashboardState.settingsSnapshot?.version || 0}
          onSubmit={onSaveSettings}
        >
          <div className="field-group">
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
          </div>

          <div className="field-group">
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
          </div>

          <div className="field-group field-span-2">
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
          </div>

          <div className="field-group">
            <label htmlFor="font-color">Font color</label>
            <input
              id="font-color"
              name="fontColor"
              defaultValue={activeSettings.fontColor}
              required
            />
          </div>

          <div className="field-group">
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
          </div>

          <div className="panel-actions field-span-2 compact">
            <button className="btn-primary" type="submit">
              Save Settings
            </button>
            <p className="meta-inline">
              Current version: {dashboardState.settingsSnapshot?.version ?? "unknown"}
            </p>
          </div>
        </form>
      </section>
    );
  };

  if (!isLoggedIn) {
    const hostedClerkConfigured = Boolean(clerkConfig?.publishableKey.length && clerkClient);

    return (
      <div className="dashboard-app auth-shell">
        <div className="ambient-orb ambient-orb-a" aria-hidden="true" />
        <div className="ambient-orb ambient-orb-b" aria-hidden="true" />

        <section className="auth-showcase motion-stagger">
          <div>
            <p className="brand-chip">FX Inline Control Plane</p>
            <h1>Secure Currency Runtime Operations</h1>
            <p className="lede">
              Configure client-specific conversion behavior, publish deterministic
              plugin artifacts, and deliver signed runtime manifests.
            </p>
          </div>

          <div className="showcase-metrics">
            <article>
              <h3>Signed Manifests</h3>
              <p>Cryptographically verifiable runtime payload delivery.</p>
            </article>
            <article>
              <h3>Versioned Settings</h3>
              <p>Deterministic UI controls with reload-safe propagation.</p>
            </article>
            <article>
              <h3>Scoped Plugins</h3>
              <p>Client-specific pre/post plugin artifact orchestration.</p>
            </article>
          </div>

          {clerkConfig ? (
            <div className="showcase-footnote">
              <span>Clerk configured</span>
              <code>{clerkConfig.publishableKey || "publishable key unavailable"}</code>
            </div>
          ) : null}
        </section>

        <section className="auth-panel motion-rise">
          <header>
            <p className="eyebrow">Authentication</p>
            <h2>Sign In To Dashboard</h2>
            <p>
              Use Clerk hosted authentication for Google SSO or email/password,
              then the dashboard automatically exchanges your session for
              `cp_session`.
            </p>
          </header>

          <div className="auth-actions auth-actions-vertical">
            <button
              className="btn-primary"
              type="button"
              onClick={() => {
                void hostedSignInRedirect();
              }}
              disabled={!hostedClerkConfigured || isSubmittingLogin}
            >
              {isSubmittingLogin ? "Redirecting..." : "Continue with Google SSO"}
            </button>

            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                void hostedSignInRedirect();
              }}
              disabled={!hostedClerkConfigured || isSubmittingLogin}
            >
              Continue with Email + Password
            </button>

            <button
              className="btn-ghost"
              type="button"
              onClick={() => {
                void hostedSignUpRedirect();
              }}
              disabled={!hostedClerkConfigured || isSubmittingLogin}
            >
              Create Account
            </button>

            {clerkConfig?.mockEnabled ? (
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  void onMockLogin();
                }}
                disabled={isSubmittingLogin}
              >
                Developer Mock Login
              </button>
            ) : null}
          </div>

          {!hostedClerkConfigured && !clerkConfig?.mockEnabled ? (
            <div className="auth-note">
              <p>
                Clerk publishable key is not available for this API origin. Update
                API origin and verify Clerk environment configuration.
              </p>
            </div>
          ) : null}
        </section>

        {dashboardState.error ? <p className="feedback error">{dashboardState.error}</p> : null}
        {dashboardState.notice ? <p className="feedback notice">{dashboardState.notice}</p> : null}
      </div>
    );
  }

  return (
    <div className="dashboard-app workspace-shell">
      <div className="ambient-orb ambient-orb-a" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-b" aria-hidden="true" />

      <header className="workspace-header motion-rise">
        <div className="brand-block">
          <p className="brand-chip">FX Inline</p>
          <h1>Control Plane Dashboard</h1>
          <p>Signed-manifest runtime operations for client pricing surfaces.</p>
        </div>

        <nav className="top-nav" aria-label="Dashboard sections">
          <button
            className={route === "/settings" ? "active" : ""}
            onClick={() => {
              setHashRoute("/settings");
            }}
            type="button"
          >
            Settings
          </button>
          <button
            className={route === "/install" ? "active" : ""}
            onClick={() => {
              setHashRoute("/install");
            }}
            type="button"
          >
            Install
          </button>
          <button
            className={route === "/plugins" ? "active" : ""}
            onClick={() => {
              setHashRoute("/plugins");
            }}
            type="button"
          >
            Plugins
          </button>
          {dashboardState.user?.isPlatformAdmin ? (
            <button
              className={route === "/admin" ? "active" : ""}
              onClick={() => {
                setHashRoute("/admin");
              }}
              type="button"
            >
              Admin
            </button>
          ) : null}
        </nav>

        <div className="session-actions">
          <span className="identity-pill">
            {userBadgeLabel}
            {dashboardState.user?.isPlatformAdmin ? " (admin)" : ""}
          </span>
          <button className="btn-ghost" onClick={() => void onLogout()} type="button">
            Logout
          </button>
        </div>
      </header>

      <main className="workspace-main motion-stagger">
        <aside className="control-rail">
          <section className="rail-panel">
            <h3>Environment</h3>
            <label htmlFor="api-origin">API origin</label>
            <input
              id="api-origin"
              value={apiOriginInput}
              onChange={(event) => {
                setApiOriginInput(event.target.value);
              }}
            />
            <button
              className="btn-secondary"
              onClick={() => {
                void onSaveApiOrigin();
              }}
              type="button"
              disabled={isSavingApiOrigin}
            >
              {isSavingApiOrigin ? "Saving..." : "Save API Origin"}
            </button>

            {clerkConfig ? (
              <p className="meta-block">
                <strong>Clerk Key</strong>
                <span>{clerkConfig.publishableKey || "Unavailable"}</span>
              </p>
            ) : null}
          </section>

          <section className="rail-panel">
            <h3>Client Scope</h3>
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
            <p className="meta-block">
              <strong>Total clients</strong>
              <span>{dashboardState.clients.length}</span>
            </p>
          </section>
        </aside>

        <section className="workspace-content">{isInitializing ? loadingPanel("Initializing dashboard...") : renderRouteContent()}</section>
      </main>

      {dashboardState.error ? <p className="feedback error">{dashboardState.error}</p> : null}
      {dashboardState.notice ? <p className="feedback notice">{dashboardState.notice}</p> : null}
    </div>
  );
}
