import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import connectDB from './config/db.js'
import './config/passport.js' // Initialize passport strategies
import passport from 'passport'
import authRoutes from './routes/authRoutes.js'
import snippetRoutes from './routes/snippetRoutes.js'
import userRoutes from './routes/userRoutes.js'

const app = express()

// Connect to MongoDB
connectDB()

// ─── Middleware ───────────────────────────────────────────────────────────────

// CORS: allow frontend origin and credentials (cookies)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true, // Required for HTTP-only cookies to be sent cross-origin
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

// Parse JSON bodies
app.use(express.json())

// Parse cookies (required for HTTP-only JWT cookies)
app.use(cookieParser())

// Initialize Passport (stateless — no sessions needed, we use JWT cookies)
app.use(passport.initialize())

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes)
app.use('/api/snippets', snippetRoutes)
app.use('/api/users', userRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ─── Server & Socket.io ──────────────────────────────────────────────────────
const server = app.listen(process.env.PORT || 8000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 8000}`)
})

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})
