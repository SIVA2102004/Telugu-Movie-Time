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
    phone: "",
    upiRef: "",
    year: "",
    college: "",
  });

  // Per-seat attendee details: { [seatId]: { name: "", gender: "Male" } }
  const [seatDetails, setSeatDetails] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const activeUpiId = config?.upiId || "telugutalkies@upi";
  const payeeName = config?.payeeName || "Telugu Talkies";
  const adminPhone = config?.adminPhone || "919876543210";

  // Sync seatDetails when selectedSeats changes
  useEffect(() => {
    setSeatDetails((prev) => {
      const updated = { ...prev };
      // Remove unselected
      Object.keys(updated).forEach((seatId) => {
        if (!selectedSeats.includes(seatId)) delete updated[seatId];
      });
      // Add newly selected with default Male
      selectedSeats.forEach((seatId, idx) => {
        if (!updated[seatId]) {
          updated[seatId] = { name: "", gender: "Male" };
        }
      });
      return updated;
    });
  }, [selectedSeats]);

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

  const handleSeatNameChange = (seatId, name) => {
    setSeatDetails((prev) => ({
      ...prev,
      [seatId]: { ...prev[seatId], name },
    }));
  };

  const handleSeatGenderChange = (seatId, gender) => {
    setSeatDetails((prev) => ({
      ...prev,
      [seatId]: { ...prev[seatId], gender },
    }));
  };

  const handlePrimaryChange = (e) => {
    setPrimaryContact((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText(activeUpiId);
    toast.success(`Copied UPI ID: ${activeUpiId}`);
  };

  const validate = () => {
    if (selectedSeats.length === 0) return "No seats selected.";

    for (const seatId of selectedSeats) {
      const details = seatDetails[seatId];
      if (!details?.name?.trim()) {
        return `Please enter attendee name for Seat ${seatId}.`;
      }
      if (!details?.gender) {
        return `Please select Male or Female for Seat ${seatId}.`;
      }
    }

    if (!/^\d{10}$/.test(primaryContact.phone)) return "Enter a valid 10-digit WhatsApp phone number.";
    if (!primaryContact.upiRef.trim()) return "Please enter the 12-digit UPI Transaction / UTR reference number.";
    if (!primaryContact.year) return "Please select your year of study.";
    if (!primaryContact.college.trim()) return "Please enter your college name.";
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);

    const primaryAttendee = seatDetails[selectedSeats[0]];
    const attendeesList = selectedSeats.map((seatId) => ({
      seatId,
      name: seatDetails[seatId]?.name?.trim() || "",
      gender: seatDetails[seatId]?.gender || "Male",
      tier: getSeatTier ? getSeatTier(seatId) : "Standard",
    }));

    const newBooking = {
      id: "bk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      name: primaryAttendee?.name || "Student",
      gender: primaryAttendee?.gender || "Male",
      phone: primaryContact.phone.trim(),
      upiId: primaryContact.upiRef.trim(),
      upiTarget: activeUpiId,
      college: primaryContact.college.trim(),
      year: primaryContact.year,
      seats: [...selectedSeats],
      attendees: attendeesList,
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
    const attendeeSummary = attendeesList
      .map((a) => `• *${a.seatId}*: ${a.name} (${a.gender})`)
      .join("\n");

    const msg = encodeURIComponent(
      `Hi Admin! 🎬\n\nI just paid *₹${totalAmount}* for seats:\n${attendeeSummary}\n\nPrimary Phone: *${primaryContact.phone}*\nUTR/Ref: *${primaryContact.upiRef}*\nCollege: *${primaryContact.college}*\n\nPlease confirm our booking!`
    );
    const waUrl = `https://wa.me/${adminPhone}?text=${msg}`;

    // 3. Immediately transition UI to Success Screen
    onSuccess({ booking: newBooking, waUrl });
    setSubmitting(false);

    // 4. Background non-blocking network sync
    Promise.resolve().then(async () => {
      try {
        await Promise.all(
          selectedSeats.map((seatId) => set(ref(rtdb, `seats/${seatId}`), "pending"))
        );
      } catch (e) {}

      try {
        await setDoc(doc(db, "bookings", newBooking.id), {
          name: newBooking.name,
          gender: newBooking.gender,
          phone: newBooking.phone,
          upiId: newBooking.upiId,
          upiTarget: activeUpiId,
          college: newBooking.college,
          year: newBooking.year,
          seats: newBooking.seats,
          attendees: attendeesList,
          totalAmount: newBooking.totalAmount,
          status: "pending",
          createdAt: serverTimestamp(),
        });
      } catch (e) {}
    });
  };

  return (
    <form className="booking-form card" onSubmit={handleSubmit}>
      <div className="booking-form__header">
        <h2 className="booking-form__title" style={{ borderBottom: "none", paddingBottom: 0 }}>
          Attendee Details & Payment
        </h2>
        <span className="booking-form__badge">{selectedSeats.length} Seats Selected</span>
      </div>

      {/* ── STEP 1: PER-SEAT ATTENDEE NAMES & GENDER ── */}
      <div className="attendee-seats-section">
        <h3 className="section-subtitle">
          <Users size={16} /> 1. Attendee Names & Gender for Selected Seats
        </h3>

        <div className="attendee-cards-list">
          {selectedSeats.map((seatId) => {
            const tier = getSeatTier ? getSeatTier(seatId) : "Silver";
            const currentDetails = seatDetails[seatId] || { name: "", gender: "Male" };

            return (
              <div key={seatId} className="attendee-seat-card">
                <div className="seat-badge-row">
                  <span className="seat-id-tag">
                    <Armchair size={13} /> Seat {seatId}
                  </span>
                  <span className={`seat-tier-subtag seat-tier-subtag--${tier.toLowerCase()}`}>
                    {tier}
                  </span>
                </div>

                <div className="seat-inputs-row">
                  {/* Attendee Name */}
                  <div className="form-field flex-grow">
                    <label className="label" htmlFor={`name-${seatId}`}>Attendee Name *</label>
                    <input
                      className="input"
                      id={`name-${seatId}`}
                      type="text"
                      placeholder={`Name for Seat ${seatId}`}
                      value={currentDetails.name}
                      onChange={(e) => handleSeatNameChange(seatId, e.target.value)}
                      required
                    />
                  </div>

                  {/* Gender Toggle */}
                  <div className="form-field">
                    <label className="label">Gender *</label>
                    <div className="gender-toggle-group">
                      {["Male", "Female"].map((g) => (
                        <button
                          type="button"
                          key={g}
                          className={`btn-gender ${currentDetails.gender === g ? "btn-gender--active" : ""}`}
                          onClick={() => handleSeatGenderChange(seatId, g)}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP 2: PRIMARY CONTACT INFO ── */}
      <div className="primary-contact-section">
        <h3 className="section-subtitle">
          <Smartphone size={16} /> 2. WhatsApp & College Details
        </h3>

        <div className="form-grid">
          <div className="form-field">
            <label className="label" htmlFor="phone">Primary WhatsApp Number *</label>
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

      {/* ── STEP 3: UPI Payment Gateway Box ── */}
      <div className="upi-payment-box">
        <div className="upi-payment-header">
          <QrCode size={20} color="var(--gold)" />
          <h3>3. Scan & Pay via UPI App</h3>
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
