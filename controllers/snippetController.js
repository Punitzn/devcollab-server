import Snippet from '../models/Snippet.js'

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
      .populate('author', 'username reputation')
      .sort({ createdAt: -1 })

    res.json(snippets)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

export const getSnippetById = async (req, res) => {
  try {
    const snippet = await Snippet.findById(req.params.id)
      .populate('author', 'username reputation')
      .populate('comments.user', 'username')

    if (!snippet) return res.status(404).json({ message: 'Snippet not found' })

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
      'username'
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

    const alreadyUpvoted = comment.upvotes.includes(req.user._id)

    if (alreadyUpvoted) {
      comment.upvotes.pull(req.user._id)
    } else {
      comment.upvotes.push(req.user._id)
      comment.downvotes.pull(req.user._id)
    }

    await snippet.save()
    res.json(comment)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}