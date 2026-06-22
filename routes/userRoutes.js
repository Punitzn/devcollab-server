import express from 'express'
import { getProfile, updateProfile } from '../controllers/userController.js'
import protect from '../middleware/auth.js'

const router = express.Router()

// GET /api/users/:id — public profile
router.get('/:id', getProfile)

// PUT /api/users/profile — update own profile (protected)
router.put('/profile', protect, updateProfile)

export default router
