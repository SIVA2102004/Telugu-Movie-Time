import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { toPng } from "html-to-image";
import download from "downloadjs";
import { Download, Share2, ArrowLeft, Ticket as TicketIcon, CheckCircle2, Film } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function TicketViewPage() {
  const { bookingId } = useParams();
  const ticketRef = useRef(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchBooking() {
      if (!bookingId) return;

      // Check local storage first
      try {
        const localCache = JSON.parse(localStorage.getItem("telugu_talkies_bookings_cache") || "[]");
        const found = localCache.find((b) => b.id === bookingId);
        if (found) {
          setBooking(found);
          setLoading(false);
          return;
        }
      } catch (e) {}

      // Fetch from Firestore
      try {
        const docSnap = await getDoc(doc(db, "bookings", bookingId));
        if (docSnap.exists()) {
          setBooking({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (err) {
        console.error("Fetch booking error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBooking();
  }, [bookingId]);

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    setDownloading(true);
    toast.loading("Generating your high-res Movie Ticket...", { id: "dl-tkt" });
    try {
      const dataUrl = await toPng(ticketRef.current, {
        quality: 0.99,
        pixelRatio: 2,
        backgroundColor: "#000000",
      });
      download(dataUrl, `PARADISE-Ticket-${booking?.name?.replace(/\s+/g, "_") || "TMT"}-${booking?.id || "ticket"}.png`, "image/png");
      toast.success("Movie Ticket Saved! 🎟️", { id: "dl-tkt" });
    } catch (err) {
      toast.error("Failed to generate ticket image.", { id: "dl-tkt" });
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!ticketRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(ticketRef.current, {
        quality: 0.99,
        pixelRatio: 2,
        backgroundColor: "#000000",
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `PARADISE-Ticket-${booking?.name || "TMT"}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Telugu Movie Time - PARADISE Ticket",
          text: `🎟️ My Official Movie Ticket for PARADISE at Crystal Mall! Seats: ${Array.isArray(booking?.seats) ? booking.seats.join(", ") : booking?.seats}`,
        });
      } else {
        handleDownload();
      }
    } catch (e) {
      handleDownload();
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
        <p style={{ color: "var(--gold)", fontWeight: 700 }}>Loading Official Movie Ticket…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a14", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24, textAlign: "center" }}>
        <Film size={48} color="var(--gold)" />
        <h2 style={{ color: "var(--gold)" }}>Ticket Not Found</h2>
        <p style={{ color: "var(--text-muted)", maxWidth: 400 }}>We couldn't find a confirmed booking with this ID. Please check your link or contact the Telugu Movie Time admin.</p>
        <Link to="/" className="btn btn-gold" style={{ textDecoration: "none" }}>
          Go to Student Booking Portal
        </Link>
      </div>
    );
  }

  const seats = Array.isArray(booking.seats) ? booking.seats : (booking.seats ? [booking.seats] : []);
  const seatsString = seats.join(", ");

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #1a0808 0%, #08080c 70%, #000000 100%)", color: "#fff", padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Toaster position="top-center" />
      {/* Top Brand Bar */}
      <div style={{ width: "100%", maxWidth: 840, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--gold)", textDecoration: "none", fontSize: "0.88rem", fontWeight: 700 }}>
          <ArrowLeft size={18} /> Back to Portal
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--green)", fontSize: "0.88rem", fontWeight: 800 }}>
          <CheckCircle2 size={18} /> Confirmed Ticket
        </div>
      </div>

      {/* Ticket Container */}
      <div style={{ width: "100%", maxWidth: 800, background: "#11111a", borderRadius: 16, border: "1px solid rgba(255, 215, 0, 0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px 24px" }}>
        
        {/* Ticket Header text */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <span style={{ fontSize: "0.75rem", letterSpacing: 3, textTransform: "uppercase", color: "var(--gold)", fontWeight: 800 }}>
            Telugu Movie Time Official Entry Pass
          </span>
          <h1 style={{ margin: "4px 0 0", fontSize: "1.4rem", color: "#fff", fontWeight: 900 }}>
            {booking.name}'s Movie Ticket
          </h1>
        </div>

        {/* The Card Viewport */}
        <div style={{ width: "100%", display: "flex", justifyContent: "center", overflowX: "auto", padding: "4px 0 12px" }}>
          <div
            ref={ticketRef}
            style={{
              position: "relative",
              width: 760,
              minWidth: 760,
              height: 494,
              borderRadius: 10,
              overflow: "hidden",
              background: "#000",
              boxShadow: "0 10px 30px rgba(0,0,0,0.9)",
            }}
          >
            {/* The Paradise Official Ticket Artwork */}
            <img
              src="/paradise_ticket_card.jpg"
              alt="Paradise Movie Ticket"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />

            {/* STAMPED SEAT NUMBERS OVERLAY */}
            <div
              style={{
                position: "absolute",
                right: "3.2%",
                bottom: "19.5%",
                width: "25.2%",
                height: "14.2%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: "2px 6px",
                background: "#ffffff",
                borderRadius: 4,
                boxShadow: "inset 0 0 4px rgba(0,0,0,0.3)",
              }}
            >
              <span
                style={{
                  fontFamily: "'Arial Black', 'Impact', sans-serif",
                  fontWeight: 900,
                  fontSize: seatsString.length > 12 ? "1.1rem" : seatsString.length > 6 ? "1.35rem" : "1.75rem",
                  color: "#111111",
                  letterSpacing: "1px",
                  lineHeight: 1.1,
                  wordBreak: "break-word",
                }}
              >
                {seatsString || "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ width: "100%", maxWidth: 600, display: "flex", gap: 12, marginTop: 16, padding: "0 12px", flexWrap: "wrap" }}>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn btn-gold"
            style={{ flex: 1, padding: "14px", justifyContent: "center", fontSize: "1rem", fontWeight: 800, gap: 8, minWidth: 200 }}
          >
            <Download size={18} /> {downloading ? "Saving Ticket..." : "Download Ticket Image (.PNG)"}
          </button>
          <button
            onClick={handleShare}
            disabled={downloading}
            className="btn btn-outline"
            style={{ flex: 1, padding: "14px", justifyContent: "center", fontSize: "1rem", fontWeight: 800, gap: 8, minWidth: 200 }}
          >
            <Share2 size={18} /> Share Ticket
          </button>
        </div>

        {/* Gate Instructions */}
        <div style={{ marginTop: 20, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 18px", maxWidth: 600, width: "100%", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
          <p style={{ margin: "0 0 4px", color: "var(--gold)", fontWeight: 700 }}>📌 Gate Instructions:</p>
          <p style={{ margin: 0 }}>• Please present this downloaded ticket card at the entry gate of <strong>Crystal Mall</strong>.</p>
          <p style={{ margin: 0 }}>• Show time is <strong>8:00 AM, 24-09-2026</strong>. Please arrive 15 minutes before the show.</p>
        </div>
      </div>
    </div>
  );
}
