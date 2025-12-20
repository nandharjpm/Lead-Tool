import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Navbar from "./components/Navbar";
import { makeFingerprint, ensureFingerprintOnServer } from './utils/fingerprint';

function App() {
  useEffect(() => {
    let mounted = true;

    async function initFingerprint() {
      try {
        const fp = await makeFingerprint();
        // Avoid repeated calls if already present
        const existingId = localStorage.getItem('fingerprintId');
        if (existingId) return;

        const res = await ensureFingerprintOnServer(fp);
        if (!mounted) return;
        // store returned fingerprint id for later API calls
        if (res?.fingerprintId) localStorage.setItem('fingerprintId', res.fingerprintId);
        if (res?.credits !== undefined) localStorage.setItem('fingerprintCredits', String(res.credits));
      } catch (err) {
        console.warn('Fingerprint initialization failed', err);
      }
    }

    initFingerprint();

    return () => { mounted = false; };
  }, []);

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* Main route -> Dashboard */}
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
