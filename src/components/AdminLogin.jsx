import { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, UserCheck, ArrowLeft, Info, HelpCircle } from "lucide-react";
import "./AdminLogin.css";

export default function AdminLogin({ onLogin, config }) {
  const [inputVal, setInputVal] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState("password"); // Default to Master password

  const masterPassword = config?.adminPassword || import.meta.env.VITE_ADMIN_PASSWORD || "admin123";
  const validCoAdminCode = config?.coAdminCode || "COADMIN2026";

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const entered = inputVal.trim();
    setTimeout(() => {
      if (entered === masterPassword) {
        sessionStorage.setItem("adminAuth", "true");
        sessionStorage.setItem("adminRole", "master");
        onLogin();
      } else if (entered === validCoAdminCode) {
        sessionStorage.setItem("adminAuth", "true");
        sessionStorage.setItem("adminRole", "co-admin");
        onLogin();
      } else {
        setError(
          loginMode === "password"
            ? "Incorrect master password. Default initial password is admin123."
            : "Invalid joining code. Please check with the main admin."
        );
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="admin-login">
      <div className="admin-login__card card">
        <div className="admin-login__icon">
          <ShieldCheck size={40} color="var(--gold)" />
        </div>
        <h1 className="admin-login__title">TMT Admin Portal</h1>
        <p className="admin-login__sub">Telugu Movie Time · Management Dashboard</p>

        {/* Mode Toggle */}
        <div className="admin-login-tabs" style={{ display: "flex", gap: 8, margin: "16px 0", width: "100%" }}>
          <button
            type="button"
            className={`btn ${loginMode === "password" ? "btn-gold" : "btn-ghost"}`}
            style={{ flex: 1, padding: "8px 10px", fontSize: "0.82rem", justifyContent: "center" }}
            onClick={() => { setLoginMode("password"); setError(""); setInputVal(""); }}
          >
            <KeyRound size={14} /> Master Admin
          </button>
          <button
            type="button"
            className={`btn ${loginMode === "code" ? "btn-gold" : "btn-ghost"}`}
            style={{ flex: 1, padding: "8px 10px", fontSize: "0.82rem", justifyContent: "center" }}
            onClick={() => { setLoginMode("code"); setError(""); setInputVal(""); }}
          >
            <UserCheck size={14} /> Co-Admin Code
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-login__form">
          <div className="admin-login__field">
            <label className="label" htmlFor="authInput">
              {loginMode === "password" ? "Master Admin Password" : "Co-Admin Joining Code"}
            </label>
            <div className="admin-login__pw-wrap">
              <input
                className="input"
                id="authInput"
                type={showPw || loginMode === "code" ? "text" : "password"}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={loginMode === "password" ? "Enter admin password (default: admin123)" : "Enter joining code (e.g. COADMIN2026)"}
                autoFocus
                required
              />
              {loginMode === "password" && (
                <button
                  type="button"
                  className="admin-login__toggle"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
            </div>
          </div>

          {error && <p className="admin-login__error">{error}</p>}

          <button className="btn btn-gold admin-login__btn" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Login to Dashboard"}
          </button>
        </form>

        {/* Instructions & Help Details Box */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "left", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--gold)", fontWeight: 700, marginBottom: 4 }}>
            <Info size={14} /> Admin Access Details:
          </div>
          <p style={{ margin: "3px 0" }}>• <strong>Master Admin:</strong> Enter password to manage movies, theater layout, UPI ID, prices, and confirm tickets.</p>
          <p style={{ margin: "3px 0" }}>• <strong>Co-Admin / Volunteers:</strong> Use the joining code created by the main admin to review & confirm bookings.</p>
          <p style={{ margin: "3px 0" }}>• <em>Default initial password:</em> <code style={{ color: "var(--gold)" }}>admin123</code></p>
        </div>

        {/* Back to student page link */}
        <div style={{ marginTop: 14 }}>
          <a href="/" style={{ color: "var(--gold)", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
            <ArrowLeft size={14} /> Back to Movie Booking
          </a>
        </div>
      </div>
    </div>
  );
}
