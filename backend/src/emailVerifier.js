import dns from "dns";
import net from "net";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Lazy initialization of Gemini AI to ensure env vars are loaded
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

// ---- Gemini AI: Analyze domain and predict email patterns ----
export async function analyzeDomainPattern(domain) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY not set, falling back to default patterns");
    return null;
  }

  try {
    const genAI = getGenAI();
    if (!genAI) {
      console.warn("Failed to initialize Gemini AI, falling back to default patterns");
      return null;
    }
    
    
    let model;
    const modelNames = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];
    let modelError = null;
    
    for (const modelName of modelNames) {
      try {
        model = genAI.getGenerativeModel({ model: modelName });
        if (model && typeof model.generateContent === 'function') {
          console.log(`✓ Using model: ${modelName}`);
          break;
        }
      } catch (err) {
        modelError = err;
        continue;
      }
    }
    
    // If no model worked, throw a clear error
    if (!model) {
      const errorMsg = modelError ? modelError.message : "No valid model found";
      console.error(`Failed to initialize any Gemini model. Last error: ${errorMsg}`);
      throw new Error(`Gemini API Error: ${errorMsg}. Please enable Generative Language API in Google Cloud Console.`);
    }
    
    const prompt = `You are an email pattern expert. Analyze the domain "${domain}" and predict the most common email address patterns used by this organization.

Based on the domain name, company type, industry standards, and common email conventions, provide a JSON array of the most likely email patterns this domain uses.

Consider:
- Company size and type (tech, healthcare, finance, education, startup, etc.)
- Common email conventions (firstname.lastname, firstname_lastname, firstinitial.lastname, firstname-lastname, etc.)
- Industry standards and best practices
- Domain characteristics and naming conventions

Return ONLY a JSON array of pattern strings using these placeholders:
- "firstname" = full first name
- "firstinitial" or "firstchar" = first character of first name
- "lastname" = last name (if available, otherwise empty)
- "lastinitial" or "lastchar" = last character of first name

Pattern examples (prioritize firstname.lastname when lastname is available):
["firstname.lastname", "firstname_lastname", "firstinitial.lastname", "firstname", "firstname-lastname", "firstinitiallastname", "firstname.lastinitial"]

IMPORTANT: If the user provides both firstname and lastname, "firstname.lastname" is the MOST COMMON pattern (e.g., "john.doe@company.com").

Domain-specific examples:
- For "google.com": ["firstname.lastname", "firstinitiallastname"]
- For "microsoft.com": ["firstname.lastname", "firstinitiallastname"]
- For "startup.com": ["firstname.lastname", "firstname"]
- For "university.edu": ["firstname.lastname", "firstinitial.lastname"]

Domain: ${domain}
Return ONLY a valid JSON array, no markdown, no code blocks, no explanations:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // Clean up response - remove markdown code blocks if present
    let cleanedText = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Extract JSON array from response
    const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const patterns = JSON.parse(jsonMatch[0]);
      console.log(`AI predicted ${patterns.length} patterns for ${domain}:`, patterns);
      return patterns;
    }
    
    console.warn(`Could not parse AI response for ${domain}:`, text.substring(0, 100));
    return null;
  } catch (error) {
    console.error("Error analyzing domain pattern with Gemini:", error.message);
    
    // Check for specific error types
    if (error.message.includes("Cannot read properties of undefined") || error.message.includes("undefined")) {
      console.error("⚠️  Model initialization failed. This usually means:");
      console.error("   1. Generative Language API is not enabled");
      console.error("   2. API key is invalid or doesn't have permissions");
      console.error("   3. The SDK cannot access the model");
      console.error("");
      console.error("📋 Solution: Enable Generative Language API in Google Cloud Console");
      console.error("   See: backend/ENABLE_GEMINI_API.md for detailed instructions");
    } else if (error.message.includes("403") || error.message.includes("Forbidden") || error.message.includes("API Key")) {
      console.error("⚠️  Gemini API Key issue detected. Please verify:");
      console.error("   1. API key is valid and not expired");
      console.error("   2. API key has proper permissions");
      console.error("   3. API key format is correct (starts with 'AIza')");
      console.error(`   Current key starts with: ${apiKey.substring(0, 10)}...`);
    } else if (error.message.includes("404") || error.message.includes("not found")) {
      console.error("⚠️  Model not found. This usually means:");
      console.error("   1. Generative Language API is not enabled in Google Cloud Console");
      console.error("   2. API key doesn't have access to Gemini models");
      console.error("   3. The API key project doesn't have the API enabled");
      console.error("");
      console.error("📋 To fix this:");
      console.error("   1. Go to: https://console.cloud.google.com/");
      console.error("   2. Select your project (or create one)");
      console.error("   3. Navigate to: APIs & Services > Library");
      console.error("   4. Search for: 'Generative Language API'");
      console.error("   5. Click 'Enable' and wait a few minutes");
      console.error("   6. Or get a new API key from: https://makersuite.google.com/app/apikey");
    }
    
    return null;
  }
}

// ---- Generate candidates based on AI-predicted patterns ----
export async function generateCandidatesWithAI(firstName, lastName, domain, aiPatterns) {
  const f = (firstName || "").toLowerCase().trim();
  const l = (lastName || "").toLowerCase().trim();
  const d = (domain || "").toLowerCase().trim();

  if (!f || !d) {
    return [];
  }

  const firstChar = f.charAt(0);
  const lastChar = f.charAt(f.length - 1);
  const lastInitial = l ? l.charAt(0) : "";
  const patterns = new Set();

  // If AI patterns are available, use them
  if (aiPatterns && aiPatterns.length > 0) {
    for (const pattern of aiPatterns) {
      try {
        // Replace pattern placeholders with actual values
        let email = pattern
          .toLowerCase()
          .replace(/firstname/gi, f)
          .replace(/firstinitial/gi, firstChar)
          .replace(/firstchar/gi, firstChar)
          .replace(/lastname/gi, l) // Now we have lastName
          .replace(/lastinitial/gi, lastInitial || lastChar) // Use lastInitial if available, else lastChar
          .replace(/lastchar/gi, lastInitial || lastChar);
        
        // Clean up any double separators (e.g., ".." or "--")
        email = email.replace(/[._-]{2,}/g, (match) => match[0]);
        // Remove leading/trailing separators
        email = email.replace(/^[._-]+|[._-]+$/g, "");
        
        // Only add if email is valid (not empty, no double separators)
        if (email && email.length > 0 && !email.includes("..") && !email.includes("--") && !email.includes("__")) {
          patterns.add(`${email}@${d}`);
        }
      } catch (e) {
        console.warn(`Error processing pattern ${pattern}:`, e.message);
      }
    }
  }

  // Always include some common fallback patterns (in case AI fails or returns few patterns)
  patterns.add(`${f}@${d}`);
  patterns.add(`${firstChar}@${d}`);
  
  // If we have lastName, add firstname.lastname pattern (most common!)
  if (l) {
    patterns.add(`${f}.${l}@${d}`); // nandhakumar.s@ardhas.com
    patterns.add(`${f}_${l}@${d}`);
    patterns.add(`${f}-${l}@${d}`);
    patterns.add(`${firstChar}.${l}@${d}`);
    patterns.add(`${firstChar}${l}@${d}`);
  }
  
  patterns.add(`${firstChar}.${f}@${d}`);
  patterns.add(`${f}.${firstChar}@${d}`);
  patterns.add(`${firstChar}${f}@${d}`);

  return Array.from(patterns);
}

// ---- Original pattern-based generation (fallback) ----
export function generateCandidates(firstName, lastName, domain) {
  const f = (firstName || "").toLowerCase().trim();
  const l = (lastName || "").toLowerCase().trim();
  const d = (domain || "").toLowerCase().trim();

  if (!f || !d) {
    return [];
  }

  const firstChar = f.charAt(0);
  const lastChar = f.charAt(f.length - 1);
  const lastInitial = l ? l.charAt(0) : "";

  const patterns = new Set();

  // Basic patterns
  patterns.add(`${f}@${d}`);                 // nandhakumar@domain.com
  patterns.add(`${firstChar}@${d}`);         // n@domain.com
  
  // Most important: firstname.lastname pattern (when lastName is available)
  if (l) {
    patterns.add(`${f}.${l}@${d}`);         // nandhakumar.s@ardhas.com (MOST COMMON!)
    patterns.add(`${f}_${l}@${d}`);          // nandhakumar_s@ardhas.com
    patterns.add(`${f}-${l}@${d}`);          // nandhakumar-s@ardhas.com
    patterns.add(`${firstChar}.${l}@${d}`);  // n.s@ardhas.com
    patterns.add(`${firstChar}${l}@${d}`);   // ns@ardhas.com
    patterns.add(`${f}${l}@${d}`);          // nandhakumars@ardhas.com
  }
  
  patterns.add(`${lastChar}@${d}`);          // r@domain.com
  
  // Dot-separated patterns
  patterns.add(`${firstChar}.${f}@${d}`);    // j.john@domain.com
  patterns.add(`${f}.${firstChar}@${d}`);    // john.j@domain.com
  patterns.add(`${lastChar}.${f}@${d}`);     // n.john@domain.com
  patterns.add(`${f}.${lastChar}@${d}`);     // john.n@domain.com
  
  // Dash-separated patterns
  patterns.add(`${firstChar}-${f}@${d}`);    // j-john@domain.com
  patterns.add(`${f}-${firstChar}@${d}`);    // john-j@domain.com
  patterns.add(`${lastChar}-${f}@${d}`);     // n-john@domain.com
  patterns.add(`${f}-${lastChar}@${d}`);     // john-n@domain.com
  
  // Underscore-separated patterns (common in emails)
  patterns.add(`${firstChar}_${f}@${d}`);    // j_john@domain.com
  patterns.add(`${f}_${firstChar}@${d}`);    // john_j@domain.com
  patterns.add(`${lastChar}_${f}@${d}`);     // n_john@domain.com
  patterns.add(`${f}_${lastChar}@${d}`);     // john_n@domain.com      

  const n = f.length;
  const maxMask = 1 << (n - 1);

  for (let mask = 0; mask < maxMask; mask++) {
    let local = "";

    for (let i = 0; i < n; i++) {
      local += f[i];

      if (i < n - 1 && (mask & (1 << i))) {
        local += ".";
      }
    }

    patterns.add(`${local}@${d}`);
  }

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