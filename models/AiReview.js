import mongoose from 'mongoose'

const aiReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    snippet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Snippet',
      required: true,
    },
    summary: { type: String, default: null },
    bugs: [{ type: String }],
    suggestions: [{ type: String }],
    complexityRating: { type: String, default: null },
    generatedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

aiReviewSchema.index({ user: 1, snippet: 1 }, { unique: true })
aiReviewSchema.index({ snippet: 1 })

export default mongoose.model('AiReview', aiReviewSchema)
