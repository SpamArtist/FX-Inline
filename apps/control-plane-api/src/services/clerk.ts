import crypto from "node:crypto";
import type {
  ClerkAuthService,
  ClerkVerifiedIdentity,
  EnvConfig,
} from "../types.js";

interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface JwtPayload {
  sub?: string;
  sid?: string;
  azp?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  [key: string]: unknown;
}

interface ClerkJwk extends crypto.JsonWebKey {
  kid?: string;
}

interface ClerkJwksResponse {
  keys: ClerkJwk[];
}

interface ClerkUserEmail {
  id: string;
  email_address: string;
}

interface ClerkUserResponse {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string | null;
  email_addresses: ClerkUserEmail[];
}

interface MockClerkPayload {
  clerkUserId?: string;
  clerkSessionId?: string;
  email?: string;
  displayName?: string;
}

function base64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/gu, "+").replace(/_/gu, "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + "=".repeat(paddingLength), "base64");
}

function base64UrlToJson<T>(input: string): T {
  return JSON.parse(base64UrlToBuffer(input).toString("utf8")) as T;
}

function parseJwt(token: string): { header: JwtHeader; payload: JwtPayload; signingInput: string; signature: Buffer } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Clerk session token must be a JWT");
  }

  const [headerPart, payloadPart, signaturePart] = parts;

  return {
    header: base64UrlToJson<JwtHeader>(headerPart),
    payload: base64UrlToJson<JwtPayload>(payloadPart),
    signingInput: `${headerPart}.${payloadPart}`,
    signature: base64UrlToBuffer(signaturePart),
  };
}

function assertTokenClaims(payload: JwtPayload): void {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== "number" || payload.exp <= nowSeconds) {
    throw new Error("Clerk session token is expired");
  }

  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds) {
    throw new Error("Clerk session token is not active yet");
  }

  if (typeof payload.sub !== "string" || payload.sub.length < 4) {
    throw new Error("Clerk session token is missing subject");
  }

  if (typeof payload.sid !== "string" || payload.sid.length < 4) {
    throw new Error("Clerk session token is missing session id");
  }
}

function assertAuthorizedParty(payload: JwtPayload, env: EnvConfig): void {
  if (!env.clerkAuthorizedParties.length) {
    return;
  }

  if (!payload.azp) {
    return;
  }

  if (typeof payload.azp !== "string") {
    throw new Error("Clerk session token contains invalid authorized party claim");
  }

  if (!env.clerkAuthorizedParties.includes(payload.azp)) {
    throw new Error("Clerk session token authorized party is not allowed");
  }
}

async function fetchJwks(env: EnvConfig): Promise<ClerkJwksResponse> {
  const response = await fetch(env.clerkJwksUrl, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(env.clerkSecretKey ? { authorization: `Bearer ${env.clerkSecretKey}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Clerk JWKS (${response.status})`);
  }

  return (await response.json()) as ClerkJwksResponse;
}

async function resolveVerificationKey(header: JwtHeader, env: EnvConfig): Promise<crypto.KeyObject> {
  if (env.clerkJwtPublicKey.length) {
    return crypto.createPublicKey(env.clerkJwtPublicKey);
  }

  const jwks = await fetchJwks(env);
  if (!Array.isArray(jwks.keys) || !jwks.keys.length) {
    throw new Error("Clerk JWKS payload is empty");
  }

  const selected = header.kid
    ? jwks.keys.find((key) => key.kid === header.kid)
    : jwks.keys[0];

  if (!selected) {
    throw new Error("Unable to find matching Clerk JWK for token kid");
  }

  return crypto.createPublicKey({ key: selected, format: "jwk" });
}

function verifyJwtSignature(
  signingInput: string,
  signature: Buffer,
  publicKey: crypto.KeyObject,
): void {
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signingInput);
  verifier.end();

  const valid = verifier.verify(publicKey, signature);
  if (!valid) {
    throw new Error("Clerk session token signature validation failed");
  }
}

function buildDisplayName(user: ClerkUserResponse, email: string): string {
  const fullName = [user.first_name, user.last_name].filter((value) => typeof value === "string" && value.length > 0).join(" ").trim();

  if (fullName.length) {
    return fullName;
  }

  if (user.username && user.username.trim().length) {
    return user.username.trim();
  }

  return email.split("@")[0] || user.id;
}

async function fetchClerkUser(clerkUserId: string, env: EnvConfig): Promise<{ email: string; displayName: string }> {
  if (!env.clerkSecretKey.length) {
    throw new Error("CONTROL_PLANE_CLERK_SECRET_KEY is required to fetch Clerk user profile");
  }

  const response = await fetch(`${env.clerkApiUrl}/v1/users/${encodeURIComponent(clerkUserId)}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.clerkSecretKey}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Clerk user (${response.status})`);
  }

  const user = (await response.json()) as ClerkUserResponse;
  const primaryEmail =
    user.email_addresses.find((email) => email.id === user.primary_email_address_id) ||
    user.email_addresses[0];

  if (!primaryEmail?.email_address) {
    throw new Error("Clerk user profile does not include an email address");
  }

  return {
    email: primaryEmail.email_address.toLowerCase(),
    displayName: buildDisplayName(user, primaryEmail.email_address.toLowerCase()),
  };
}

function decodeMockPayload(token: string): MockClerkPayload {
  if (token === "mock-clerk") {
    return {};
  }

  if (!token.startsWith("mock-clerk:")) {
    throw new Error("Mock Clerk session token must start with mock-clerk");
  }

  const encodedPayload = token.slice("mock-clerk:".length);
  if (!encodedPayload.length) {
    return {};
  }

  try {
    return base64UrlToJson<MockClerkPayload>(encodedPayload);
  } catch {
    throw new Error("Invalid mock Clerk token payload");
  }
}

function verifyMockSessionToken(
  clerkSessionToken: string,
  clerkUserId: string | null | undefined,
): ClerkVerifiedIdentity {
  const mockPayload = decodeMockPayload(clerkSessionToken);

  const resolvedClerkUserId =
    (typeof clerkUserId === "string" && clerkUserId.trim().length ? clerkUserId.trim() : null) ||
    (typeof mockPayload.clerkUserId === "string" && mockPayload.clerkUserId.trim().length ? mockPayload.clerkUserId.trim() : null) ||
    "user_mock_clerk";

  const resolvedSessionId =
    (typeof mockPayload.clerkSessionId === "string" && mockPayload.clerkSessionId.trim().length
      ? mockPayload.clerkSessionId.trim()
      : null) || `sess_mock_${resolvedClerkUserId}`;

  const resolvedEmail =
    (typeof mockPayload.email === "string" && mockPayload.email.includes("@")
      ? mockPayload.email.toLowerCase()
      : `${resolvedClerkUserId}@example.com`);

  const resolvedDisplayName =
    (typeof mockPayload.displayName === "string" && mockPayload.displayName.trim().length
      ? mockPayload.displayName.trim()
      : resolvedEmail.split("@")[0]);

  return {
    clerkUserId: resolvedClerkUserId,
    clerkSessionId: resolvedSessionId,
    email: resolvedEmail,
    displayName: resolvedDisplayName,
  };
}

export function createClerkAuthService(env: EnvConfig): ClerkAuthService {
  async function verifySessionToken({
    clerkSessionToken,
    clerkUserId,
  }: {
    clerkSessionToken: string;
    clerkUserId?: string | null;
  }): Promise<ClerkVerifiedIdentity> {
    if (!clerkSessionToken.trim().length) {
      throw new Error("clerkSessionToken is required");
    }

    if (env.enableMockClerk) {
      return verifyMockSessionToken(clerkSessionToken.trim(), clerkUserId);
    }

    const parsed = parseJwt(clerkSessionToken.trim());

    if (parsed.header.alg !== "RS256") {
      throw new Error("Clerk session token must use RS256");
    }

    assertTokenClaims(parsed.payload);
    assertAuthorizedParty(parsed.payload, env);

    const publicKey = await resolveVerificationKey(parsed.header, env);
    verifyJwtSignature(parsed.signingInput, parsed.signature, publicKey);

    const resolvedClerkUserId = parsed.payload.sub as string;
    const resolvedSessionId = parsed.payload.sid as string;

    if (
      clerkUserId &&
      clerkUserId.trim().length &&
      clerkUserId.trim() !== resolvedClerkUserId
    ) {
      throw new Error("Provided clerkUserId does not match token subject");
    }

    const profile = await fetchClerkUser(resolvedClerkUserId, env);

    return {
      clerkUserId: resolvedClerkUserId,
      clerkSessionId: resolvedSessionId,
      email: profile.email,
      displayName: profile.displayName,
    };
  }

  return {
    verifySessionToken,
  };
}
