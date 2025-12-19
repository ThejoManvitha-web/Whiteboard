# Real‑Time Collaborative Whiteboard

A full‑stack collaborative whiteboard with real‑time drawing, sharing, and persistence. Frontend is built with React; backend uses Node.js, Express, MongoDB, and Socket.IO.

## Features

- Real‑time multi‑user drawing with Socket.IO (throttled ~50 ms for smooth updates)
- Tools: brush, line, rectangle, circle, arrow, eraser, text
- Color, fill, and size controls; undo/redo; JPEG export
- JWT authentication (1‑day tokens) with protected REST APIs and secure socket authentication via middleware
- Canvas management: create, rename, list, share/unshare, delete
- Access control: owner/shared users can view/edit
- **Database optimization with essential indexes for improved query performance**

## Tech Stack

- Frontend: React, roughjs, perfect‑freehand, lodash.throttle
- Backend: Node.js, Express, Socket.IO, Mongoose (MongoDB)
- Deployment: Frontend on Vercel, Backend on Render

## Monorepo Layout

```
whiteboard-app/
  backend/
    config/, controllers/, middlewares/, models/, routes/, server.js
  frontend/
    public/, src/ (components/, store/, utils/), package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (Atlas or local)

### 1) Clone and install

```bash
git clone https://github.com/abhinav1karthik/Whiteboard-App.git
cd Whiteboard-App

# Backend deps
cd backend && npm install

# Frontend deps
cd ../frontend && npm install
```

### 2) Configure environment variables

Backend (`backend/.env`):

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/whiteboard
JWT_SECRET=replace_with_a_strong_secret
CLIENT_URL=http://localhost:3000
```

Frontend (`frontend/.env`):

```env
REACT_APP_API_URL=http://localhost:5000
```

### 3) Run locally

In one terminal (backend):

```bash
cd backend
npm start
# Server running on http://localhost:5000
```

In another terminal (frontend):

```bash
cd frontend
npm start
# App running on http://localhost:3000
```

Login/Register at `/login` and `/register`. After login, a JWT is stored in `localStorage` and used for API calls and secure socket authentication via auth headers.

## REST API (summary)

Base URL: `http://localhost:5000/api`

Auth header: `Authorization: Bearer <JWT>`

### Users

- `POST /users/register` — Register with `{ email, password }`
- `POST /users/login` — Login; returns `{ token }` (1‑day expiry)
- `GET /users/me` — Get current user (requires auth)

### Canvas

- `POST /canvas/create` — Create canvas
- `PUT /canvas/update` — Update elements `{ canvasId, elements }`
- `GET /canvas/load/:id` — Load a canvas by id
- `GET /canvas/list` — List canvases owned or shared with user
- `PUT /canvas/share/:id` — Share with a user by `{ email }`
- `PUT /canvas/unshare/:id` — Remove user `{ userIdToRemove }`
- `PUT /canvas/update-name` — Rename canvas `{ canvasId, name }` (owner only, 1–20 chars)
- `DELETE /canvas/delete/:id` — Delete canvas (owner only)

## Socket.IO Realtime Protocol

Rooms: Each canvas uses a room named by its `canvasId`. Clients must be authorized (owner or shared) to join.

**Security**: Socket connections are authenticated via `io.use()` middleware that validates JWT tokens from auth headers before allowing any socket events.

Client emits:

- `joinCanvas` → `{ canvasId }` — Request to join a canvas room
- `drawingUpdate` → `{ canvasId, elements }` — Send drawing changes (throttled ~50 ms)
- `eraseUpdate` → `{ canvasId, elements }` — Send erase changes (throttled ~50 ms)
- `leaveCanvas` → `{ canvasId }` — Leave room on page change/unmount

Server emits:

- `loadCanvas` → `elements` — Initial elements after joining
- `receiveDrawingUpdate` → `elements` — Broadcast drawing updates to other clients
- `receiveEraseUpdate` → `elements` — Broadcast erase updates to other clients
- `unauthorized` → `{ message }` — When token invalid or user lacks access
- `canvasNameUpdated` → `{ canvasId, name }` — Sent from HTTP controller after rename

Client socket setup (high‑level):

- Auth token is sent in the `auth` object during handshake (secure header-based authentication)
- Auto‑reconnect enabled (5 attempts, 3s delay)
- Uses WebSocket transport

## Data Models (Mongoose)

User:

```js
{
  email: String, // unique
  password: String // bcrypt‑hashed (10 salt rounds)
}
```

Canvas:

```js
{
  owner: ObjectId(User),
  shared: [ObjectId(User)],
  elements: [Mixed],
  name: String (<= 20, default "Untitled"),
  createdAt: Date
}
```

## Architecture Notes

- Express and Socket.IO share the same HTTP server
- `io` is injected into Express requests (`req.io`) so controllers can broadcast
- **Secure Socket Authentication**: `io.use()` middleware validates JWT tokens from auth headers before allowing socket connections
- Owner/shared authorization enforced for both HTTP and Socket.IO
- Canvas state persisted on updates to MongoDB

## Security Features

- **JWT Authentication**: 1-day tokens for secure user authentication
- **Secure Socket Authentication**: Tokens sent via auth headers (not query parameters) and validated by `io.use()` middleware
- **Centralized Auth**: All socket connections authenticated before any events are processed
- **Protected Routes**: Both REST APIs and socket events require valid authentication
- **Access Control**: Canvas access restricted to owners and explicitly shared users

## Performance & UX

- Socket emissions throttled to ~50 ms (~20 Hz) for smooth, low‑overhead updates
- **Buffered database writes**: Real-time updates broadcast immediately, DB writes buffered every 500ms (reduces DB load from ~20 writes/sec to ~2 writes/sec per canvas)
- Room‑scoped broadcasting avoids cross‑canvas noise
- Reconnect strategy: 5 attempts, 3 s delay
- Undo/redo with in‑memory history for fast local interactions

## Database Optimization

This application implements essential database indexes and query optimizations:

### Indexes Implemented

- **User Collection**: Email (unique) - for fast login lookups
- **Canvas Collection**:
  - Owner index - for finding user's canvases
  - Shared users index - for finding shared canvases
  - Owner + CreatedAt compound index - for user's canvases sorted by date

### Query Optimizations

- **Projection**: Only fetch required fields (excludes elements array in list view)
- **Atomic Updates**: Single query for authorization check + update
- **Single Query Authorization**: Combine access control with data retrieval

### Performance Benefits

- **Faster query execution** through database indexing
- **Reduced data transfer** by excluding unnecessary fields
- **Better scalability** as data volume grows

## Deployment

Backend (Render):

- Set env vars: `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`
- Bind to Render service URL (e.g., `https://your-backend.onrender.com`)

Frontend (Vercel):

- Set `REACT_APP_API_URL` to your deployed backend URL
- Rebuild and redeploy

## Troubleshooting

- 401/403 on join: Ensure JWT is present in `localStorage` and not expired; verify canvas is owned/shared
- Socket not connecting: Check `REACT_APP_API_URL`, CORS `CLIENT_URL`, and that backend is running
- Socket authentication errors: Verify JWT token is valid and not expired; check browser console for auth middleware errors
- Nothing renders: Ensure canvas `elements` array is non‑empty and tools are selected
- Rename errors: Name must be 1–20 characters and you must be the owner

## License

MIT
