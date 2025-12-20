#!/usr/bin/env node
// Simple test script for credit flow. Requires backend to be running on localhost:5000
// Usage: node src/scripts/test-credit-flow.js

const API = process.env.API_URL || 'http://localhost:5000';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const fingerprint = `testfp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  console.log('Using fingerprint:', fingerprint);

  // Create fingerprint record
  let res = await fetch(`${API}/api/fingerprints`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint })
  });
  const body = await res.json();
  if (!res.ok) throw new Error('Failed to create fingerprint: ' + JSON.stringify(body));
  const fingerprintId = body.fingerprintId;
  console.log('fingerprintId:', fingerprintId, 'credits:', body.credits);

  // Call /api/find-emails 3 times
  for (let i = 1; i <= 3; i++) {
    res = await fetch(`${API}/api/find-emails`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Jane', domain: 'example.com', fingerprintId })
    });
    const data = await res.json();
    console.log(`attempt ${i}: status=${res.status}`, data.message || data);
    if (!res.ok) throw new Error('Expected success on attempts 1-3');
    await sleep(200);
  }

  // 4th attempt should fail with login_required
  res = await fetch(`${API}/api/find-emails`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Jane', domain: 'example.com', fingerprintId })
  });
  const data = await res.json();
  console.log('attempt 4:', res.status, data);
  if (res.status !== 403 && data.reason !== 'login_required') {
    throw new Error('Expected login_required on 4th attempt');
  }

  // Link fingerprint to user and expect credits >=5
  res = await fetch(`${API}/api/link-fingerprint`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprintId, userId: 'test-user-1' })
  });
  const linkBody = await res.json();
  if (!res.ok) throw new Error('Failed to link fingerprint: ' + JSON.stringify(linkBody));
  console.log('linked, credits:', linkBody.credits);
  if (typeof linkBody.credits !== 'number' || linkBody.credits < 5) throw new Error('Expected credits >= 5 after linking');

  // After linking, should be able to search
  res = await fetch(`${API}/api/find-emails`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'Jane', domain: 'example.com', fingerprintId })
  });
  const postLink = await res.json();
  console.log('post-link attempt:', res.status, postLink);
  if (!res.ok) throw new Error('Expected success after linking');

  console.log('Credit flow test completed successfully');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
