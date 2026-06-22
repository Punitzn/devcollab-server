import jwt from 'jsonwebtoken'
import User from '../models/User.js'

/**
 * Middleware to protect routes.
 * Reads JWT from:
 *   1. HTTP-only cookie (primary — set by our auth endpoints)
 *   2. Authorization header (fallback — for API clients / Postman testing)
 */
const protect = async (req, res, next) => {
  try {
    // 1. Try cookie first
    let token = req.cookies?.token

    // 2. Fallback to Authorization: Bearer <token>
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized — no token' })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')

    if (!req.user) {
      return res.status(401).json({ message: 'User not found' })
    }

    next()
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' })
  }
}

export const optionalProtect = async (req, res, next) => {
  try {
    let token = req.cookies?.token

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(decoded.id).select('-password')
    }
  } catch (err) {
    // Ignore invalid or expired token for optional protect
  }
  next()
}

export default protect
