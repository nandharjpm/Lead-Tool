import "../components/Navbar.css";
import { signInWithGoogle } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { linkFingerprintToUser } from '../utils/fingerprint';
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from '../assets/logo.png';

export default function Navbar() {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);

  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithGoogle();
      console.log("User:", result.user);

      // Link fingerprint to user account (if available)
      try {
        const fingerprintId = localStorage.getItem('fingerprintId');
        if (fingerprintId && result?.user?.uid) {
          const linkRes = await linkFingerprintToUser(fingerprintId, result.user.uid);
          if (linkRes?.credits !== undefined) {
            localStorage.setItem('fingerprintCredits', String(linkRes.credits));
            showSuccess('Signup successful! Free credits applied.');
          }
        }
      } catch (linkErr) {
        console.warn('Failed to link fingerprint after Google signup', linkErr);
      }

      setShowPopup(true);
      setTimeout(() => {
        setShowPopup(false);
        navigate("/");
      }, 2000);
    } catch (err) {
      console.error(err);
      alert("Google sign-in failed");
    }
  };

     const handleEmailLogin = async () => {
    try {
        let result = {};
      if (typeof loginWithEmail === 'function') {
        result = await loginWithEmail("test@example.com", "password123");
        console.log("Logged In:", result.user);
      } else {
        console.warn('loginWithEmail not implemented in this codebase');
      }

      // Attempt to link fingerprint if login returns a user
      try {
        const fingerprintId = localStorage.getItem('fingerprintId');
        if (fingerprintId && result?.user?.uid) {
          const linkRes = await linkFingerprintToUser(fingerprintId, result.user.uid);
          if (linkRes?.credits !== undefined) {
            localStorage.setItem('fingerprintCredits', String(linkRes.credits));
            showSuccess('Login successful! Free credits applied.');
          }
        }
      } catch (linkErr) {
        console.warn('Failed to link fingerprint after login', linkErr);
      }

      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  };


  const showSuccess = (msg) => {
    setShowPopup(msg);
    setTimeout(() => setShowPopup(null), 2000);
  };

  return (
    <>
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="logo"><img src={logo} alt="Your Brand Logo" /></Link>
        <Link to="/features" className="nav-item">
          Features
        </Link>
        <Link to="/pricing" className="nav-item">
          Pricing
        </Link>

      </div>

      <div className="nav-right">
        <Link to="/login" className="btn-outline">SIGN IN</Link>
        <button className="btn-solid" onClick={handleGoogleSignup}>
          SIGN UP
        </button>
      </div>
    </nav>

      {showPopup && (
        <div className="popup">
          <div className="popup-content">
            🎉 {showPopup}
          </div>
        </div>
      )}
      </>
  );
}
