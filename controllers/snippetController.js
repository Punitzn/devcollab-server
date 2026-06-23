import Snippet from '../models/Snippet.js'
import AiReview from '../models/AiReview.js'
import {
  TTL,
  listKey,
  detailKey,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheDelPattern,
} from '../utils/cache.js'

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

export const createSnippet = async (req, res) => {
  try {
    const { title, description, code, language, tags, codeVersions } = req.body

    // Initialize codeVersions if not provided
    let finalCodeVersions = codeVersions
    if (
      !finalCodeVersions ||
      !Array.isArray(finalCodeVersions) ||
      finalCodeVersions.length === 0
    ) {
      finalCodeVersions = [{ language, code }]
    }

    const finalLanguage = language || finalCodeVersions[0].language
    const finalCode = code || finalCodeVersions[0].code

    const snippet = await Snippet.create({
      title,
      description,
      code: finalCode,
      language: finalLanguage,
      codeVersions: finalCodeVersions,
      tags,
      author: req.user._id,
    })

    // A new snippet invalidates every list page (sort order changes) and the author's profile cache pages
    await Promise.all([
      cacheDelPattern('snip:list:*'),
      cacheDelPattern(`user:profile:${req.user._id}:*`),
    ])

    res.status(201).json(snippet)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIST  (GET /api/snippets)
// ─────────────────────────────────────────────────────────────────────────────

export const getSnippets = async (req, res) => {
  try {
    const { language, tag, search } = req.query

    // ─── Pagination ───────────────────────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(50, parseInt(req.query.limit) || 20)
    const skip = (page - 1) * limit

    // ─── Redis cache (user-agnostic — AI reviews are attached separately) ─────
    const key = listKey({ page, limit, language, tag, search })
    const cached = await cacheGet(key)

    let basePayload // { snippets, page, limit, total, totalPages }

    if (cached) {
      basePayload = cached
    } else {
      // ─── DB fetch ────────────────────────────────────────────────────────────
      const filter = {}
      if (language) filter.language = language
      if (tag) filter.tags = tag
      if (search) filter.title = { $regex: search, $options: 'i' }

      const [snippets, total] = await Promise.all([
        Snippet.find(filter)
          .populate('author', 'username avatar reputation')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Snippet.countDocuments(filter),
      ])

      // Sort by net votes within this page (≤20 items — negligible)
      snippets.sort((a, b) => {
        const scoreA = (a.upvotes?.length || 0) - (a.downvotes?.length || 0)
        const scoreB = (b.upvotes?.length || 0) - (b.downvotes?.length || 0)
        return scoreB - scoreA
      })

      basePayload = {
        snippets,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }

      // Cache the base payload (no user-specific AI review data)
      await cacheSet(key, basePayload, TTL.SNIPPET_LIST)
    }

    // ─── Layer in AI reviews for logged-in user (indexed, fast) ───────────────
    // Deep-clone so we don't mutate the in-memory cached object
    const snippets = basePayload.snippets.map((s) => ({ ...s }))

    if (req.user && snippets.length > 0) {
      const aiReviews = await AiReview.find({
        user: req.user._id,
        snippet: { $in: snippets.map((s) => s._id) },
      }).lean()
      const reviewMap = new Map(aiReviews.map((r) => [r.snippet.toString(), r]))
      snippets.forEach((s) => {
        s.aiReview = reviewMap.get(s._id.toString()) || null
      })
    }

    res.json({ ...basePayload, snippets })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL  (GET /api/snippets/:id)
// ─────────────────────────────────────────────────────────────────────────────

export const getSnippetById = async (req, res) => {
  try {
    const key = detailKey(req.params.id)
    const cached = await cacheGet(key)

    let snippet

    if (cached) {
      snippet = cached
    } else {
      snippet = await Snippet.findById(req.params.id)
        .populate('author', 'username avatar reputation')
        .populate('comments.user', 'username avatar')
        .lean()

      if (!snippet)
        return res.status(404).json({ message: 'Snippet not found' })

      await cacheSet(key, snippet, TTL.SNIPPET_DETAIL)
    }

    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    // AI review is user-specific — always fetch fresh, never cache it on the doc
    const result = { ...snippet }
    if (req.user) {
      result.aiReview =
        (await AiReview.findOne({
          user: req.user._id,
          snippet: snippet._id,
        }).lean()) || null
    } else {
      delete result.aiReview
    }

    res.json(result)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

export const deleteSnippet = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    if (snippet.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' })

    await snippet.deleteOne()

    // Invalidate detail + every list page + author's profile cache pages
    await Promise.all([
      cacheDel(detailKey(req.params.id)),
      cacheDelPattern('snip:list:*'),
      cacheDelPattern(`user:profile:${req.user._id}:*`),
    ])

    res.json({ message: 'Snippet deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────

export const updateSnippet = async (req, res) => {
  try {
    const { title, description, code, language, tags, codeVersions } = req.body
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    if (snippet.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Not authorized' })

    snippet.title = title !== undefined ? title : snippet.title
    snippet.description =
      description !== undefined ? description : snippet.description

    if (
      codeVersions !== undefined &&
      Array.isArray(codeVersions) &&
      codeVersions.length > 0
    ) {
      snippet.codeVersions = codeVersions
      snippet.code = codeVersions[0].code
      snippet.language = codeVersions[0].language
    } else {
      if (code !== undefined) snippet.code = code
      if (language !== undefined) snippet.language = language

      // Keep codeVersions[0] in sync if it exists, otherwise initialize it
      if (snippet.codeVersions && snippet.codeVersions.length > 0) {
        if (code !== undefined) snippet.codeVersions[0].code = code
        if (language !== undefined) snippet.codeVersions[0].language = language
      } else {
        snippet.codeVersions = [
          { language: snippet.language, code: snippet.code },
        ]
      }
    }

    snippet.tags = tags !== undefined ? tags : snippet.tags

    await snippet.save()

    // Invalidate detail + every list page + author's profile cache pages
    await Promise.all([
      cacheDel(detailKey(req.params.id)),
      cacheDelPattern('snip:list:*'),
      cacheDelPattern(`user:profile:${req.user._id}:*`),
    ])

    res.json(snippet)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────────────────────────────────────

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

    // New comment changes the detail view and the snippet author's profile cache pages
    await Promise.all([
      cacheDel(detailKey(req.params.id)),
      cacheDelPattern(`user:profile:${snippet.author}:*`),
    ])

    const updated = await Snippet.findById(req.params.id).populate(
      'comments.user',
      'username avatar'
    )

    // Broadcast the newest comment to all other viewers of this snippet in real-time
    const newComment = updated.comments[updated.comments.length - 1]
    const io = req.app.get('io')
    if (io) {
      io.to(req.params.id).emit('review:new', {
        snippetId: req.params.id,
        comment: newComment,
      })
    }

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
    if (comment.upvotes.includes(userId)) {
      comment.upvotes.pull(userId)
    } else {
      comment.upvotes.push(userId)
      comment.downvotes.pull(userId)
    }

    await snippet.save()
    await Promise.all([
      cacheDel(detailKey(req.params.id)),
      cacheDelPattern(`user:profile:${snippet.author}:*`),
    ])
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
    if (comment.downvotes.includes(userId)) {
      comment.downvotes.pull(userId)
    } else {
      comment.downvotes.push(userId)
      comment.upvotes.pull(userId)
    }

    await snippet.save()
    await Promise.all([
      cacheDel(detailKey(req.params.id)),
      cacheDelPattern(`user:profile:${snippet.author}:*`),
    ])
    res.json(comment)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SNIPPET VOTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /api/snippets/:id/upvote
 * Toggle upvote on the snippet itself (not a comment).
 */
export const upvoteSnippet = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

    const userId = req.user._id
    if (snippet.upvotes.some((id) => id.equals(userId))) {
      snippet.upvotes.pull(userId)
    } else {
      snippet.upvotes.push(userId)
      snippet.downvotes.pull(userId)
    }

    await snippet.save()

    // Vote changes the detail doc, may re-order lists, and changes author profile info (votes)
    await Promise.all([
      cacheDel(detailKey(req.params.id)),
      cacheDelPattern('snip:list:*'),
      cacheDelPattern(`user:profile:${snippet.author}:*`),
    ])

    res.json({ upvotes: snippet.upvotes, downvotes: snippet.downvotes })
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
    if (snippet.downvotes.some((id) => id.equals(userId))) {
      snippet.downvotes.pull(userId)
    } else {
      snippet.downvotes.push(userId)
      snippet.upvotes.pull(userId)
    }

    await snippet.save()

    await Promise.all([
      cacheDel(detailKey(req.params.id)),
      cacheDelPattern('snip:list:*'),
      cacheDelPattern(`user:profile:${snippet.author}:*`),
    ])

    res.json({ upvotes: snippet.upvotes, downvotes: snippet.downvotes })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
