// Simple in-memory rate limiter (no external dependencies).
// Suitable for single-server deployments. For multi-instance deployments,
// replace with @upstash/ratelimit + Upstash Redis.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup of expired buckets (every 60s)
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  cleanup();
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) {
    return false;
  }
  existing.count += 1;
  return true;
}

/**
 * Extract a client identifier from a request. Uses the IP address.
 */
export function getClientId(req: Request): string {
  const headers = req.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    return xff.split(",")[0].trim();
  }
  const xRealIp = headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();
  return "unknown";
}

// Pre-configured limiters for known abuse-prone endpoints.
export const LIMITERS = {
  auth: (clientId: string) => rateLimit(`auth:${clientId}`, 5, 60_000),
  register: (clientId: string) => rateLimit(`register:${clientId}`, 3, 10 * 60_000),
  createPost: (userId: string) => rateLimit(`post:${userId}`, 20, 60 * 60_000),
  createComment: (userId: string) => rateLimit(`comment:${userId}`, 60, 60 * 60_000),
  createMessage: (userId: string) => rateLimit(`msg:${userId}`, 100, 60 * 60_000),
  createDM: (userId: string) => rateLimit(`dm:${userId}`, 60, 60 * 60_000),
  vote: (userId: string) => rateLimit(`vote:${userId}`, 100, 60_000),
  search: (clientId: string) => rateLimit(`search:${clientId}`, 20, 60_000),
};
