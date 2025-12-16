# Email Verification Flow

## Overview
This project uses **SMTP (Simple Mail Transfer Protocol) verification** to verify email addresses in real-time.

## Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. EMAIL IDENTIFICATION (generateCandidates)                │
│    Input: firstName + domain                                 │
│    Output: Array of candidate email patterns                │
│    Examples: john@domain.com, j.john@domain.com, etc.       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. MX RECORD LOOKUP (resolveMx)                             │
│    Uses DNS to find mail exchange server                    │
│    Example: domain.com → mail.domain.com (priority 10)       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. SMTP VERIFICATION (smtpVerifyEmail)                      │
│    Connects to MX server on port 25                         │
│    Performs SMTP handshake:                                  │
│    ├─ HELO example.com                                       │
│    ├─ MAIL FROM:<test@example.com>                           │
│    └─ RCPT TO:<email@domain.com>  ← Checks if email exists  │
│                                                                 │
│    Response Codes:                                           │
│    ├─ 200-299: ✅ Valid (email exists)                      │
│    ├─ 550/551/553: ❌ Invalid (email doesn't exist)        │
│    └─ Other: ⚠️ Risky/Uncertain                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. RESULT                                                    │
│    Returns: { email, status, confidence }                   │
│    Status: "valid" | "invalid" | "risky"                    │
│    Confidence: 0-95%                                         │
└─────────────────────────────────────────────────────────────┘
```

## Key Functions

### 1. `generateCandidates(firstName, domain)`
- **Purpose**: Generate potential email patterns
- **Method**: Pattern matching (no network calls)
- **Output**: Array of candidate emails

### 2. `resolveMx(domain)`
- **Purpose**: Find mail server for domain
- **Method**: DNS MX record lookup
- **Output**: MX hostname (e.g., "mail.google.com")

### 3. `smtpVerifyEmail(email, mxHost)`
- **Purpose**: Verify if email exists
- **Method**: Direct SMTP connection (port 25)
- **Output**: `true` (valid), `false` (invalid), `null` (uncertain)

## Verification Methods Used

✅ **SMTP Verification** (Primary method)
- Real-time verification
- Direct connection to mail server
- Most accurate method
- Requires port 25 access

❌ **NOT Used:**
- Regex validation only
- API-based verification services
- Email sending verification
- Disposable email detection

## Limitations

1. **Port 25 Blocking**: Many ISPs/cloud providers block port 25
   - Error: `SMTP_UNAVAILABLE`
   - Solution: Run from server with port 25 access

2. **Rate Limiting**: Some SMTP servers limit verification attempts
   - May return uncertain results

3. **Greylisting**: Some servers temporarily reject emails
   - May show false negatives

4. **Privacy**: Some servers don't reveal if email exists
   - Returns uncertain/risky status

## Example Usage

```javascript
// Find emails for a person
const results = await verifyEmailsForPerson("john", "example.com");
// Returns: [{ email: "john@example.com", status: "valid", confidence: 95 }, ...]

// Verify single email
const result = await verifySingleEmail("test@example.com");
// Returns: { email: "test@example.com", status: "valid", confidence: 95 }

// Verify multiple emails
const results = await verifyMultipleEmails(["email1@domain.com", "email2@domain.com"]);
// Returns: Array of verification results
```
