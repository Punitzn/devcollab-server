import Redis from 'ioredis'

/**
 * Creates a Redis client from REDIS_URL env var.
 * If the var is not set the module exports null and the entire
 * caching layer becomes a no-op — the app still works normally.
 *
 * Recommended free providers:
 *   Upstash (https://upstash.com)  →  set REDIS_URL to the rediss:// URL they give you
 *   Redis Cloud free tier          →  same — use the redis:// / rediss:// URL
 */
let redis = null

if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1, // fail fast — don't block requests on Redis issues
    enableReadyCheck: false, // skip the HELLO check (required for some managed Redis)
    lazyConnect: false,
    tls: process.env.REDIS_URL.startsWith('rediss://')
      ? { rejectUnauthorized: false }
      : undefined,
  })

  redis.on('connect', () => console.log('✅ Redis connected'))
  redis.on('error', (err) => console.error(`⚠️  Redis error: ${err.message}`))
} else {
  console.warn(
    '⚠️  REDIS_URL not set — caching disabled, running without Redis'
  )
}

export default redis
