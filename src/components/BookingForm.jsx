import { useState, useEffect } from "react";
import { db, rtdb } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { IndianRupee, Tag, QrCode, Smartphone, Copy, CheckCircle, MessageCircle, Users, Armchair } from "lucide-react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import "./BookingForm.css";

const YEAR_OPTIONS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export default function BookingForm({
  selectedSeats,
  pricePerSeat,
  getSeatPrice,
  getSeatTier,
  config,
  onSuccess
}) {
  const [primaryContact, setPrimaryContact] = useState({
    name: "",
    phone: "",
    upiRef: "",
    year: "",
    college: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const activeUpiId = config?.upiId || "telugutalkies@upi";
  const payeeName = config?.payeeName || "Telugu Talkies";
  const adminPhone = config?.adminPhone || "919876543210";

  const totalAmount = selectedSeats.reduce((sum, seatId) => {
    const price = getSeatPrice ? getSeatPrice(seatId) : pricePerSeat;
    return sum + price;
  }, 0);

  const tierBreakdown = selectedSeats.reduce((acc, seatId) => {
    const tier = getSeatTier ? getSeatTier(seatId) : "Standard";
    const price = getSeatPrice ? getSeatPrice(seatId) : pricePerSeat;
    if (!acc[tier]) {
      acc[tier] = { count: 0, price, seats: [] };
    }
    acc[tier].count += 1;
    acc[tier].seats.push(seatId);
    return acc;
  }, {});

  // Generate UPI Payment QR Code
  const upiUri = `upi://pay?pa=${encodeURIComponent(activeUpiId)}&pn=${encodeURIComponent(payeeName)}&am=${totalAmount}&tn=${encodeURIComponent(`Tickets for ${selectedSeats.join(",")}`)}&cu=INR`;

  useEffect(() => {
    if (totalAmount > 0) {
      QRCode.toDataURL(upiUri, {
        width: 200,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR Code Error:", err));
    }
  }, [upiUri, totalAmount]);

  const handlePrimaryChange = (e) => {
    setPrimaryContact((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText(activeUpiId);
    toast.success(`Copied UPI ID: ${activeUpiId}`);
  };

  const validate = () => {
    if (selectedSeats.length === 0) return "No seats selected.";
    if (!primaryContact.name.trim()) return "Please enter your full name.";
    if (!/^\d{10}$/.test(primaryContact.phone)) return "Enter a valid 10-digit WhatsApp phone number.";
    if (!primaryContact.upiRef.trim()) return "Please enter the 12-digit UPI Transaction / UTR reference number.";
    if (!primaryContact.year) return "Please select your year of study.";
    if (!primaryContact.college.trim()) return "Please enter your college name.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);

    const newBooking = {
      id: "bk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: primaryContact.name.trim(),
      phone: primaryContact.phone.trim(),
      upiId: primaryContact.upiRef.trim(),
      upiTarget: activeUpiId,
      college: primaryContact.college.trim(),
      year: primaryContact.year,
      seats: [...selectedSeats],
      totalAmount,
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
        seatsData[seatId] = "pending"; // Automatically blocked
      });
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(seatsData));
      window.dispatchEvent(new Event("storage"));
    } catch (storageErr) {
      console.warn("Storage notice:", storageErr);
    }

    // 2. WhatsApp direct notification link
    const msg = encodeURIComponent(
      `Hi Admin! 🎬\n\nI just paid *₹${totalAmount}* for seats: *${selectedSeats.join(", ")}*.\nName: *${primaryContact.name}*\nPhone: *${primaryContact.phone}*\nUTR/Ref: *${primaryContact.upiRef}*\nCollege: *${primaryContact.college}*\n\nPlease confirm our booking!`
    );
    const waUrl = `https://wa.me/${adminPhone}?text=${msg}`;

    // 3. Fast Parallel Cloud Sync to Realtime Database and Firestore
    try {
      await Promise.race([
        Promise.all([
          // Realtime Database Seat Lock
          Promise.all(selectedSeats.map((seatId) => set(ref(rtdb, `seats/${seatId}`), "pending"))).catch(() => {}),
          // Realtime Database Booking Record
          set(ref(rtdb, `all_bookings/${newBooking.id}`), {
            id: newBooking.id,
            name: newBooking.name,
            phone: newBooking.phone,
            upiId: newBooking.upiId,
            upiTarget: activeUpiId,
            college: newBooking.college,
            year: newBooking.year,
            seats: newBooking.seats,
            totalAmount: newBooking.totalAmount,
            status: "pending",
            createdAt: new Date().toISOString(),
          }).catch(() => {}),
          // Firestore Booking Record
          setDoc(doc(db, "bookings", newBooking.id), {
            id: newBooking.id,
            name: newBooking.name,
            phone: newBooking.phone,
            upiId: newBooking.upiId,
            upiTarget: activeUpiId,
            college: newBooking.college,
            year: newBooking.year,
            seats: newBooking.seats,
            totalAmount: newBooking.totalAmount,
            status: "pending",
            createdAt: new Date().toISOString(),
          }).catch(() => {}),
        ]),
        new Promise((res) => setTimeout(res, 800)), // Max 800ms wait so customer experience is instant
      ]);
    } catch (e) {
      console.warn("Cloud sync non-fatal notice:", e);
    }

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
            required
          >
            <option value="">Select year…</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* College Name */}
        <div className="form-field form-field--full">
          <label className="label" htmlFor="college">College Name *</label>
          <input
            className="input"
            id="college"
            name="college"
            type="text"
            placeholder="Marwadi University"
            value={primaryContact.college}
            onChange={handlePrimaryChange}
            required
          />
        </div>

        {/* Selected Seats */}
        <div className="form-field form-field--full">
          <label className="label">Selected Seats ({selectedSeats.length})</label>
          <input
            className="input"
            type="text"
            value={selectedSeats.join(", ") || "None"}
            readOnly
            disabled
          />
        </div>
      </div>

      {/* Tier Breakdown */}
      {Object.keys(tierBreakdown).length > 0 && (
        <div className="tier-breakdown">
          {Object.entries(tierBreakdown).map(([tier, data]) => (
            <div key={tier} className="tier-item">
              <span className={`tier-tag tier-tag--${tier.toLowerCase()}`}>
                <Tag size={12} /> {tier} (₹{data.price} × {data.count})
              </span>
              <span className="tier-subtotal">₹{data.price * data.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Total Amount */}
      <div className="booking-form__total">
        <IndianRupee size={18} />
        <span>Total Payable</span>
        <strong>₹{totalAmount}</strong>
      </div>

      {/* ── UPI Payment Gateway Box ── */}
      <div className="upi-payment-box">
        <div className="upi-payment-header">
          <QrCode size={20} color="var(--gold)" />
          <h3>Scan & Pay via UPI App</h3>
        </div>

        <div className="upi-payment-content">
          {/* QR Code */}
          <div className="upi-qr-wrapper">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="UPI QR Code" className="upi-qr-img" />
            ) : (
              <div className="upi-qr-placeholder">Generating QR…</div>
            )}
            <span className="upi-qr-amount">Exact Amount: ₹{totalAmount}</span>
          </div>

          {/* Direct Pay Options */}
          <div className="upi-details">
            <p className="upi-instruction">
              Scan with <strong>GPay, PhonePe, Paytm</strong> or send to:
            </p>

            <div className="upi-id-badge">
              <span>{activeUpiId}</span>
              <button type="button" className="btn-copy" onClick={copyUpiId} title="Copy UPI ID">
                <Copy size={13} /> Copy
              </button>
            </div>

            <a href={upiUri} className="btn btn-outline upi-direct-btn">
              <Smartphone size={14} /> Pay via UPI App
            </a>
          </div>
        </div>

        {/* Transaction Reference input */}
        <div className="form-field form-field--full" style={{ marginTop: 14 }}>
          <label className="label" htmlFor="upiRef" style={{ color: "var(--gold)", fontWeight: 700 }}>
            UPI Reference / UTR Number *
          </label>
          <input
            className="input"
            id="upiRef"
            name="upiRef"
            type="text"
            placeholder="e.g. 328492019482 (12-digit UTR from payment receipt)"
            value={primaryContact.upiRef}
            onChange={handlePrimaryChange}
            required
          />
        </div>
      </div>

      <button className="btn btn-gold booking-form__submit" disabled={submitting}>
        {submitting ? (
          <>
            <span className="spinner" style={{ width: 18, height: 18 }} />
            Submitting Booking…
          </>
        ) : (
          "Submit Booking & Payment"
        )}
      </button>
    </form>
  );
}
