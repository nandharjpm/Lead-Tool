import "../components/Navbar.css";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-left">
        <div className="nav-item dropdown">Features ▾</div>
        <div className="nav-item dropdown">Resources ▾</div>
        <div className="nav-item">Pricing</div>
      </div>

      <div className="nav-right">
        <button className="btn-outline">SIGN IN</button>
        <button className="btn-solid">SIGN UP</button>
      </div>
    </nav>
  );
}
