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

const handleOAuthFailure = (provider) => (req, res, next) => {
  passport.authenticate(provider, { session: false }, (err, user, info) => {
    if (err || !user) {
      const message =
        err?.message || info?.message || `${provider} authentication failed`
      return res.redirect(
        `/api/auth/oauth-error?message=${encodeURIComponent(message)}`
      )
    }

    req.user = user
    return next()
  })(req, res, next)
}

router.post('/register', register)
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', protect, getMe)

router.post('/complete-profile', protect, completeProfile)
router.put('/set-password', protect, setPassword)

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
)

router.get('/google/callback', handleOAuthFailure('google'), oauthCallback)

router.get(
  '/github',
  passport.authenticate('github', {
    scope: ['user:email'],
    session: false,
  })
)

router.get('/github/callback', handleOAuthFailure('github'), oauthCallback)

router.get('/oauth-error', oauthError)

export default router
