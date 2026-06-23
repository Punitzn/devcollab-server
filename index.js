import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import { Server } from 'socket.io'
import connectDB from './config/db.js'
import './config/passport.js' // Initialize passport strategies
import passport from 'passport'
import authRoutes from './routes/authRoutes.js'
import snippetRoutes from './routes/snippetRoutes.js'
import userRoutes from './routes/userRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'

const app = express()
app.set('trust proxy', 1)

// Compress response payloads
app.use(compression())

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
app.use('/api/notifications', notificationRoutes)

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

// Make `io` accessible inside Express controllers via req.app.get('io')
app.set('io', io)

io.on('connection', (socket) => {
  // ── Each logged-in user joins their own private room ────────────────────────
  // This enables real-time notification delivery to a specific user.
  socket.on('user:join', (userId) => {
    if (userId) socket.join(userId)
  })

  // ── Join the room for a specific snippet ───────────────────────────────────
  socket.on('review:join', (snippetId) => {
    socket.join(snippetId)
  })

  // ── Leave the room for a specific snippet ──────────────────────────────────
  socket.on('review:leave', (snippetId) => {
    socket.leave(snippetId)
  })

  // ── User started typing a review ───────────────────────────────────────────
  // Relay to everyone else in the room (not the sender)
  socket.on('review:typing', ({ snippetId, username }) => {
    if (!snippetId || !username) return
    socket.to(snippetId).emit('review:typing', { username, snippetId })
  })

  // ── User stopped typing (submitted, cleared, or went idle) ─────────────────
  socket.on('review:stop', ({ snippetId, username }) => {
    if (!snippetId || !username) return
    socket.to(snippetId).emit('review:stop', { username, snippetId })
  })

  // ── On disconnect, nothing extra needed ────────────────────────────────────
  // Socket.IO automatically removes the socket from all rooms on disconnect,
  // so viewers will stop receiving events from this socket.
})

