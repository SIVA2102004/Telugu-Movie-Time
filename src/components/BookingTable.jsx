import { useState } from "react";
import { db, rtdb } from "../firebase";
import { doc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { MessageCircle, Check, X, Search, Download, CheckCircle, Edit3, Trash2, Save, UserCheck, Shield, RefreshCw, RotateCcw, Ticket } from "lucide-react";
import toast from "react-hot-toast";
import VintageTicketModal from "./VintageTicketModal";
import "./BookingTable.css";

const STATUS_OPTIONS = ["All", "pending", "confirmed", "cancelled"];

export default function BookingTable({
  bookings = [],
  setBookings,
  config = {},
  adminRole = "master",
  refreshBookings,
  refreshing = false,
}) {
  const isMasterAdmin = adminRole === "master";

  const [filter, setFilter] = useState("All");
  const [screenFilter, setScreenFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editingBooking, setEditingBooking] = useState(null);
  const [selectedTicketBooking, setSelectedTicketBooking] = useState(null);

  const safeBookings = Array.isArray(bookings) ? bookings : [];

  // ── Detect duplicate seat conflicts between multiple bookings per screen ──
  const seatBookingMap = {};
  safeBookings.forEach((b) => {
    if (b && b.status !== "cancelled" && Array.isArray(b.seats)) {
      const bScreen = b.screenId || "screen-1";
      b.seats.forEach((s) => {
        const key = `${bScreen}_${s}`;
        if (!seatBookingMap[key]) seatBookingMap[key] = [];
        seatBookingMap[key].push(b);
      });
    }
  });

  const conflictingSeatSet = new Set(
    Object.keys(seatBookingMap).filter((k) => seatBookingMap[k].length > 1)
  );

  // ── Filter & search ─────────────────────────────────────────────────────
  const filtered = safeBookings.filter((b) => {
    if (!b) return false;
    const matchStatus = filter === "All" || b.status === filter;
    const bScreen = b.screenId || "screen-1";
    const matchScreen = screenFilter === "all" || bScreen === screenFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.name?.toLowerCase().includes(q) ||
      b.phone?.includes(q) ||
      b.upiId?.toLowerCase().includes(q) ||
      b.college?.toLowerCase().includes(q) ||
      b.screenName?.toLowerCase().includes(q) ||
      (Array.isArray(b.seats) && b.seats.some((s) => s?.toLowerCase().includes(q)));
    return matchStatus && matchScreen && matchSearch;
  });

  // Helper to format 10-digit phone to international format (91XXXXXXXXXX)
  const formatWhatsAppPhone = (rawPhone) => {
    let p = String(rawPhone || "").replace(/\D/g, "");
    if (!p) return "";
    if (p.length === 10) return `91${p}`;
    if (p.length === 12 && p.startsWith("91")) return p;
    if (p.startsWith("0")) return `91${p.slice(1)}`;
    return p;
  };

  // Generates ticket WhatsApp link with detailed message
  const getTicketWhatsAppUrl = (booking) => {
    if (!booking) return "";
    const seats = Array.isArray(booking.seats) ? booking.seats.join(", ") : (booking.seats || "");
    const formattedPhone = formatWhatsAppPhone(booking.phone);
    if (!formattedPhone) return "";
    const ticketDownloadUrl = `https://tmt-wheat.vercel.app/ticket/${booking.id}`;

    const activeScreenName = config?.screens?.find((s) => s.id === config?.activeScreenId)?.name || "Screen 1";
    const msg = encodeURIComponent(
      `🎟️ *TELUGU MOVIE TIME (TMT) - MOVIE TICKET CONFIRMATION* 🎬\n\n` +
      `👤 *Name:* ${booking.name || "Movie Lover"}\n` +
      `🍿 *Movie:* ${config?.movieName || "PARADISE"}\n` +
      `🖥️ *Screen / Audi:* *${activeScreenName}*\n` +
      `📅 *Date:* 24-09-2026\n` +
      `⏰ *Time:* ${config?.showTime || "8:00 AM"}\n` +
      `📍 *Theater:* ${config?.theater || "Crystal Mall"} (${activeScreenName})\n` +
      `💺 *Confirmed Seats:* *${seats}*\n` +
      `💰 *Total Paid:* *₹${booking.totalAmount || 0}*\n` +
      `💳 *UTR / Ref:* ${booking.upiId || "Verified"}\n` +
      `🏫 *College:* ${booking.college || ""} (${booking.year || ""})\n\n` +
      `✅ *STATUS: CONFIRMED*\n\n` +
      `🎟️ *Download Official Ticket Card:* \n${ticketDownloadUrl}\n\n` +
      `📌 *Instructions:*\n` +
      `• Please show this ticket / ticket image at the entry gate.\n` +
      `• Please arrive 15 minutes before the show.\n\n` +
      `Enjoy the show together! 🍿🎉\n- Telugu Movie Time Admin`
    );

    return `https://wa.me/${formattedPhone}?text=${msg}`;
  };

  // Generates Cancellation WhatsApp message link
  const getCancellationWhatsAppUrl = (booking, reason = "Cancelled") => {
    if (!booking) return "";
    const seats = Array.isArray(booking.seats) ? booking.seats.join(", ") : (booking.seats || "");
    const formattedPhone = formatWhatsAppPhone(booking.phone);
    if (!formattedPhone) return "";

    const activeScreenName = config?.screens?.find((s) => s.id === config?.activeScreenId)?.name || "Screen 1";
    const msg = encodeURIComponent(
      `❌ *TELUGU MOVIE TIME (TMT) — BOOKING CANCELLED* ⚠️\n\n` +
      `Hello *${booking.name || "Customer"}*,\n` +
      `Your booking request for *${config?.movieName || "Telugu Movie"}* (*${activeScreenName}*) has been *${reason.toUpperCase()}* by Admin.\n\n` +
      `💺 *Seats Released:* ${seats}\n` +
      `💰 *Amount:* ₹${booking.totalAmount || 0}\n` +
      `💳 *UTR / Ref:* ${booking.upiId || "N/A"}\n\n` +
      `📌 *Reason / Note:*\n` +
      `• Payment verification failed, duplicate seats selected, or request cancelled.\n` +
      `• If money was debited from your account, please contact the admin team with your bank statement.\n\n` +
      `For queries, reply directly to this number.\n- Telugu Movie Time Team`
    );

    return `https://wa.me/${formattedPhone}?text=${msg}`;
  };

  // ── 1. CONFIRM BOOKING (Instant 0ms Execution for both Master Admin & Co-Admin) ──
  const confirmBooking = (booking) => {
    if (!booking || !booking.id) return;

    const bScreen = booking.screenId || "screen-1";
    const currentAdminUser = sessionStorage.getItem("adminName") || (isMasterAdmin ? "Master Admin" : "Co-Admin");

    if (setBookings) {
      setBookings((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const updated = safePrev.map((b) => (b.id === booking.id ? { ...b, status: "confirmed", confirmedBy: currentAdminUser, confirmedAt: new Date().toISOString() } : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem(`telugu_talkies_seats_cache_${bScreen}`) || "{}");
      (booking.seats || []).forEach((s) => { seatsCache[s] = "booked"; });
      localStorage.setItem(`telugu_talkies_seats_cache_${bScreen}`, JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Confirmed: ${booking.name} by ${currentAdminUser} 🎟️`);

    // Automatically open Vintage Ticket Modal for this booking
    setSelectedTicketBooking({ ...booking, status: "confirmed" });

    const waUrl = getTicketWhatsAppUrl(booking);
    if (waUrl) window.open(waUrl, "_blank");

    Promise.resolve().then(async () => {
      try {
        await setDoc(doc(db, "bookings", booking.id), {
          status: "confirmed",
          confirmedBy: currentAdminUser,
          confirmedAt: new Date().toISOString(),
        }, { merge: true });
        await set(ref(rtdb, `all_bookings/${booking.id}/status`), "confirmed");
        await set(ref(rtdb, `all_bookings/${booking.id}/confirmedBy`), currentAdminUser);
        await Promise.all([
          ...(booking.seats || []).map((s) => set(ref(rtdb, `seats_${bScreen}/${s}`), "booked")),
          ...(booking.seats || []).map((s) => set(ref(rtdb, `seats/${s}`), "booked")),
        ]);
      } catch (e) {
        console.warn("Firestore confirm sync notice:", e);
      }
    });
  };

  // ── 2. CANCEL BOOKING (Master Admin only) ─────────────────────────────
  const cancelBooking = (booking) => {
    if (!isMasterAdmin) {
      toast.error("Permission denied: Only Master Admin can cancel bookings.");
      return;
    }
    if (!booking || !booking.id) return;

    const bScreen = booking.screenId || "screen-1";

    if (setBookings) {
      setBookings((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const updated = safePrev.map((b) => (b.id === booking.id ? { ...b, status: "cancelled" } : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem(`telugu_talkies_seats_cache_${bScreen}`) || "{}");
      (booking.seats || []).forEach((s) => { seatsCache[s] = "available"; });
      localStorage.setItem(`telugu_talkies_seats_cache_${bScreen}`, JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Cancelled: ${booking.name}. Seats released! 🟢`);

    // Automatically send Cancellation notification message on WhatsApp
    const cancelWaUrl = getCancellationWhatsAppUrl(booking, "Cancelled");
    if (cancelWaUrl) window.open(cancelWaUrl, "_blank");

    Promise.resolve().then(async () => {
      try {
        await setDoc(doc(db, "bookings", booking.id), { status: "cancelled" }, { merge: true });
        await set(ref(rtdb, `all_bookings/${booking.id}/status`), "cancelled");
        await Promise.all([
          ...(booking.seats || []).map((s) => set(ref(rtdb, `seats_${bScreen}/${s}`), "available")),
          ...(booking.seats || []).map((s) => set(ref(rtdb, `seats/${s}`), "available")),
        ]);
      } catch (e) {
        console.warn("Firestore cancel sync notice:", e);
      }
    });
  };

  // ── 3. DELETE BOOKING (Master Admin only) ───────────────────────────────
  const deleteBooking = (booking) => {
    if (!isMasterAdmin) {
      toast.error("Permission denied: Only Master Admin can delete records.");
      return;
    }
    if (!booking || !booking.id) return;

    const bScreen = booking.screenId || "screen-1";

    if (setBookings) {
      setBookings((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const updated = safePrev.filter((b) => b.id !== booking.id);
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem(`telugu_talkies_seats_cache_${bScreen}`) || "{}");
      (booking.seats || []).forEach((s) => { seatsCache[s] = "available"; });
      localStorage.setItem(`telugu_talkies_seats_cache_${bScreen}`, JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Deleted booking for ${booking.name}`);

    // Automatically send Cancellation notification message on WhatsApp
    const deleteWaUrl = getCancellationWhatsAppUrl(booking, "Deleted & Cancelled");
    if (deleteWaUrl) window.open(deleteWaUrl, "_blank");

    Promise.resolve().then(async () => {
      try {
        await deleteDoc(doc(db, "bookings", booking.id));
        await set(ref(rtdb, `all_bookings/${booking.id}`), null);
        await Promise.all([
          ...(booking.seats || []).map((s) => set(ref(rtdb, `seats_${bScreen}/${s}`), "available")),
          ...(booking.seats || []).map((s) => set(ref(rtdb, `seats/${s}`), "available")),
        ]);
      } catch (e) {
        console.warn("Firestore delete sync notice:", e);
      }
    });
  };

  // ── 4. EDIT BOOKING (Master Admin only) ───────────────────────────────────
  const saveEditedBooking = (e) => {
    e.preventDefault();
    if (!editingBooking || !editingBooking.id) return;
    if (!isMasterAdmin) {
      toast.error("Permission denied: Only Master Admin can edit bookings.");
      return;
    }

    const updatedBooking = { ...editingBooking };

    if (setBookings) {
      setBookings((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const updated = safePrev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    toast.success("Booking updated! ✅");
    setEditingBooking(null);

    Promise.resolve().then(async () => {
      try {
        await setDoc(doc(db, "bookings", updatedBooking.id), updatedBooking, { merge: true });
        await set(ref(rtdb, `all_bookings/${updatedBooking.id}`), updatedBooking);
      } catch (e) {
        console.warn("Firestore edit sync notice:", e);
      }
    });
  };

  // ── 5. BULK CONFIRM ALL PENDING (Instant 0ms) ────────────────────────────
  const confirmAllPending = () => {
    const pendingList = safeBookings.filter((b) => b?.status === "pending");
    if (pendingList.length === 0) {
      toast("No pending bookings to confirm.", { icon: "ℹ️" });
      return;
    }

    if (setBookings) {
      setBookings((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        const updated = safePrev.map((b) => (b?.status === "pending" ? { ...b, status: "confirmed" } : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem("telugu_talkies_seats_cache") || "{}");
      pendingList.forEach((b) => {
        (b?.seats || []).forEach((s) => { seatsCache[s] = "booked"; });
      });
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Confirmed all ${pendingList.length} bookings! 🚀`);

    Promise.resolve().then(async () => {
      try {
        for (const booking of pendingList) {
          await setDoc(doc(db, "bookings", booking.id), { status: "confirmed" }, { merge: true });
          await set(ref(rtdb, `all_bookings/${booking.id}/status`), "confirmed");
          (booking?.seats || []).forEach((s) => set(ref(rtdb, `seats/${s}`), "booked"));
        }
      } catch (e) {}
    });
  };

  // ── 6. RESET ALL DATABASE & SEATS (Master Admin Only) ────────────────────
  const resetDatabase = async () => {
    if (!isMasterAdmin) {
      toast.error("Permission denied: Only Master Admin can reset database.");
      return;
    }

    if (!window.confirm("⚠️ ARE YOU SURE YOU WANT TO RESET THE ENTIRE DATABASE?\n\nThis will permanently delete all bookings, clear all pending/booked seats, and reset the hall back to 100% available.")) {
      return;
    }

    // 1. Instantly clear local storage
    try {
      localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify([]));
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify({}));
      if (setBookings) setBookings([]);
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.loading("Resetting cloud database...", { id: "reset-toast" });

    try {
      // 2. Clear all bookings from Firestore
      const snap = await getDocs(collection(db, "bookings"));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "bookings", d.id))));

      // 3. Clear RTDB bookings & seat locks
      try {
        await set(ref(rtdb, "seats"), null);
        await set(ref(rtdb, "all_bookings"), null);
      } catch (rtdbErr) {}

      toast.success("Database & Seat Map reset successfully! 🟢", { id: "reset-toast" });
      if (refreshBookings) refreshBookings();
    } catch (err) {
      console.error("Database reset error:", err);
      toast.error("Error resetting database. Check internet connection.", { id: "reset-toast" });
    }
  };

  const openWhatsApp = (booking) => {
    const waUrl = getTicketWhatsAppUrl(booking);
    if (waUrl) window.open(waUrl, "_blank");
  };

  // ── Export CSV (Master Admin only) ───────────────────────────────────────
  const exportCSV = () => {
    const confirmed = safeBookings.filter((b) => b?.status === "confirmed");
    if (confirmed.length === 0) { toast.error("No confirmed bookings to export."); return; }

    const headers = ["#", "Screen", "Name", "Phone", "College", "Year", "Seats", "Amount", "UTR / Ref", "Target UPI", "Status"];
    const rows = confirmed.map((b, i) => [
      i + 1,
      b?.screenName || (config?.screens?.find((s) => s.id === b?.screenId)?.name) || "Screen 1",
      b?.name || "",
      b?.phone || "",
      b?.college || "",
      b?.year || "",
      Array.isArray(b?.seats) ? b.seats.join(" ") : (b?.seats || ""),
      b?.totalAmount || 0,
      b?.upiId || "",
      b?.upiTarget || config?.upiId || "",
      b?.status || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telugu-movie-time-bookings-${config?.movieName?.replace(/\s+/g, "-") || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${confirmed.length} bookings.`);
  };

  const pendingCount = safeBookings.filter((b) => b?.status === "pending").length;

  return (
    <div className="booking-table-wrapper">
      {/* Controls */}
      <div className="booking-table-controls">
        <div className="bt-filters">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              className={`btn ${filter === s ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "6px 14px" }}
              onClick={() => setFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s === "pending" && pendingCount > 0 && (
                <span className="bt-pending-bubble">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Screen Filter Selector */}
        {(config?.screens || []).length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700 }}>Screen:</span>
            <button
              className={`btn ${screenFilter === "all" ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "3px 10px", fontSize: "0.74rem" }}
              onClick={() => setScreenFilter("all")}
            >
              All Screens
            </button>
            {(config?.screens || []).map((scr) => (
              <button
                key={scr.id}
                className={`btn ${screenFilter === scr.id ? "btn-gold" : "btn-ghost"}`}
                style={{ padding: "3px 10px", fontSize: "0.74rem" }}
                onClick={() => setScreenFilter(scr.id)}
              >
                {scr.name}
              </button>
            ))}
          </div>
        )}

        <div className="bt-search">
          <Search size={15} color="var(--text-muted)" />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search name, phone, seats, UTR…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="bt-top-actions">
          {refreshBookings && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                refreshBookings();
                toast.success("Bookings refreshed from cloud! 🔄");
              }}
              disabled={refreshing}
              title="Refresh bookings from cloud database"
              style={{ padding: "6px 12px", gap: 5, color: "var(--gold)" }}
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}

          {pendingCount > 0 && (
            <button className="btn btn-green" onClick={confirmAllPending} title="Confirm all pending requests">
              <CheckCircle size={14} /> Confirm All ({pendingCount})
            </button>
          )}

          {isMasterAdmin && (
            <button className="btn btn-outline" onClick={exportCSV}>
              <Download size={14} /> Export CSV
            </button>
          )}

          {isMasterAdmin && (
            <button
              className="btn btn-red"
              onClick={resetDatabase}
              title="Reset all bookings & seat map"
              style={{ padding: "6px 12px", gap: 5 }}
            >
              <RotateCcw size={14} /> Reset Database
            </button>
          )}
        </div>
      </div>

      {conflictingSeatSet.size > 0 && (
        <div style={{ background: "rgba(255, 68, 68, 0.12)", border: "1px solid var(--red)", borderRadius: 8, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ color: "#ff4444", fontSize: "0.85rem", fontWeight: 700 }}>
            ⚠️ SEAT CONFLICT DETECTED: Seat(s) {Array.from(conflictingSeatSet).join(", ")} were submitted by multiple students simultaneously!
          </div>
          <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
            Review the UTR / Payment timestamp below: Click <strong>"Confirm"</strong> for the verified student and <strong>"Edit"</strong> or <strong>"Cancel"</strong> for the duplicate.
          </span>
        </div>
      )}

      {/* Count */}
      <p className="bt-count">
        Showing <strong>{filtered.length}</strong> of <strong>{safeBookings.length}</strong> bookings
        {!isMasterAdmin && (
          <span style={{ marginLeft: 8, color: "#4fc3f7", fontSize: "0.75rem", fontWeight: 700 }}>
            (Co-Admin Mode: Ticket Verification & Confirmation Access)
          </span>
        )}
      </p>

      {/* Table */}
      <div className="bt-scroll">
        <table className="bt-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Screen</th>
              <th>Name</th>
              <th>Phone</th>
              <th>College</th>
              <th>Year</th>
              <th>Seats</th>
              <th>Amount</th>
              <th>UTR / Ref</th>
              <th>Status</th>
              <th>Admin Controls</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} className="bt-empty">No bookings found.</td>
              </tr>
            ) : (
              filtered.map((b, i) => {
                const screenBadgeText = b?.screenName || (config?.screens?.find((s) => s.id === b?.screenId)?.name) || (b?.screenId ? b.screenId.toUpperCase().replace("-", " ") : "Screen 1");
                return (
                <tr key={b?.id || i}>
                  <td>{i + 1}</td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "rgba(255, 215, 0, 0.12)",
                        border: "1px solid rgba(255, 215, 0, 0.35)",
                        color: "var(--gold)",
                        fontSize: "0.74rem",
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      🖥️ {screenBadgeText}
                    </span>
                  </td>
                  <td className="bt-name">{b?.name || "N/A"}</td>
                  <td>
                    <a href={`tel:${b?.phone}`} style={{ color: "var(--text)" }}>
                      {b?.phone || "N/A"}
                    </a>
                  </td>
                  <td>{b?.college || "—"}</td>
                  <td>{b?.year || "—"}</td>
                  <td>
                    <div className="seat-chips">
                      {(Array.isArray(b?.seats) ? b.seats : []).map((s) => {
                        const bScreen = b.screenId || "screen-1";
                        const hasConflict = conflictingSeatSet.has(`${bScreen}_${s}`);
                        return (
                          <span
                            key={s}
                            className={`seat-chip ${hasConflict ? "seat-chip--conflict" : ""}`}
                            title={hasConflict ? `Seat ${s} is duplicated in another booking on ${screenBadgeText}!` : `Seat ${s}`}
                          >
                            {s} {hasConflict && "⚠️"}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td><strong style={{ color: "var(--gold)" }}>₹{b?.totalAmount || 0}</strong></td>
                  <td className="bt-upi">
                    <span title={`Paid with reference: ${b?.upiId}`}>
                      {b?.upiId || "N/A"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span className={`badge badge-${b?.status || "pending"}`}>{b?.status || "pending"}</span>
                      {b?.status === "confirmed" && b?.confirmedBy && (
                        <span style={{ fontSize: "0.68rem", color: "#4fc3f7", fontWeight: 700 }}>
                          ✓ by {b.confirmedBy}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="bt-actions">
                      {/* Confirm & WhatsApp Ticket (Available to both Master & Co-Admin) */}
                      {b?.status === "pending" && (
                        <button
                          className="btn btn-green"
                          style={{ padding: "6px 12px", gap: 4, fontSize: "0.76rem", fontWeight: 700 }}
                          onClick={() => confirmBooking(b)}
                          title="Verify payment & send ticket on WhatsApp"
                        >
                          <Check size={14} /> Confirm
                        </button>
                      )}

                      {/* Cancel (Master Admin Only) */}
                      {isMasterAdmin && b?.status !== "cancelled" && (
                        <button
                          className="btn btn-red"
                          style={{ padding: "5px 8px" }}
                          onClick={() => cancelBooking(b)}
                          title="Cancel Booking & Release Seats"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {/* Edit Booking (Master Admin Only) */}
                      {isMasterAdmin && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "5px 8px", color: "var(--gold)" }}
                          onClick={() => setEditingBooking({ ...b, seatsInput: (Array.isArray(b?.seats) ? b.seats : []).join(", ") })}
                          title="Edit Booking Details"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}

                      {/* Delete Booking (Master Admin Only) */}
                      {isMasterAdmin && (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "5px 8px", color: "var(--red)" }}
                          onClick={() => deleteBooking(b)}
                          title="Permanently Delete Booking"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}

                      {/* Vintage Ticket Preview & WhatsApp Send */}
                      <button
                        className="btn btn-gold"
                        style={{ padding: "5px 8px", gap: 4, fontSize: "0.72rem" }}
                        onClick={() => setSelectedTicketBooking(b)}
                        title="View & Download Official Vintage Ticket"
                      >
                        <Ticket size={13} /> Ticket
                      </button>

                      {/* WhatsApp manual link */}
                      <button
                        className="btn btn-wa"
                        style={{ padding: "5px 8px" }}
                        onClick={() => openWhatsApp(b)}
                        title="Send ticket message on WhatsApp"
                      >
                        <MessageCircle size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );})
            )}
          </tbody>
        </table>
      </div>

      {/* Vintage Ticket Modal for Official Ticket Image Generation */}
      {selectedTicketBooking && (
        <VintageTicketModal
          booking={selectedTicketBooking}
          config={config}
          onClose={() => setSelectedTicketBooking(null)}
        />
      )}

      {/* Edit Booking Modal */}
      {isMasterAdmin && editingBooking && (
        <div className="bt-modal-backdrop" onClick={() => setEditingBooking(null)}>
          <div className="bt-modal card" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "var(--gold)", marginBottom: 14 }}>Edit Booking</h3>
            <form onSubmit={saveEditedBooking} className="bt-edit-form">
              <div className="form-field">
                <label className="label">Student Name</label>
                <input
                  className="input"
                  value={editingBooking.name || ""}
                  onChange={(e) => setEditingBooking({ ...editingBooking, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  value={editingBooking.phone || ""}
                  onChange={(e) => setEditingBooking({ ...editingBooking, phone: e.target.value })}
                  required
                />
              </div>

              <div className="form-field">
                <label className="label">College</label>
                <input
                  className="input"
                  value={editingBooking.college || ""}
                  onChange={(e) => setEditingBooking({ ...editingBooking, college: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label className="label">Total Amount (₹)</label>
                <input
                  className="input"
                  type="number"
                  value={editingBooking.totalAmount || 0}
                  onChange={(e) => setEditingBooking({ ...editingBooking, totalAmount: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="form-field">
                <label className="label">UTR / Payment Reference</label>
                <input
                  className="input"
                  value={editingBooking.upiId || ""}
                  onChange={(e) => setEditingBooking({ ...editingBooking, upiId: e.target.value })}
                />
              </div>

              <div className="form-field">
                <label className="label">Status</label>
                <select
                  className="select"
                  value={editingBooking.status || "pending"}
                  onChange={(e) => setEditingBooking({ ...editingBooking, status: e.target.value })}
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="bt-modal-actions" style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingBooking(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-gold">
                  <Save size={14} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
