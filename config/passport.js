import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as GitHubStrategy } from 'passport-github2'
import User from '../models/User.js'

const trimTrailingSlash = (value) => value?.replace(/\/+$/, '')
const serverURL = trimTrailingSlash(
  process.env.SERVER_URL || 'http://localhost:8000'
)

/**
 * Google OAuth Strategy
 * Triggered when user visits /api/auth/google/callback
 * profile contains: id, displayName, emails[], photos[]
 */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${serverURL}/api/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value
        const avatar = profile.photos?.[0]?.value || ''

        if (!email) {
          return done(new Error('No email returned from Google'), null)
        }

        // Check if user already exists (by email regardless of provider)
        let user = await User.findOne({ email })

        if (user) {
          // If this email exists via local or another provider,
          // link the Google provider to their existing account
          if (user.provider !== 'google') {
            user.provider = 'google'
            user.providerId = profile.id
            if (!user.avatar) user.avatar = avatar
            await user.save()
          }
          return done(null, user)
        }

        // New user — create account (profile is incomplete until they set username)
        user = await User.create({
          email,
          avatar,
          provider: 'google',
          providerId: profile.id,
          isProfileComplete: false,
          // username is NOT set here — user will set it on /complete-profile
        })

        return done(null, user)
      } catch (err) {
        return done(err, null)
      }
    }
  )
)

/**
 * GitHub OAuth Strategy
 * profile contains: id, displayName, emails[], photos[]
 * Note: GitHub may return null email if the user's email is private
 */
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${serverURL}/api/auth/github/callback`,
      scope: ['user:email'], // Request email access
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.find((e) => e.primary)?.value ||
          profile.emails?.[0]?.value
        const avatar = profile.photos?.[0]?.value || ''

        if (!email) {
          return done(
            new Error(
              'No email returned from GitHub. Please make your GitHub email public or use another login method.'
            ),
            null
          )
        }

        // Check if user already exists by email
        let user = await User.findOne({ email })

        if (user) {
          // Link GitHub to existing account if not already GitHub
          if (user.provider !== 'github') {
            user.provider = 'github'
            user.providerId = profile.id.toString()
            if (!user.avatar) user.avatar = avatar
            await user.save()
          }
          return done(null, user)
        }

        // New user — create account without username
        user = await User.create({
          email,
          avatar,
          provider: 'github',
          providerId: profile.id.toString(),
          isProfileComplete: false,
        })

        return done(null, user)
      } catch (err) {
        return done(err, null)
      }
    }
  )
)

// Passport requires these for session support (we use stateless JWT but passport needs them)
passport.serializeUser((user, done) => done(null, user._id))
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password')
    done(null, user)
  } catch (err) {
    done(err, null)
  }
})

export default passport
