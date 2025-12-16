import dns from "dns";
import net from "net";
// ---- MX lookup ----
export function resolveMx(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || !addresses.length) {
        return reject(new Error("No MX records for domain"));
      }
      const sorted = addresses.sort((a, b) => a.priority - b.priority);
      resolve(sorted[0].exchange);
    });
  });
}


export function smtpVerifyEmail(email, mxHost, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let step = 0;
    let buffer = "";

    const finish = (result) => {
      if (finished) return;
      finished = true;
      try {
        socket.end("QUIT\r\n");
      } catch (e) {}
      socket.destroy();
      clearTimeout(timer);
      resolve(result);
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
      
      failUnavailable("SMTP timeout");
    }, timeoutMs);

    socket.on("error", (err) => {
      console.error("SMTP error for", email, "->", err.code || err.message);

      if (
        err.code === "ECONNREFUSED" ||
        err.code === "ECONNRESET" ||
        err.code === "EHOSTUNREACH" ||
        err.code === "ETIMEDOUT"
      ) {
        failUnavailable(err.message);
      } else {
        finish(null);
      }
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      
      // Wait for complete response (SMTP responses end with \r\n)
      if (!buffer.includes("\r\n")) return;

      const lines = buffer.split("\r\n").filter(line => line.trim());
      if (lines.length === 0) return;
      
      // Get the last complete line (SMTP multi-line responses end with space after code)
      let responseLine = "";
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.length >= 3) {
          const lineCode = parseInt(line.slice(0, 3), 10);
          if (!isNaN(lineCode)) {
            // Check if this is the final line (no space after code = final line)
            if (line.length === 3 || line[3] !== ' ') {
              responseLine = line;
              break;
            } else {
              // This is a continuation line, keep looking
              responseLine = line;
            }
          }
        }
      }
      
      if (!responseLine) {
        buffer = "";
        return;
      }
      
      const code = parseInt(responseLine.slice(0, 3), 10) || 0;
      const message = responseLine.substring(4).trim();

      // Log SMTP responses for debugging
      if (step >= 2) {
        console.log(`SMTP [${email}]: ${code} ${message}`);
      }

      // Clear buffer after processing
      buffer = "";

      if (step === 0) {
        socket.write(`HELO example.com\r\n`);
        step = 1;
      } else if (step === 1) {
        socket.write(`MAIL FROM:<test@example.com>\r\n`);
        step = 2;
      } else if (step === 2) {
        socket.write(`RCPT TO:<${email}>\r\n`);
        step = 3;
      } else if (step === 3) {
        // SMTP response codes:
        // 2xx = Success (email exists)
        // 250 = Requested mail action okay, completed
        // 251 = User not local; will forward
        // 450 = Mailbox temporarily unavailable (greylisting - treat as valid)
        // 451 = Requested action aborted: local error (treat as uncertain)
        // 550 = Mailbox unavailable / User not found (email doesn't exist)
        // 551 = User not local (email doesn't exist)
        // 553 = Mailbox name not allowed (email doesn't exist)
        
        if (code >= 200 && code < 300) {
          // 2xx codes = valid email
          console.log(`✓ Email ${email} is VALID (code: ${code})`);
          finish(true);
        } else if (code === 450) {
          // Greylisting - temporarily unavailable but email likely exists
          console.log(`⚠ Email ${email} is likely VALID but greylisted (code: ${code})`);
          finish(true); // Treat greylisting as valid
        } else if (code === 550 || code === 551 || code === 553) {
          // Explicit rejection = email doesn't exist
          console.log(`✗ Email ${email} is INVALID (code: ${code})`);
          finish(false);
        } else if (code >= 400 && code < 500) {
          // Other 4xx codes = uncertain (could be temporary or policy)
          console.log(`? Email ${email} status UNCERTAIN (code: ${code} - ${message})`);
          finish(null);
        } else {
          // Unknown codes = uncertain
          console.log(`? Email ${email} status UNCERTAIN (unknown code: ${code} - ${message})`);
          finish(null);
        }
      }
    });

    socket.on("end", () => {
      if (!finished) finish(null);
    });
  });
}

export async function verifyMultipleEmails(emails) {
  const results = [];
  const domainMap = new Map();

  for (const email of emails) {
    const domain = email.split("@")[1];
    if (!domain) {
      results.push({ email, status: "invalid", confidence: 0 });
      continue;
    }

    try {
      let mxHost = domainMap.get(domain);
      if (!mxHost) {
        mxHost = await resolveMx(domain);
        domainMap.set(domain, mxHost);
      }

      const result = await smtpVerifyEmail(email, mxHost);
      
      if (result === true) {
        results.push({ email, status: "valid", confidence: 95 });
      } else if (result === false) {
        results.push({ email, status: "invalid", confidence: 0 });
      } else {
        results.push({ email, status: "risky", confidence: 50 });
      }
    } catch (err) {
      if (err.code === "SMTP_UNAVAILABLE") {
        throw err;
      }
      results.push({ email, status: "risky", confidence: 30 });
    }
  }

  return results;
}

export async function verifyEmailsForPerson(firstName, lastName, domain) {
  const domainTrimmed = domain.trim();
  
  // Step 1: Analyze domain with Gemini AI to predict email patterns
  console.log(`Analyzing domain patterns for: ${domainTrimmed}`);
  const aiPatterns = await analyzeDomainPattern(domainTrimmed);
  
  // Step 2: Generate candidates using AI-predicted patterns
  const candidates = aiPatterns 
    ? await generateCandidatesWithAI(firstName, lastName, domainTrimmed, aiPatterns)
    : generateCandidates(firstName, lastName, domainTrimmed);

  const fullName = lastName ? `${firstName} ${lastName}` : firstName;
  console.log(`Generated ${candidates.length} candidate emails for ${fullName}@${domainTrimmed}`);

  if (!candidates.length) {
    return candidates.map(email => ({ email, status: "invalid", confidence: 0 }));
  }

  // Step 3: Verify candidates using SMTP
  try {
    const mxHost = await resolveMx(domainTrimmed);
    const results = [];

    for (const email of candidates) {
      let result;
      try {
        result = await smtpVerifyEmail(email, mxHost);
      } catch (err) {
        if (err.code === "SMTP_UNAVAILABLE") {
          throw err;
        } else {
          result = null;
        }
      }

      if (result === true) {
        results.push({ email, status: "valid", confidence: 95 });
      } else if (result === false) {
        results.push({ email, status: "invalid", confidence: 0 });
      } else {
        results.push({ email, status: "risky", confidence: 50 });
      }
    }

    return results;
  } catch (err) {
    if (err.code === "SMTP_UNAVAILABLE") {
      throw err;
    }
    return candidates.map(email => ({ email, status: "risky", confidence: 30 }));
  }
}