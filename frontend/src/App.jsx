import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Navbar from "./components/Navbar";
import Pricing from "./components/Pricing";
import Features from "./components/Features";
import Login from "./components/login";
import EmailChecker from "./components/EmailChecker";

function App() {
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
