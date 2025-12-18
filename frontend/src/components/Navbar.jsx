import "../components/Navbar.css";
import { signInWithGoogle } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

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
      const result = await loginWithEmail(email, password);

      console.log("Logged in:", result.user);

      // Optional: save profile info
      await saveUserProfile({
        name,
        phone: `${countryCode}${phone}`,
        email,
      });

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
