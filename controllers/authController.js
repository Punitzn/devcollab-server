import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body
    console.log('body:', req.body)

    const userExists = await User.findOne({ email })
    console.log('userExists:', userExists)
    if (userExists)
      return res.status(400).json({ message: 'Email already in use' })

    console.log('creating user...')
    const user = await User.create({ username, email, password })
    console.log('user created:', user)

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token: generateToken(user._id),
    })
  } catch (err) {
    console.log('ERROR:', err)
    res.status(500).json({ message: err.message })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const isMatch = await user.matchPassword(password)
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid credentials' })

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      token: generateToken(user._id),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getMe = async (req, res) => {
  res.json(req.user)
}
