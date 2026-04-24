export interface ActiveKey {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
  privateKeyPath: string;
  publicKeyPath: string | null;
}

export interface CreateSigningServiceInput {
  privateKeyPath: string;
  fallbackDirectory: string;
}
