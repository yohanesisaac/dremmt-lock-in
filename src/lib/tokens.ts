import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

/** URL-safe random token for invitations and member access. */
export function generateToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Sign a value with the admin password so the admin session cookie cannot be
 * forged without knowing ADMIN_PASSWORD. Not a full auth system — sized for the
 * pilot admin dashboard.
 */
export function signValue(value: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function verifySignedValue(signed: string, secret: string): string | null {
  const lastDot = signed.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const value = signed.slice(0, lastDot);
  const mac = signed.slice(lastDot + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const macBuf = Buffer.from(mac);
  const expectedBuf = Buffer.from(expected);
  if (macBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(macBuf, expectedBuf)) return null;
  return value;
}
