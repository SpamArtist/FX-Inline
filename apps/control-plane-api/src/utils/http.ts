import type { ServerResponse } from "node:http";
import type { ApiError } from "../types.js";
import type { CookieOptions } from "./http.types.js";

export function parseCookies(cookieHeader: string): Record<string, string> {
  if (!cookieHeader.length) {
    return {};
  }

  const values: Record<string, string> = {};

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValueParts] = part.trim().split("=");
    if (!rawKey) continue;

    const rawValue = rawValueParts.join("=");
    values[rawKey] = decodeURIComponent(rawValue || "");
  }

  return values;
}

export function createCookie(name: string, value: string, options: CookieOptions = {}): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  segments.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly !== false) {
    segments.push("HttpOnly");
  }

  const sameSite = options.sameSite ?? "Lax";
  segments.push(`SameSite=${sameSite}`);

  if (options.secure) {
    segments.push("Secure");
  }

  if (typeof options.maxAgeSeconds === "number") {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }

  return segments.join("; ");
}

export function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string | string[]> = {},
): void {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders,
  });

  response.end(body);
}

export function createApiError(
  code: string,
  message: string,
  details: Record<string, unknown> | null = null,
  statusCode = 400,
): ApiError {
  return {
    statusCode,
    payload: {
      error: {
        code,
        message,
        details,
      },
    },
  };
}
