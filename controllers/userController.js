import mongoose from 'mongoose'
import User from '../models/User.js'
import Snippet from '../models/Snippet.js'
import {
  TTL,
  profileKey,
  heatmapKey,
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
 * GET /api/users/:id/heatmap
 * Returns a flat activity map { "YYYY-MM-DD": count } for the past 365 days.
 * Counts: snippets posted + comments left by this user.
 */
export const getActivityHeatmap = async (req, res) => {
  try {
    const { id } = req.params
    const key = heatmapKey(id)
    const cached = await cacheGet(key)
    if (cached) return res.json(cached)

    const since = new Date()
    since.setDate(since.getDate() - 364) // 365 days inclusive of today
    since.setHours(0, 0, 0, 0)

    // 1. Snippets posted by this user in the window
    const snippetDates = await Snippet.find(
      { author: id, createdAt: { $gte: since } },
      { createdAt: 1 }
    ).lean()

    // 2. Comments left by this user across any snippet in the window
    const commentDocs = await Snippet.aggregate([
      { $unwind: '$comments' },
      {
        $match: {
          'comments.user': new mongoose.Types.ObjectId(id),
          'comments.createdAt': { $gte: since },
        },
      },
      { $project: { _id: 0, createdAt: '$comments.createdAt' } },
    ])

    // Helper: normalise a Date to "YYYY-MM-DD" in local ISO format
    const toDay = (d) => new Date(d).toISOString().slice(0, 10)

    const map = {}
    for (const s of snippetDates) {
      const day = toDay(s.createdAt)
      map[day] = (map[day] || 0) + 1
    }
    for (const c of commentDocs) {
      const day = toDay(c.createdAt)
      map[day] = (map[day] || 0) + 1
    }

    await cacheSet(key, map, TTL.HEATMAP)
    return res.json(map)
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
        bookmarks: req.user.bookmarks || [],
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

/**
 * POST /api/users/bookmarks/:snippetId
 * Toggles bookmark status of a snippet.
 */
export const toggleBookmark = async (req, res) => {
  try {
    const { snippetId } = req.params
    if (!mongoose.Types.ObjectId.isValid(snippetId)) {
      return res.status(400).json({ message: 'Invalid snippet ID' })
    }

    const snippetExists = await Snippet.exists({ _id: snippetId })
    if (!snippetExists) {
      return res.status(404).json({ message: 'Snippet not found' })
    }

    const user = await User.findById(req.user._id)
    const index = user.bookmarks.indexOf(snippetId)

    if (index > -1) {
      user.bookmarks.splice(index, 1)
    } else {
      user.bookmarks.push(snippetId)
    }

    await user.save()

    return res.json({
      message: index > -1 ? 'Bookmark removed' : 'Bookmark added',
      bookmarks: user.bookmarks,
    })
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}

/**
 * GET /api/users/bookmarks
 * Returns all snippets bookmarked by the logged-in user.
 */
export const getBookmarks = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: 'bookmarks',
        populate: {
          path: 'author',
          select: 'username avatar reputation',
        },
      })
      .lean()

    if (!user) return res.status(404).json({ message: 'User not found' })

    return res.json(user.bookmarks || [])
  } catch (err) {
    return res.status(500).json({ message: err.message })
  }
}
