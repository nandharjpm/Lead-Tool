import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import cors from "cors";
import axios from "axios";
import { verifyMultipleEmails } from "./emailVerifier.js";

/* -------------------- ENV SETUP -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

/* -------------------- APP SETUP -------------------- */
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* -------------------- FIND EMAILS (HUNTER) -------------------- */
app.post("/api/find-emails", async (req, res) => {
  const { firstName, domain } = req.body;

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
        timeout: 8000,
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

    if (!emailData || !emailData.email) {
      return res.json({
        success: true,
        totalFound: 0,
        results: [],
      });
    }

    const score = typeof emailData.score === "number" ? emailData.score : 0;

    let status = "risky";
    if (score >= 90) status = "valid";
    else if (score < 60) status = "invalid";

    return res.json({
      success: true,
      totalFound: 1,
      results: [
        {
          email: emailData.email,
          status,
          confidence: score,
        },
      ],
    });
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

    return res.json({
      success: true,
      totalChecked: results.length,
      results,
    });
  } catch (err) {
    console.error("Email check error:", err.code || err.message);

    if (err.code === "SMTP_UNAVAILABLE") {
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

/* -------------------- START SERVER -------------------- */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
