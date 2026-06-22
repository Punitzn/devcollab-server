import express from 'express'
import passport from 'passport'
import {
  register,
  login,
  logout,
  getMe,
  oauthCallback,
  oauthError,
  completeProfile,
  setPassword,
} from '../controllers/authController.js'
import protect from '../middleware/auth.js'

const router = express.Router()

// ─── Local Auth ──────────────────────────────────────────────────────────────
router.post('/register', register)
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', protect, getMe)

// ─── Profile Completion (OAuth users must set username) ──────────────────────
router.post('/complete-profile', protect, completeProfile)
router.put('/set-password', protect, setPassword)

// ─── Google OAuth ─────────────────────────────────────────────────────────────
// Step 1: redirect user to Google's consent screen
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
)

// Step 2: Google redirects back here with code
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/api/auth/oauth-error',
  }),
  oauthCallback
)

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────
// Step 1: redirect user to GitHub's consent screen
router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  })
)

// Step 2: GitHub redirects back here
router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/api/auth/oauth-error',
  }),
  oauthCallback
)

// ─── OAuth Error ──────────────────────────────────────────────────────────────
router.get('/oauth-error', oauthError)

export default router
