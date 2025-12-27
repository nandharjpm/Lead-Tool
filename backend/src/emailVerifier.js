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
// Return an array of MX hostnames sorted by priority (lowest first)
export function resolveMxHosts(domain) {
  return new Promise((resolve, reject) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || !addresses.length) {
        return reject(new Error("No MX records for domain"));
      }
      const sorted = addresses.sort((a, b) => a.priority - b.priority).map(a => a.exchange);
      resolve(sorted);
    });
  });
}


function smtpVerifyAtAddress(email, address, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let finished = false;
    let step = 0;
    let buffer = "";

    const cleanup = (socket, timer) => {
      try { socket.end("QUIT\r\n"); } catch (e) {}
      try { socket.destroy(); } catch (e) {}
      clearTimeout(timer);
    };

    const finish = (result, socket, timer) => {
      if (finished) return;
      finished = true;
      cleanup(socket, timer);
      resolve(result);
    };

    const failUnavailable = (reason, socket, timer) => {
      if (finished) return;
      finished = true;
      cleanup(socket, timer);
      const err = new Error(reason || "SMTP unavailable");
      err.code = "SMTP_UNAVAILABLE";
      reject(err);
    };

    const socket = net.createConnection({ host: address, port: 25 });

    const timer = setTimeout(() => {
      failUnavailable("SMTP timeout", socket, timer);
    }, timeoutMs);

    socket.on("error", (err) => {
      // network level errors — report as unavailable so caller can try other hosts
      if (err && (err.code === "ECONNREFUSED" || err.code === "ECONNRESET" || err.code === "EHOSTUNREACH" || err.code === "ETIMEDOUT" || err.code === 'ENETUNREACH')) {
        return failUnavailable(err.message || String(err), socket, timer);
      }

      // other errors — resolve null (indeterminate)
      console.error("SMTP socket error for", email, "->", err && (err.code || err.message));
      finish(null, socket, timer);
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
          finish(true, socket, timer);
        } else if (code === 550 || code === 551 || code === 553) {
          finish(false, socket, timer);
        } else {
          finish(null, socket, timer);
        }
      }
    });

    socket.on("end", () => {
      if (!finished) finish(null, socket, timer);
    });
  });
}

// Try to verify an email by resolving all addresses for a given MX host and attempting each one.
async function tryVerifyAgainstMxHost(email, mxHost, timeoutMs = 15000) {
  try {
    const addrs = await new Promise((resolve, reject) => {
      dns.lookup(mxHost, { all: true }, (err, addresses) => {
        if (err || !addresses || !addresses.length) return reject(err || new Error('No addresses'));
        resolve(addresses);
      });
    });

    // prefer IPv4 addresses first
    addrs.sort((a, b) => (a.family === 4 ? -1 : 1));

    let lastErr = null;
    for (const addr of addrs) {
      try {
        const result = await smtpVerifyAtAddress(email, addr.address, timeoutMs);
        return result; // true/false/null
      } catch (err) {
        lastErr = err;
        if (err && err.code === 'SMTP_UNAVAILABLE') {
          // try next address or MX host
          continue;
        } else {
          // non-network fatal error, continue trying addresses
          continue;
        }
      }
    }

    // if we reach here and lastErr is SMTP_UNAVAILABLE, bubble it up
    if (lastErr && lastErr.code === 'SMTP_UNAVAILABLE') throw lastErr;
    return null;
  } catch (err) {
    // DNS or lookup failure — treat as unavailable for this host
    const e = new Error(err && (err.message || String(err)) || 'Lookup failed');
    e.code = 'SMTP_UNAVAILABLE';
    throw e;
  }
}

export async function verifySingleEmail(email) {
  const domain = email.split("@")[1];
  if (!domain) {
    return { email, status: "invalid", confidence: 0, message: "Invalid email format" };
  }

  try {
    const mxHosts = await resolveMxHosts(domain);

    let lastNetworkErr = null;
    for (const mx of mxHosts) {
      try {
        const result = await tryVerifyAgainstMxHost(email, mx, 15000);
        if (result === true) return { email, status: "valid", confidence: 95 };
        if (result === false) return { email, status: "invalid", confidence: 0 };
        // result === null -> indeterminate, try next MX
      } catch (err) {
        if (err && err.code === 'SMTP_UNAVAILABLE') {
          lastNetworkErr = err;
          continue; // try next MX
        }
        // unexpected, continue
        continue;
      }
    }

    // If we exhausted MX hosts and had a network-level error, propagate it (caller may fallback)
    if (lastNetworkErr) {
      throw lastNetworkErr;
    }

    return { email, status: "risky", confidence: 50 };
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
      let mxHosts = domainMap.get(domain);
      if (!mxHosts) {
        try {
          mxHosts = await resolveMxHosts(domain);
        } catch (mxErr) {
          // Could not resolve MX for domain — treat as risky suggestion
          console.warn(`No MX records for domain ${domain}:`, mxErr && mxErr.message);
          domainMap.set(domain, []);
          mxHosts = [];
        }
        domainMap.set(domain, mxHosts);
      }

      let determined = false;
      let lastNetworkErr = null;

      if (mxHosts && mxHosts.length) {
        for (const mx of mxHosts) {
          try {
            const r = await tryVerifyAgainstMxHost(email, mx, 15000);
            if (r === true) {
              results.push({ email, status: "valid", confidence: 95, source: 'smtp' });
              determined = true;
              break;
            }
            if (r === false) {
              results.push({ email, status: "invalid", confidence: 0, source: 'smtp' });
              determined = true;
              break;
            }
            // r === null -> indeterminate; try next MX
          } catch (err) {
            if (err && err.code === 'SMTP_UNAVAILABLE') {
              lastNetworkErr = err;
              // try next MX host
              continue;
            }
            // otherwise continue trying
            continue;
          }
        }
      }

      if (!determined) {
        if (lastNetworkErr) {
          // Network-level SMTP problems: don't throw — return low-confidence suggestion
          console.warn('SMTP network errors when verifying', email, 'lastError:', lastNetworkErr && lastNetworkErr.message);
          results.push({ email, status: 'risky', confidence: 30, message: 'SMTP unavailable — suggestion only' });
        } else {
          // No definitive SMTP result but no network errors either
          results.push({ email, status: 'risky', confidence: 50, message: 'Indeterminate via SMTP' });
        }
      }
    } catch (err) {
      // Any unexpected error — return risky suggestion
      console.error('Unexpected error verifying', email, err && (err.message || err));
      results.push({ email, status: 'risky', confidence: 30, message: 'Verification failed, suggestion only' });
    }
  }

  return results;
}

export async function verifyEmailsForPerson(firstName, domain) {
  const candidates = generateCandidates(firstName, domain.trim());

  if (!candidates.length) {
    return candidates.map(email => ({ email, status: "invalid", confidence: 0 }));
  }
  const results = [];
  try {
    let mxHosts = [];
    try {
      mxHosts = await resolveMxHosts(domain.trim());
    } catch (mxErr) {
      console.warn(`No MX for domain ${domain.trim()} while generating candidates:`, mxErr && mxErr.message);
      mxHosts = [];
    }

    for (const email of candidates) {
      let determined = false;
      let lastNetworkErr = null;

      if (mxHosts && mxHosts.length) {
        for (const mx of mxHosts) {
          try {
            const r = await tryVerifyAgainstMxHost(email, mx, 15000);
            if (r === true) {
              results.push({ email, status: "valid", confidence: 95, source: 'smtp' });
              determined = true;
              break;
            }
            if (r === false) {
              results.push({ email, status: "invalid", confidence: 0, source: 'smtp' });
              determined = true;
              break;
            }
            // r === null -> indeterminate; try next MX
          } catch (err) {
            if (err && err.code === 'SMTP_UNAVAILABLE') {
              lastNetworkErr = err;
              continue;
            }
            continue;
          }
        }
      }

      if (!determined) {
        if (lastNetworkErr) {
          console.warn('SMTP network errors for candidate', email, lastNetworkErr && lastNetworkErr.message);
          results.push({ email, status: 'risky', confidence: 30, message: 'SMTP unavailable — suggestion only' });
        } else {
          results.push({ email, status: 'risky', confidence: 50 });
        }
      }
    }

    return results;
  } catch (err) {
    console.error('Unexpected error in verifyEmailsForPerson', err && (err.message || err));
    return candidates.map(email => ({ email, status: 'risky', confidence: 30, message: 'Verification failed' }));
  }
}