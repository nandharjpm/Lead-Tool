# Email Finder Flow Documentation

## Complete User Flow

### Frontend → Backend → Email Verification

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Dashboard.jsx                                      │
│                                                              │
│ User Input:                                                  │
│   - First Name: "John"                                       │
│   - Domain: "company.com"                                    │
│                                                              │
│ Action: Click "Find" button                                 │
│                                                              │
│ API Call: POST /api/find-emails                             │
│ Body: { firstName: "John", domain: "company.com" }          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: server.js                                            │
│                                                              │
│ Endpoint: POST /api/find-emails                              │
│                                                              │
│ 1. Validates input (firstName & domain required)             │
│ 2. Calls: verifyEmailsForPerson(firstName, domain)         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: emailVerifier.js                                    │
│                                                              │
│ Function: verifyEmailsForPerson(firstName, domain)         │
│                                                              │
│ Step 1: Analyze Domain with Gemini AI                        │
│   └─> analyzeDomainPattern(domain)                          │
│       • Calls Gemini API to predict email patterns          │
│       • Returns: ["firstname.lastname", "firstinitial..."]  │
│                                                              │
│ Step 2: Generate Email Candidates                            │
│   └─> generateCandidatesWithAI(firstName, domain, patterns) │
│       • Applies AI patterns to firstName                     │
│       • Generates: ["john@company.com", "j@company.com"...] │
│       • Fallback: generateCandidates() if AI fails            │
│                                                              │
│ Step 3: SMTP Verification                                    │
│   └─> For each candidate:                                    │
│       • resolveMx(domain) → Get mail server                  │
│       • smtpVerifyEmail(email, mxHost) → Verify exists       │
│       • Returns: { email, status, confidence }               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ RESPONSE: JSON                                                │
│                                                              │
│ {                                                            │
│   success: true,                                             │
│   totalFound: 5,                                             │
│   results: [                                                 │
│     { email: "john@company.com", status: "valid", ... },     │
│     { email: "j@company.com", status: "invalid", ... },     │
│     ...                                                      │
│   ]                                                          │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Display Results                                    │
│                                                              │
│ • Shows valid/invalid/risky emails                           │
│ • Displays confidence scores                                 │
│ • Allows CSV export                                          │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. Email Finder
- **Endpoint**: `POST /api/find-emails`
- **Input**: `{ firstName: string, domain: string }`
- **Output**: `{ success: boolean, totalFound: number, results: Array }`
- **Flow**: AI Pattern Analysis → Generate Candidates → SMTP Verify

### 2. Email Checker
- **Endpoint**: `POST /api/check-emails`
- **Input**: `{ emails: string[] }`
- **Output**: `{ success: boolean, totalChecked: number, results: Array }`
- **Flow**: Direct SMTP Verification (no AI needed)

## Functions Used

### Active Functions (Keep)
- ✅ `analyzeDomainPattern()` - Gemini AI domain analysis
- ✅ `generateCandidatesWithAI()` - AI-based candidate generation
- ✅ `generateCandidates()` - Fallback pattern generation
- ✅ `verifyEmailsForPerson()` - Main finder function
- ✅ `verifyMultipleEmails()` - Bulk email verification
- ✅ `resolveMx()` - DNS MX record lookup
- ✅ `smtpVerifyEmail()` - SMTP email verification


## Key Features

1. **AI-Powered Pattern Prediction**: Uses Gemini to analyze domain and predict email patterns
2. **Smart Fallback**: Falls back to default patterns if AI fails
3. **SMTP Verification**: Real-time verification via SMTP (port 25)
4. **Error Handling**: Graceful handling of SMTP unavailability
5. **Confidence Scores**: Returns confidence levels for each result

## Environment Variables

```env
GEMINI_API_KEY=your_api_key_here
PORT=5000
```
