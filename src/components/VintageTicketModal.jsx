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

  const handleShareTicketImage = async () => {
    if (!ticketRef.current) return;
    setDownloading(true);
    toast.loading("Preparing Ticket Image for WhatsApp...", { id: "ticket-share" });
    try {
      const dataUrl = await toPng(ticketRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: "#0d0d1a",
      });

      // Convert base64 dataUrl to blob and file
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `TMT-Vintage-Ticket-${customerName.replace(/\s+/g, "_")}.png`, { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Telugu Movie Time Ticket — ${movieName}`,
          text: `🎟️ *TELUGU MOVIE TIME TICKET*\nMovie: ${movieName}\nScreen: ${activeScreenName}\nSeats: ${seatsString}\nName: ${customerName}`,
        });
        toast.success("Ticket shared to WhatsApp! 🎉", { id: "ticket-share" });
      } else {
        // Fallback: download the image and open WhatsApp with pre-filled message
        download(dataUrl, `TMT-Ticket-${movieName.replace(/\s+/g, "_")}-${activeScreenName.replace(/\s+/g, "_")}-${booking.id || "ticket"}.png`, "image/png");
        toast.success("Ticket Image saved! Opening WhatsApp...", { id: "ticket-share" });
        sendWhatsAppWithTicketLink();
      }
    } catch (err) {
      console.warn("Share notice:", err);
      // Fallback
      handleDownload();
      sendWhatsAppWithTicketLink();
    } finally {
      setDownloading(false);
    }
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

        {/* Scrollable Container for the Ticket */}
        <div className="ticket-preview-viewport">
          {/* THE PARADISE OFFICIAL TICKET CARD WITH OVERLAY SEAT NUMBERS */}
          <div
            className="paradise-ticket-card"
            ref={ticketRef}
            style={{
              position: "relative",
              width: 800,
              minWidth: 800,
              height: 520,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 12px 36px rgba(0,0,0,0.8)",
              background: "#000",
            }}
          >
            {/* Base Official Ticket Graphic */}
            <img
              src="/paradise_ticket_card.jpg"
              alt="The Paradise Official Movie Ticket"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />

            {/* DYNAMIC SEAT NUMBERS OVERLAY ON WHITE BOX */}
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
                  fontSize: seatsString.length > 12 ? "1.1rem" : seatsString.length > 6 ? "1.4rem" : "1.8rem",
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
              onClick={handleShareTicketImage}
              disabled={downloading}
              style={{ flex: 1.2, padding: "12px", justifyContent: "center", gap: 8, fontSize: "0.95rem" }}
            >
              <MessageCircle size={18} /> Send Ticket Image on WhatsApp 📲
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
