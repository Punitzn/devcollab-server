import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: { type: String, required: true },
    lineNumber: { type: Number, default: null },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

const snippetSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    code: { type: String, required: true },
    language: { type: String, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [{ type: String, trim: true }],
    comments: [commentSchema],
    // Upvotes and downvotes on the snippet itself
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Speeds up the most common queries on the home feed
snippetSchema.index({ language: 1 }) // filter by language
snippetSchema.index({ tags: 1 }) // filter by tag
snippetSchema.index({ title: 'text' }) // full-text search on title
snippetSchema.index({ author: 1 }) // profile page — snippets by user
snippetSchema.index({ createdAt: -1 }) // default sort (newest first)
// Compound: language filter + recency sort (common combined query)
snippetSchema.index({ language: 1, createdAt: -1 })

export default mongoose.model('Snippet', snippetSchema)
