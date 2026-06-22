import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { Server } from 'socket.io'
import connectDB from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import snippetRoutes from './routes/snippetRoutes.js'

const app = express()

connectDB()

app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/snippets', snippetRoutes)

const server = app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`)
})

const io = new Server(server)

io.on('connection', (socket) => {
  console.log('user connected:', socket.id)
})
