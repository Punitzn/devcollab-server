import express from 'express'
import {
  getProfile,
  updateProfile,
  searchUsers,
  getActivityHeatmap,
  toggleBookmark,
  getBookmarks,
} from '../controllers/userController.js'
import protect from '../middleware/auth.js'

const router = express.Router()

// GET /api/users — search users by username
router.get('/', searchUsers)

// GET /api/users/bookmarks — get user's bookmarks (protected)
router.get('/bookmarks', protect, getBookmarks)

// POST /api/users/bookmarks/:snippetId — toggle bookmark (protected)
router.post('/bookmarks/:snippetId', protect, toggleBookmark)

// GET /api/users/:id — public profile
router.get('/:id', getProfile)

// GET /api/users/:id/heatmap — activity heatmap (public)
router.get('/:id/heatmap', getActivityHeatmap)

// PUT /api/users/profile — update own profile (protected)
router.put('/profile', protect, updateProfile)

export default router
