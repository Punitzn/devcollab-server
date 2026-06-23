import redis from '../config/redis.js'

export const TTL = {
  SNIPPET_LIST: 60,
  SNIPPET_DETAIL: 120,
  USER_PROFILE: 300,
  HEATMAP: 300,
}

export const listKey = ({ page, limit, language, tag, search }) =>
  `snip:list:p${page}:l${limit}:lang${language || ''}:tag${tag || ''}:q${search || ''}`

export const detailKey = (id) => `snip:detail:${id}`

export const profileKey = (id, page = 1, limit = 10) =>
  `user:profile:${id}:p${page}:l${limit}`

export const heatmapKey = (id) => `user:heatmap:${id}`

export const cacheGet = async (key) => {
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const cacheSet = async (key, data, ttl = TTL.SNIPPET_LIST) => {
  if (!redis) return
  try {
    await redis.setex(key, ttl, JSON.stringify(data))
  } catch {}
}

export const cacheDel = async (...keys) => {
  if (!redis || !keys.length) return
  try {
    await redis.del(...keys)
  } catch {}
}

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
