import { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, UserCheck, ArrowLeft, Info, HelpCircle, RefreshCw, Key, ShieldAlert, User, Phone, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import "./AdminLogin.css";

export default function AdminLogin({ onLogin, config }) {
  const [inputVal, setInputVal] = useState("");
  const [passwordVal, setPasswordVal] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Login modes: 'master' | 'coadmin' | 'register'
  const [loginMode, setLoginMode] = useState("coadmin"); // default to co-admin ID & Password or master

  // Co-Admin Registration State (One-time code verification + create credentials)
  const [regStep, setRegStep] = useState(1); // 1 = enter joining code, 2 = set name, phone, loginId & password
  const [verifiedCode, setVerifiedCode] = useState("");
  const [coAdminRegDetails, setCoAdminRegDetails] = useState({
    name: "",
    phone: "",
    loginId: "",
    password: "",
    college: "",
  });

  // Forgot password reset modal state for master admin
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryPin, setRecoveryPin] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPw, setConfirmNewPw] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const masterPassword = config?.adminPassword || import.meta.env.VITE_ADMIN_PASSWORD || "admin123";
  const validCoAdminCode = config?.coAdminCode || "COADMIN2026";
  const securityPin = config?.securityPin || "9999";

  // 1. MASTER ADMIN LOGIN
  const handleMasterLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const entered = passwordVal.trim();
    setTimeout(() => {
      if (entered === masterPassword) {
        sessionStorage.setItem("adminAuth", "true");
        sessionStorage.setItem("adminRole", "master");
        sessionStorage.setItem("adminName", "Master Admin");
        onLogin();
      } else {
        setError("Incorrect master password. (Default: admin123)");
      }
      setLoading(false);
    }, 300);
  };

  // 2. CO-ADMIN DIRECT LOGIN (WITH LOGIN ID & PASSWORD)
  const handleCoAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const enteredId = inputVal.trim().toLowerCase();
    const enteredPw = passwordVal.trim();

    if (!enteredId || !enteredPw) {
      setError("Please enter both Login ID and Password.");
      setLoading(false);
      return;
    }

    try {
      // Check local cache
      const localCoAdmins = JSON.parse(localStorage.getItem("tmt_co_admins_cache") || "[]");
      let found = localCoAdmins.find(
        (c) =>
          (c.loginId?.toLowerCase() === enteredId || c.phone === enteredId) &&
          c.password === enteredPw
      );

      // If not in cache, check Firestore
      if (!found) {
        const { getDoc, doc } = await import("firebase/firestore");
        const docSnap = await getDoc(doc(db, "coAdmins", enteredId));
        if (docSnap.exists() && docSnap.data().password === enteredPw) {
          found = { id: docSnap.id, ...docSnap.data() };
        } else {
          // Check by phone number key
          const phoneSnap = await getDoc(doc(db, "coAdmins", `ca_${enteredId}`));
          if (phoneSnap.exists() && phoneSnap.data().password === enteredPw) {
            found = { id: phoneSnap.id, ...phoneSnap.data() };
          }
        }
      }

      if (found) {
        sessionStorage.setItem("adminAuth", "true");
        sessionStorage.setItem("adminRole", "co-admin");
        sessionStorage.setItem("adminName", found.name || found.loginId);
        sessionStorage.setItem("adminPhone", found.phone || "");
        sessionStorage.setItem("adminCollege", found.college || "");
        sessionStorage.setItem("coAdminLoginId", found.loginId || enteredId);

        toast.success(`Welcome back, ${found.name || found.loginId}! 🎟️`);
        onLogin();
      } else {
        setError("Invalid Login ID or Password. If you are a new volunteer, click 'Register with Code'.");
      }
    } catch (err) {
      console.warn("Login lookup notice:", err);
      setError("Login failed. Please check your credentials or network.");
    }
    setLoading(false);
  };

  // 3. CO-ADMIN REGISTRATION STEP 1 (VERIFY CODE)
  const handleVerifyRegistrationCode = (e) => {
    e.preventDefault();
    setError("");
    const entered = inputVal.trim();
    if (entered === validCoAdminCode) {
      setVerifiedCode(entered);
      setRegStep(2);
      toast.success("Joining code verified! Now set up your Login ID & Password. 🔑");
    } else {
      setError("Invalid joining code. Please check with the Master Admin.");
    }
  };

  // 4. CO-ADMIN REGISTRATION STEP 2 (SAVE CREDENTIALS & LOGIN)
  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setError("");

    if (!coAdminRegDetails.name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!/^\d{10}$/.test(coAdminRegDetails.phone.trim())) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!coAdminRegDetails.loginId.trim() || coAdminRegDetails.loginId.length < 3) {
      setError("Login ID must be at least 3 characters.");
      return;
    }
    if (!coAdminRegDetails.password.trim() || coAdminRegDetails.password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    const coId = coAdminRegDetails.loginId.trim().toLowerCase();
    const newCoAdminRecord = {
      id: coId,
      loginId: coId,
      password: coAdminRegDetails.password.trim(),
      name: coAdminRegDetails.name.trim(),
      phone: coAdminRegDetails.phone.trim(),
      college: coAdminRegDetails.college.trim() || "Telugu Movie Club",
      codeUsed: verifiedCode,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      role: "co-admin",
    };

    // Save to Firestore & local storage
    try {
      const { setDoc, doc } = await import("firebase/firestore");
      await setDoc(doc(db, "coAdmins", coId), newCoAdminRecord, { merge: true });
      await setDoc(doc(db, "coAdmins", `ca_${coAdminRegDetails.phone.trim()}`), newCoAdminRecord, { merge: true });

      const localList = JSON.parse(localStorage.getItem("tmt_co_admins_cache") || "[]");
      const filtered = localList.filter((c) => c.loginId !== coId && c.phone !== coAdminRegDetails.phone.trim());
      localStorage.setItem("tmt_co_admins_cache", JSON.stringify([newCoAdminRecord, ...filtered]));

      sessionStorage.setItem("adminAuth", "true");
      sessionStorage.setItem("adminRole", "co-admin");
      sessionStorage.setItem("adminName", coAdminRegDetails.name.trim());
      sessionStorage.setItem("adminPhone", coAdminRegDetails.phone.trim());
      sessionStorage.setItem("adminCollege", coAdminRegDetails.college.trim());
      sessionStorage.setItem("coAdminLoginId", coId);

      toast.success(`Account created! Logged in as ${coAdminRegDetails.name.trim()} 🚀`);
      onLogin();
    } catch (err) {
      console.error("Co-Admin registration error:", err);
      toast.success("Account created locally! 🚀");
      onLogin();
    }
    setLoading(false);
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
      await setDoc(doc(db, "movieConfig", "current"), { adminPassword: newPassword.trim() }, { merge: true });
    } catch (e) {}

    setResetSuccess("Password successfully reset! You can now log in.");
    toast.success("Password reset successfully! 🔑");
    setTimeout(() => {
      setShowForgotModal(false);
      setPasswordVal(newPassword.trim());
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

        {/* Mode Toggle Tabs */}
        <div className="admin-login-tabs" style={{ display: "flex", gap: 6, margin: "16px 0 20px", width: "100%", background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 10 }}>
          <button
            type="button"
            className={`btn ${loginMode === "coadmin" ? "btn-gold" : "btn-ghost"}`}
            style={{ flex: 1, padding: "8px 6px", fontSize: "0.78rem", justifyContent: "center", borderRadius: 8 }}
            onClick={() => {
              setLoginMode("coadmin");
              setError("");
              setInputVal("");
              setPasswordVal("");
            }}
          >
            <UserCheck size={14} /> Co-Admin Login
          </button>

          <button
            type="button"
            className={`btn ${loginMode === "master" ? "btn-gold" : "btn-ghost"}`}
            style={{ flex: 1, padding: "8px 6px", fontSize: "0.78rem", justifyContent: "center", borderRadius: 8 }}
            onClick={() => {
              setLoginMode("master");
              setError("");
              setInputVal("");
              setPasswordVal("");
            }}
          >
            <KeyRound size={14} /> Master Admin
          </button>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            1. CO-ADMIN DIRECT LOGIN (LOGIN ID & PASSWORD)
        ═════════════════════════════════════════════════════════════ */}
        {loginMode === "coadmin" && (
          <form onSubmit={handleCoAdminLogin} className="admin-login__form">
            <div className="admin-login__field">
              <label className="label" htmlFor="coLoginId">Co-Admin Login ID or Phone Number *</label>
              <div className="admin-login__pw-wrap">
                <input
                  className="input"
                  id="coLoginId"
                  type="text"
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  placeholder="e.g. siva or 9876543210"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="coPassword">Co-Admin Password *</label>
              <div className="admin-login__pw-wrap">
                <input
                  className="input"
                  id="coPassword"
                  type={showPw ? "text" : "password"}
                  value={passwordVal}
                  onChange={(e) => setPasswordVal(e.target.value)}
                  placeholder="Enter your personal password"
                  required
                />
                <button
                  type="button"
                  className="admin-login__toggle"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="admin-login__error">{error}</p>}

            <button className="btn btn-gold admin-login__btn" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Login as Co-Admin 🚀"}
            </button>

            <div style={{ marginTop: 14, textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>New Co-Admin / Volunteer? </span>
              <button
                type="button"
                onClick={() => {
                  setLoginMode("register");
                  setRegStep(1);
                  setError("");
                  setInputVal("");
                }}
                style={{ background: "none", border: "none", color: "var(--gold)", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}
              >
                Register with Code 🔑
              </button>
            </div>
          </form>
        )}

        {/* ═════════════════════════════════════════════════════════════
            2. MASTER ADMIN LOGIN
        ═════════════════════════════════════════════════════════════ */}
        {loginMode === "master" && (
          <form onSubmit={handleMasterLogin} className="admin-login__form">
            <div className="admin-login__field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label className="label" htmlFor="masterPasswordInput" style={{ margin: 0 }}>
                  Master Admin Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{ background: "none", border: "none", color: "var(--gold)", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>
              <div className="admin-login__pw-wrap">
                <input
                  className="input"
                  id="masterPasswordInput"
                  type={showPw ? "text" : "password"}
                  value={passwordVal}
                  onChange={(e) => setPasswordVal(e.target.value)}
                  placeholder="Enter master password (default: admin123)"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  className="admin-login__toggle"
                  onClick={() => setShowPw((v) => !v)}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="admin-login__error">{error}</p>}

            <button className="btn btn-gold admin-login__btn" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Login to Master Dashboard 👑"}
            </button>
          </form>
        )}

        {/* ═════════════════════════════════════════════════════════════
            3. ONE-TIME CO-ADMIN REGISTRATION (CODE -> CREATE CREDENTIALS)
        ═════════════════════════════════════════════════════════════ */}
        {loginMode === "register" && regStep === 1 && (
          <form onSubmit={handleVerifyRegistrationCode} className="admin-login__form">
            <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: "0.8rem", color: "var(--gold)" }}>
              🔑 <strong>One-Time Registration:</strong> Enter the joining code from Master Admin to create your personal Login ID & Password.
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="regCode">Joining Code *</label>
              <input
                className="input"
                id="regCode"
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Enter code (e.g. COADMIN2026)"
                autoFocus
                required
              />
            </div>

            {error && <p className="admin-login__error">{error}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => { setLoginMode("coadmin"); setError(""); }}
              >
                ← Back
              </button>
              <button type="submit" className="btn btn-gold" style={{ flex: 2 }}>
                Verify Code →
              </button>
            </div>
          </form>
        )}

        {loginMode === "register" && regStep === 2 && (
          <form onSubmit={handleCompleteRegistration} className="admin-login__form">
            <div style={{ background: "rgba(0,230,118,0.1)", border: "1px solid var(--green)", borderRadius: 8, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", color: "var(--green)", fontWeight: 700 }}>
              <CheckCircle2 size={16} /> Code Verified! Create your Login credentials:
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="regName">Full Name *</label>
              <input
                className="input"
                id="regName"
                type="text"
                placeholder="e.g. Siva"
                value={coAdminRegDetails.name}
                onChange={(e) => setCoAdminRegDetails({ ...coAdminRegDetails, name: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="regPhone">WhatsApp Phone *</label>
              <input
                className="input"
                id="regPhone"
                type="tel"
                maxLength={10}
                placeholder="10-digit number"
                value={coAdminRegDetails.phone}
                onChange={(e) => setCoAdminRegDetails({ ...coAdminRegDetails, phone: e.target.value })}
                required
              />
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="regLoginId">Choose Your Login ID * (You will use this to login)</label>
              <input
                className="input"
                id="regLoginId"
                type="text"
                placeholder="e.g. siva2026"
                value={coAdminRegDetails.loginId}
                onChange={(e) => setCoAdminRegDetails({ ...coAdminRegDetails, loginId: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                required
              />
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="regPassword">Choose Your Password *</label>
              <input
                className="input"
                id="regPassword"
                type="password"
                placeholder="Enter a secure password"
                value={coAdminRegDetails.password}
                onChange={(e) => setCoAdminRegDetails({ ...coAdminRegDetails, password: e.target.value })}
                required
              />
            </div>

            <div className="admin-login__field">
              <label className="label" htmlFor="regCollege">College (Optional)</label>
              <input
                className="input"
                id="regCollege"
                type="text"
                placeholder="e.g. Marwadi University"
                value={coAdminRegDetails.college}
                onChange={(e) => setCoAdminRegDetails({ ...coAdminRegDetails, college: e.target.value })}
              />
            </div>

            {error && <p className="admin-login__error">{error}</p>}

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setRegStep(1)}
              >
                ← Back
              </button>
              <button type="submit" className="btn btn-gold" style={{ flex: 2 }} disabled={loading}>
                {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : "Register & Login 🚀"}
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
