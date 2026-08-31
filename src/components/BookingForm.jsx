import { useState, useEffect } from "react";
import { db, rtdb } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { IndianRupee, QrCode, Smartphone, Copy, Check, Send, Loader2, Zap, ShieldCheck, Sparkles, Clock, CheckCircle2 } from "lucide-react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { playSuccessChime } from "../utils/soundEffects";
import "./BookingForm.css";

export default function BookingForm({
  selectedSeats,
  pricePerSeat = 200,
  onSuccess,
  config = {},
  totalAmount,
  getSeatPrice,
  getSeatTier,
  layout,
  screenId = "screen-1",
  screenName = "Screen 1",
  existingBookings = [],
}) {
  const computedAmount = Number(
    totalAmount !== undefined && !isNaN(totalAmount)
      ? totalAmount
      : selectedSeats.reduce((sum, s) => sum + (getSeatPrice ? getSeatPrice(s) : (config?.pricePerSeat || 200)), 0)
  );

  const [primaryContact, setPrimaryContact] = useState({
    name: "",
    phone: "",
    upiRef: "",
    college: "",
    year: "1st Year",
  });

  const [submitting, setSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [txnRef] = useState(() => "TMT" + Math.random().toString(36).substring(2, 7).toUpperCase());
  const [radarTimer, setRadarTimer] = useState(300); // 5 min radar timer

  const activeUpiId = config?.upiId || "telugumovietime@upi";
  const activePayee = config?.payeeName || "Telugu Movie Time";
  const adminPhone  = config?.adminPhone || "919876543210";

  // Dynamic NPCI Standard Locked-Amount Deep Link
  const baseNote = `TMT-${screenId}-${selectedSeats.join(",")}`;
  const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayee)}&am=${computedAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(baseNote)}&tr=${encodeURIComponent(txnRef)}`;

  // Multi-app dedicated deep links
  const gpayUrl = `gpay://upi/pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayee)}&am=${computedAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(baseNote)}&tr=${encodeURIComponent(txnRef)}`;
  const phonepeUrl = `phonepe://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayee)}&am=${computedAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(baseNote)}&tr=${encodeURIComponent(txnRef)}`;
  const paytmUrl = `paytmmp://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayee)}&am=${computedAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(baseNote)}&tr=${encodeURIComponent(txnRef)}`;

  // Radar timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setRadarTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate crisp local vector QR code without third-party API lag
  useEffect(() => {
    QRCode.toDataURL(upiIntentUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error("QR Code Generation error:", err));
  }, [upiIntentUrl]);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(activeUpiId);
    setCopiedUpi(true);
    toast.success("UPI ID copied! Paste it in your payment app.");
    setTimeout(() => setCopiedUpi(false), 3000);
  };

  const handlePrimaryChange = (e) => {
    const { name, value } = e.target;
    setPrimaryContact((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!primaryContact.name.trim()) return "Please enter student name.";
    if (!primaryContact.phone.trim()) return "Please enter WhatsApp phone number.";
    if (!/^\d{10}$/.test(primaryContact.phone.replace(/\D/g, ""))) return "Please enter a valid 10-digit phone number.";
    if (!primaryContact.upiRef.trim()) return "Please enter the UPI 12-digit UTR / Reference ID.";
    if (primaryContact.upiRef.trim().length < 6) return "Please enter a valid UPI Reference / UTR Number.";

    // ── STRICT DUPLICATE UTR BLOCKING ──
    const enteredUtr = primaryContact.upiRef.trim().toLowerCase();
    
    // Check against existingBookings prop
    const duplicateInCloud = (existingBookings || []).some(
      (b) => b.status !== "cancelled" && String(b.upiId || "").trim().toLowerCase() === enteredUtr
    );
    if (duplicateInCloud) {
      return "⚠️ This UTR / Reference ID has already been used for another booking! Duplicate UTRs are not allowed.";
    }

    // Check against local bookings cache
    try {
      const localCache = JSON.parse(localStorage.getItem("telugu_talkies_bookings_cache") || "[]");
      const duplicateInLocal = localCache.some(
        (b) => b.status !== "cancelled" && String(b.upiId || "").trim().toLowerCase() === enteredUtr
      );
      if (duplicateInLocal) {
        return "⚠️ This UTR / Reference ID is already in use! Each transaction must have a unique UTR.";
      }
    } catch (e) {}

    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);

    // 1. Play Instant Celebration Chime (Web Audio API)
    playSuccessChime();

    const bookingId = "bk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);

    const newBooking = {
      id: bookingId,
      txnRef: txnRef,
      screenId: screenId,
      screenName: screenName,
      name: primaryContact.name.trim(),
      phone: primaryContact.phone.trim(),
      upiId: primaryContact.upiRef.trim(),
      upiTarget: activeUpiId,
      college: primaryContact.college.trim(),
      year: primaryContact.year,
      seats: [...selectedSeats],
      totalAmount: computedAmount,
      status: "pending", // 🛡️ Secure: Set to Pending until Admin verifies bank credit
      createdAt: new Date().toISOString(),
      source: "student_portal_smart_autopay",
    };

    // 1. Instantly write to local shared cache & lock seats in 0ms (Orange / Pending)
    try {
      const existing = JSON.parse(localStorage.getItem("telugu_talkies_bookings_cache") || "[]");
      const updated = [newBooking, ...existing];
      localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated));

      const seatsData = JSON.parse(localStorage.getItem(`telugu_talkies_seats_cache_${screenId}`) || "{}");
      selectedSeats.forEach((seatId) => {
        seatsData[seatId] = "pending";
      });
      localStorage.setItem(`telugu_talkies_seats_cache_${screenId}`, JSON.stringify(seatsData));
      window.dispatchEvent(new Event("storage"));
    } catch (storageErr) {}

    const activeScreenName = config?.screens?.find((s) => s.id === config?.activeScreenId)?.name || screenName || "Screen 1";

    // 2. WhatsApp message sent to ADMIN by Student
    const adminMsg = encodeURIComponent(
      `Hi Admin! 🎬\n\nI just paid *₹${computedAmount}* for seats: *${selectedSeats.join(", ")}*.\n` +
      `Screen: *${activeScreenName}*\n` +
      `Name: *${primaryContact.name}*\n` +
      `Phone: *${primaryContact.phone}*\n` +
      `UTR/Ref: *${primaryContact.upiRef}*\n` +
      `College: *${primaryContact.college}* (${primaryContact.year})\n\n` +
      `Please verify and confirm my booking!`
    );
    const waAdminUrl = `https://wa.me/${adminPhone}?text=${adminMsg}`;

    // 2b. WhatsApp Self-Confirmation / Receipt message for Customer
    const cleanCustomerPhone = primaryContact.phone.replace(/\D/g, "");
    const formattedCustomerPhone = cleanCustomerPhone.startsWith("91") ? cleanCustomerPhone : `91${cleanCustomerPhone}`;
    const customerMsg = encodeURIComponent(
      `🍿 *TELUGU MOVIE TIME — BOOKING REQUEST RECEIVED* 🎬\n\n` +
      `Hello *${primaryContact.name}*,\n` +
      `Your booking request for *${config?.movieName || "the movie"}* (*${activeScreenName}*) has been recorded!\n\n` +
      `💺 *Seats:* *${selectedSeats.join(", ")}*\n` +
      `💰 *Amount:* *₹${computedAmount}*\n` +
      `💳 *UTR / Ref:* ${primaryContact.upiRef}\n` +
      `⏳ *Status:* *PENDING ADMIN VERIFICATION*\n\n` +
      `📌 *Next Step:* Admin will verify your UPI credit. Once approved, your official confirmed vintage ticket card will be sent to this WhatsApp number.\n\n` +
      `Thank you for choosing Telugu Movie Time! 🎉`
    );
    const waCustomerUrl = `https://wa.me/${formattedCustomerPhone}?text=${customerMsg}`;

    // Parallel non-blocking Cloud sync (Firestore & RTDB)
    setDoc(doc(db, "bookings", newBooking.id), newBooking, { merge: true }).catch(console.error);
    Promise.all([
      ...selectedSeats.map((seatId) => set(ref(rtdb, `seats_${screenId}/${seatId}`), "pending")),
      set(ref(rtdb, `all_bookings/${newBooking.id}`), newBooking),
    ]).catch(console.warn);

    toast.success("Booking request submitted for verification! 🎟️");

    // Automatically trigger WhatsApp in new tab so user sends screenshot
    try {
      window.open(waAdminUrl, "_blank");
    } catch (e) {}

    // 4. Instant Transition to Success Screen (0ms latency)
    onSuccess({
      booking: newBooking,
      waUrl: waAdminUrl,
      waCustomerUrl: waCustomerUrl,
    });
    setSubmitting(false);
  };

  return (
    <form className="booking-form card" onSubmit={handleSubmit}>
      <div className="booking-form__header">
        <h2 className="booking-form__title" style={{ borderBottom: "none", paddingBottom: 0 }}>
          Student Details & Payment
        </h2>
        <span className="booking-form__badge">{selectedSeats.length} Seats Selected</span>
      </div>

      <div className="form-grid">
        {/* Full Name */}
        <div className="form-field form-field--full">
          <label className="label" htmlFor="name">Full Name *</label>
          <input
            className="input"
            id="name"
            name="name"
            type="text"
            placeholder="Siva Reddy"
            value={primaryContact.name}
            onChange={handlePrimaryChange}
            autoComplete="name"
            required
          />
        </div>

        {/* WhatsApp Phone */}
        <div className="form-field">
          <label className="label" htmlFor="phone">WhatsApp Phone Number *</label>
          <input
            className="input"
            id="phone"
            name="phone"
            type="tel"
            placeholder="9876543210"
            maxLength={10}
            value={primaryContact.phone}
            onChange={handlePrimaryChange}
            autoComplete="tel"
            required
          />
        </div>

        {/* Year of Study */}
        <div className="form-field">
          <label className="label" htmlFor="year">Year of Study *</label>
          <select
            className="select"
            id="year"
            name="year"
            value={primaryContact.year}
            onChange={handlePrimaryChange}
          >
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
            <option value="Faculty / Staff">Faculty / Staff</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* College Name */}
        <div className="form-field form-field--full">
          <label className="label" htmlFor="college">College / Department</label>
          <input
            className="input"
            id="college"
            name="college"
            type="text"
            placeholder="e.g. Marwadi University - CSE"
            value={primaryContact.college}
            onChange={handlePrimaryChange}
          />
        </div>
      </div>

      {/* ── ⚡ SMART AUTO-PAY SECTION ── */}
      <div className="payment-box" style={{ border: "2px solid var(--gold)", background: "linear-gradient(180deg, rgba(255, 215, 0, 0.06) 0%, rgba(20, 16, 24, 0.95) 100%)", borderRadius: 14, padding: "18px 16px" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, borderBottom: "1px solid rgba(255, 215, 0, 0.2)", paddingBottom: 10, marginBottom: 14 }}>
          <h3 className="payment-box__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, color: "var(--gold)", fontSize: "1.05rem" }}>
            <Zap size={18} color="#FFD700" /> ⚡ Smart Auto-Pay (NPCI Locked)
          </h3>
          <span style={{ fontSize: "0.75rem", background: "rgba(0, 230, 118, 0.15)", border: "1px solid var(--green)", color: "var(--green)", padding: "2px 8px", borderRadius: 20, fontWeight: 800 }}>
            🔒 Amount Locked: ₹{computedAmount}
          </span>
        </div>

        {/* Dynamic Amount-Locked QR Code */}
        <div className="payment-box__qr-wrapper" style={{ border: "2px solid var(--gold)", padding: 12, borderRadius: 12, background: "#fff", maxWidth: 200, margin: "0 auto 12px" }}>
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt="Locked UPI QR"
              className="payment-box__qr-img"
              width={175}
              height={175}
            />
          ) : (
            <div style={{ width: 175, height: 175, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          )}
          <span style={{ fontSize: "0.72rem", color: "#000", fontWeight: 800, textAlign: "center", marginTop: 4 }}>
            Scan with GPay / PhonePe / Paytm
          </span>
        </div>

        {/* Radar Timer & Transaction Trace */}
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", background: "rgba(255, 255, 255, 0.04)", padding: "8px 12px", borderRadius: 8, fontSize: "0.78rem", color: "var(--text-muted)", margin: "8px 0 14px", border: "1px dashed rgba(255, 255, 255, 0.1)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={13} color="var(--yellow)" />
            Expires in: <strong style={{ color: "var(--yellow)" }}>{Math.floor(radarTimer / 60)}:{String(radarTimer % 60).padStart(2, "0")}</strong>
          </span>
          <span>
            Ref Code: <code style={{ color: "var(--gold)", fontWeight: 800 }}>{txnRef}</code>
          </span>
        </div>

        {/* 1-Click Mobile UPI App Launchers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", fontWeight: 600 }}>
            📲 Or Tap to Open Your Payment App (Amount Auto-Filled):
          </span>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <a
              href={phonepeUrl}
              className="btn btn-outline"
              style={{ fontSize: "0.75rem", padding: "8px 4px", justifyContent: "center", borderColor: "#5f259f", color: "#b388ff", background: "rgba(95,37,159,0.15)", fontWeight: 700 }}
              onClick={() => toast.success("Opening PhonePe with exact ₹" + computedAmount + " locked!")}
            >
              🟣 PhonePe
            </a>

            <a
              href={gpayUrl}
              className="btn btn-outline"
              style={{ fontSize: "0.75rem", padding: "8px 4px", justifyContent: "center", borderColor: "#4285F4", color: "#82b1ff", background: "rgba(66,133,244,0.15)", fontWeight: 700 }}
              onClick={() => toast.success("Opening Google Pay with exact ₹" + computedAmount + " locked!")}
            >
              🔵 Google Pay
            </a>

            <a
              href={paytmUrl}
              className="btn btn-outline"
              style={{ fontSize: "0.75rem", padding: "8px 4px", justifyContent: "center", borderColor: "#00BAF2", color: "#80d8ff", background: "rgba(0,186,242,0.15)", fontWeight: 700 }}
              onClick={() => toast.success("Opening Paytm with exact ₹" + computedAmount + " locked!")}
            >
              🔷 Paytm
            </a>
          </div>

          <a
            href={upiIntentUrl}
            className="btn btn-gold"
            style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "10px", fontSize: "0.88rem", fontWeight: 800 }}
            onClick={() => toast.success("Opening default UPI App with exact ₹" + computedAmount + " locked!")}
          >
            ⚡ Pay ₹{computedAmount} via Any UPI App
          </a>
        </div>

        {/* Payee Details & Copy Tool */}
        <div className="payment-box__upi-row" style={{ marginTop: 12 }}>
          <span className="payment-box__upi-label">UPI ID:</span>
          <span className="payment-box__upi-id">{activeUpiId}</span>
          <button
            type="button"
            className="btn btn-ghost payment-box__copy-btn"
            onClick={handleCopyUpi}
            title="Copy UPI ID"
          >
            {copiedUpi ? <Check size={14} color="var(--green)" /> : <Copy size={14} />}
            {copiedUpi ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* UTR Input with Quick Paste Helper */}
      <div className="form-field" style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className="label" htmlFor="upiRef" style={{ margin: 0 }}>
            12-Digit UPI UTR / Reference ID *
          </label>
          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                const digits = text.replace(/\D/g, "");
                if (digits.length >= 10) {
                  setPrimaryContact((prev) => ({ ...prev, upiRef: digits.slice(0, 12) }));
                  toast.success("UTR pasted from clipboard! 📋");
                } else if (text.trim()) {
                  setPrimaryContact((prev) => ({ ...prev, upiRef: text.trim() }));
                  toast.success("Pasted from clipboard!");
                } else {
                  toast("Clipboard is empty. Please copy UTR from your bank app.", { icon: "ℹ️" });
                }
              } catch (e) {
                toast("Please paste your 12-digit UTR manually.", { icon: "ℹ️" });
              }
            }}
            style={{ background: "none", border: "none", color: "var(--gold)", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", textDecoration: "underline", padding: 0 }}
          >
            📋 Paste from Clipboard
          </button>
        </div>
        <input
          className="input"
          id="upiRef"
          name="upiRef"
          type="text"
          placeholder="e.g. 423456789012"
          value={primaryContact.upiRef}
          onChange={handlePrimaryChange}
          required
        />
        <span className="field-hint">
          After paying in GPay/PhonePe/Paytm → Copy the 12-digit UPI Reference Number / UTR and paste here.
        </span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="btn btn-gold btn-full"
        style={{ marginTop: 20, padding: "14px", fontSize: "1rem", fontWeight: 800 }}
        disabled={submitting || selectedSeats.length === 0}
      >
        {submitting ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="spinner" style={{ width: 18, height: 18 }} />
            Confirming Booking & Generating Ticket…
          </span>
        ) : (
          `⚡ Confirm Bank Payment & Generate Ticket (₹${computedAmount})`
        )}
      </button>
    </form>
  );
}
