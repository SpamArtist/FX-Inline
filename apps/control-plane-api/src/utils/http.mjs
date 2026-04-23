export function parseCookies(cookieHeader) {
  if (typeof cookieHeader !== "string" || !cookieHeader.length) {
    return {};
  }

  const values = {};

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValueParts] = part.trim().split("=");
    if (!rawKey) continue;

    const rawValue = rawValueParts.join("=");
    values[rawKey] = decodeURIComponent(rawValue || "");
  }

  return values;
}

export function createCookie(name, value, options = {}) {
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

export function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...extraHeaders,
  });

  response.end(body);
}

export function createApiError(code, message, details = null, statusCode = 400) {
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
