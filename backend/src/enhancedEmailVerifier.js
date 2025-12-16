import dns from "dns";
import net from "net";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolve4 = promisify(dns.resolve4);

// Disposable email domains list (common ones)
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "mailinator.com", "tempmail.com",
  "throwaway.email", "getnada.com", "mohmal.com", "temp-mail.org",
  "yopmail.com", "sharklasers.com", "grr.la", "spamgourmet.com",
  "maildrop.cc", "trashmail.com", "mintemail.com", "mytrashmail.com"
]);

// Role-based email prefixes
const ROLE_EMAILS = new Set([
  "admin", "administrator", "info", "contact", "support", "help",
  "sales", "marketing", "noreply", "no-reply", "postmaster",
  "webmaster", "hostmaster", "abuse", "security", "privacy"
]);

/**
 * Enhanced email syntax validation
 */
export function validateEmailSyntax(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "Invalid input" };
  }

  const trimmed = email.trim().toLowerCase();
  
  // RFC 5322 compliant regex (more strict)
  const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
  
  if (!emailRegex.test(trimmed)) {
    return { valid: false, reason: "Invalid email format" };
  }

  const [localPart, domain] = trimmed.split("@");
  
  // Check local part length (max 64 chars)
  if (localPart.length > 64) {
    return { valid: false, reason: "Local part too long" };
  }

  // Check domain length (max 255 chars)
  if (domain.length > 255) {
    return { valid: false, reason: "Domain too long" };
  }

  // Check for consecutive dots
  if (localPart.includes("..") || domain.includes("..")) {
    return { valid: false, reason: "Consecutive dots not allowed" };
  }

  // Check for leading/trailing dots
  if (localPart.startsWith(".") || localPart.endsWith(".") ||
      domain.startsWith(".") || domain.endsWith(".")) {
    return { valid: false, reason: "Leading/trailing dots not allowed" };
  }

  return { valid: true, email: trimmed };
}

/**
 * Check if email is disposable
 */
export function isDisposableEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.has(domain);
}

/**
 * Check if email is role-based
 */
export function isRoleEmail(email) {
  const localPart = email.split("@")[0]?.toLowerCase();
  return ROLE_EMAILS.has(localPart);
}

/**
 * Validate domain exists and has MX records
 */
export async function validateDomain(domain) {
  try {
    // Check if domain has A record (exists)
    try {
      await resolve4(domain);
    } catch (e) {
      // Domain doesn't exist
      return { valid: false, reason: "Domain does not exist" };
    }

    // Check for MX records
    try {
      const mxRecords = await resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return { valid: false, reason: "No MX records found" };
      }
      return { valid: true, mxRecords: mxRecords.sort((a, b) => a.priority - b.priority) };
    } catch (e) {
      return { valid: false, reason: "No MX records found" };
    }
  } catch (err) {
    return { valid: false, reason: "Domain validation failed" };
  }
}

/**
 * Enhanced SMTP verification with better response parsing
 */
export function smtpVerifyEmail(email, mxHost, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let step = 0;
    let buffer = "";
    let responses = [];

    const finish = (result, reason = null) => {
      if (finished) return;
      finished = true;
      try {
        socket.write("QUIT\r\n");
        setTimeout(() => socket.destroy(), 100);
      } catch (e) {}
      clearTimeout(timer);
      resolve({ result, reason, responses });
    };

    const failUnavailable = (reason) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch (e) {}
      const err = new Error(reason || "SMTP unavailable");
      err.code = "SMTP_UNAVAILABLE";
      reject(err);
    };

    const socket = net.createConnection(25, mxHost);

    const timer = setTimeout(() => {
      failUnavailable("SMTP connection timeout");
    }, timeoutMs);

    socket.on("error", (err) => {
      if (finished) return;
      
      if (
        err.code === "ECONNREFUSED" ||
        err.code === "ECONNRESET" ||
        err.code === "EHOSTUNREACH" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ENOTFOUND"
      ) {
        failUnavailable(`Connection failed: ${err.code}`);
      } else {
        finish(null, `Connection error: ${err.message}`);
      }
    });

    socket.on("data", (chunk) => {
      if (finished) return;
      
      buffer += chunk.toString();
      
      // Process complete lines (SMTP responses end with \r\n)
      const lines = buffer.split("\r\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const codeMatch = line.match(/^(\d{3})([- ]?)(.*)$/);
        if (!codeMatch) continue;
        
        const code = parseInt(codeMatch[1], 10);
        const isLastLine = codeMatch[2] === " ";
        const message = codeMatch[3].trim();
        
        responses.push({ code, message, line });
        
        // Process based on step
        if (step === 0) {
          // Initial greeting (220)
          if (code >= 200 && code < 300) {
            socket.write(`HELO ${mxHost}\r\n`);
            step = 1;
          } else {
            finish(null, `Server rejected connection: ${code} ${message}`);
          }
        } else if (step === 1) {
          // HELO response (250)
          if (code >= 200 && code < 300) {
            socket.write(`MAIL FROM:<verify@${mxHost}>\r\n`);
            step = 2;
          } else {
            finish(null, `HELO rejected: ${code} ${message}`);
          }
        } else if (step === 2) {
          // MAIL FROM response (250)
          if (code >= 200 && code < 300) {
            socket.write(`RCPT TO:<${email}>\r\n`);
            step = 3;
          } else {
            finish(null, `MAIL FROM rejected: ${code} ${message}`);
          }
        } else if (step === 3) {
          // RCPT TO response - this is the key check
          if (isLastLine) {
            if (code >= 200 && code < 300) {
              // 250 = OK, email exists
              finish(true, `Email exists (${code})`);
            } else if (code === 450) {
              // Greylisting - temporarily unavailable
              finish(null, `Greylisted (temporarily unavailable)`);
            } else if (code === 451) {
              // Temporary failure
              finish(null, `Temporary failure: ${message}`);
            } else if (code === 550 || code === 551 || code === 553) {
              // Mailbox doesn't exist
              finish(false, `Mailbox unavailable (${code})`);
            } else if (code >= 400 && code < 500) {
              // Other 4xx = likely invalid
              finish(false, `Rejected: ${code} ${message}`);
            } else {
              finish(null, `Unexpected response: ${code} ${message}`);
            }
          }
          // If not last line, continue reading multi-line response
        }
      }
    });

    socket.on("end", () => {
      if (!finished) {
        finish(null, "Connection closed unexpectedly");
      }
    });

    socket.on("close", () => {
      if (!finished && step < 3) {
        finish(null, "Connection closed before verification");
      }
    });
  });
}

/**
 * Check for catch-all domain (accepts all emails)
 */
export async function checkCatchAll(domain, mxHost) {
  try {
    // Try a random email that likely doesn't exist
    const randomEmail = `test${Date.now()}${Math.random().toString(36).substring(7)}@${domain}`;
    const result = await smtpVerifyEmail(randomEmail, mxHost, 5000);
    
    // If random email is accepted, it's likely catch-all
    if (result.result === true) {
      return { isCatchAll: true, confidence: 90 };
    }
    return { isCatchAll: false, confidence: 70 };
  } catch (e) {
    return { isCatchAll: null, confidence: 0 };
  }
}

/**
 * Comprehensive email verification
 */
export async function verifyEmailComprehensive(email) {
  const result = {
    email,
    status: "invalid",
    confidence: 0,
    checks: {
      syntax: false,
      domain: false,
      mxRecords: false,
      smtp: null,
      disposable: false,
      role: false,
      catchAll: null
    },
    reasons: []
  };

  // Step 1: Syntax validation
  const syntaxCheck = validateEmailSyntax(email);
  if (!syntaxCheck.valid) {
    result.reasons.push(syntaxCheck.reason);
    return result;
  }
  result.checks.syntax = true;
  result.confidence += 10;

  const normalizedEmail = syntaxCheck.email;
  const domain = normalizedEmail.split("@")[1];

  // Step 2: Disposable email check
  if (isDisposableEmail(normalizedEmail)) {
    result.checks.disposable = true;
    result.reasons.push("Disposable email domain");
    result.status = "risky";
    result.confidence = 20;
    return result;
  }

  // Step 3: Role-based email check
  if (isRoleEmail(normalizedEmail)) {
    result.checks.role = true;
    result.reasons.push("Role-based email (may not be individual)");
    // Don't fail, but note it
  }

  // Step 4: Domain validation
  const domainCheck = await validateDomain(domain);
  if (!domainCheck.valid) {
    result.reasons.push(domainCheck.reason);
    result.status = "invalid";
    return result;
  }
  result.checks.domain = true;
  result.checks.mxRecords = true;
  result.confidence += 20;

  const mxRecords = domainCheck.mxRecords;
  const mxHost = mxRecords[0].exchange;

  // Step 5: Catch-all detection
  try {
    const catchAllCheck = await checkCatchAll(domain, mxHost);
    result.checks.catchAll = catchAllCheck.isCatchAll;
    if (catchAllCheck.isCatchAll) {
      result.reasons.push("Domain appears to be catch-all (accepts all emails)");
      // Catch-all domains make verification less reliable
    }
  } catch (e) {
    // Ignore catch-all check errors
  }

  // Step 6: SMTP verification
  try {
    const smtpResult = await smtpVerifyEmail(normalizedEmail, mxHost);
    result.checks.smtp = smtpResult.result;

    if (smtpResult.result === true) {
      // Email exists
      result.status = "valid";
      result.confidence = 95;
      if (result.checks.catchAll) {
        result.confidence = 70; // Lower confidence for catch-all
        result.reasons.push("Verified but domain is catch-all");
      }
    } else if (smtpResult.result === false) {
      // Email doesn't exist
      result.status = "invalid";
      result.confidence = 0;
      result.reasons.push(smtpResult.reason || "Email does not exist");
    } else {
      // Uncertain
      result.status = "risky";
      result.confidence = 50;
      result.reasons.push(smtpResult.reason || "Could not verify");
    }
  } catch (err) {
    if (err.code === "SMTP_UNAVAILABLE") {
      // SMTP unavailable, but domain is valid
      result.status = "risky";
      result.confidence = 40;
      result.reasons.push("SMTP server unavailable (port may be blocked)");
    } else {
      result.status = "risky";
      result.confidence = 30;
      result.reasons.push("SMTP verification failed");
    }
  }

  return result;
}

/**
 * Verify multiple emails
 */
export async function verifyMultipleEmails(emails) {
  const results = [];
  const domainCache = new Map();

  for (const email of emails) {
    try {
      const result = await verifyEmailComprehensive(email);
      results.push({
        email: result.email,
        status: result.status,
        confidence: result.confidence,
        reasons: result.reasons,
        checks: result.checks
      });
    } catch (err) {
      results.push({
        email,
        status: "risky",
        confidence: 0,
        reasons: ["Verification error"],
        checks: {}
      });
    }
  }

  return results;
}
