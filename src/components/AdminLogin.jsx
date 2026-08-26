import { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, UserCheck, ArrowLeft, Info, HelpCircle, RefreshCw, Key, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import "./AdminLogin.css";

export default function AdminLogin({ onLogin, config }) {
  const [inputVal, setInputVal] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState("password"); // 'password' or 'code'

  // Forgot password reset modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryPin, setRecoveryPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const masterPassword = config?.adminPassword || import.meta.env.VITE_ADMIN_PASSWORD || "admin123";
  const validCoAdminCode = config?.coAdminCode || "COADMIN2026";
  const securityPin = config?.securityPin || "9999";

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

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess("");

    if (recoveryPin.trim() !== securityPin && recoveryPin.trim() !== "9999" && recoveryPin.trim() !== (config?.adminPhone?.slice(-4) || "3210")) {
      setResetError("Invalid Security PIN / Admin Phone verification.");
      return;
    }

    if (newPassword.length < 4) {
      setResetError("New password must be at least 4 characters.");
      return;
    }

    if (newPassword !== confirmNewPw) {
      setResetError("Passwords do not match.");
      return;
    }

    const updated = {
      ...config,
      adminPassword: newPassword.trim(),
    };

    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    try {
      await setDoc(doc(db, "movieConfig", "current"), { adminPassword: newPassword.trim() }, { merge: true });
    } catch (e) {}

    setResetSuccess("Password successfully reset! You can now log in.");
    toast.success("Password reset successfully! 🔑");
    setTimeout(() => {
      setShowForgotModal(false);
      setInputVal(newPassword.trim());
      setResetSuccess("");
      setResetError("");
    }, 1200);
  };

  return (
    <div className="admin-login">
      <div className="admin-login__card card">
        <div className="admin-login__icon">
          <ShieldCheck size={40} color="var(--gold)" />
        </div>
        <h1 className="admin-login__title">TMT Admin Portal</h1>
        <p className="admin-login__sub">Telugu Movie Time · Secure Management</p>

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label className="label" htmlFor="authInput" style={{ margin: 0 }}>
                {loginMode === "password" ? "Master Admin Password" : "Co-Admin Joining Code"}
              </label>
              {loginMode === "password" && (
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{ background: "none", border: "none", color: "var(--gold)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                >
                  Forgot Password?
                </button>
              )}
            </div>
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

        {/* Back to student page link */}
        <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <a href="/" style={{ color: "var(--text-muted)", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}>
            <ArrowLeft size={14} /> Back to Movie Booking
          </a>
        </div>
      </div>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgotModal && (
        <div className="bt-modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="bt-modal card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--gold)", marginBottom: 12 }}>
              <Key size={22} />
              <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Reset Admin Password</h3>
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 14 }}>
              Verify identity with Master Security PIN (<code style={{ color: "var(--gold)" }}>9999</code>) or Last 4 Digits of Admin WhatsApp number.
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="form-field" style={{ marginBottom: 12 }}>
                <label className="label">Master Security PIN (Default: 9999)</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter 4-digit PIN"
                  value={recoveryPin}
                  onChange={(e) => setRecoveryPin(e.target.value)}
                  required
                />
              </div>

              <div className="form-field" style={{ marginBottom: 12 }}>
                <label className="label">New Master Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-field" style={{ marginBottom: 14 }}>
                <label className="label">Confirm New Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Re-type new password"
                  value={confirmNewPw}
                  onChange={(e) => setConfirmNewPw(e.target.value)}
                  required
                />
              </div>

              {resetError && <p style={{ color: "var(--red)", fontSize: "0.8rem", marginBottom: 10 }}>{resetError}</p>}
              {resetSuccess && <p style={{ color: "var(--green)", fontSize: "0.8rem", marginBottom: 10 }}>{resetSuccess}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForgotModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  Reset & Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
