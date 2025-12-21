// visitor.model.js

const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  timezone: {
    type: String,
    required: true
  },
  offset: String,
  userAgent: String,
  screenResolution: String,
  ip: String,
  startTime: {
    type: Date,
    required: true
  },
  endTime: Date,
  totalTimeSpent: {
    type: Number,
    default: 0
  },
  pageVisits: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  events: [{
    type: {
      type: String,
      required: true
    },
    data: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for analytics queries
visitorSchema.index({ timezone: 1 });
visitorSchema.index({ startTime: -1 });
visitorSchema.index({ totalTimeSpent: -1 });

module.exports = mongoose.model('Visitor', visitorSchema);