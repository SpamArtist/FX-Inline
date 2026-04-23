import crypto from "node:crypto";

const SCRYPT_KEY_LENGTH = 64;

function runScrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Buffer.from(derivedKey));
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 10) {
    throw new Error("Password must be at least 10 characters");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await runScrypt(password, salt);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string | null): Promise<boolean> {
  if (typeof encodedHash !== "string") {
    return false;
  }

  const [algorithm, salt, digestHex] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !digestHex) {
    return false;
  }

  const derivedKey = await runScrypt(password, salt);
  const digestBuffer = Buffer.from(digestHex, "hex");

  if (derivedKey.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedKey, digestBuffer);
}
