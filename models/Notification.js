import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: [
        'snippet_upvote',
        'snippet_comment',
        'comment_upvote',
        'ai_review_complete',
      ],
      required: true,
    },
    snippet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Snippet',
      default: null,
    },
    meta: {
      snippetTitle: { type: String, default: '' },
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

notificationSchema.index({ recipient: 1, read: 1 })
notificationSchema.index({ recipient: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
