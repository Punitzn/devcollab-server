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
    codeVersions: [
      {
        language: { type: String, required: true },
        code: { type: String, required: true },
      },
    ],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [{ type: String, trim: true }],
    comments: [commentSchema],
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

snippetSchema.index({ language: 1 })
snippetSchema.index({ tags: 1 })
snippetSchema.index({ title: 'text' })
snippetSchema.index({ author: 1 })
snippetSchema.index({ createdAt: -1 })
snippetSchema.index({ language: 1, createdAt: -1 })

export default mongoose.model('Snippet', snippetSchema)
