import dns from "dns";
import net from "net";

export function generateCandidates(firstName, domain) {
  const f = (firstName || "").toLowerCase().trim();
  const d = (domain || "").toLowerCase().trim();

  if (!f || !d) {
    return [];
  }

  const firshtChar = f.charAt(0);
  const lastChar = f.charAt(f.length - 1);


  const patterns = new Set();
  patterns.add(`${f}@${d}`);           
  patterns.add(`${firshtChar}@${d}`);    
  patterns.add(`${firshtChar}.${f}@${d}`);
  patterns.add(`${f}.${firshtChar}@${d}`);
  patterns.add(`${firshtChar}-${f}@${d}`);
  patterns.add(`${firshtChar}${f}@${d}`);
  patterns.add(`${lastChar}@${d}`);    
  patterns.add(`${lastChar}.${f}@${d}`);
  patterns.add(`${lastChar}-${f}@${d}`);
  patterns.add(`${f}.${lastChar}@${d}`);
  patterns.add(`${lastChar}${f}@${d}`);

  return Array.from(patterns);
}

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
      if (!buffer.includes("\n")) return;

      const lines = buffer.trim().split("\n");
      const lastLine = lines[lines.length - 1].trim();
      const code = parseInt(lastLine.slice(0, 3), 10) || 0;

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
        
        if (code >= 200 && code < 300) {
          finish(true);
        } else if (code === 550 || code === 551 || code === 553) {
          finish(false);
        } else {
          finish(null);
        }
      }
    });

    socket.on("end", () => {
      if (!finished) finish(null);
    });
  });
}

export async function verifySingleEmail(email) {
  const domain = email.split("@")[1];
  if (!domain) {
    return { email, status: "invalid", confidence: 0, message: "Invalid email format" };
  }

  try {
    const mxHost = await resolveMx(domain);
    const result = await smtpVerifyEmail(email, mxHost);
    
    if (result === true) {
      return { email, status: "valid", confidence: 95 };
    } else if (result === false) {
      return { email, status: "invalid", confidence: 0 };
    } else {
      return { email, status: "risky", confidence: 50 };
    }
  } catch (err) {
    if (err.code === "SMTP_UNAVAILABLE") {
      throw err;
    }
    return { email, status: "risky", confidence: 30, message: "Could not verify" };
  }
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

export async function verifyEmailsForPerson(firstName, domain) {
  const candidates = generateCandidates(firstName, domain.trim());

  if (!candidates.length) {
    return candidates.map(email => ({ email, status: "invalid", confidence: 0 }));
  }

  try {
    const mxHost = await resolveMx(domain.trim());
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