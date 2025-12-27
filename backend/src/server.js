import express from "express";
import cors from "cors";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { verifyEmailsForPerson, verifyMultipleEmails, verifySingleEmail } from "./emailVerifier.js";
// import Session from "./fingerprint/visitor.model.js";

// Load .env from the backend folder (robust when server is started from repo root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });
if (result.error) {
  // fallback to default behavior (load from process.cwd())
  dotenv.config();
}

const HUNTER_API_KEY = process.env.HUNTER_API_KEY || process.env.HUNTER_KEY;
console.log('before hunter api key', HUNTER_API_KEY ? '***(present)***' : 'undefined');

const app = express();
const PORT = process.env.PORT || 5000;

const sessions = new Map();

const saveSession = (sessionId, data) => {
  sessions.set(sessionId, { ...data, lastUpdated: new Date() });
};

const getSession = (sessionId) => {
  return sessions.get(sessionId);
};

const updateSessionActivity = async (sessionId) => {
  const session = getSession(sessionId);
  if (!session) {
    const newSession = { sessionId, startTime: new Date(), pageVisits: 1, totalTimeSpent: 0, isActive: true };
    saveSession(sessionId, newSession);
    return newSession;
  }
  session.pageVisits = (session.pageVisits || 0) + 1;
  session.lastUpdated = new Date();
  saveSession(sessionId, session);
  return session;
};

app.use(cors());
app.use(express.json());

app.post("/api/find-emails", async (req, res) => {
  const { firstName, lastName, fullName, domain, sessionId } = req.body;

  console.log("Hit /api/find-emails with body:", { firstName, lastName, fullName, domain });

  const nameProvided = fullName || firstName;
  if (!nameProvided || !domain) {
    return res.status(400).json({
      success: false,
      message: "Name and domain are required",
    });
  }

  try {
    if (sessionId) {
      try {
        await updateSessionActivity(sessionId);
      } catch (e) {
        console.warn('Failed to update session activity', e?.message || e);
      }
    }
    console.log('before hunter api key', HUNTER_API_KEY ? '*** (present) ***' : 'undefined');

    // Use Hunter.io exclusively when a server-side key is configured.
    if (HUNTER_API_KEY) {
      try {
        const nameToUse = fullName ? fullName.trim() : `${firstName || ''} ${lastName || ''}`.trim();
        const parts = nameToUse.split(/\s+/).filter(Boolean);
        const f = parts[0] || '';
        const l = parts.slice(1).join(' ') || '';

        const hunterUrl = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(f)}&last_name=${encodeURIComponent(l)}&api_key=${encodeURIComponent(HUNTER_API_KEY)}`;

        const finderResp = await fetch(hunterUrl);
        if (!finderResp.ok) {
          const txt = await finderResp.text().catch(() => '');
          console.warn('Hunter API non-OK response', finderResp.status, txt);
          return res.status(502).json({ success: false, message: 'External finder service error' });
        }

        const finderJson = await finderResp.json().catch(() => null);
        if (finderJson && finderJson.data && finderJson.data.email) {
          const email = finderJson.data.email;
          const score = finderJson.data.score || finderJson.data.confidence || null;
          let status = 'risky';
          let confidence = score || 50;
          if (typeof score === 'number') {
            if (score >= 80) {
              status = 'valid';
              confidence = Math.min(95, Math.round(score));
            } else if (score < 30) {
              status = 'invalid';
              confidence = Math.max(0, Math.round(score));
            } else {
              status = 'risky';
              confidence = Math.round(score);
            }
          }

          return res.json({
            success: true,
            totalFound: 1,
            results: [{ email, status, confidence }],
            source: 'hunter',
          });
        }

        // Hunter returned OK but no email found — return a clear 404 so frontend knows there is no hunter result
        return res.status(404).json({ success: false, message: 'No email found by external finder' });
      } catch (err) {
        console.warn('Hunter API call failed:', err?.message || err);
        return res.status(502).json({ success: false, message: 'External finder request failed' });
      }
    }

    // If no hunter key is configured, return explicit error (we no longer fall back to local generation)
    return res.status(500).json({ success: false, message: 'Finder API key not configured on server' });
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
    // If SMTP unavailable, return a best-effort 'risky' suggestion for each input email
    if (err.code === "SMTP_UNAVAILABLE") {
      console.warn('SMTP unavailable, returning risky suggestions instead of error');
      const fallbackResults = validEmails.map(email => ({
        email: email.trim(),
        status: 'risky',
        confidence: 30,
        message: 'SMTP unavailable — suggestion only',
      }));

      return res.json({
        success: true,
        totalChecked: fallbackResults.length,
        results: fallbackResults,
        fallback: true,
        message: 'SMTP unavailable — returned suggestion results with low confidence'
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
