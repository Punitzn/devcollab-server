import Snippet from '../models/Snippet.js'
import AiReview from '../models/AiReview.js'

export const createSnippet = async (req, res) => {
  try {
    const { title, description, code, language, tags } = req.body
    const snippet = await Snippet.create({
      title,
      description,
      code,
      language,
      tags,
      author: req.user._id,
    })
    res.status(201).json(snippet)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getSnippets = async (req, res) => {
  try {
    const { language, tag, search } = req.query
    const filter = {}
    if (language) filter.language = language
    if (tag) filter.tags = tag
    if (search) filter.title = { $regex: search, $options: 'i' }

    const snippets = await Snippet.find(filter)
      .populate('author', 'username avatar reputation')
      .sort({ createdAt: -1 })

    let snippetsWithReview = snippets
    if (req.user) {
      const aiReviews = await AiReview.find({
        user: req.user._id,
        snippet: { $in: snippets.map((s) => s._id) },
      })
      const reviewMap = new Map(aiReviews.map((r) => [r.snippet.toString(), r]))
      snippetsWithReview = snippets.map((s) => {
        const obj = s.toObject()
        obj.aiReview = reviewMap.get(s._id.toString()) || null
        return obj
      })
    } else {
      snippetsWithReview = snippets.map((s) => {
        const obj = s.toObject()
        delete obj.aiReview
        return obj
      })
    }

    // Sort by net votes (upvotes - downvotes), highest first
    snippetsWithReview.sort((a, b) => {
      const scoreA = (a.upvotes?.length || 0) - (a.downvotes?.length || 0)
      const scoreB = (b.upvotes?.length || 0) - (b.downvotes?.length || 0)
      return scoreB - scoreA
    })

    res.json(snippetsWithReview)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getSnippetById = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
      .populate('author', 'username avatar reputation')
      .populate('comments.user', 'username avatar')

    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    const obj = snippet.toObject()
    if (req.user) {
      const aiReview = await AiReview.findOne({
        user: req.user._id,
        snippet: snippet._id,
      })
      obj.aiReview = aiReview || null
    } else {
      delete obj.aiReview
    }

    res.json(obj)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const deleteSnippet = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    if (snippet.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' })

    await snippet.deleteOne()
    res.json({ message: 'Snippet deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const addComment = async (req, res) => {
  try {
    const { content, lineNumber } = req.body
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    snippet.comments.push({
      user: req.user._id,
      content,
      lineNumber: lineNumber || null,
    })
    await snippet.save()

    const updated = await Snippet.findById(req.params.id).populate(
      'comments.user',
      'username avatar'
    )
    res.status(201).json(updated.comments)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const upvoteComment = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    const comment = snippet.comments.id(req.params.commentId)
    if (!comment) return res.status(404).json({ message: 'Comment not found' })

    const userId = req.user._id
    const alreadyUpvoted = comment.upvotes.includes(userId)

    if (alreadyUpvoted) {
      comment.upvotes.pull(userId)
    } else {
      comment.upvotes.push(userId)
      comment.downvotes.pull(userId) // remove downvote if switching
    }

    await snippet.save()
    res.json(comment)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const downvoteComment = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    const comment = snippet.comments.id(req.params.commentId)
    if (!comment) return res.status(404).json({ message: 'Comment not found' })

    const userId = req.user._id
    const alreadyDownvoted = comment.downvotes.includes(userId)

    if (alreadyDownvoted) {
      comment.downvotes.pull(userId)
    } else {
      comment.downvotes.push(userId)
      comment.upvotes.pull(userId) // remove upvote if switching
    }

    await snippet.save()
    res.json(comment)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * PATCH /api/snippets/:id/upvote
 * Toggle upvote on the snippet itself (not a comment).
 */
export const upvoteSnippet = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    const userId = req.user._id
    const alreadyUpvoted = snippet.upvotes.some((id) => id.equals(userId))

    if (alreadyUpvoted) {
      // Toggle off
      snippet.upvotes.pull(userId)
    } else {
      snippet.upvotes.push(userId)
      snippet.downvotes.pull(userId) // remove downvote if switching to upvote
    }

    await snippet.save()
    res.json({
      upvotes: snippet.upvotes,
      downvotes: snippet.downvotes,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

/**
 * PATCH /api/snippets/:id/downvote
 * Toggle downvote on the snippet itself.
 */
export const downvoteSnippet = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    const userId = req.user._id
    const alreadyDownvoted = snippet.downvotes.some((id) => id.equals(userId))

    if (alreadyDownvoted) {
      // Toggle off
      snippet.downvotes.pull(userId)
    } else {
      snippet.downvotes.push(userId)
      snippet.upvotes.pull(userId) // remove upvote if switching to downvote
    }

    await snippet.save()
    res.json({
      upvotes: snippet.upvotes,
      downvotes: snippet.downvotes,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}