const mongoose = require("mongoose");

const canvasSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  shared: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  elements: [{ type: mongoose.Schema.Types.Mixed }],
  name: { type: String, default: "Untitled", maxlength: 20 }, // Added name field
  createdAt: { type: Date, default: Date.now },
});

// Essential indexes for Canvas model
canvasSchema.index({ owner: 1 }); // Owner lookup for user's canvases
canvasSchema.index({ shared: 1 }); // Shared user lookup
canvasSchema.index({ owner: 1, createdAt: -1 }); // User's canvases sorted by date

module.exports = mongoose.model("Canvas", canvasSchema);
