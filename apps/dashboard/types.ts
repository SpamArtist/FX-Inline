export interface DashboardUser {
  id: string;
  email: string;
  displayName: string;
  clerkUserId: string | null;
  isPlatformAdmin: boolean;
}

export interface DashboardClient {
  id: string;
  slug: string;
  name: string;
  preferredCurrency: string;
  allowedOrigins: string[];
  allowedPaths: string[];
  createdAt: number;
  role: string;
}

export interface UiSettings {
  fontScalePct: number;
  fontWeight: number;
  fontFamily: string;
  fontColor: string;
  spacingEm: number;
}

export interface SettingsSnapshot {
  version: number;
  settings: UiSettings;
  updatedAt: number;
}

export interface ApiErrorPayload {
  error?: {
    message?: string;
  };
}

export interface DashboardState {
  apiOrigin: string;
  user: DashboardUser | null;
  clients: DashboardClient[];
  activeClientId: string | null;
  csrfToken: string | null;
  settingsSnapshot: SettingsSnapshot | null;
  error: string;
  notice: string;
}

export interface AuthMeResponse {
  user: DashboardUser;
  clients: DashboardClient[];
}

export interface AllowedDomain {
  domain: string;
  createdByUserId: string | null;
  createdAt: number;
}

export interface AllowedDomainsResponse {
  domains: AllowedDomain[];
}

export interface AddAllowedDomainResponse {
  domain: AllowedDomain;
}

export interface RemoveAllowedDomainResponse {
  removed: boolean;
  domain: string;
}

export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface InstallSnippetResponse {
  snippet: string;
}

export interface PublishPluginResponse {
  kind: string;
  version: number;
}

export type DashboardRoute = "/login" | "/settings" | "/install" | "/plugins" | "/admin";

export interface ClerkConfigResponse {
  publishableKey: string;
  authorizedParties: string[];
  mockEnabled: boolean;
}
