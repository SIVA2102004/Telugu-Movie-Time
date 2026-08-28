import { useState, useEffect } from "react";
import { db, rtdb } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { IndianRupee, QrCode, Smartphone, Copy, Check, Send, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import "./BookingForm.css";

export default function BookingForm({
  selectedSeats,
  config,
  onSuccess,
  totalAmount,
  getSeatPrice,
  getSeatTier,
  layout,
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

  const activeUpiId = config?.upiId || "telugumovietime@upi";
  const activePayee = config?.payeeName || "Telugu Movie Time";
  const adminPhone  = config?.adminPhone || "919876543210";

  const upiIntentUrl = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(activePayee)}&am=${computedAmount}&cu=INR&tn=TMT-${selectedSeats.join(",")}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiIntentUrl)}`;

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
    if (!primaryContact.name.trim()) return "Please enter your full name.";
    if (!/^\d{10}$/.test(primaryContact.phone.trim()))
      return "Please enter a valid 10-digit WhatsApp phone number.";
    if (!primaryContact.upiRef.trim())
      return "Please enter the UTR / UPI Transaction Reference number.";
    if (selectedSeats.length === 0)
      return "Please select at least one seat.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);

    // 0. Pre-Submission Collision Guard: Check if any seat is already booked/pending in cloud
    try {
      const { collection, getDocs } = await import("firebase/firestore");
      const snap = await getDocs(collection(db, "bookings"));
      const alreadyTaken = new Set();
      snap.docs.forEach((d) => {
        const b = d.data();
        if (b && b.status !== "cancelled" && Array.isArray(b.seats)) {
          b.seats.forEach((s) => alreadyTaken.add(s));
        }
      });

      const conflictingSeats = selectedSeats.filter((s) => alreadyTaken.has(s));
      if (conflictingSeats.length > 0) {
        toast.error(`⚠️ Seat(s) ${conflictingSeats.join(", ")} were just booked by someone else! Please choose different seats.`);
        setSubmitting(false);
        return;
      }
    } catch (checkErr) {
      console.warn("Seat availability check notice:", checkErr);
    }

    const bookingId = "bk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4);
    const newBooking = {
      id: bookingId,
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

      const seatsData = JSON.parse(localStorage.getItem("telugu_talkies_seats_cache") || "{}");
      selectedSeats.forEach((seatId) => {
        seatsData[seatId] = "pending";
      });
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(seatsData));
      window.dispatchEvent(new Event("storage"));
    } catch (storageErr) {
      console.warn("Storage notice:", storageErr);
    }

    // 2. WhatsApp direct notification link
    const msg = encodeURIComponent(
      `Hi Admin! 🎬\n\nI just paid *₹${computedAmount}* for seats: *${selectedSeats.join(", ")}*.\nName: *${primaryContact.name}*\nPhone: *${primaryContact.phone}*\nUTR/Ref: *${primaryContact.upiRef}*\nCollege: *${primaryContact.college}*\n\nPlease confirm our booking!`
    );
    const waUrl = `https://wa.me/${adminPhone}?text=${msg}`;

    // 3. Direct Firestore & RTDB Save with UI feedback
    try {
      await setDoc(doc(db, "bookings", newBooking.id), newBooking, { merge: true });
    } catch (fsErr) {
      console.error("Firestore booking write failed:", fsErr);
    }

    try {
      await Promise.all([
        ...selectedSeats.map((seatId) => set(ref(rtdb, `seats/${seatId}`), "pending")),
        set(ref(rtdb, `all_bookings/${newBooking.id}`), newBooking),
      ]);
    } catch (rtdbErr) {
      console.warn("RTDB booking write notice:", rtdbErr);
    }

    toast.success("Booking sent to Admin Portal! 🎟️");

    // 4. Transition UI to Success Screen immediately
    onSuccess({ booking: newBooking, waUrl });
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
          <img
            src={qrCodeUrl}
            alt="UPI QR Code"
            className="payment-box__qr-img"
            width={180}
            height={180}
          />
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
