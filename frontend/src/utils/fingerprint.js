// Lightweight fingerprint helper — conservative fields and localStorage
export async function makeFingerprint() {
  const existing = localStorage.getItem('fingerprint');
  if (existing) return existing;

  const data = [
    navigator.userAgent || '',
    navigator.platform || '',
    `${screen.width || 0}x${screen.height || 0}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  ].join('||');

  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(data));
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem('fingerprint', hex);
  return hex;
}

export async function ensureFingerprintOnServer(fingerprint) {
  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const res = await fetch(`${API}/api/fingerprints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprint })
  });
  if (!res.ok) throw new Error('Failed to sync fingerprint');
  return res.json(); // { fingerprintId, credits }
}

export async function linkFingerprintToUser(fingerprintId, userId) {
  if (!fingerprintId || !userId) throw new Error('fingerprintId and userId required');
  const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const res = await fetch(`${API}/api/link-fingerprint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fingerprintId, userId })
  });
  if (!res.ok) throw new Error('Failed to link fingerprint');
  return res.json(); // { credits }
}
