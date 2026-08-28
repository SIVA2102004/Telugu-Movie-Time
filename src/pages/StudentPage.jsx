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

  const [activeView, setActiveView] = useState("movie"); // "movie" (Overview) or "booking" (Seat Selection)
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [lockTimer, setLockTimer] = useState(null);
  const timerRef = useRef(null);
  const lockStartRef = useRef(null);

  const activeScreen = config?.screens?.find((s) => s.id === config?.activeScreenId) || config?.screens?.[0] || {};
  const activePoster = config?.posterUrl || activeScreen.posterUrl || null;
  const activeScreenName = activeScreen.name || "Screen 1";

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
        setCountdown(`Show starts in ${h}h ${m}m`);
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
        title: `Book seats — ${config?.movieName || "Telugu Movie Time"}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  const formattedDate = config?.date
    ? new Date(config.date).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Saturday, 26 September 2026";

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: "#1A1A2E", color: "#F0F0F0", border: "1px solid #2A2A4A" },
        }}
      />

      {/* Dynamic Movie Poster Background Ambient Glow Effect */}
      {activePoster ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage: `radial-gradient(circle at center, rgba(0,0,0,0.55) 0%, rgba(13,13,26,0.92) 100%), url(${activePoster})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(40px) brightness(0.38) saturate(2.2)",
            zIndex: -1,
            transform: "scale(1.2)",
            transition: "all 0.6s ease",
          }}
        />
      ) : (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "radial-gradient(circle at 50% 20%, rgba(180, 20, 20, 0.25) 0%, rgba(13,13,26,0.98) 70%)",
            zIndex: -1,
          }}
        />
      )}

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
              Your booking request for <strong>{config?.movieName || "the movie"}</strong> ({activeScreenName}) has been received.
              <br />
              Your seats are currently set to <strong>Pending Verification (Orange)</strong>.
              <br />
              Once admin confirms your payment, your confirmed vintage ticket will be sent to your WhatsApp!
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
                <div><strong>Screen:</strong> <span style={{ color: "var(--gold)" }}>{activeScreenName}</span></div>
                <div><strong>Seats:</strong> <span style={{ color: "var(--gold)" }}>{(submittedData.booking.seats || []).join(", ")}</span></div>
                <div><strong>Total Amount:</strong> ₹{submittedData.booking.totalAmount}</div>
                <div><strong>Name:</strong> {submittedData.booking.name}</div>
                <div><strong>UTR / Ref:</strong> {submittedData.booking.upiId}</div>
              </div>
            )}

            {submittedData?.waUrl && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", marginTop: 8 }}>
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
                  }}
                >
                  <MessageCircle size={20} /> Send Screenshot to Admin on WhatsApp
                </a>

                {submittedData?.waCustomerUrl && (
                  <a
                    href={submittedData.waCustomerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      padding: "10px 20px",
                      fontSize: "0.88rem",
                      width: "100%",
                      textDecoration: "none",
                      color: "var(--gold)",
                      borderColor: "var(--gold)",
                    }}
                  >
                    <MessageCircle size={16} /> Save Pending Booking Receipt on My WhatsApp
                  </a>
                )}
              </div>
            )}

            <button
              className="btn btn-outline"
              style={{ marginTop: 14, width: "100%", display: "inline-flex", justifyContent: "center", gap: 6 }}
              onClick={() => {
                setSubmitted(false);
                setSubmittedData(null);
                setActiveView("movie");
              }}
            >
              <ArrowLeft size={16} /> Back to Movie Overview
            </button>
          </div>
        </main>
      ) : (
        /* ── Standard Booking & Movie Overview Page ── */
        <main className="student-page">
          {/* Navigation Pill Switcher */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "10px 0 20px" }}>
            <button
              type="button"
              className={`btn ${activeView === "movie" ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "10px 24px", fontSize: "0.95rem", fontWeight: 700, borderRadius: 30 }}
              onClick={() => setActiveView("movie")}
            >
              🎬 Movie Details & Venue
            </button>
            <button
              type="button"
              className={`btn ${activeView === "booking" ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "10px 24px", fontSize: "0.95rem", fontWeight: 700, borderRadius: 30 }}
              onClick={() => setActiveView("booking")}
            >
              🎟️ Book Your Seats ({selectedSeats.length})
            </button>
          </div>

          {activeView === "movie" ? (
            /* ════ VIEW 1: IMMERSIVE MOVIE OVERVIEW, VENUE & CONTACTS ════ */
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Hero Movie Showcase Card */}
              <div
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 28,
                  padding: 28,
                  background: "linear-gradient(135deg, rgba(26,26,46,0.92) 0%, rgba(22,33,62,0.95) 100%)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,215,0,0.3)",
                  borderRadius: 16,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                }}
              >
                {/* Poster Artwork Column */}
                <div style={{ flex: "0 0 260px", maxWidth: 300, margin: "0 auto" }}>
                  {activePoster ? (
                    <img
                      src={activePoster}
                      alt="Movie Poster"
                      style={{
                        width: "100%",
                        height: 380,
                        objectFit: "cover",
                        borderRadius: 12,
                        boxShadow: "0 15px 30px rgba(0,0,0,0.8), 0 0 20px rgba(255,215,0,0.2)",
                        border: "2px solid rgba(255,215,0,0.4)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 380,
                        background: "linear-gradient(180deg, #1b1714 0%, #0d0d1a 100%)",
                        borderRadius: 12,
                        border: "2px dashed var(--gold)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: 16,
                      }}
                    >
                      <span style={{ fontSize: "4rem" }}>🎬</span>
                      <h3 style={{ color: "var(--gold)", marginTop: 12 }}>{config?.movieName || "Telugu Movie Time"}</h3>
                    </div>
                  )}
                </div>

                {/* Movie Meta & Synopsis Column */}
                <div style={{ flex: "1 1 340px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                      <span style={{ background: "var(--gold)", color: "#0d0d1a", fontWeight: 900, fontSize: "0.75rem", padding: "3px 10px", borderRadius: 6 }}>
                        {activeScreenName}
                      </span>
                      <span style={{ background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: "0.75rem", padding: "3px 10px", borderRadius: 6, fontWeight: 700 }}>
                        {config?.genre || "Action / Drama · Telugu (U/A)"}
                      </span>
                      <span style={{ color: "var(--gold)", fontSize: "0.85rem", fontWeight: 700 }}>
                        From ₹{config?.tierPrices?.Silver || 200}
                      </span>
                    </div>

                    <h1 style={{ fontSize: "2.4rem", color: "#fff", margin: "4px 0 8px", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
                      {config?.movieName || "PARADISE"}
                    </h1>

                    <p style={{ color: "var(--gold)", fontSize: "1rem", fontWeight: 600, fontStyle: "italic", margin: "0 0 16px" }}>
                      "{config?.movieTagline || "Experience the Grand Telugu Premiere with Student Special Treats!"}"
                    </p>

                    <p style={{ color: "#d0d0e0", fontSize: "0.92rem", lineHeight: 1.7, margin: "0 0 20px" }}>
                      {config?.movieDescription || "Join fellow movie enthusiasts for an exclusive cinematic screening organized by Telugu Movie Time! Experience premium Dolby Atmos sound, crystal-clear projection, luxury seating, and exciting Telugu student community vibes."}
                    </p>
                  </div>

                  {/* Highlights Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>📅 Date & Time</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", marginTop: 2 }}>{formattedDate}</div>
                      <div style={{ color: "var(--gold)", fontWeight: 800, fontSize: "0.82rem" }}>{config?.showTime || "8:00 AM"}</div>
                    </div>

                    <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>🏛️ Cinema Venue</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", marginTop: 2 }}>{config?.theater || "Crystal Mall"}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{activeScreenName}</div>
                    </div>
                  </div>

                  {/* Big Call to Action Button */}
                  <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-gold"
                      style={{ flex: "1 1 200px", padding: "14px 28px", fontSize: "1.05rem", fontWeight: 800, justifyContent: "center", gap: 8, boxShadow: "0 8px 25px rgba(255,215,0,0.4)" }}
                      onClick={() => setActiveView("booking")}
                    >
                      <Ticket size={20} /> Select Your Seats Now 🚀
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "14px 20px", fontSize: "0.9rem", gap: 6 }}
                      onClick={handleShare}
                    >
                      <Share2 size={18} /> Share Show
                    </button>
                  </div>
                </div>
              </div>

              {/* Venue Location & Contact Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                {/* Location & Directions Card */}
                <div className="card" style={{ padding: 22 }}>
                  <h3 style={{ color: "var(--gold)", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
                    📍 Venue & Location Directions
                  </h3>
                  <p style={{ color: "#e0e0e0", fontSize: "0.92rem", lineHeight: 1.5, margin: "0 0 14px" }}>
                    <strong>{config?.theater || "Crystal Mall"}</strong> ({activeScreenName})<br />
                    <span style={{ color: "var(--text-muted)" }}>{config?.locationAddress || "Crystal Mall, 3rd Floor, Kalawad Road, Rajkot"}</span>
                  </p>
                  <a
                    href={config?.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(config?.theater || "Crystal Mall")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    style={{ width: "100%", justifyContent: "center", gap: 8, fontWeight: 700 }}
                  >
                    🗺️ Open in Google Maps Navigation
                  </a>
                </div>

                {/* Contact & Support Card */}
                <div className="card" style={{ padding: 22 }}>
                  <h3 style={{ color: "var(--gold)", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
                    💬 Organizers & Student Helpline
                  </h3>
                  <p style={{ color: "#e0e0e0", fontSize: "0.92rem", lineHeight: 1.5, margin: "0 0 14px" }}>
                    Need group bookings, transportation assistance, or payment verification help? Contact our Telugu Movie Time student team directly.
                  </p>
                  <a
                    href={`https://wa.me/${config?.adminPhone || "919876543210"}?text=Hi%20TMT%20Team!%20I%20have%20a%20query%20about%20the%20show.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-wa"
                    style={{ width: "100%", justifyContent: "center", gap: 8, fontWeight: 700 }}
                  >
                    <MessageCircle size={18} /> Chat with Admin Helpline on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          ) : (
            /* ════ VIEW 2: INTERACTIVE SEATING MAP & BOOKING FORM ════ */
            <>
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
                    <h2>Choose Your Seats ({activeScreenName})</h2>
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
            </>
          )}
        </main>
      )}
    </>
  );
}
