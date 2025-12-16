# SMTP Response Codes Explained

## What is Greylisting?

**Greylisting** is an anti-spam technique used by mail servers to temporarily reject emails from unknown senders.

### How it works:
1. **First attempt**: When you try to verify an email, the server responds with code **450** (temporarily unavailable)
2. **Legitimate mail servers**: Will retry sending after a few minutes (usually 5-15 minutes)
3. **Spam bots**: Usually don't retry, so they're blocked
4. **Second attempt**: If the sender retries, the email is accepted

### Example:
```
You: RCPT TO:<nandhakumar.s@ardhas.com>
Server: 450 Mailbox temporarily unavailable (greylisting)
```

**What this means**: The email likely EXISTS, but the server is being cautious. After a retry, it would be accepted.

**In our code**: We treat greylisting (450) as **VALID** because it indicates the email exists, just needs a retry.

---

## What is Temporary Failure?

**Temporary Failure** (code 451) means the mail server encountered a temporary problem and couldn't verify the email right now.

### Common causes:
1. **Server overload**: Too many requests at once
2. **Network issues**: Connection problems between servers
3. **Rate limiting**: Server is limiting verification attempts
4. **Maintenance**: Server is temporarily down for maintenance
5. **DNS issues**: Temporary DNS resolution problems

### Example:
```
You: RCPT TO:<nandhakumar.s@ardhas.com>
Server: 451 Requested action aborted: local error in processing
```

**What this means**: The email might exist, but we can't verify it right now. Try again later.

**In our code**: We mark this as **RISKY** (uncertain) because we don't know if the email exists or not.

---

## SMTP Response Code Reference

### Success Codes (2xx) - Email EXISTS ✅
- **250**: Requested mail action okay, completed
- **251**: User not local; will forward to another server
- **252**: Cannot VRFY user, but will accept message and attempt delivery

**Meaning**: The email address exists and can receive mail.

---

### Temporary Failure Codes (4xx) - Uncertain ⚠️

#### 450 - Greylisting (Treated as VALID in our code)
- **450**: Mailbox temporarily unavailable
- **Cause**: Anti-spam greylisting
- **Action**: Email likely exists, just needs retry
- **Our handling**: Mark as **VALID** (95% confidence)

#### 451 - Temporary Failure (Treated as RISKY)
- **451**: Requested action aborted: local error in processing
- **Cause**: Server overload, network issues, rate limiting
- **Action**: Try again later
- **Our handling**: Mark as **RISKY** (50% confidence)

#### 452 - Insufficient Storage
- **452**: Requested action not taken: insufficient system storage
- **Cause**: Mailbox is full
- **Action**: Email exists but can't receive mail
- **Our handling**: Mark as **RISKY** (50% confidence)

#### 421 - Service Not Available
- **421**: Service not available, closing transmission channel
- **Cause**: Server is shutting down or overloaded
- **Action**: Try again later
- **Our handling**: Mark as **RISKY** (50% confidence)

---

### Permanent Failure Codes (5xx) - Email DOESN'T EXIST ❌

#### 550 - Mailbox Unavailable
- **550**: Mailbox unavailable / User not found
- **Cause**: Email address doesn't exist
- **Our handling**: Mark as **INVALID** (0% confidence)

#### 551 - User Not Local
- **551**: User not local; please try forwarding path
- **Cause**: Email doesn't exist on this server
- **Our handling**: Mark as **INVALID** (0% confidence)

#### 553 - Mailbox Name Not Allowed
- **553**: Mailbox name not allowed / Mailbox name syntax incorrect
- **Cause**: Invalid email format or doesn't exist
- **Our handling**: Mark as **INVALID** (0% confidence)

#### 552 - Exceeded Storage Allocation
- **552**: Exceeded storage allocation
- **Cause**: Mailbox is full (but email exists)
- **Our handling**: Mark as **RISKY** (50% confidence) - email exists but can't receive

---

## How Our Code Handles These

```javascript
if (code >= 200 && code < 300) {
  // 2xx = Valid email ✅
  status: "valid", confidence: 95
}
else if (code === 450) {
  // Greylisting = Valid (needs retry) ✅
  status: "valid", confidence: 95
}
else if (code === 550 || code === 551 || code === 553) {
  // Explicit rejection = Invalid ❌
  status: "invalid", confidence: 0
}
else if (code >= 400 && code < 500) {
  // Other 4xx = Uncertain ⚠️
  status: "risky", confidence: 50
}
```

---

## Why Your Email Shows as "Risky"

If `nandhakumar.s@ardhas.com` shows as **risky** (50% confidence), it means:

1. **The server returned a 4xx code** (not 250 or 450)
   - Could be 451 (temporary failure)
   - Could be 452 (storage issue)
   - Could be 421 (service unavailable)

2. **The server might be:**
   - Rate limiting verification attempts
   - Overloaded
   - Using strict anti-spam policies
   - Blocking verification attempts from your IP

3. **What to do:**
   - Check the console logs to see the exact response code
   - The email likely EXISTS (otherwise you'd get 550/551/553)
   - Try again later or from a different IP
   - Consider the email as "probably valid" if it's showing risky

---

## Best Practices

1. **Don't verify too frequently** - Servers may rate limit you
2. **Respect greylisting** - Wait and retry if you get 450
3. **Handle temporary failures gracefully** - Mark as risky, not invalid
4. **Log response codes** - Helps diagnose issues
5. **Use retry logic** - For 450/451 codes, retry after a delay

---

## Summary

| Code | Meaning | Our Status | Confidence |
|------|---------|------------|------------|
| 250 | Success | ✅ Valid | 95% |
| 450 | Greylisting | ✅ Valid | 95% |
| 451 | Temporary failure | ⚠️ Risky | 50% |
| 550 | User not found | ❌ Invalid | 0% |
| 551 | User not local | ❌ Invalid | 0% |
| 553 | Mailbox not allowed | ❌ Invalid | 0% |

**Key Takeaway**: If you see "risky" with 50% confidence, the email likely EXISTS but the server is being cautious or having temporary issues. It's better to mark it as risky than invalid.
