require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const connectToDB = require("./config/db");
const { Server } = require("socket.io");
const http = require("http");
const Canvas = require("./models/canvasModel");
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT_SECRET;

const userRoutes = require("./routes/userRoutes");
const canvasRoutes = require("./routes/canvasRoutes");

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};
// Middleware
app.use(cors(corsOptions));
app.use(express.json());

connectToDB();

const server = http.createServer(app);
const io = new Server(server, corsOptions);

app.use((req, res, next) => {
  req.io = io;
  next();
});

//Routes
app.use("/api/users", userRoutes);
app.use("/api/canvas", canvasRoutes);

// Socket authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      console.log("Socket connection rejected: No token provided");
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, SECRET_KEY);
    socket.userId = decoded.userId;
    console.log(`Socket authenticated for user: ${socket.userId}`);
    next();
  } catch (error) {
    console.log("Socket connection rejected: Invalid token", error.message);
    if (error.name === "TokenExpiredError") {
      return next(new Error("Authentication error: Token expired"));
    } else if (error.name === "JsonWebTokenError") {
      return next(new Error("Authentication error: Invalid token"));
    } else {
      return next(new Error("Authentication error: Token verification failed"));
    }
  }
});

// Track active rooms per socket
const socketRooms = new Map();
// Maps socket.id → Set of canvasIds that this socket has joined.

// Canvas write buffer for efficient database writes
const canvasWriteBuffer = new Map(); // canvasId -> { elements, timeoutId }

// Flush canvas to database
const flushCanvasToDB = async (canvasId) => {
  const buffer = canvasWriteBuffer.get(canvasId);
  if (!buffer) return;

  try {
    await Canvas.findByIdAndUpdate(
      canvasId,
      { elements: buffer.elements },
      { new: true }
    );
    console.log(`Flushed canvas ${canvasId} to DB`);
  } catch (error) {
    console.error(`Failed to flush canvas ${canvasId}:`, error);
  }

  canvasWriteBuffer.delete(canvasId);
};

// Schedule canvas write with buffering
const scheduleCanvasWrite = (canvasId, elements) => {
  // Clear existing timeout
  const existing = canvasWriteBuffer.get(canvasId);
  if (existing?.timeoutId) {
    clearTimeout(existing.timeoutId);
  }

  // Schedule new write in 500ms
  const timeoutId = setTimeout(() => {
    flushCanvasToDB(canvasId);
  }, 500);

  canvasWriteBuffer.set(canvasId, { elements, timeoutId });
};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Initialize room tracking for this socket
  socketRooms.set(socket.id, new Set());

  socket.on("joinCanvas", async ({ canvasId }) => {
    try {
      const rooms = socketRooms.get(socket.id);

      // Prevent duplicate joins
      if (rooms.has(canvasId)) {
        console.log(`User ${socket.id} already in canvas ${canvasId}`);
        return;
      }

      // User ID is already available from socket authentication middleware
      const userId = socket.userId;
      console.log(`User ${userId} joining canvas ${canvasId}`);

      const canvas = await Canvas.findById(canvasId);
      if (!canvas) {
        console.log(`Canvas ${canvasId} not found`);
        socket.emit("unauthorized", { message: "Canvas not found" });
        return;
      }

      // Convert to string for reliable comparison
      const ownerStr = canvas.owner.toString();
      const userIdStr = userId.toString();
      const sharedUsers = canvas.shared.map((id) => id.toString());

      const isOwner = ownerStr === userIdStr;
      const isShared = sharedUsers.includes(userIdStr);

      if (!isOwner && !isShared) {
        console.log(`User ${userIdStr} not authorized for canvas ${canvasId}`);
        socket.emit("unauthorized", {
          message: "You are not authorized to join this canvas",
        });
        return;
      }

      // Join the room and track it
      socket.join(canvasId);
      rooms.add(canvasId);
      console.log(`User ${socket.id} joined canvas ${canvasId}`);
      // Prefer in-memory buffer if present (latest state users see)
      const buffer = canvasWriteBuffer.get(canvasId);
      const stateToSend = buffer?.elements ?? canvas.elements;
      // Send current canvas elements
      socket.emit("loadCanvas", stateToSend);
    } catch (error) {
      console.error("Join canvas error:", error);
      socket.emit("error", {
        message: "An error occurred while joining the canvas",
      });
    }
  });

  socket.on("drawingUpdate", async ({ canvasId, elements }) => {
    try {
      // Broadcast to others in the room (except sender) - REALTIME
      socket.to(canvasId).emit("receiveDrawingUpdate", elements);

      // Schedule database write (buffered for efficiency)
      scheduleCanvasWrite(canvasId, elements);
    } catch (error) {
      console.error("Drawing update error:", error);
    }
  });

  socket.on("leaveCanvas", ({ canvasId }) => {
    const rooms = socketRooms.get(socket.id);
    if (rooms && rooms.has(canvasId)) {
      socket.leave(canvasId);
      rooms.delete(canvasId);
      console.log(`User ${socket.id} left canvas ${canvasId}`);
    }
  });

  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);
    const rooms = socketRooms.get(socket.id);
    if (!rooms) return;

    for (const roomId of rooms) {
      const buffer = canvasWriteBuffer.get(roomId);
      const sockets = await io.in(roomId).fetchSockets(); // returns array of socket instances
      // If no sockets left in the room and there's a pending buffer, flush it
      if ((!sockets || sockets.length === 0) && buffer?.timeoutId) {
        clearTimeout(buffer.timeoutId);
        await flushCanvasToDB(roomId);
      }
    }
    socketRooms.delete(socket.id);
  });

  socket.on("eraseUpdate", async ({ canvasId, elements }) => {
    try {
      // Broadcast erase to others - REALTIME
      socket.to(canvasId).emit("receiveEraseUpdate", elements);

      // Schedule database write (buffered for efficiency)
      scheduleCanvasWrite(canvasId, elements);
    } catch (error) {
      console.error("Erase update error:", error);
    }
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
