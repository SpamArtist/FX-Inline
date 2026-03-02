import { config } from "./config.js";
import {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
  UserRecord,
} from "./types.js";
import {
  base64UrlDecode,
  base64UrlEncode,
  constantTimeEqual,
  createId,
  signHmacSha256,
} from "./crypto.js";

type TokenPayload = AccessTokenPayload | RefreshTokenPayload;

type TokenResult<T extends TokenPayload> = {
  payload: T;
  token: string;
};

const JWT_HEADER = {
  alg: "HS256",
  typ: "JWT",
};

function encodeToken<T extends TokenPayload>(
  payload: T,
  secret: string,
): TokenResult<T> {
  const headerEncoded = base64UrlEncode(JSON.stringify(JWT_HEADER));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${headerEncoded}.${payloadEncoded}`;
  const signature = signHmacSha256(unsigned, secret);

  return {
    payload,
    token: `${unsigned}.${signature}`,
  };
}

function decodeAndVerifyToken<T extends TokenPayload>(
  token: string,
  secret: string,
): T | null {
  const [headerEncoded, payloadEncoded, signature] = token.split(".");

  if (!headerEncoded || !payloadEncoded || !signature) return null;

  const unsigned = `${headerEncoded}.${payloadEncoded}`;
  const expectedSignature = signHmacSha256(unsigned, secret);

  if (!constantTimeEqual(expectedSignature, signature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as T;
    if (!payload.exp || Date.now() >= payload.exp * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueAuthTokens(user: UserRecord): {
  tokens: AuthTokens;
  refreshTokenId: string;
} {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const accessPayload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    typ: "access",
    jti: createId("at"),
    iat: nowSeconds,
    exp: nowSeconds + config.accessTokenTtlSeconds,
  };

  const refreshPayload: RefreshTokenPayload = {
    sub: user.id,
    email: user.email,
    typ: "refresh",
    jti: createId("rt"),
    iat: nowSeconds,
    exp: nowSeconds + config.refreshTokenTtlSeconds,
  };

  const accessToken = encodeToken(accessPayload, config.accessTokenSecret).token;
  const refreshToken = encodeToken(refreshPayload, config.refreshTokenSecret).token;

  return {
    tokens: {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: accessPayload.exp * 1000,
      refreshTokenExpiresAt: refreshPayload.exp * 1000,
    },
    refreshTokenId: refreshPayload.jti,
  };
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const payload = decodeAndVerifyToken<AccessTokenPayload>(
    token,
    config.accessTokenSecret,
  );

  if (!payload || payload.typ !== "access") return null;
  return payload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  const payload = decodeAndVerifyToken<RefreshTokenPayload>(
    token,
    config.refreshTokenSecret,
  );

  if (!payload || payload.typ !== "refresh") return null;
  return payload;
}
