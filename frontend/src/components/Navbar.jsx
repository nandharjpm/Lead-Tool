import "../components/Navbar.css";
import { signInWithGoogle } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Link } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);

  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithGoogle();
      console.log("User:", result.user);

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
      const result = await loginWithEmail("test@example.com", "password123");  
      console.log("Logged In:", result.user);

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
        <div className="logo"> Logo </div>
        <Link to="/features" className="nav-item">
          Features
        </Link>
        <Link to="/pricing" className="nav-item">
          Pricing
        </Link>

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
