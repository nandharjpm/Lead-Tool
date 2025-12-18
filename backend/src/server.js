import express from "express";
import cors from "cors";
import { verifyEmailsForPerson, verifyMultipleEmails, verifySingleEmail } from "./emailVerifier.js";
// import Session from "./fingerprint/visitor.model.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Finder endpoint: Generate email patterns and verify them
app.post("/api/find-emails", async (req, res) => {
  const { firstName, domain, sessionId } = req.body;

  console.log("Hit /api/find-emails with body:", req.body);

  if (!firstName || !domain) {
    return res.status(400).json({
      success: false,
      message: "Name and domain are required",
    });
  }

  try {
    // 🔑 Update session activity
    if (sessionId) {
      await updateSessionActivity(sessionId);
    }

    const results = await verifyEmailsForPerson(firstName, domain);

    return res.json({
      success: true,
      totalFound: results.length,
      results,
    });
  } catch (err) {
    console.error("Error verifying emails:", err.code || err.message);

    if (err.code === "SMTP_UNAVAILABLE") {
      return res.status(503).json({
        success: false,
        reason: "smtp_unavailable",
        message:
          "SMTP server unavailable (port 25 blocked or unreachable). Cannot verify emails.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to verify emails (MX/SMTP error)",
    });
  }
});

app.post("/api/check-emails", async (req, res) => {
  const { emails } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({
      success: false,
      message: "emails array is required and must not be empty",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails = emails.filter(email => emailRegex.test(email.trim()));
  
  if (validEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid email addresses provided",
    });
  }

  try {
    const results = await verifyMultipleEmails(validEmails.map(e => e.trim()));

    return res.json({
      success: true,
      totalChecked: results.length,
      results,
    });
  } catch (err) {
    console.error("Error checking emails:", err.code || err.message);

    if (err.code === "SMTP_UNAVAILABLE") {
      return res.status(503).json({
        success: false,
        reason: "smtp_unavailable",
        message: "SMTP server unavailable (port 25 blocked or unreachable). Cannot verify emails.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to check emails (MX/SMTP error)",
    });
  }
});

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
