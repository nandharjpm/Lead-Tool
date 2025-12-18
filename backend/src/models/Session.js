import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true, index: true },
  fingerprint: {
    ip: String,
    userAgent: String,
    timezone: String,
    offset: Number,
    screenResolution: String},
  startTime: Date,
  endTime: Date,
  totalTimeSpent: { type: Number, default: 0 },
  pageVisits: { type: Number, default: 1 },
  apiHits: { findEmails: { type: Number, default: 0 } },
  events: [{ type: { type: String }, timestamp: Date, meta: Object }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("Session", SessionSchema);
