import User from '../models/User.js'
import Snippet from '../models/Snippet.js'
import {
  TTL,
  profileKey,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
} from '../utils/cache.js'

/**
 * GET /api/users/:id
 * Returns a user's public profile + their snippets (paginated).
 */
export const getProfile = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, parseInt(req.query.limit) || 10)
    const skip = (page - 1) * limit

    const key = profileKey(req.params.id, page, limit)
    const cached = await cacheGet(key)
    if (cached) {
      return res.json(cached)
    }

    const user = await User.findById(req.params.id)
      .select('-password -provider -providerId')
      .lean()
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Fetch paginated public snippets by this user
    const [snippets, total] = await Promise.all([
      Snippet.find({ author: user._id })
        .sort({ createdAt: -1 })
        .select(
          'title description language tags upvotes downvotes comments createdAt'
        )
        .skip(skip)
        .limit(limit)
        .lean(),
      Snippet.countDocuments({ author: user._id }),
    ])

    const payload = {
      user,
      snippets,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }

    await cacheSet(key, payload, TTL.USER_PROFILE)

    return res.json(payload)
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

/**
 * PUT /api/users/profile
 * Allows the authenticated user to update their own profile.
 * Fields: username, bio, avatar
 */
export const updateProfile = async (req, res) => {
  try {
    const { username, bio, avatar } = req.body

    if (username && username !== req.user.username) {
      const taken = await User.findOne({ username })
      if (taken) {
        return res.status(400).json({ message: 'Username already taken' })
      }
      req.user.username = username
    }

    if (bio !== undefined) req.user.bio = bio
    if (avatar !== undefined) req.user.avatar = avatar

    await req.user.save()

    // Invalidate all paginated user profile cache pages and all snippet lists (since user avatar/username changes)
    await Promise.all([
      cacheDelPattern(`user:profile:${req.user._id}:*`),
      cacheDelPattern('snip:list:*'),
    ])

    return res.json({
      user: {
        _id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        avatar: req.user.avatar,
        bio: req.user.bio,
        reputation: req.user.reputation,
        provider: req.user.provider,
        isProfileComplete: req.user.isProfileComplete,
      },
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/users
 * Search users by username.
 */
export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query
    if (!query) return res.json([])

    const users = await User.find({
      username: { $regex: query, $options: 'i' },
    })
      .select('username avatar reputation')
      .limit(10)
      .lean()

    return res.json(users)
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}
