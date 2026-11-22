interface RateLimitOptions {
  /** Maximum number of requests allowed inside the window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

interface Bucket {
  timestamps: number[]
  lastSeenAt: number
}

/**
 * Small in-process sliding-window limiter.
 *
 * The database attempt counter is the durable limit; this adds cheap burst
 * protection per driver/order. It intentionally stays process-local because the
 * deployment is a single Node process and no shared cache exists yet.
 */
const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

const prune = (now: number) => {
  if (buckets.size <= MAX_BUCKETS) {
    return
  }

  for (const [key, bucket] of buckets) {
    if (now - bucket.lastSeenAt > 60 * 60 * 1000) {
      buckets.delete(key)
    }
  }
}

export const consumeRateLimit = (
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now = Date.now()
): RateLimitResult => {
  const cutoff = now - windowMs
  const bucket = buckets.get(key) ?? { timestamps: [], lastSeenAt: now }
  const timestamps = bucket.timestamps.filter((timestamp) => timestamp > cutoff)

  if (timestamps.length >= limit) {
    bucket.timestamps = timestamps
    bucket.lastSeenAt = now
    buckets.set(key, bucket)

    return {
      allowed: false,
      retryAfterMs: Math.max(0, timestamps[0] + windowMs - now),
    }
  }

  timestamps.push(now)
  bucket.timestamps = timestamps
  bucket.lastSeenAt = now
  buckets.set(key, bucket)
  prune(now)

  return { allowed: true, retryAfterMs: 0 }
}

/** Test-only hook so limits do not leak between cases. */
export const resetRateLimitsForTests = (): void => {
  buckets.clear()
}
