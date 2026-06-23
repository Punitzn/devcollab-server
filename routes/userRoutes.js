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

router.get('/', searchUsers)
router.get('/bookmarks', protect, getBookmarks)
router.post('/bookmarks/:snippetId', protect, toggleBookmark)
router.get('/:id', getProfile)
router.get('/:id/heatmap', getActivityHeatmap)
router.put('/profile', protect, updateProfile)

export default router
