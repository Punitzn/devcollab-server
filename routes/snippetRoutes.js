import express from 'express'
import {
  createSnippet,
  getSnippets,
  getSnippetById,
  deleteSnippet,
  addComment,
  upvoteComment,
} from '../controllers/snippetController.js'
import protect from '../middleware/auth.js'

const router = express.Router()

router.get('/', getSnippets)
router.get('/:id', getSnippetById)
router.post('/', protect, createSnippet)
router.delete('/:id', protect, deleteSnippet)
router.post('/:id/comments', protect, addComment)
router.patch('/:id/comments/:commentId/upvote', protect, upvoteComment)

export default router