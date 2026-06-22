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

    // ─── Pagination ───────────────────────────────────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1)
    const limit = Math.min(50, parseInt(req.query.limit) || 20)
    const skip  = (page - 1) * limit

    // ─── Filter ───────────────────────────────────────────────────────────────────
    const filter = {}
    if (language) filter.language = language
    if (tag)      filter.tags = tag
    if (search)   filter.title = { $regex: search, $options: 'i' }

    // Run the paginated query and total count in parallel
    const [snippets, total] = await Promise.all([
      Snippet.find(filter)
        .populate('author', 'username avatar reputation')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),                 // plain JS objects — 2-5x faster than Mongoose docs
      Snippet.countDocuments(filter),
    ])

    // Sort by net votes within this page (only up to 20 items — negligible cost)
    snippets.sort((a, b) => {
      const scoreA = (a.upvotes?.length || 0) - (a.downvotes?.length || 0)
      const scoreB = (b.upvotes?.length || 0) - (b.downvotes?.length || 0)
      return scoreB - scoreA
    })

    // Attach cached AI review for logged-in user (one query for all snippets)
    if (req.user && snippets.length > 0) {
      const aiReviews = await AiReview.find({
        user:    req.user._id,
        snippet: { $in: snippets.map((s) => s._id) },
      }).lean()
      const reviewMap = new Map(aiReviews.map((r) => [r.snippet.toString(), r]))
      snippets.forEach((s) => {
        s.aiReview = reviewMap.get(s._id.toString()) || null
      })
    }

    res.json({ snippets, page, limit, total, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getSnippetById = async (req, res) => {
  try {
    // .lean() + manual populate kept separate because we need the full doc
    const snippet = await Snippet.findById(req.params.id)
      .populate('author', 'username avatar reputation')
      .populate('comments.user', 'username avatar')
      .lean()

    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    if (req.user) {
      const aiReview = await AiReview.findOne({
        user:    req.user._id,
        snippet: snippet._id,
      }).lean()
      snippet.aiReview = aiReview || null
    } else {
      delete snippet.aiReview
    }

    res.json(snippet)
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
