const mongoose = require("mongoose");

const FingerprintSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true, unique: true },
  ip: String,
  userAgent: String,
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  hits: { type: Number, default: 1 }
});

module.exports = mongoose.model("Fingerprint", FingerprintSchema);

const Fingerprint = require("./models/Fingerprint");

app.post("/save_fingerprint", async (req, res) => {
  try {
    const { fingerprint } = req.body;

    if (!fingerprint) {
      return res.status(400).json({ error: "Missing fingerprint" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];

    // Try to find existing fingerprint
    let record = await Fingerprint.findOne({ fingerprint });

    if (record) {
      record.lastSeen = new Date();
      record.hits += 1;
      await record.save();
      return res.json({
        status: "existing",
        hits: record.hits
      });
    }

    // Create new record if not found
    await Fingerprint.create({
      fingerprint,
      ip,
      userAgent
    });

    res.json({
      status: "new",
      hits: 1
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/use-credit", async (req, res) => {
  const { fingerprint } = req.body;

  const user = await Fingerprint.findOne({ fingerprint });
  if (!user) return res.status(403).json({ error: "Unknown user" });

  const limit = 3;  // <-- your credit limit

  if (user.hits > limit) {
    return res.json({ allowed: false, message: "Free credit limit reached" });
  }

  res.json({ allowed: true, remaining: limit - user.hits });
});

// server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// In-memory storage (replace with database in production)
const sessions = new Map();
const visitors = new Map();

// Database helper functions
const saveSession = (sessionId, data) => {
  sessions.set(sessionId, {
    ...data,
    lastUpdated: new Date()
  });
};

const getSession = (sessionId) => {
  return sessions.get(sessionId);
};

const saveVisitor = (visitorData) => {
  const visitorId = uuidv4();
  visitors.set(visitorId, {
    ...visitorData,
    createdAt: new Date()
  });
  return visitorId;
};

// API Routes

// 1. Initialize new session
app.post('/api/session/start', (req, res) => {
  try {
    const { timezone, offset, userAgent, screenResolution } = req.body;
    
    if (!timezone) {
      return res.status(400).json({ error: 'Timezone is required' });
    }

    const sessionId = uuidv4();
    const sessionData = {
      sessionId,
      timezone,
      offset,
      userAgent: userAgent || req.headers['user-agent'],
      screenResolution,
      ip: req.ip || req.connection.remoteAddress,
      startTime: new Date(),
      totalTimeSpent: 0,
      pageVisits: 1,
      isActive: true,
      events: []
    };

    saveSession(sessionId, sessionData);

    console.log(`New session started: ${sessionId}`);

    res.json({
      success: true,
      sessionId,
      message: 'Session started successfully'
    });

  } catch (error) {
    console.error('Error starting session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Update session activity (heartbeat)
app.post('/api/session/update', (req, res) => {
  try {
    const { sessionId, timeSpent, isActive, pageVisits } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update session data
    session.totalTimeSpent = timeSpent || session.totalTimeSpent;
    session.isActive = isActive !== undefined ? isActive : session.isActive;
    session.pageVisits = pageVisits || session.pageVisits;
    session.lastUpdated = new Date();

    saveSession(sessionId, session);

    res.json({
      success: true,
      message: 'Session updated successfully'
    });

  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Log specific events
app.post('/api/session/event', (req, res) => {
  try {
    const { sessionId, eventType, eventData } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({ error: 'Session ID and event type are required' });
    }

    const session = getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Add event to session
    const event = {
      type: eventType,
      data: eventData,
      timestamp: new Date()
    };

    session.events.push(event);
    saveSession(sessionId, session);

    console.log(`Event logged: ${eventType} for session ${sessionId}`);

    res.json({
      success: true,
      message: 'Event logged successfully'
    });

  } catch (error) {
    console.error('Error logging event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. End session and save visitor data
app.post('/api/session/end', (req, res) => {
  try {
    const { sessionId, finalTimeSpent } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = getSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Update final time
    session.totalTimeSpent = finalTimeSpent || session.totalTimeSpent;
    session.endTime = new Date();
    session.isActive = false;

    // Save to permanent visitor storage
    const visitorId = saveVisitor(session);

    // Clean up active session
    sessions.delete(sessionId);

    console.log(`Session ended: ${sessionId}, saved as visitor ${visitorId}`);

    res.json({
      success: true,
      visitorId,
      message: 'Session ended and saved successfully'
    });

  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Get analytics/statistics
app.get('/api/analytics/summary', (req, res) => {
  try {
    const allVisitors = Array.from(visitors.values());
    const activeSessions = Array.from(sessions.values());

    // Calculate statistics
    const totalVisitors = allVisitors.length;
    const activeVisitors = activeSessions.filter(s => s.isActive).length;
    
    const avgTimeSpent = totalVisitors > 0
      ? allVisitors.reduce((sum, v) => sum + (v.totalTimeSpent || 0), 0) / totalVisitors
      : 0;

    // Timezone distribution
    const timezoneDistribution = {};
    allVisitors.forEach(v => {
      timezoneDistribution[v.timezone] = (timezoneDistribution[v.timezone] || 0) + 1;
    });

    // Sort by most common timezones
    const topTimezones = Object.entries(timezoneDistribution)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        totalVisitors,
        activeVisitors,
        avgTimeSpent: Math.round(avgTimeSpent),
        topTimezones,
        recentVisitors: allVisitors.slice(-10).reverse()
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Get specific visitor data
app.get('/api/visitor/:visitorId', (req, res) => {
  try {
    const { visitorId } = req.params;
    const visitor = visitors.get(visitorId);

    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }

    res.json({
      success: true,
      data: visitor
    });

  } catch (error) {
    console.error('Error fetching visitor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    activeSessions: sessions.size,
    totalVisitors: visitors.size
  });
});

// Cleanup old sessions (run periodically)
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes

  for (const [sessionId, session] of sessions.entries()) {
    const lastUpdate = new Date(session.lastUpdated).getTime();
    
    if (now - lastUpdate > timeout) {
      // Save abandoned session
      saveVisitor(session);
      sessions.delete(sessionId);
      console.log(`Cleaned up abandoned session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// Start server
app.listen(PORT, () => {
  console.log(`Visitor tracking server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;

// ============================================
// DATABASE SCHEMA (MongoDB/Mongoose example)
// ============================================

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

// ============================================
// CLIENT-SIDE INTEGRATION CODE
// ============================================


// tracking.js - Add to your frontend

class VisitorTracker {
  constructor(apiUrl = 'http://localhost:3000/api') {
    this.apiUrl = apiUrl;
    this.sessionId = null;
    this.startTime = Date.now();
    this.timeSpent = 0;
    this.isActive = true;
    this.pageVisits = 1;
    this.lastActivity = Date.now();
    this.heartbeatInterval = null;
  }

  async init() {
    // Get timezone info
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Date().getTimezoneOffset();
    const offsetHours = Math.abs(offset / 60);
    const offsetMins = Math.abs(offset % 60);
    const offsetStr = `UTC${offset <= 0 ? '+' : '-'}${offsetHours}:${offsetMins.toString().padStart(2, '0')}`;

    // Start session
    try {
      const response = await fetch(`${this.apiUrl}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone,
          offset: offsetStr,
          userAgent: navigator.userAgent,
          screenResolution: `${screen.width}x${screen.height}`
        })
      });

      const data = await response.json();
      if (data.success) {
        this.sessionId = data.sessionId;
        this.startHeartbeat();
        this.attachListeners();
        console.log('Tracking initialized:', this.sessionId);
      }
    } catch (error) {
      console.error('Failed to initialize tracking:', error);
    }
  }

  startHeartbeat() {
    // Send updates every 10 seconds
    this.heartbeatInterval = setInterval(() => {
      this.updateSession();
    }, 10000);
  }

  async updateSession() {
    if (!this.sessionId) return;

    // Calculate active time
    const now = Date.now();
    const timeSinceLastActivity = now - this.lastActivity;
    
    if (timeSinceLastActivity < 30000) { // Active if less than 30s
      this.timeSpent = Math.floor((now - this.startTime) / 1000);
      this.isActive = true;
    } else {
      this.isActive = false;
    }

    try {
      await fetch(`${this.apiUrl}/session/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          timeSpent: this.timeSpent,
          isActive: this.isActive,
          pageVisits: this.pageVisits
        })
      });
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }

  async logEvent(eventType, eventData = {}) {
    if (!this.sessionId) return;

    try {
      await fetch(`${this.apiUrl}/session/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          eventType,
          eventData
        })
      });
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }

  async endSession() {
    if (!this.sessionId) return;

    clearInterval(this.heartbeatInterval);

    try {
      await fetch(`${this.apiUrl}/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          finalTimeSpent: this.timeSpent
        })
      });
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }

  attachListeners() {
    // Track activity
    const updateActivity = () => {
      this.lastActivity = Date.now();
    };

    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logEvent('tab_hidden');
      } else {
        this.logEvent('tab_visible');
        this.pageVisits++;
        updateActivity();
      }
    });

    // End session on page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
    });
  }
}

// Usage:
const tracker = new VisitorTracker('http://your-api-url.com/api');
tracker.init();

// Log custom events:
tracker.logEvent('button_click', { buttonId: 'subscribe' });
tracker.logEvent('form_submit', { formName: 'contact' });