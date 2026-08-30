import React, { useRef, useState } from "react";
import { toPng } from "html-to-image";
import download from "downloadjs";
import { Download, Share2, MessageCircle, X, CheckCircle, Ticket as TicketIcon, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import "./VintageTicketModal.css";

export default function VintageTicketModal({
  booking,
  config = {},
  onClose,
  isStudent = false,
}) {
  const ticketRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [customPoster, setCustomPoster] = useState(config?.posterUrl || null);

  if (!booking) return null;

  const seats = Array.isArray(booking.seats) ? booking.seats : (booking.seats ? [booking.seats] : []);
  const seatsString = seats.join(", ");
  const movieName = config?.movieName || "PARADISE";
  const activeScreenName = config?.screens?.find((s) => s.id === config?.activeScreenId)?.name || "Screen 1";
  const theater = `${config?.theater || "CRYSTAL MALL"} · ${activeScreenName}`;
  const date = config?.date || "26 09 2026";
  const showTime = config?.showTime || "8:00 A.M.";
  const customerName = booking?.name || "Valued Guest";
  const ticketCount = seats.length || 1;

  const handleDownload = async () => {
    if (!ticketRef.current) return;
    setDownloading(true);
    toast.loading("Generating Vintage Ticket...", { id: "ticket-dl" });
    try {
      const dataUrl = await toPng(ticketRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: "#0d0d1a",
      });
      download(dataUrl, `TMT-Ticket-${movieName.replace(/\s+/g, "_")}-${activeScreenName.replace(/\s+/g, "_")}-${booking.id || "ticket"}.png`, "image/png");
      toast.success("Vintage Ticket Downloaded! 🎟️", { id: "ticket-dl" });
    } catch (err) {
      console.error("Error generating ticket image:", err);
      toast.error("Failed to generate ticket image. Please try again.", { id: "ticket-dl" });
    } finally {
      setDownloading(false);
    }
  };

  const handlePosterUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCustomPoster(reader.result);
        toast.success("Movie poster updated on ticket! 🎬");
      };
      reader.readAsDataURL(file);
    }
  };

  const formatWhatsAppPhone = (rawPhone) => {
    let p = String(rawPhone || "").replace(/\D/g, "");
    if (!p) return "";
    if (p.length === 10) return `91${p}`;
    if (p.length === 12 && p.startsWith("91")) return p;
    if (p.startsWith("0")) return `91${p.slice(1)}`;
    return p;
  };

  const formattedPhone = formatWhatsAppPhone(booking.phone);

  const sendWhatsAppWithTicketLink = () => {
    if (!formattedPhone) {
      toast.error("Customer phone number is missing or invalid.");
      return;
    }
    const msg = encodeURIComponent(
      `🎟️ *TELUGU MOVIE TIME (TMT) - VINTAGE TICKET CONFIRMATION* 🎬\n\n` +
      `👤 *Name:* ${booking.name || ""}\n` +
      `🍿 *Movie:* ${movieName}\n` +
      `🖥️ *Screen / Audi:* *${activeScreenName}*\n` +
      `📅 *Date:* ${date}\n` +
      `⏰ *Time:* ${showTime}\n` +
      `📍 *Theatre:* ${theater}\n` +
      `💺 *Confirmed Seats:* *${seatsString}* (${ticketCount} Ticket${ticketCount > 1 ? "s" : ""})\n` +
      `💰 *Total Paid:* *₹${booking.totalAmount || 0}*\n` +
      `💳 *UTR / Ref:* ${booking.upiId || "Verified"}\n` +
      `🏫 *College:* ${booking.college || ""} (${booking.year || ""})\n\n` +
      `✅ *STATUS: CONFIRMED*\n\n` +
      `📌 *Instructions:*\n` +
      `• Please show your ticket at the entrance gate.\n` +
      `• Please arrive 15 minutes before show time.\n\n` +
      `Enjoy the movie! 🍿🎉\n- Telugu Movie Time Team`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${msg}`, "_blank");
  };

  return (
    <div className="ticket-modal-overlay" onClick={onClose}>
      <div className="ticket-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header bar */}
        <div className="ticket-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TicketIcon size={20} color="var(--gold)" />
            <h3 style={{ margin: 0, color: "var(--gold)", fontSize: "1.1rem" }}>
              Official Vintage Ticket
            </h3>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Poster replace control for Admin */}
        <div className="ticket-modal-toolbar">
          <label className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "0.8rem", cursor: "pointer", gap: 6 }}>
            <ImageIcon size={14} /> Change Poster on Ticket
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePosterUpload} />
          </label>

          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginLeft: "auto" }}>
            Seat(s): <strong style={{ color: "var(--gold)" }}>{seatsString}</strong>
          </span>
        </div>

        {/* Scrollable Container for the Vintage Ticket */}
        <div className="ticket-preview-viewport">
          <div className="vintage-ticket" ref={ticketRef}>
            {/* LEFT MAIN TICKET BODY */}
            <div className="vintage-ticket__main">
              <div className="vintage-ticket__top-stars">
                <span>★ ★ ★</span>
                <span className="admit-one-text">ADMIT {ticketCount > 1 ? ticketCount : "ONE"}</span>
                <span>★ ★ ★</span>
              </div>

              {/* Movie Title in Vintage Horror / Cinematic Style */}
              <div className="vintage-ticket__movie-title">
                {movieName}
              </div>
              <div className="vintage-ticket__in-cinemas">
                — IN CINEMAS —
              </div>

              {/* Details & Popcorn Split */}
              <div className="vintage-ticket__details-row">
                <div className="vintage-ticket__info-group">
                  <div className="info-item">
                    <div className="info-icon">🏛️</div>
                    <div className="info-text">
                      <span className="info-label">THEATRE & SCREEN</span>
                      <span className="info-val">{theater}</span>
                      <span style={{ fontSize: "0.62rem", color: "#5a4b3c", fontWeight: 700, marginTop: 1 }}>
                        📍 {config?.locationAddress || "Crystal Mall, 3rd Floor, Kalawad Road, Rajkot"}
                      </span>
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-icon">📅</div>
                    <div className="info-text">
                      <span className="info-label">DATE</span>
                      <span className="info-val">{date}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-icon">⏰</div>
                    <div className="info-text">
                      <span className="info-label">SHOW TIME</span>
                      <span className="info-val">{showTime}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <div className="info-icon">💺</div>
                    <div className="info-text">
                      <span className="info-label">SEATS</span>
                      <span className="info-val seat-highlight">{seatsString}</span>
                    </div>
                  </div>
                </div>

                {/* Divider Line */}
                <div className="vintage-ticket__vertical-sep" />

                {/* Center Popcorn / Ticket Count */}
                <div className="vintage-ticket__center-badge">
                  <div className="popcorn-badge-icon">🍿</div>
                  <div className="ticket-count-num">{ticketCount}</div>
                  <div className="ticket-count-label">TICKET{ticketCount > 1 ? "S" : ""}</div>
                  <div className="ticket-guest-name">{customerName}</div>
                  <div className="ticket-thankyou">
                    THANK YOU<br />FOR CHOOSING US!
                  </div>
                </div>
              </div>

              {/* Bottom Footer */}
              <div className="vintage-ticket__bottom-bar">
                <span className="enjoy-text">🎬 ENJOY THE MOVIE!</span>
                <span className="rating-stars">★★★★★</span>
                <span className="tmt-branding-tag">TMT · TELUGU MOVIE TIME</span>
              </div>
            </div>

            {/* PERFORATION STUB LINE */}
            <div className="vintage-ticket__perforation">
              <div className="notch-top" />
              <div className="perf-dots" />
              <div className="notch-bottom" />
            </div>

            {/* RIGHT STUB WITH POSTER */}
            <div className="vintage-ticket__stub">
              <div className="stub-poster-wrapper">
                {customPoster ? (
                  <img src={customPoster} alt="Poster" className="stub-poster-img" />
                ) : (
                  <div className="stub-poster-placeholder">
                    <div className="stub-title-art">{movieName}</div>
                    <div className="stub-silhouette">👤</div>
                  </div>
                )}
                <div className="stub-poster-overlay">
                  <div className="stub-overlay-title">{movieName}</div>
                  <div className="stub-overlay-sub">— IN CINEMAS —</div>
                </div>
              </div>

              <div className="stub-footer-box">
                <div className="stub-theater">{theater}</div>
                <div className="stub-stars">★ ★ ★</div>
                <div className="stub-date">{date}</div>
                <div className="stub-time">{showTime}</div>
                <div className="stub-seat-tag">SEAT: {seatsString}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ticket-modal-actions">
          <button
            className="btn btn-gold"
            onClick={handleDownload}
            disabled={downloading}
            style={{ flex: 1, padding: "12px", justifyContent: "center", gap: 8, fontSize: "0.95rem" }}
          >
            <Download size={18} /> {downloading ? "Saving Ticket Image..." : "Download Vintage Ticket (.PNG)"}
          </button>

          {!isStudent && (
            <button
              className="btn btn-wa"
              onClick={sendWhatsAppWithTicketLink}
              style={{ flex: 1, padding: "12px", justifyContent: "center", gap: 8, fontSize: "0.95rem" }}
            >
              <MessageCircle size={18} /> Send Ticket to WhatsApp ({booking.phone})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
