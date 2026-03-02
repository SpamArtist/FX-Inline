import { IncomingMessage, ServerResponse } from "node:http";

export function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key, Stripe-Signature");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

export function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function sendText(
  res: ServerResponse,
  statusCode: number,
  body: string,
  contentType = "text/plain; charset=utf-8",
): void {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", contentType);
  res.end(body);
}

export async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

export async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const raw = await readRawBody(req);

  if (!raw.trim()) {
    return {} as T;
  }

  return JSON.parse(raw) as T;
}

export function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;

  const [scheme, token] = headerValue.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token.trim();
}

export function getOriginFromRequest(req: IncomingMessage): string {
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "127.0.0.1:8787";
  return `${proto}://${host}`;
}
