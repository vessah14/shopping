type Bucket = { hits: number[] };

/**
 * Small in-memory sliding-window rate limiter. It is per process, which is enough for a
 * single Railway instance; use a shared store (Redis, PostgreSQL) if the app is scaled out.
 */
export function createRateLimiter({ limit, windowMs, maxKeys = 10_000 }: { limit: number; windowMs: number; maxKeys?: number }) {
  const buckets = new Map<string, Bucket>();

  return function take(key: string, now = Date.now()) {
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((time) => now - time < windowMs);
    if (bucket.hits.length >= limit) {
      buckets.set(key, bucket);
      return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (now - bucket.hits[0])) / 1000) };
    }
    bucket.hits.push(now);
    buckets.delete(key);
    buckets.set(key, bucket);
    if (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value as string);
    return { allowed: true, retryAfterSeconds: 0 };
  };
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}
