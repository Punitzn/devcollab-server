import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true, // allows multiple null values (OAuth users before completing profile)
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // Password is optional — OAuth users may not have one initially
    password: {
      type: String,
      default: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      default: '',
    },
    reputation: {
      type: Number,
      default: 0,
    },
    // OAuth provider info
    provider: {
      type: String,
      enum: ['local', 'google', 'github'],
      default: 'local',
    },
    providerId: {
      type: String,
      default: null,
    },
    // OAuth users must complete their profile (set username) before accessing the app
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

// Hash password before saving (only if modified and non-null)
userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return
  this.password = await bcrypt.hash(this.password, 10)
})

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false // OAuth user with no password set
  return await bcrypt.compare(enteredPassword, this.password)
}

export default mongoose.model('User', userSchema)
