import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./components/Dashboard";
import Navbar from "./components/Navbar";
import Pricing from "./components/Pricing";
import Features from "./components/Features";
import Login from "./components/login";

function App() {
  return (
    <BrowserRouter>
    <Navbar />
      <Routes>
        {/* Main route -> Dashboard */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/features" element={<Features />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
