import { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, UserCheck, ArrowLeft, Info, HelpCircle, RefreshCw, Key, ShieldAlert, User, Phone, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import "./AdminLogin.css";

export default function AdminLogin({ onLogin, config }) {
  const [inputVal, setInputVal] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState("password"); // 'password' or 'code'

  // Co-Admin 2-Step Verification & Details State
  const [coAdminStep, setCoAdminStep] = useState(1); // 1 = Enter code, 2 = Enter details
  const [verifiedCode, setVerifiedCode] = useState("");
  const [coAdminDetails, setCoAdminDetails] = useState({
    name: "",
    phone: "",
    college: "",
  });

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

  // Handle Master Admin Login or Co-Admin Step 1 (Code Verification)
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const entered = inputVal.trim();

    setTimeout(() => {
      if (loginMode === "password") {
        if (entered === masterPassword) {
          sessionStorage.setItem("adminAuth", "true");
          sessionStorage.setItem("adminRole", "master");
          sessionStorage.setItem("adminName", "Master Admin");
          onLogin();
        } else {
          setError("Incorrect master password. Default initial password is admin123.");
        }
      } else if (loginMode === "code") {
        if (entered === validCoAdminCode) {
          setVerifiedCode(entered);
          setCoAdminStep(2); // Proceed to step 2: Enter Volunteer/Co-Admin Details
          toast.success("Joining Code verified! Please enter your details. ✅");
        } else {
          setError("Invalid joining code. Please check with the main admin.");
        }
      }
      setLoading(false);
    }, 300);
  };

  // Handle Co-Admin Step 2: Finalize Details & Login
  const handleCoAdminDetailsSubmit = (e) => {
    e.preventDefault();
    if (!coAdminDetails.name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!/^\d{10}$/.test(coAdminDetails.phone.trim())) {
      setError("Please enter a valid 10-digit WhatsApp phone number.");
      return;
    }

    setLoading(true);
    const coAdminId = "ca_" + coAdminDetails.phone.trim();
    const newCoAdminRecord = {
      id: coAdminId,
      name: coAdminDetails.name.trim(),
      phone: coAdminDetails.phone.trim(),
      college: coAdminDetails.college.trim() || "Telugu Movie Club",
      codeUsed: verifiedCode,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      role: "co-admin",
    };

    // Save to Firestore & Local Storage
    try {
      import("firebase/firestore").then(({ setDoc, doc }) => {
        setDoc(doc(db, "coAdmins", coAdminId), newCoAdminRecord, { merge: true }).catch(console.error);
      });
      const localCoAdmins = JSON.parse(localStorage.getItem("tmt_co_admins_cache") || "[]");
      const filtered = localCoAdmins.filter((c) => c.phone !== coAdminDetails.phone.trim());
      localStorage.setItem("tmt_co_admins_cache", JSON.stringify([newCoAdminRecord, ...filtered]));
    } catch (e) {}

    setTimeout(() => {
      sessionStorage.setItem("adminAuth", "true");
      sessionStorage.setItem("adminRole", "co-admin");
      sessionStorage.setItem("adminName", coAdminDetails.name.trim());
      sessionStorage.setItem("adminPhone", coAdminDetails.phone.trim());
      sessionStorage.setItem("adminCollege", coAdminDetails.college.trim());

      toast.success(`Welcome, ${coAdminDetails.name.trim()}! 🎟️`);
      onLogin();
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
            onClick={() => {
              setLoginMode("password");
              setCoAdminStep(1);
              setError("");
              setInputVal("");
            }}
          >
            <KeyRound size={14} /> Master Admin
          </button>
          <button
            type="button"
            className={`btn ${loginMode === "code" ? "btn-gold" : "btn-ghost"}`}
            style={{ flex: 1, padding: "8px 10px", fontSize: "0.82rem", justifyContent: "center" }}
            onClick={() => {
              setLoginMode("code");
              setCoAdminStep(1);
              setError("");
              setInputVal("");
            }}
          >
            <UserCheck size={14} /> Co-Admin Code
          </button>
        </div>

        {/* ── SCREEN A: MASTER ADMIN LOGIN OR CO-ADMIN STEP 1 ── */}
        {coAdminStep === 1 ? (
          <form onSubmit={handleSubmit} className="admin-login__form">
            <div className="admin-login__field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="label" htmlFor="authInput" style={{ margin: 0 }}>
                  {loginMode === "password" ? "Master Admin Password" : "Step 1: Enter Joining Code"}
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
              {loading ? (
                <span className="spinner" style={{ width: 18, height: 18 }} />
              ) : loginMode === "code" ? (
                "Verify Code & Continue →"
              ) : (
                "Login to Dashboard"
              )}
            </button>
          </form>
        ) : (
          /* ── SCREEN B: CO-ADMIN STEP 2: DETAILS ENTRY ── */
          <form onSubmit={handleCoAdminDetailsSubmit} className="admin-login__form">
            <div style={{ background: "rgba(79,195,247,0.1)", border: "1px solid #4fc3f7", borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "#4fc3f7" }}>
              <CheckCircle2 size={16} /> Code Verified ({verifiedCode}). Enter your details to continue.
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="coName">Your Full Name *</label>
              <input
                className="input"
                id="coName"
                type="text"
                placeholder="e.g. Siva Kumar"
                value={coAdminDetails.name}
                onChange={(e) => setCoAdminDetails({ ...coAdminDetails, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="coPhone">WhatsApp Phone Number *</label>
              <input
                className="input"
                id="coPhone"
                type="tel"
                placeholder="10-digit phone number"
                maxLength={10}
                value={coAdminDetails.phone}
                onChange={(e) => setCoAdminDetails({ ...coAdminDetails, phone: e.target.value })}
                required
              />
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="coCollege">College / Branch (Optional)</label>
              <input
                className="input"
                id="coCollege"
                type="text"
                placeholder="e.g. Marwadi University"
                value={coAdminDetails.college}
                onChange={(e) => setCoAdminDetails({ ...coAdminDetails, college: e.target.value })}
              />
            </div>

            {error && <p className="admin-login__error">{error}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => { setCoAdminStep(1); setError(""); }}
              >
                ← Back
              </button>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ flex: 2 }}
                disabled={loading}
              >
                {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Complete Login 🚀"}
              </button>
            </div>
          </form>
        )}

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
