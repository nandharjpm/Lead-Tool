import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import cors from "cors";
import axios from "axios";
import mongoose from 'mongoose';
import Fingerprint from './models/Fingerprint.js';
import { verifyMultipleEmails } from "./enhancedEmailVerifier.js";
import EmailSearch from './models/EmailSearch.js';
import EmailVerification from './models/EmailVerification.js';

/* -------------------- ENV SETUP -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

/* -------------------- MONGODB -------------------- */
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, { autoIndex: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error", err));
} else {
  console.warn("MONGODB_URI not set - fingerprints will not persist");
}

/* -------------------- APP SETUP -------------------- */
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* -------------------- FINGERPRINTS -------------------- */
app.post('/api/fingerprints', async (req, res) => {
  try {
    const { fingerprint } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!fingerprint) return res.status(400).json({ success: false, message: 'fingerprint required' });

    let record = await Fingerprint.findOne({ fingerprint });
    if (!record) {
      record = await Fingerprint.create({ fingerprint, ip, userAgent });
    } else {
      record.lastSeen = new Date();
      record.hits += 1;
      record.ip = ip;
      record.userAgent = userAgent;
      await record.save();
    }

    return res.json({ success: true, fingerprintId: record._id, credits: record.credits, linkedUserId: record.linkedUserId });
  } catch (err) {
    console.error('Fingerprint error', err);
    return res.status(500).json({ success: false, message: 'Failed to save fingerprint' });
  }
});

app.post('/api/link-fingerprint', async (req, res) => {
  try {
    const { fingerprintId, userId } = req.body;
    if (!fingerprintId || !userId) return res.status(400).json({ success: false, message: 'fingerprintId and userId required' });

    const record = await Fingerprint.findById(fingerprintId);
    if (!record) return res.status(404).json({ success: false, message: 'Fingerprint not found' });

    record.linkedUserId = userId;
    record.credits = Math.max(record.credits, 5);
    await record.save();

    return res.json({ success: true, credits: record.credits });
  } catch (err) {
    console.error('Link fingerprint error', err);
    return res.status(500).json({ success: false, message: 'Failed to link fingerprint' });
  }
});

/* -------------------- FIND EMAILS (HUNTER) -------------------- */
app.post("/api/find-emails", async (req, res) => {
  const { firstName, domain, fingerprintId } = req.body;

  if (!firstName || !domain) {
    return res.status(400).json({
      success: false,
      message: "Name and domain are required",
    });
  }

  const hunterApiKey = process.env.HUNTER_API_KEY;
  if (!hunterApiKey) {
    return res.status(500).json({
      success: false,
      message: "HUNTER_API_KEY not configured",
    });
  }

  // Enforce credits per fingerprint (anonymous) or linked user
  if (!fingerprintId) {
    return res.status(400).json({ success: false, message: 'fingerprintId required for usage limits' });
  }

  // Atomically debit 1 credit. If no credits remain, require login.
  const debit = await Fingerprint.findOneAndUpdate(
    { _id: fingerprintId, credits: { $gt: 0 } },
    { $inc: { credits: -1, hits: 1 }, $set: { lastSeen: new Date(), ip: req.ip, userAgent: req.get('User-Agent') } },
    { new: true }
  );

  if (!debit) {
    return res.status(403).json({ success: false, reason: 'login_required', message: 'Free credits exhausted; please sign up to continue' });
  }

  // Clean domain (remove https:// etc)
  const cleanDomain = domain.replace(/^https?:\/\//, "").trim();

  // Parse name (allow full name)
  const parts = firstName.trim().split(/\s+/);
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  console.log("last : ", last);
  try {
    const response = await axios.get(
      "https://api.hunter.io/v2/email-finder",
      {
        timeout: 10000,
        params: {
          domain: cleanDomain,
          first_name: first,
          last_name: last || "",
          api_key: hunterApiKey,
        },
      }
    );

    const emailData = response.data?.data;
    console.log("emailData : ", emailData);

    const resultObj = {
      success: true,
      totalFound: 0,
      results: []
    };

    if (!emailData || !emailData.email) {
      // Save search record (no results)
      try {
        await EmailSearch.create({
          fingerprintId,
          firstName: first,
          lastName: last || '',
          domain,
          cleanDomain,
          hunterResponse: response.data,
          results: [],
          creditsUsed: 0,
          ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.get('User-Agent')
        });
      } catch (e) {
        console.error('Failed to save EmailSearch (no results):', e);
      }

      return res.json(resultObj);
    }

    const score = typeof emailData.score === "number" ? emailData.score : 0;

    let status = "risky";
    if (score >= 90) status = "valid";
    else if (score < 60) status = "invalid";

    const foundResult = {
      email: emailData.email,
      status,
      confidence: score,
      creditsRemaining: debit.credits
    };

    // Persist search with result
    try {
      await EmailSearch.create({
        fingerprintId,
        firstName: first,
        lastName: last || '',
        domain,
        cleanDomain,
        hunterResponse: response.data,
        results: [foundResult],
        creditsUsed: 1,
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      });
    } catch (e) {
      console.error('Failed to save EmailSearch:', e);
    }

    resultObj.totalFound = 1;
    resultObj.results = [foundResult];

    return res.json(resultObj);
  } catch (err) {
    console.error("Hunter API error:", err.response?.data || err.message);

    return res.status(502).json({
      success: false,
      message: "Failed to fetch email from Hunter",
    });
  }
});

/* -------------------- CHECK EMAILS (SMTP) -------------------- */
app.post("/api/check-emails", async (req, res) => {
  const { emails } = req.body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({
      success: false,
      message: "emails array is required",
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validEmails = emails
    .map(e => e.trim())
    .filter(e => emailRegex.test(e));

  if (validEmails.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid email addresses provided",
    });
  }

  try {
    const results = await verifyMultipleEmails(validEmails);

    // Persist verification request and results
    try {
      await EmailVerification.create({
        fingerprintId: req.body.fingerprintId || null,
        requestedBy: null,
        emails: validEmails,
        results,
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.get('User-Agent')
      });
    } catch (e) {
      console.error('Failed to save EmailVerification:', e);
    }

    return res.json({
      success: true,
      totalChecked: results.length,
      results,
    });
  } catch (err) {
    console.error("Email check error:", err.code || err.message);

    if (err.code === "SMTP_UNAVAILABLE") {
      // Record failed verification event for monitoring
      try {
        await EmailVerification.create({
          fingerprintId: req.body.fingerprintId || null,
          requestedBy: null,
          emails: validEmails,
          results: [],
          ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
          userAgent: req.get('User-Agent')
        });
      } catch (e) {
        console.error('Failed to save EmailVerification (failed):', e);
      }

      return res.status(503).json({
        success: false,
        reason: "smtp_unavailable",
        message: "SMTP server unavailable (port 25 blocked)",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to verify emails",
    });
  }
});

/* -------------------- USERSDETAILS ROUTES -------------------- */
import UserDetails from './models/UserDetails.js';

// Create a new user detail
app.post('/api/usersdetails', async (req, res) => {
  try {
    const payload = req.body || {};
    // Accept common fields, keep schema flexible
    const doc = await UserDetails.create({
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      company: payload.company,
      title: payload.title,
      phone: payload.phone,
      notes: payload.notes,
      metadata: payload.metadata,
      createdByFingerprint: payload.createdByFingerprint || null,
      linkedUserId: payload.linkedUserId || null
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('Create UserDetails error', err);
    return res.status(500).json({ success: false, message: 'Failed to create user details' });
  }
});

// List / search user details (supports text q and pagination)
app.get('/api/usersdetails', async (req, res) => {
  try {
    const { q, limit = 50, skip = 0 } = req.query;
    const query = {};

    if (q) {
      query.$text = { $search: q };
    }

    const docs = await UserDetails.find(query).sort({ createdAt: -1 }).limit(Number(limit)).skip(Number(skip)).lean();
    const total = await UserDetails.countDocuments(query);

    return res.json({ success: true, total, results: docs });
  } catch (err) {
    console.error('List UserDetails error', err);
    return res.status(500).json({ success: false, message: 'Failed to list user details' });
  }
});

// Get by id
app.get('/api/usersdetails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await UserDetails.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Get UserDetails error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
});

// Update
app.put('/api/usersdetails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body || {};
    const doc = await UserDetails.findByIdAndUpdate(id, payload, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Update UserDetails error', err);
    return res.status(500).json({ success: false, message: 'Failed to update user details' });
  }
});

// Delete
app.delete('/api/usersdetails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await UserDetails.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    console.error('Delete UserDetails error', err);
    return res.status(500).json({ success: false, message: 'Failed to delete user details' });
  }
});

/* -------------------- EMAIL SEARCH / VERIFICATION LISTING -------------------- */
// List EmailSearch entries (filter by fingerprintId or text q)
app.get('/api/emailsearches', async (req, res) => {
  try {
    const { fingerprintId, q, limit = 50, skip = 0 } = req.query;
    const query = {};
    if (fingerprintId) query.fingerprintId = fingerprintId;
    if (q) query.$text = { $search: q };

    const results = await EmailSearch.find(query).sort({ createdAt: -1 }).limit(Number(limit)).skip(Number(skip)).lean();
    const total = await EmailSearch.countDocuments(query);
    return res.json({ success: true, total, results });
  } catch (err) {
    console.error('List EmailSearch error', err);
    return res.status(500).json({ success: false, message: 'Failed to list email searches' });
  }
});

// Get single EmailSearch by id
app.get('/api/emailsearches/:id', async (req, res) => {
  try {
    const doc = await EmailSearch.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Get EmailSearch error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch email search' });
  }
});

// List EmailVerification entries (filter by fingerprintId or email)
app.get('/api/emailverifications', async (req, res) => {
  try {
    const { fingerprintId, email, limit = 50, skip = 0 } = req.query;
    const query = {};
    if (fingerprintId) query.fingerprintId = fingerprintId;
    if (email) query.emails = email;

    const results = await EmailVerification.find(query).sort({ createdAt: -1 }).limit(Number(limit)).skip(Number(skip)).lean();
    const total = await EmailVerification.countDocuments(query);
    return res.json({ success: true, total, results });
  } catch (err) {
    console.error('List EmailVerification error', err);
    return res.status(500).json({ success: false, message: 'Failed to list email verifications' });
  }
});

// Get single EmailVerification by id
app.get('/api/emailverifications/:id', async (req, res) => {
  try {
    const doc = await EmailVerification.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: doc });
  } catch (err) {
    console.error('Get EmailVerification error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch email verification' });
  }
});

/* -------------------- START SERVER -------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
