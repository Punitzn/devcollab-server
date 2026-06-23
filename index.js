import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import { Server } from 'socket.io'
import connectDB from './config/db.js'
import './config/passport.js'
import passport from 'passport'
import authRoutes from './routes/authRoutes.js'
import snippetRoutes from './routes/snippetRoutes.js'
import userRoutes from './routes/userRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'

const app = express()
app.set('trust proxy', 1)

app.use(compression())

connectDB()

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.use(express.json())
app.use(cookieParser())
app.use(passport.initialize())

app.use('/api/auth', authRoutes)
app.use('/api/snippets', snippetRoutes)
app.use('/api/users', userRoutes)
app.use('/api/notifications', notificationRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

const server = app.listen(process.env.PORT || 8000, () => {
  console.log(`✅ Server running on port ${process.env.PORT || 8000}`)
})

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
})

app.set('io', io)

io.on('connection', (socket) => {
  socket.on('user:join', (userId) => {
    if (userId) socket.join(userId)
  })

  socket.on('review:join', (snippetId) => {
    socket.join(snippetId)
  })

  socket.on('review:leave', (snippetId) => {
    socket.leave(snippetId)
  })

  socket.on('review:typing', ({ snippetId, username }) => {
    if (!snippetId || !username) return
    socket.to(snippetId).emit('review:typing', { username, snippetId })
  })

  socket.on('review:stop', ({ snippetId, username }) => {
    if (!snippetId || !username) return
    socket.to(snippetId).emit('review:stop', { username, snippetId })
  })
})
