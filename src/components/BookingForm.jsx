import { useState, useEffect } from "react";
import { db, rtdb } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { IndianRupee, QrCode, Smartphone, Copy, Check, Send, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
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

  const activeUpiId = config?.upiId || "telugumovietime@upi";
  const activePayee = config?.payeeName || "Telugu Movie Time";
  const adminPhone  = config?.adminPhone || "919876543210";

  const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayee)}&am=${computedAmount}&cu=INR&tn=TMT-${selectedSeats.join(",")}`;

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

    // ── CHECK DUPLICATE UTR ──
    const enteredUtr = primaryContact.upiRef.trim().toLowerCase();
    
    // Check against existingBookings prop
    const duplicateInCloud = (existingBookings || []).some(
      (b) => b.status !== "cancelled" && String(b.upiId || "").trim().toLowerCase() === enteredUtr
    );
    if (duplicateInCloud) {
      return "⚠️ This UTR / Reference ID has already been submitted for another booking! Please check your payment receipt.";
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

    const bookingId = "bk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const newBooking = {
      id: bookingId,
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
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    // 1. Instantly write to local shared cache & lock seats in 0ms
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

    const activeScreenName = config?.screens?.find((s) => s.id === config?.activeScreenId)?.name || "Screen 1";

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
      `🍿 *TELUGU MOVIE TIME — BOOKING ACKNOWLEDGEMENT* 🎬\n\n` +
      `Hello *${primaryContact.name}*,\n` +
      `Your booking request for *${config?.movieName || "the movie"}* (*${activeScreenName}*) has been recorded!\n\n` +
      `💺 *Seats:* *${selectedSeats.join(", ")}*\n` +
      `💰 *Amount:* *₹${computedAmount}*\n` +
      `💳 *UTR / Ref:* ${primaryContact.upiRef}\n` +
      `⏳ *Status:* *PENDING ADMIN VERIFICATION*\n\n` +
      `📌 *Next Step:* Admin is verifying your payment. Your official confirmed vintage ticket will be sent to this WhatsApp number shortly after approval.\n\n` +
      `Thank you for choosing Telugu Movie Time! 🎉`
    );
    const waCustomerUrl = `https://wa.me/${formattedCustomerPhone}?text=${customerMsg}`;

    // 3. Parallel non-blocking Cloud sync (Firestore & RTDB)
    setDoc(doc(db, "bookings", newBooking.id), newBooking, { merge: true }).catch(console.error);
    Promise.all([
      ...selectedSeats.map((seatId) => set(ref(rtdb, `seats_${screenId}/${seatId}`), "pending")),
      set(ref(rtdb, `all_bookings/${newBooking.id}`), newBooking),
    ]).catch(console.warn);

    toast.success("Booking request submitted! 🎟️");

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

      {/* ── PAYMENT SECTION ── */}
      <div className="payment-box">
        <h3 className="payment-box__title">
          <QrCode size={18} /> Scan & Pay via Any UPI App
        </h3>

        <div className="payment-box__qr-wrapper">
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt="UPI QR Code"
              className="payment-box__qr-img"
              width={180}
              height={180}
            />
          ) : (
            <div style={{ width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          )}
        </div>

        {/* Payee Info */}
        <div className="payment-box__payee-info">
          <span>Payee: <strong>{activePayee}</strong></span>
          <span>Amount: <strong className="payment-box__amount">₹{computedAmount}</strong></span>
        </div>

        {/* UPI ID Pill */}
        <div className="payment-box__upi-row">
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

        {/* Mobile UPI Deep Link */}
        <a
          href={upiIntentUrl}
          className="btn btn-outline payment-box__pay-app-btn"
          style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
        >
          <Smartphone size={16} /> Pay ₹{computedAmount} via GPay / PhonePe / Paytm
        </a>
      </div>

      {/* UTR Input */}
      <div className="form-field" style={{ marginTop: 16 }}>
        <label className="label" htmlFor="upiRef">
          UTR / UPI Transaction Reference ID *
        </label>
        <input
          className="input"
          id="upiRef"
          name="upiRef"
          type="text"
          placeholder="12-digit UTR (e.g. 423456789012)"
          value={primaryContact.upiRef}
          onChange={handlePrimaryChange}
          required
        />
        <span className="field-hint">
          Open your UPI app after payment → Copy the 12-digit UTR/Ref number and paste here.
        </span>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        className="btn btn-gold btn-full"
        style={{ marginTop: 20 }}
        disabled={submitting || selectedSeats.length === 0}
      >
        {submitting ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="spinner" style={{ width: 18, height: 18 }} />
            Submitting Booking…
          </span>
        ) : (
          `Submit & Confirm Booking (₹${computedAmount})`
        )}
      </button>
    </form>
  );
}
