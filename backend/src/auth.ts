import { hashPassword, verifyPassword } from "./crypto.js";
import { createId } from "./crypto.js";
import { mutateDb, readDb } from "./db.js";
import { getEntitlementView } from "./entitlements.js";
import { issueAuthTokens, verifyAccessToken, verifyRefreshToken } from "./tokens.js";
import { AuthTokens, EntitlementView, RefreshTokenPayload, UserRecord } from "./types.js";

type AuthResult = {
  user: {
    id: string;
    email: string;
  };
  tokens: AuthTokens;
  entitlement: EntitlementView;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): boolean {
  return /.+@.+\..+/.test(email);
}

function validatePassword(password: string): boolean {
  return password.length >= 8;
}

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const db = await readDb();
  const normalized = normalizeEmail(email);
  return db.users.find((entry) => entry.email === normalized) || null;
}

async function findUserById(userId: string): Promise<UserRecord | null> {
  const db = await readDb();
  return db.users.find((entry) => entry.id === userId) || null;
}

async function createUser(email: string, password: string): Promise<UserRecord> {
  const now = Date.now();
  const user: UserRecord = {
    id: createId("usr"),
    email: normalizeEmail(email),
    passwordHash: hashPassword(password),
    createdAt: now,
    stripeCustomerId: null,
  };

  await mutateDb((draft) => {
    draft.users.push(user);
  });

  return user;
}

async function saveRefreshSession(
  userId: string,
  tokenId: string,
  expiresAt: number,
): Promise<void> {
  await mutateDb((draft) => {
    draft.refreshSessions.push({
      tokenId,
      userId,
      issuedAt: Date.now(),
      expiresAt,
      revokedAt: null,
      replacedByTokenId: null,
    });
  });
}

async function revokeRefreshSession(
  tokenId: string,
  replacedByTokenId?: string,
): Promise<void> {
  await mutateDb((draft) => {
    const session = draft.refreshSessions.find((entry) => entry.tokenId === tokenId);
    if (!session) return;

    session.revokedAt = Date.now();
    session.replacedByTokenId = replacedByTokenId || null;
  });
}

async function validateRefreshSession(
  payload: RefreshTokenPayload,
): Promise<{ valid: boolean; reason?: string }> {
  const db = await readDb();

  const session = db.refreshSessions.find(
    (entry) => entry.tokenId === payload.jti && entry.userId === payload.sub,
  );

  if (!session) {
    return { valid: false, reason: "Refresh session not found" };
  }

  if (session.revokedAt) {
    return { valid: false, reason: "Refresh session revoked" };
  }

  if (Date.now() >= session.expiresAt) {
    return { valid: false, reason: "Refresh session expired" };
  }

  return { valid: true };
}

async function issueSession(user: UserRecord): Promise<AuthResult> {
  const { tokens, refreshTokenId } = issueAuthTokens(user);

  await saveRefreshSession(user.id, refreshTokenId, tokens.refreshTokenExpiresAt);

  const entitlement = await getEntitlementView(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    tokens,
    entitlement,
  };
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!validateEmail(email)) {
    throw new Error("Please provide a valid email address");
  }

  if (!validatePassword(password)) {
    throw new Error("Password must have at least 8 characters");
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with this email already exists");
  }

  const user = await createUser(email, password);
  return issueSession(user);
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Invalid credentials");
  }

  return issueSession(user);
}

export async function rotateRefreshToken(refreshToken: string): Promise<AuthResult> {
  const refreshPayload = verifyRefreshToken(refreshToken);
  if (!refreshPayload) {
    throw new Error("Invalid refresh token");
  }

  const validation = await validateRefreshSession(refreshPayload);
  if (!validation.valid) {
    throw new Error(validation.reason || "Invalid refresh session");
  }

  const user = await findUserById(refreshPayload.sub);
  if (!user) {
    throw new Error("User not found");
  }

  const { tokens, refreshTokenId } = issueAuthTokens(user);

  await revokeRefreshSession(refreshPayload.jti, refreshTokenId);
  await saveRefreshSession(user.id, refreshTokenId, tokens.refreshTokenExpiresAt);

  const entitlement = await getEntitlementView(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    tokens,
    entitlement,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  const refreshPayload = verifyRefreshToken(refreshToken);
  if (!refreshPayload) return;

  await revokeRefreshSession(refreshPayload.jti);
}

export async function requireAuthedUser(accessToken: string): Promise<{
  id: string;
  email: string;
}> {
  const accessPayload = verifyAccessToken(accessToken);
  if (!accessPayload) {
    throw new Error("Unauthorized");
  }

  const user = await findUserById(accessPayload.sub);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    id: user.id,
    email: user.email,
  };
}

export async function updateStripeCustomerId(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await mutateDb((draft) => {
    const user = draft.users.find((entry) => entry.id === userId);
    if (!user) return;

    user.stripeCustomerId = stripeCustomerId;
  });
}

export async function findUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<UserRecord | null> {
  const db = await readDb();
  return db.users.find((entry) => entry.stripeCustomerId === stripeCustomerId) || null;
}

export async function getUserById(userId: string): Promise<UserRecord | null> {
  return findUserById(userId);
}
