<h1 align="center">
  ⚙️ DevCollab — Backend
</h1>

<h4 align="center">The Node.js + Express REST API and Socket.io server powering DevCollab — a collaborative code-snippet platform with OAuth authentication and AI-powered code reviews.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white&style=for-the-badge" alt="Node.js">
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white&style=for-the-badge" alt="Express 5">
  <img src="https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?logo=mongodb&logoColor=white&style=for-the-badge" alt="MongoDB">
  <img src="https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white&style=for-the-badge" alt="Socket.io">
  <img src="https://img.shields.io/badge/Passport.js-OAuth-34E27A?logo=passport&logoColor=white&style=for-the-badge" alt="Passport">
  <img src="https://img.shields.io/badge/Gemini_AI-Powered-4285F4?logo=google&logoColor=white&style=for-the-badge" alt="Gemini AI">
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#️-project-structure">Project Structure</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-environment-variables">Environment Variables</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-database-schema">Database Schema</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## ✨ Features

### 🔐 Authentication
- **Local Auth** — Email + password registration and login with bcrypt hashing
- **Google OAuth 2.0** — Sign in via Google using Passport.js strategy
- **GitHub OAuth** — Sign in via GitHub using Passport.js strategy
- **JWT via HTTP-only Cookies** — Stateless, XSS-safe token sessions (no server-side session store)
- **Profile Completion** — OAuth users must set a username before accessing protected resources
- **Set Password** — OAuth users can add a password to enable local login

### 📝 Snippets
- Full CRUD for code snippets (create, read, delete)
- Filter snippets by `language`, `tag`, or title `search`
- Snippets sorted by net vote score (upvotes − downvotes)
- Author-only delete protection

### 💬 Comments & Voting
- Add comments to snippets, optionally tied to a specific **line number**
- Toggle upvote / downvote on both snippets and individual comments (mutually exclusive)

### 🤖 AI Code Reviews
- **Gemini AI** (primary) — Uses `@google/generative-ai` SDK; returns structured JSON reviews
- **OpenAI GPT-4o-mini** (fallback) — Used when `GEMINI_API_KEY` is not set
- Structured output: `summary`, `bugs[]`, `suggestions[]`, `complexityRating`
- Per-user per-snippet caching in MongoDB; force-refresh with `?force=true`
- Graceful handling of rate limits (429) and unavailable models

### 🔌 Real-time (Socket.io)
- Socket.io server co-hosted with Express
- Emits connection/disconnection events (extensible for live comment broadcasting)

---

## 🛠 Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | JavaScript runtime |
| **Express** | 5 | HTTP server framework |
| **MongoDB + Mongoose** | 9 | Database and ODM |
| **Socket.io** | 4 | Real-time WebSocket server |
| **Passport.js** | 0.7 | OAuth middleware |
| **passport-google-oauth20** | 2 | Google OAuth 2.0 strategy |
| **passport-github2** | 0.1 | GitHub OAuth strategy |
| **jsonwebtoken** | 9 | JWT signing and verification |
| **bcryptjs** | 3 | Secure password hashing |
| **cookie-parser** | 1.4 | HTTP-only cookie parsing |
| **cors** | 2.8 | CORS policy enforcement |
| **dotenv** | 17 | Environment variable loading |
| **@google/generative-ai** | 0.24 | Gemini AI SDK |
| **openai** | 6 | OpenAI SDK (GPT-4o-mini fallback) |
| **nodemon** | 3 | Dev server auto-restart |
| **prettier** | 3 | Code formatting |

---

## 🗂️ Project Structure

```
devcollab-server/
├── config/
│   ├── db.js              # MongoDB connection (Mongoose)
│   └── passport.js        # Google & GitHub OAuth strategy setup
├── controllers/
│   ├── authController.js  # register, login, logout, getMe, oauthCallback,
│   │                      #   completeProfile, setPassword
│   ├── snippetController.js # createSnippet, getSnippets, getSnippetById,
│   │                        #   deleteSnippet, addComment,
│   │                        #   upvoteComment, downvoteComment,
│   │                        #   upvoteSnippet, downvoteSnippet
│   ├── aiController.js    # generateAiReview (Gemini + OpenAI fallback)
│   └── userController.js  # getUserProfile
├── middleware/
│   └── auth.js            # protect (JWT required), optionalProtect (JWT optional)
├── models/
│   ├── User.js            # User schema with OAuth + local auth support
│   ├── Snippet.js         # Snippet schema with embedded Comment sub-schema
│   └── AiReview.js        # AI review cache (per user + snippet)
├── routes/
│   ├── authRoutes.js      # /api/auth/*
│   ├── snippetRoutes.js   # /api/snippets/*
│   └── userRoutes.js      # /api/users/*
├── index.js               # App entry: Express setup, middleware, routes, Socket.io
├── .prettierrc            # Prettier config
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18 or higher
- **npm** v8 or higher
- A **MongoDB** URI (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas))
- A **Google OAuth** app ([Google Cloud Console](https://console.cloud.google.com/))
- A **GitHub OAuth** app ([GitHub Developer Settings](https://github.com/settings/developers))
- A **Gemini API key** ([Google AI Studio](https://aistudio.google.com/)) or **OpenAI API key**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Punitzn/devcollab-server.git
cd devcollab-server

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Edit .env with your credentials (see Environment Variables below)

# 4. Start the development server
npm run dev
```

The server starts on **http://localhost:8000** by default.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon (auto-restart on file changes) |
| `node index.js` | Start in production mode |
| `npm run format` | Format all files with Prettier |

---

## 🔑 Environment Variables

Create a `.env` file in the root of this directory:

```env
# ─── Server ───────────────────────────────────────────────────────────────────
PORT=8000

# ─── Database ─────────────────────────────────────────────────────────────────
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/devcollab

# ─── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_jwt_key_here

# ─── CORS — must match the frontend origin exactly ────────────────────────────
FRONTEND_URL=http://localhost:5173

# ─── Google OAuth ─────────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:8000/api/auth/google/callback

# ─── GitHub OAuth ─────────────────────────────────────────────────────────────
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:8000/api/auth/github/callback

# ─── AI Code Review ───────────────────────────────────────────────────────────
# Gemini takes priority when GEMINI_API_KEY is set
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash        # Optional — defaults to gemini-3.5-flash

# OpenAI is used as fallback when GEMINI_API_KEY is absent
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini             # Optional — defaults to gpt-4o-mini
```

---

## 📡 API Reference

All endpoints are prefixed with `/api`. Authentication uses **HTTP-only JWT cookies** automatically set by the server on login.

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/register` | ❌ | Register with email & password |
| `POST` | `/login` | ❌ | Log in; sets `token` HTTP-only cookie |
| `POST` | `/logout` | ❌ | Clears the auth cookie |
| `GET` | `/me` | ✅ | Returns the currently authenticated user |
| `POST` | `/complete-profile` | ✅ | Set username for OAuth users (required before app access) |
| `PUT` | `/set-password` | ✅ | Add/change password for OAuth-registered users |
| `GET` | `/google` | ❌ | Initiates Google OAuth flow |
| `GET` | `/google/callback` | ❌ | Google OAuth redirect handler |
| `GET` | `/github` | ❌ | Initiates GitHub OAuth flow |
| `GET` | `/github/callback` | ❌ | GitHub OAuth redirect handler |
| `GET` | `/oauth-error` | ❌ | OAuth failure redirect with error message |

---

### Snippets — `/api/snippets`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/` | Optional | List all snippets; supports `?language=`, `?tag=`, `?search=` |
| `GET` | `/:id` | Optional | Get a single snippet with comments and AI review |
| `POST` | `/` | ✅ | Create a new snippet |
| `DELETE` | `/:id` | ✅ Author only | Delete a snippet |
| `POST` | `/:id/comments` | ✅ | Add a comment (`content`, optional `lineNumber`) |
| `PATCH` | `/:id/comments/:commentId/upvote` | ✅ | Toggle upvote on a comment |
| `PATCH` | `/:id/comments/:commentId/downvote` | ✅ | Toggle downvote on a comment |
| `PATCH` | `/:id/upvote` | ✅ | Toggle upvote on a snippet |
| `PATCH` | `/:id/downvote` | ✅ | Toggle downvote on a snippet |
| `POST` | `/:id/ai-review` | ✅ | Generate or retrieve cached AI code review |

**AI Review query params:**
- `?force=true` — Bypass cache and regenerate the review

---

### Users — `/api/users`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/:id` | ❌ | Get a user's public profile |

---

### Health Check

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{ status: "ok", timestamp }` |

---

## 🗃️ Database Schema

### User
```js
{
  username:          String,   // unique, sparse (null until OAuth user completes profile)
  email:             String,   // required, unique
  password:          String,   // bcrypt hashed; null for OAuth-only accounts
  avatar:            String,   // URL
  bio:               String,
  reputation:        Number,   // default: 0
  provider:          String,   // 'local' | 'google' | 'github'
  providerId:        String,   // OAuth provider user ID
  isProfileComplete: Boolean,  // false until username is set
  createdAt, updatedAt
}
```

### Snippet
```js
{
  title:       String,   // required
  description: String,
  code:        String,   // required
  language:    String,   // required (e.g. 'javascript', 'python')
  author:      ObjectId, // ref: User
  tags:        [String],
  upvotes:     [ObjectId], // ref: User
  downvotes:   [ObjectId], // ref: User
  comments:    [Comment],  // embedded sub-documents
  createdAt, updatedAt
}
```

### Comment *(embedded in Snippet)*
```js
{
  user:       ObjectId, // ref: User
  content:    String,   // required
  lineNumber: Number,   // nullable — for line-specific comments
  upvotes:    [ObjectId],
  downvotes:  [ObjectId],
  createdAt, updatedAt
}
```

### AiReview
```js
{
  user:             ObjectId, // ref: User
  snippet:          ObjectId, // ref: Snippet
  summary:          String,
  bugs:             [String],
  suggestions:      [String],
  complexityRating: String,   // e.g. "Time: O(n) | Space: O(1)"
  generatedAt:      Date
}
```

---

## 🔒 Security

| Measure | Detail |
|---|---|
| **HTTP-only JWT cookies** | Auth tokens are never exposed to JavaScript — prevents XSS token theft |
| **Bcrypt (salt=10)** | All passwords are hashed before storage |
| **CORS whitelist** | Only the `FRONTEND_URL` origin is permitted with credentials |
| **Ownership checks** | Delete operations confirm the requester is the author |
| **Optional auth middleware** | `optionalProtect` lets public routes work without leaking user-specific data |
| **OAuth error handling** | Failed OAuth redirects carry a human-readable error message |

---

## 🤖 AI Review Flow

```
POST /api/snippets/:id/ai-review
         │
         ▼
  Existing review? ──yes──► Return cached (unless ?force=true)
         │ no
         ▼
  GEMINI_API_KEY set?
    yes ──► Call Gemini API (gemini-2.0-flash)
    no  ──► Call OpenAI API (gpt-4o-mini)
         │
         ▼
  Parse JSON response
  { summary, bugs[], suggestions[], complexityRating }
         │
         ▼
  Save/update AiReview document in MongoDB
         │
         ▼
  Return { aiReview, cached: false }
```

---

## 🌐 Deployment

Deploy to any Node.js-compatible host (Render, Railway, Fly.io, etc.).

### Steps

1. Push this repository to GitHub
2. Create a new web service on your host pointing to this repo
3. Set the **start command** to: `node index.js`
4. Add all [environment variables](#-environment-variables) in the host dashboard
5. Update `FRONTEND_URL` to your production frontend URL
6. Update OAuth callback URLs to your production backend URL

### Update OAuth Apps (Production)

In your Google Cloud Console and GitHub Developer Settings, add the production callback URLs:

```
https://your-backend.com/api/auth/google/callback
https://your-backend.com/api/auth/github/callback
```

---

## 🔗 Related

- **Frontend Repository** — [devcollab-client](https://github.com/Punitzn/devcollab-client)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">Built with ❤️ using Node.js + Express + MongoDB</p>
