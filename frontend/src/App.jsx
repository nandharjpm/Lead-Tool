import { useEffect, useState } from "react";
import { makeFingerprint, ensureFingerprintOnServer } from './utils/fingerprint';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Navbar from "./components/Navbar";
import Pricing from "./components/Pricing";
import Features from "./components/Features";
import Login from "./components/login";
import EmailChecker from "./components/EmailChecker";

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
        <Route path="/" element={<Navigate to="/email-finder" />} />
        <Route path="/email-finder" element={<Dashboard />} />
        <Route path="/email-verification" element={<EmailChecker />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/features" element={<Features />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
