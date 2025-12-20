// NOTE: legacy file converted to ESM stub.
// The project now uses `src/models/Fingerprint.js` and routes in `src/server.js` for fingerprint and credit behavior.

export function legacyFingerprintModuleDeprecated() {
  return {
    message: 'Deprecated - use src/models/Fingerprint.js and server routes'
  };

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