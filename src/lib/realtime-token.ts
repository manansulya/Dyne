import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived HMAC token that proves a socket.io connection belongs to a
 * specific user. The realtime service has no session cookie access, so the
 * Next.js app mints a token for the signed-in user and the service verifies it
 * with the same shared secret. The service therefore never has to trust a
 * client-supplied user id.
 *
 * Format: base64url({"sub":userId,"exp":unixSeconds,"un":displayName}) + "." +
 * base64url(hmac). The display name travels inside the signed payload so the
 * service can label typing/presence events without a database of its own.
 */

const DEFAULT_TTL_SECONDS = 300;

export interface RealtimeTokenPayload {
  sub: string;
  exp: number;
  un: string | null;
}

export function realtimeSecret(): string {
  const secret = process.env.REALTIME_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("REALTIME_SECRET (or NEXTAUTH_SECRET) must be set to sign realtime tokens");
  }
  return secret;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signRealtimeToken(
  userId: string,
  {
    displayName = null,
    ttlSeconds = DEFAULT_TTL_SECONDS,
    secret = realtimeSecret(),
  }: { displayName?: string | null; ttlSeconds?: number; secret?: string } = {}
): { token: string; expiresAt: number } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = b64url(
    JSON.stringify({ sub: userId, exp, un: displayName } satisfies RealtimeTokenPayload)
  );
  return { token: `${body}.${sign(body, secret)}`, expiresAt: exp * 1000 };
}

/** Returns the payload, or null when the token is malformed, forged or expired. */
export function verifyRealtimeToken(
  token: unknown,
  { secret = realtimeSecret() } = {}
): RealtimeTokenPayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body, secret));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as RealtimeTokenPayload).sub !== "string" ||
    typeof (payload as RealtimeTokenPayload).exp !== "number"
  ) {
    return null;
  }
  const { sub, exp, un } = payload as RealtimeTokenPayload;
  if (!sub || exp * 1000 <= Date.now()) return null;
  return { sub, exp, un: typeof un === "string" ? un : null };
}

/** Constant-time comparison for the service-to-service shared secret. */
export function secretsMatch(provided: unknown, secret = realtimeSecret()): boolean {
  if (typeof provided !== "string" || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}
