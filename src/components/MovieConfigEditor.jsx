import { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Save, QrCode, Smartphone, CreditCard, KeyRound, UserCheck, ShieldCheck, Copy } from "lucide-react";
import toast from "react-hot-toast";
import "./MovieConfigEditor.css";

export default function MovieConfigEditor({ config }) {
  const [form, setForm] = useState({
    movieName: "Telugu Talkies",
    date: "",
    theater: "",
    showTime: "",
    pricePerSeat: 200,
    upiId: "telugutalkies@upi",
    payeeName: "Telugu Talkies",
    adminPhone: "919876543210",
    coAdminCode: "COADMIN2026",
    adminPassword: "admin123",
    ...config,
  });
  const [saving, setSaving] = useState(false);
  const [blockedInput, setBlockedInput] = useState(
    (config.blockedSeats || []).join(", ")
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "pricePerSeat" ? Number(value) : value,
    }));
  };

  const copyCoAdminCode = () => {
    navigator.clipboard.writeText(form.coAdminCode || "COADMIN2026");
    toast.success(`Copied Co-Admin Joining Code: ${form.coAdminCode || "COADMIN2026"}`);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const updated = {
      ...form,
      blockedSeats: blockedInput
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
      pricePerSeat: Number(form.pricePerSeat),
    };

    // Instant local save
    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
    } catch (e) {}

    // Cloud firestore save
    try {
      await setDoc(doc(db, "movieConfig", "current"), updated, { merge: true });
      toast.success("Settings, Security & Co-Admin Code saved! 🚀");
    } catch (err) {
      toast.success("Saved to local workspace cache! ✅");
    }
    setSaving(false);
  };

  return (
    <form className="config-editor card" onSubmit={handleSave}>
      <h2 className="config-editor__title">Movie, Security & Gateway Configuration</h2>

      <div className="config-grid">
        {/* Movie Info */}
        <div className="form-field">
          <label className="label" htmlFor="movieName">Movie Name</label>
          <input className="input" id="movieName" name="movieName"
            value={form.movieName || ""} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="date">Show Date</label>
          <input className="input" type="date" id="date" name="date"
            value={form.date || ""} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="theater">Theater Name</label>
          <input className="input" id="theater" name="theater"
            value={form.theater || ""} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="showTime">Show Time</label>
          <input className="input" id="showTime" name="showTime"
            placeholder="6:30 PM" value={form.showTime || ""} onChange={handleChange} />
        </div>

        {/* ── CO-ADMIN & SECURITY SECTION ── */}
        <div className="form-field form-field--full" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck size={18} /> Co-Admin Access & Security
          </h3>
          <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Generate joining codes for volunteer team members to manage bookings together securely.
          </small>
        </div>

        <div className="form-field">
          <label className="label" htmlFor="coAdminCode">
            <UserCheck size={13} style={{ display: "inline", marginRight: 4 }} />
            Co-Admin Joining Code (Share with helpers)
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="input"
              id="coAdminCode"
              name="coAdminCode"
              placeholder="e.g. TELUGU_VOLUNTEER_2026"
              value={form.coAdminCode || ""}
              onChange={handleChange}
            />
            <button type="button" className="btn btn-ghost" onClick={copyCoAdminCode} title="Copy Joining Code">
              <Copy size={14} />
            </button>
          </div>
          <small style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
            Co-admins can log in using this joining code.
          </small>
        </div>

        <div className="form-field">
          <label className="label" htmlFor="adminPassword">
            <KeyRound size={13} style={{ display: "inline", marginRight: 4 }} />
            Master Admin Password
          </label>
          <input
            className="input"
            id="adminPassword"
            name="adminPassword"
            type="password"
            placeholder="Master admin password"
            value={form.adminPassword || "admin123"}
            onChange={handleChange}
          />
        </div>

        {/* ── PAYMENT GATEWAY CONFIGURATION ── */}
        <div className="form-field form-field--full" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <QrCode size={18} /> UPI Payment Gateway Settings
          </h3>
          <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            When an account fills up or changes, change the UPI ID here. QR codes on student checkout will automatically update.
          </small>
        </div>

        <div className="form-field">
          <label className="label" htmlFor="upiId">
            <CreditCard size={13} style={{ display: "inline", marginRight: 4 }} />
            Active UPI ID (for QR & Payment) *
          </label>
          <input
            className="input"
            id="upiId"
            name="upiId"
            placeholder="example@upi or phone@paytm"
            value={form.upiId || ""}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="payeeName">Payee Name (Business / Name)</label>
          <input
            className="input"
            id="payeeName"
            name="payeeName"
            placeholder="Telugu Talkies Admin"
            value={form.payeeName || ""}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="adminPhone">
            <Smartphone size={13} style={{ display: "inline", marginRight: 4 }} />
            Admin WhatsApp Phone (with Country Code)
          </label>
          <input
            className="input"
            id="adminPhone"
            name="adminPhone"
            placeholder="919876543210"
            value={form.adminPhone || ""}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="pricePerSeat">Default Price Per Seat (₹)</label>
          <input className="input" type="number" id="pricePerSeat" name="pricePerSeat"
            min={1} value={form.pricePerSeat || ""} onChange={handleChange} />
        </div>

        <div className="form-field form-field--full">
          <label className="label" htmlFor="blockedSeats">
            Blocked Seats (comma-separated, e.g. A1, J10)
          </label>
          <input className="input" id="blockedSeats"
            value={blockedInput} onChange={(e) => setBlockedInput(e.target.value)}
            placeholder="A1, A10, J1, J10" />
        </div>
      </div>

      <button className="btn btn-gold" style={{ alignSelf: "flex-start", marginTop: 8 }} disabled={saving}>
        {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : <><Save size={15} /> Save All Settings</>}
      </button>
    </form>
  );
}
