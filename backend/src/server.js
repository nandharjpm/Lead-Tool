import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

import express from "express";
import cors from "cors";
import { verifyEmailsForPerson, verifyMultipleEmails } from "./emailVerifier.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Finder endpoint: Generate email patterns and verify them
app.post("/api/find-emails", async (req, res) => {
  const { firstName, domain } = req.body;
  console.log("Hit /api/find-emails with body:", req.body);

  if (!firstName || !domain) {
    return res.status(400).json({
      success: false,
      message: "Name and domain are required",
    });
  }

  // Parse full name: split "nandhakumar s" into firstName="nandhakumar" and lastName="s"
  const nameParts = firstName.trim().split(/\s+/);
  const parsedFirstName = nameParts[0] || "";
  const parsedLastName = nameParts.slice(1).join(" ") || "";

  try {
    const results = await verifyEmailsForPerson(parsedFirstName, parsedLastName, domain);

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
        message: "SMTP server unavailable (port 25 blocked or unreachable). Cannot verify emails.",
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
