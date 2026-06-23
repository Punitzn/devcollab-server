import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })

const setTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production'
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

const formatUser = (user) => ({
  _id: user._id,
  username: user.username,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio,
  reputation: user.reputation,
  provider: user.provider,
  isProfileComplete: user.isProfileComplete,
  bookmarks: (user.bookmarks || []).map((b) => b.toString()),
})

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' })
    }

    const emailExists = await User.findOne({ email })
    if (emailExists) {
      return res.status(400).json({ message: 'Email already in use' })
    }

    const usernameExists = await User.findOne({ username })
    if (usernameExists) {
      return res.status(400).json({ message: 'Username already taken' })
    }

    const user = await User.create({
      username,
      email,
      password,
      provider: 'local',
      isProfileComplete: true,
    })

    const token = generateToken(user._id)
    setTokenCookie(res, token)

    return res.status(201).json({ user: formatUser(user), token })
  } catch (err) {
    console.error('Register error:', err)
    return res.status(500).json({ message: err.message })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    if (!user.password) {
      return res.status(401).json({
        message: `This account was created via ${user.provider}. Please set a password in your profile settings first, or use ${user.provider} to sign in.`,
      })
    }

    const isMatch = await user.matchPassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const token = generateToken(user._id)
    setTokenCookie(res, token)

    return res.json({ user: formatUser(user), token })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ message: err.message })
  }
}

export const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  })
  return res.json({ message: 'Logged out successfully' })
}

export const getMe = async (req, res) => {
  return res.json({ user: formatUser(req.user) })
}

export const oauthCallback = (req, res) => {
  const user = req.user
  const token = generateToken(user._id)
  const frontendURL = (
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ).replace(/\/+$/, '')

  if (!user.isProfileComplete) {
    return res.redirect(`${frontendURL}/complete-profile?token=${token}`)
  }
  return res.redirect(`${frontendURL}/?token=${token}`)
}

export const oauthError = (req, res) => {
  const frontendURL = (
    process.env.FRONTEND_URL || 'http://localhost:5173'
  ).replace(/\/+$/, '')
  const message = req.query.message || 'OAuth authentication failed'
  return res.redirect(
    `${frontendURL}/login?error=${encodeURIComponent(message)}`
  )
}

export const completeProfile = async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username) {
      return res.status(400).json({ message: 'Username is required' })
    }

    const existing = await User.findOne({ username })
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'Username already taken' })
    }

    req.user.username = username
    req.user.isProfileComplete = true

    if (password) {
      if (password.length < 6) {
        return res
          .status(400)
          .json({ message: 'Password must be at least 6 characters' })
      }
      req.user.password = password
    }

    await req.user.save()

    return res.json({ user: formatUser(req.user) })
  } catch (err) {
    console.error('Complete profile error:', err)
    return res.status(500).json({ message: err.message })
  }
}

export const setPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: 'New password must be at least 6 characters' })
    }

    if (req.user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' })
      }
      const isMatch = await req.user.matchPassword(currentPassword)
      if (!isMatch) {
        return res
          .status(401)
          .json({ message: 'Current password is incorrect' })
      }
    }

    req.user.password = newPassword
    await req.user.save()

    return res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Set password error:', err)
    return res.status(500).json({ message: err.message })
  }
}
