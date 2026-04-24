import type crypto from "node:crypto";

export interface JwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

export interface JwtPayload {
  sub?: string;
  sid?: string;
  azp?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  [key: string]: unknown;
}

export interface ParsedJwt {
  header: JwtHeader;
  payload: JwtPayload;
  signingInput: string;
  signature: Buffer;
}

export interface ClerkJwk extends crypto.JsonWebKey {
  kid?: string;
}

export interface ClerkJwksResponse {
  keys: ClerkJwk[];
}

export interface ClerkUserEmail {
  id: string;
  email_address: string;
}

export interface ClerkUserResponse {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string | null;
  email_addresses: ClerkUserEmail[];
}

export interface MockClerkPayload {
  clerkUserId?: string;
  clerkSessionId?: string;
  email?: string;
  displayName?: string;
}
