import { useEffect, useState, useCallback, useRef } from "react";
import { rtdb } from "../firebase";
import { ref, set } from "firebase/database";
import { useSeats } from "../hooks/useSeats";
import { useBookings } from "../hooks/useBookings";
import { useMovieConfig } from "../hooks/useMovieConfig";
import SeatMap from "../components/SeatMap";
import BookingForm from "../components/BookingForm";
import MovieHeader from "../components/MovieHeader";
import VintageTicketModal from "../components/VintageTicketModal";
import { CheckCircle, Share2, Timer, Ticket, MessageCircle, ArrowLeft, Download } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import "../styles/globals.css";
import "./StudentPage.css";

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function StudentPage() {
  const { seatMap } = useSeats();
  const { bookings } = useBookings();
  const { config, layout, getSeatPrice, getSeatTier } = useMovieConfig();

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [lockTimer, setLockTimer] = useState(null);
  const timerRef = useRef(null);
  const lockStartRef = useRef(null);

  // ── Seat toggle ──────────────────────────────────────────────────────────
  const handleSeatToggle = useCallback(
    async (seatId) => {
      const isSelected = selectedSeats.includes(seatId);

      if (isSelected) {
        setSelectedSeats((prev) => prev.filter((s) => s !== seatId));
        // Remove lock from RTDB and Firestore
        try {
          await set(ref(rtdb, `seats/${seatId}`), "available");
        } catch (e) {}
        try {
          const { doc, deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db, "activeLocks", seatId));
        } catch (e) {}
      } else {
        setSelectedSeats((prev) => [...prev, seatId]);
        // Set lock in RTDB and Firestore
        try {
          await set(ref(rtdb, `seats/${seatId}`), "locked");
        } catch (e) {}
        try {
          const { doc, setDoc } = await import("firebase/firestore");
          await setDoc(doc(db, "activeLocks", seatId), {
            status: "locked",
            timestamp: Date.now(),
          });
        } catch (e) {}
      }
    },
    [selectedSeats]
  );

  // ── 5-minute holding timer ───────────────────────────────────────────────
  useEffect(() => {
    if (selectedSeats.length > 0 && !timerRef.current) {
      lockStartRef.current = Date.now();
      setLockTimer(LOCK_TIMEOUT_MS / 1000);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - lockStartRef.current;
        const remaining = Math.max(0, Math.ceil((LOCK_TIMEOUT_MS - elapsed) / 1000));
        setLockTimer(remaining);

        if (remaining === 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setSelectedSeats((prev) => {
            prev.forEach(async (seatId) => {
              try { set(ref(rtdb, `seats/${seatId}`), "available"); } catch (e) {}
              try {
                const { doc, deleteDoc } = await import("firebase/firestore");
                await deleteDoc(doc(db, "activeLocks", seatId));
              } catch (e) {}
            });
            return [];
          });
        }
      }, 1000);
    }

    if (selectedSeats.length === 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setLockTimer(null);
      lockStartRef.current = null;
    }

    return () => {};
  }, [selectedSeats.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Countdown to show time ───────────────────────────────────────────────
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!config?.date || !config?.showTime) return;
    const tick = () => {
      try {
        const showDate = new Date(`${config.date} ${config.showTime}`);
        const diff = showDate - Date.now();
        if (diff <= 0) { setCountdown("Booking closed"); return; }
        const h = Math.floor(diff / 3_600_000);
        const m = Math.floor((diff % 3_600_000) / 60_000);
        setCountdown(`Booking closes in ${h}h ${m}m`);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [config?.date, config?.showTime]);

  const handleSuccess = (data) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setSelectedSeats([]);
    setLockTimer(null);
    setSubmittedData(data);
    setSubmitted(true);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Book seats — ${config?.movieName || "Telugu Talkies"}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#1A1A2E", color: "#F0F0F0", border: "1px solid #2A2A4A" },
        }}
      />
      <MovieHeader config={config} layout={layout} />

      {/* ── Submitted Confirmation Screen ── */}
      {submitted ? (
        <main className="student-page">
          <div className="student-page__success card" style={{ maxWidth: 640, margin: "40px auto" }}>
            <CheckCircle size={64} color="var(--green)" />
            <h2 style={{ color: "var(--green)", fontSize: "1.8rem", margin: "8px 0" }}>
              Payment & Booking Submitted!
            </h2>
            <p style={{ color: "var(--text)", fontSize: "1rem", lineHeight: 1.6 }}>
              Your booking request for <strong>{config?.movieName || "the movie"}</strong> has been received.
              <br />
              Your seats are currently set to <strong>Pending Verification (Orange)</strong>.
              <br />
              Once admin confirms your payment, tickets will be sent to your WhatsApp!
            </p>

            {submittedData?.booking && (
              <div
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "16px 20px",
                  width: "100%",
                  textAlign: "left",
                  margin: "12px 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div><strong>Seats:</strong> <span style={{ color: "var(--gold)" }}>{(submittedData.booking.seats || []).join(", ")}</span></div>
                <div><strong>Total Amount:</strong> ₹{submittedData.booking.totalAmount}</div>
                <div><strong>Name:</strong> {submittedData.booking.name}</div>
                <div><strong>UTR / Ref:</strong> {submittedData.booking.upiId}</div>
              </div>
            )}

            {submittedData?.waUrl && (
              <a
                href={submittedData.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-wa"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "14px 24px",
                  fontSize: "1rem",
                  width: "100%",
                  fontWeight: 700,
                  textDecoration: "none",
                  marginTop: 10,
                }}
              >
                <MessageCircle size={20} /> Send Screenshot to Admin on WhatsApp
              </a>
            )}

            <button
              className="btn btn-outline"
              style={{ marginTop: 14, width: "100%", display: "inline-flex", justifyContent: "center", gap: 6 }}
              onClick={() => {
                setSubmitted(false);
                setSubmittedData(null);
              }}
            >
              <ArrowLeft size={16} /> Back to Seating Layout
            </button>
          </div>
        </main>
      ) : (
        /* ── Standard Booking Screen ── */
        <main className="student-page">
          {/* Info strip */}
          <div className="student-page__strip">
            {countdown && (
              <span className="strip-item">
                <Timer size={14} />
                {countdown}
              </span>
            )}
            {selectedSeats.length > 0 && (
              <span className="strip-item" style={{ color: "var(--gold)" }}>
                <Ticket size={14} />
                {selectedSeats.length} seat{selectedSeats.length > 1 ? "s" : ""} selected
              </span>
            )}
            {lockTimer !== null && (
              <span className="strip-item strip-item--warn">
                <Timer size={14} />
                Seats release in {Math.floor(lockTimer / 60)}:
                {String(lockTimer % 60).padStart(2, "0")}
              </span>
            )}
            <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: "0.8rem" }} onClick={handleShare}>
              <Share2 size={13} /> Share
            </button>
          </div>

          <div className="student-page__content">
            {/* Seat map */}
            <section className="student-page__seatmap card">
              <div className="seatmap-header">
                <h2>Choose Your Seats</h2>
                {selectedSeats.length > 0 && (
                  <span className="selected-count">
                    {selectedSeats.length} selected
                  </span>
                )}
              </div>
              <SeatMap
                layout={layout}
                seatMap={seatMap}
                selectedSeats={selectedSeats}
                bookings={bookings}
                onSeatToggle={handleSeatToggle}
                maxSeats={999}
                blockedSeats={config?.blockedSeats || []}
              />
            </section>

            {/* Booking form (slides in when seats selected) */}
            {selectedSeats.length > 0 && (
              <section className="student-page__form">
                <BookingForm
                  selectedSeats={selectedSeats}
                  pricePerSeat={config?.pricePerSeat}
                  getSeatPrice={getSeatPrice}
                  getSeatTier={getSeatTier}
                  config={config}
                  onSuccess={handleSuccess}
                />
              </section>
            )}
          </div>
        </main>
      )}
    </>
  );
}
