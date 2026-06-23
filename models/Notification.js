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
        'snippet_upvote',    // someone upvoted your snippet
        'snippet_comment',   // someone commented on your snippet
        'comment_upvote',    // someone upvoted your comment
        'ai_review_complete', // AI review finished for your snippet
      ],
      required: true,
    },
    snippet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Snippet',
      default: null,
    },
    // Extra context (e.g. snippet title stored at creation time so it survives deletion)
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

// Fast lookup: "give me all unread notifications for user X"
notificationSchema.index({ recipient: 1, read: 1 })
// Fast lookup: "give me notifications for user X sorted by newest"
notificationSchema.index({ recipient: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)
