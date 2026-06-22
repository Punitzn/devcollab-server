import express from 'express'
import {
  createSnippet,
  getSnippets,
  getSnippetById,
  deleteSnippet,
  addComment,
  upvoteComment,
  downvoteComment,
  upvoteSnippet,
  downvoteSnippet,
} from '../controllers/snippetController.js'
import { generateAiReview } from '../controllers/aiController.js'
import protect, { optionalProtect } from '../middleware/auth.js'

const router = express.Router()

router.get('/', optionalProtect, getSnippets)
router.get('/:id', optionalProtect, getSnippetById)
router.post('/', protect, createSnippet)
router.delete('/:id', protect, deleteSnippet)
router.post('/:id/comments', protect, addComment)
router.patch('/:id/comments/:commentId/upvote', protect, upvoteComment)
router.patch('/:id/comments/:commentId/downvote', protect, downvoteComment)

// Snippet-level voting
router.patch('/:id/upvote', protect, upvoteSnippet)
router.patch('/:id/downvote', protect, downvoteSnippet)

// AI code review
router.post('/:id/ai-review', protect, generateAiReview)

export default router
