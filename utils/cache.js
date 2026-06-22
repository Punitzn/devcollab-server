import redis from '../config/redis.js'

// ─── TTLs (seconds) ──────────────────────────────────────────────────────────
export const TTL = {
  SNIPPET_LIST: 60, // 1 min  — changes on new posts / deletes
  SNIPPET_DETAIL: 120, // 2 min  — changes on comment / vote
  USER_PROFILE: 300, // 5 min  — profiles change rarely
}

// ─── Key builders ────────────────────────────────────────────────────────────

/**
 * Snippet list key — encodes every query dimension so different
 * filters never collide in the cache.
 */
export const listKey = ({ page, limit, language, tag, search }) =>
  `snip:list:p${page}:l${limit}:lang${language || ''}:tag${tag || ''}:q${search || ''}`

/** Snippet detail key */
export const detailKey = (id) => `snip:detail:${id}`

/** User profile key */
export const profileKey = (id, page = 1, limit = 10) =>
  `user:profile:${id}:p${page}:l${limit}`

// ─── Core helpers ────────────────────────────────────────────────────────────

/**
 * Get a cached value. Returns parsed object or null on miss / error.
 * Never throws — Redis failure is treated as a cache miss.
 */
export const cacheGet = async (key) => {
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Store a value in Redis with an expiry (TTL in seconds).
 * Fails silently so a Redis outage never breaks a request.
 */
export const cacheSet = async (key, data, ttl = TTL.SNIPPET_LIST) => {
  if (!redis) return
  try {
    await redis.setex(key, ttl, JSON.stringify(data))
  } catch {}
}

/**
 * Delete one or more exact keys.
 */
export const cacheDel = async (...keys) => {
  if (!redis || !keys.length) return
  try {
    await redis.del(...keys)
  } catch {}
}

/**
 * Delete every key matching a glob pattern.
 * Uses SCAN in batches of 100 — safe in production (no KEYS * blocking).
 *
 * Example: cacheDelPattern('snip:list:*')
 */
export const cacheDelPattern = async (pattern) => {
  if (!redis) return
  try {
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100
      )
      if (keys.length) await redis.del(...keys)
      cursor = next
    } while (cursor !== '0')
  } catch {}
}
