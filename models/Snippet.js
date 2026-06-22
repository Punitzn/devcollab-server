import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema(
  {
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true },
    content: { type: String, 
        required: true },
    lineNumber: { type: Number, 
        default: null },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' }],
  },
  { timestamps: true }
)

const snippetSchema = new mongoose.Schema(
  {
    title: { type: String, 
        required: true, 
        trim: true },
    description: { 
        type: String, 
        default: '' },
    code: { 
        type: String, 
        required: true },
    language: { 
        type: String, 
        required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [{
         type: String, 
        trim: true }],
    comments: [commentSchema],
    upvotes: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' }],
    aiReview: {
      summary: {
         type: String, 
         default: null },
      bugs: [{ 
        type: String }],
      suggestions: [{ 
        type: String }],
      complexityRating: { 
        type: String, 
        default: null },
      generatedAt: { 
        type: Date, 
        default: null },
    },
  },
  { timestamps: true }
)

export default mongoose.model('Snippet', snippetSchema)
