# Credit Flow Test & Documentation

This file documents the simple credit flow used in development and a small script that exercises the flow.

How it works (summary):

- Anonymous visitors create a fingerprint record via `POST /api/fingerprints` and receive `fingerprintId` and `credits` (default 3).
- The Finder endpoint `POST /api/find-emails` requires `fingerprintId` and atomically debits 1 credit per successful request.
- When credits are exhausted, `/api/find-emails` returns `403` with `reason: 'login_required'`.
- Call `POST /api/link-fingerprint` with `{ fingerprintId, userId }` to link to an account and give at least 5 credits. Frontend should call this after successful signup/login (pass the authenticated user's id, e.g., Firebase `user.uid`).

Example frontend snippet:

```js
// after login/signup
const fingerprintId = localStorage.getItem('fingerprintId');
await fetch(`${API}/api/link-fingerprint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fingerprintId, userId: user.uid })
});
```

Running the automatic test (local):

1. Make sure the backend is running and `MONGODB_URI` points to a working MongoDB instance.
2. From `backend/` run:

```bash
npm run test:credits
```

This test will:
- create a new fingerprint
- perform 3 successful finder requests
- confirm the 4th request returns `login_required`
- link fingerprint to a test user and confirm credits are >= 5

If the test exits with a non-zero code, check server logs and ensure the backend is reachable at `http://localhost:5000` (or set `API_URL` env var before running).
