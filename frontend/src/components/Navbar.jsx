import "../components/Navbar.css";
// import { signInWithGoogle } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithGoogle();
      console.log("User:", result.user);

      // Go to dashboard
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("Google sign-in failed");
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <div className="nav-item dropdown">Features ▾</div>
        <div className="nav-item dropdown">Resources ▾</div>
        <div className="nav-item">Pricing</div>
      </div>

      <div className="nav-right">
        <button className="btn-outline">SIGN IN</button>
        <button className="btn-solid" onClick={handleGoogleSignup}>
          SIGN UP
        </button>
      </div>
    </nav>
  );
}
