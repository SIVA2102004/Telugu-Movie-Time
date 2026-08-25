import { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, UserCheck } from "lucide-react";
import "./AdminLogin.css";

export default function AdminLogin({ onLogin, config }) {
  const [inputVal, setInputVal] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState("code"); // 'code' or 'password'

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
        setError("Invalid password or co-admin joining code. Please check with the main admin.");
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="admin-login">
      <div className="admin-login__card card">
        <div className="admin-login__icon">
          <ShieldCheck size={36} color="var(--gold)" />
        </div>
        <h1 className="admin-login__title">Admin Portal</h1>
        <p className="admin-login__sub">Telugu Talkies · Secure Management</p>

        {/* Mode Toggle */}
        <div className="admin-login-tabs" style={{ display: "flex", gap: 8, margin: "16px 0", width: "100%" }}>
          <button
            type="button"
            className={`btn ${loginMode === "code" ? "btn-gold" : "btn-ghost"}`}
            style={{ flex: 1, padding: "8px 10px", fontSize: "0.82rem", justifyContent: "center" }}
            onClick={() => { setLoginMode("code"); setError(""); }}
          >
            <UserCheck size={14} /> Joining Code
          </button>
          <button
            type="button"
            className={`btn ${loginMode === "password" ? "btn-gold" : "btn-ghost"}`}
            style={{ flex: 1, padding: "8px 10px", fontSize: "0.82rem", justifyContent: "center" }}
            onClick={() => { setLoginMode("password"); setError(""); }}
          >
            <KeyRound size={14} /> Password
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-login__form">
          <div className="admin-login__field">
            <label className="label" htmlFor="authInput">
              {loginMode === "code" ? "Co-Admin Joining Code" : "Master Admin Password"}
            </label>
            <div className="admin-login__pw-wrap">
              <input
                className="input"
                id="authInput"
                type={showPw || loginMode === "code" ? "text" : "password"}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={loginMode === "code" ? "Enter joining code (e.g. COADMIN2026)" : "Enter master password"}
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
            {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Access Dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
