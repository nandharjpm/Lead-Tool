import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

export default function Signup() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      alert("Please fill all required fields");
      return;
    }

    try {
      await signupWithEmail(email, password);

      await saveUserProfile({
        name,
        email,
        phone,
      });

      navigate("/");
    } catch {
      alert("Signup failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Google */}
        <button className="google-btn">
          <img src="/google.svg" alt="Google" />
          Sign up with Google
        </button>

        <div className="divider">
          <span>Or</span>
        </div>

        {/* Full Name */}
        <label>Full name</label>
        <input
          type="text"
          placeholder="Enter your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {/* Phone */}
        <label>Phone number (optional)</label>
        <PhoneInput
          country={"us"}
          value={phone}
          onChange={setPhone}
          inputClass="phone-input"
          containerClass="phone-container"
        />

        {/* Email */}
        <label>Email</label>
        <input
          type="email"
          placeholder="Personal or work email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {/* Password */}
        <label>Password</label>
        <div className="password-wrapper">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            👁
          </span>
        </div>

        <button className="btn-primary" onClick={handleSignup}>
          Sign up FREE
        </button>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
