# UsersDetails API

This document describes the `usersdetails` Mongoose model and the REST endpoints to create, list, fetch, update and delete documents.

## Model fields
- firstName
- lastName
- email
- company
- title
- phone
- notes
- metadata (freeform JSON)
- createdByFingerprint (optional)
- linkedUserId (optional)

## Endpoints
- POST /api/usersdetails
  - Create a document. Send JSON body with fields above.
- GET /api/usersdetails?q=<text>&limit=50&skip=0
  - List documents, optional text search using `q`.
- GET /api/usersdetails/:id
  - Fetch a document by its ObjectId.
- PUT /api/usersdetails/:id
  - Update a document (partial update allowed).
- DELETE /api/usersdetails/:id
  - Delete a document by id.

## Local testing
1. Copy `.env.example` to `.env` and set `MONGODB_URI` to your Atlas connection string or local MongoDB.
2. Start backend: `npm run dev` from `backend/`.
3. Run the simple test script: `npm run test:users` (it will create, fetch, update, delete a test document).

**Note:** Do not commit `.env` with credentials. Use environment variables or your CI secret manager for production.
