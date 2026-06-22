import User from '../models/User.js'
import Snippet from '../models/Snippet.js'

/**
 * GET /api/users/:id
 * Returns a user's public profile + their snippets.
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      '-password -provider -providerId'
    )
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Fetch all public snippets by this user
    const snippets = await Snippet.find({ author: user._id })
      .sort({ createdAt: -1 })
      .select(
        'title description language tags upvotes downvotes comments createdAt'
      )

    return res.json({ user, snippets })
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
