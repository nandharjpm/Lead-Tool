import "../components/Navbar.css";
import { signInWithGoogle } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { linkFingerprintToUser } from '../utils/fingerprint';

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

      showSuccess("Login successful!");
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
        <div className="nav-item dropdown">Features ▾</div>
        <div className="nav-item dropdown">Resources ▾</div>
        <div className="nav-item">Pricing</div>
      </div>

      <div className="nav-right">
        <button className="btn-outline" onClick={handleEmailLogin}> SIGN IN </button>
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
