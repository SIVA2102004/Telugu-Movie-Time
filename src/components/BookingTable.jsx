import { useState } from "react";
import { db, rtdb } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { ref, set } from "firebase/database";
import { MessageCircle, Check, X, Search, Download, CheckCircle, Edit3, Trash2, Save } from "lucide-react";
import toast from "react-hot-toast";
import "./BookingTable.css";

const STATUS_OPTIONS = ["All", "pending", "confirmed", "cancelled"];

export default function BookingTable({ bookings, setBookings, config }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [editingBooking, setEditingBooking] = useState(null);

  // ── Filter & search ─────────────────────────────────────────────────────
  const filtered = bookings.filter((b) => {
    const matchStatus = filter === "All" || b.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.name?.toLowerCase().includes(q) ||
      b.phone?.includes(q) ||
      b.upiId?.toLowerCase().includes(q) ||
      b.college?.toLowerCase().includes(q) ||
      (b.seats || []).some((s) => s.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  // Generates ticket WhatsApp link with detailed message
  const getTicketWhatsAppUrl = (booking) => {
    const seats = (booking.seats || []).join(", ");
    const cleanPhone = String(booking.phone).replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;

    const msg = encodeURIComponent(
      `🎟️ *TELUGU TALKIES - MOVIE TICKET CONFIRMATION* 🎬\n\n` +
      `👤 *Name:* ${booking.name}\n` +
      `🍿 *Movie:* ${config.movieName || "Telugu Movie"}\n` +
      `📅 *Date:* ${config.date || "Upcoming Show"}\n` +
      `⏰ *Time:* ${config.showTime || "TBA"}\n` +
      `📍 *Theater:* ${config.theater || "Theater"}\n` +
      `💺 *Confirmed Seats:* *${seats}*\n` +
      `💰 *Total Paid:* *₹${booking.totalAmount}*\n` +
      `💳 *UTR / Ref:* ${booking.upiId || "Verified"}\n` +
      `🏫 *College:* ${booking.college || ""} (${booking.year || ""})\n\n` +
      `✅ *STATUS: CONFIRMED*\n\n` +
      `📌 *Instructions:*\n` +
      `• Please show this ticket message at the entry gate.\n` +
      `• Please arrive 15 minutes before the show.\n\n` +
      `Enjoy the show together! 🍿🎉\n- Telugu Talkies Admin`
    );

    return `https://wa.me/${formattedPhone}?text=${msg}`;
  };

  // ── 1. CONFIRM BOOKING (Instant 0ms Execution) ──────────────────────────
  const confirmBooking = (booking) => {
    if (setBookings) {
      setBookings((prev) => {
        const updated = prev.map((b) => (b.id === booking.id ? { ...b, status: "confirmed" } : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem("telugu_talkies_seats_cache") || "{}");
      (booking.seats || []).forEach((s) => { seatsCache[s] = "booked"; });
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Confirmed: ${booking.name} ✅`);

    const waUrl = getTicketWhatsAppUrl(booking);
    window.open(waUrl, "_blank");

    Promise.resolve().then(async () => {
      try {
        await setDoc(doc(db, "bookings", booking.id), { status: "confirmed" }, { merge: true });
        await Promise.all(
          (booking.seats || []).map((s) => set(ref(rtdb, `seats/${s}`), "booked"))
        );
      } catch (e) {
        console.warn("Firestore confirm sync notice:", e);
      }
    });
  };

  // ── 2. CANCEL BOOKING (Instant 0ms Execution & Seat Release) ─────────────
  const cancelBooking = (booking) => {
    if (setBookings) {
      setBookings((prev) => {
        const updated = prev.map((b) => (b.id === booking.id ? { ...b, status: "cancelled" } : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem("telugu_talkies_seats_cache") || "{}");
      (booking.seats || []).forEach((s) => { seatsCache[s] = "available"; });
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Cancelled: ${booking.name}. Seats released! 🟢`);

    Promise.resolve().then(async () => {
      try {
        await setDoc(doc(db, "bookings", booking.id), { status: "cancelled" }, { merge: true });
        await Promise.all(
          (booking.seats || []).map((s) => set(ref(rtdb, `seats/${s}`), "available"))
        );
      } catch (e) {
        console.warn("Firestore cancel sync notice:", e);
      }
    });
  };

  // ── 3. DELETE BOOKING (Instant 0ms Removal & Seat Release) ───────────────
  const deleteBooking = (booking) => {
    if (setBookings) {
      setBookings((prev) => {
        const updated = prev.filter((b) => b.id !== booking.id);
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem("telugu_talkies_seats_cache") || "{}");
      (booking.seats || []).forEach((s) => { seatsCache[s] = "available"; });
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Deleted booking for ${booking.name}`);

    Promise.resolve().then(async () => {
      try {
        await deleteDoc(doc(db, "bookings", booking.id));
        await Promise.all(
          (booking.seats || []).map((s) => set(ref(rtdb, `seats/${s}`), "available"))
        );
      } catch (e) {
        console.warn("Firestore delete sync notice:", e);
      }
    });
  };

  // ── 4. EDIT BOOKING (Instant 0ms Save) ───────────────────────────────────
  const saveEditedBooking = (e) => {
    e.preventDefault();
    if (!editingBooking) return;

    const updatedBooking = { ...editingBooking };

    if (setBookings) {
      setBookings((prev) => {
        const updated = prev.map((b) => (b.id === updatedBooking.id ? updatedBooking : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    toast.success("Booking updated! ✅");
    setEditingBooking(null);

    Promise.resolve().then(async () => {
      try {
        await setDoc(doc(db, "bookings", updatedBooking.id), updatedBooking, { merge: true });
      } catch (e) {
        console.warn("Firestore edit sync notice:", e);
      }
    });
  };

  // ── 5. BULK CONFIRM ALL PENDING (Instant 0ms) ────────────────────────────
  const confirmAllPending = () => {
    const pendingList = bookings.filter((b) => b.status === "pending");
    if (pendingList.length === 0) {
      toast("No pending bookings to confirm.", { icon: "ℹ️" });
      return;
    }

    if (setBookings) {
      setBookings((prev) => {
        const updated = prev.map((b) => (b.status === "pending" ? { ...b, status: "confirmed" } : b));
        try { localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    }

    try {
      const seatsCache = JSON.parse(localStorage.getItem("telugu_talkies_seats_cache") || "{}");
      pendingList.forEach((b) => {
        (b.seats || []).forEach((s) => { seatsCache[s] = "booked"; });
      });
      localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(seatsCache));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    toast.success(`Confirmed all ${pendingList.length} bookings! 🚀`);

    Promise.resolve().then(async () => {
      try {
        for (const booking of pendingList) {
          await setDoc(doc(db, "bookings", booking.id), { status: "confirmed" }, { merge: true });
          (booking.seats || []).forEach((s) => set(ref(rtdb, `seats/${s}`), "booked"));
        }
      } catch (e) {}
    });
  };

  const openWhatsApp = (booking) => {
    const waUrl = getTicketWhatsAppUrl(booking);
    window.open(waUrl, "_blank");
  };

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const confirmed = bookings.filter((b) => b.status === "confirmed");
    if (confirmed.length === 0) { toast.error("No confirmed bookings to export."); return; }

    const headers = ["#", "Name", "Phone", "College", "Year", "Seats", "Amount", "UTR / Ref", "Target UPI", "Status"];
    const rows = confirmed.map((b, i) => [
      i + 1,
      b.name,
      b.phone,
      b.college,
      b.year,
      (b.seats || []).join(" "),
      b.totalAmount,
      b.upiId,
      b.upiTarget || config.upiId || "",
      b.status,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telugu-talkies-bookings-${config.movieName?.replace(/\s+/g, "-") || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${confirmed.length} bookings.`);
  };

  const pendingCount = bookings.filter((b) => b.status === "pending").length;

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
          {pendingCount > 0 && (
            <button className="btn btn-green" onClick={confirmAllPending} title="Confirm all pending requests">
              <CheckCircle size={14} /> Confirm All ({pendingCount})
            </button>
          )}

          <button className="btn btn-outline" onClick={exportCSV}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="bt-count">
        Showing <strong>{filtered.length}</strong> of <strong>{bookings.length}</strong> bookings
      </p>

      {/* Table */}
      <div className="bt-scroll">
        <table className="bt-table">
          <thead>
            <tr>
              <th>#</th>
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
                <td colSpan={10} className="bt-empty">No bookings found.</td>
              </tr>
            ) : (
              filtered.map((b, i) => (
                <tr key={b.id || i}>
                  <td>{i + 1}</td>
                  <td className="bt-name">{b.name}</td>
                  <td>
                    <a href={`tel:${b.phone}`} style={{ color: "var(--text)" }}>
                      {b.phone}
                    </a>
                  </td>
                  <td>{b.college}</td>
                  <td>{b.year}</td>
                  <td>
                    <div className="seat-chips">
                      {(b.seats || []).map((s) => (
                        <span key={s} className="seat-chip">{s}</span>
                      ))}
                    </div>
                  </td>
                  <td><strong style={{ color: "var(--gold)" }}>₹{b.totalAmount}</strong></td>
                  <td className="bt-upi">
                    <span title={`Paid with reference: ${b.upiId}`}>
                      {b.upiId || "N/A"}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                  </td>
                  <td>
                    <div className="bt-actions">
                      {b.status === "pending" && (
                        <button
                          className="btn btn-green"
                          style={{ padding: "6px 10px", gap: 4, fontSize: "0.74rem" }}
                          onClick={() => confirmBooking(b)}
                          title="Verify payment & send ticket on WhatsApp"
                        >
                          <Check size={13} /> Confirm
                        </button>
                      )}

                      {b.status !== "cancelled" && (
                        <button
                          className="btn btn-red"
                          style={{ padding: "5px 8px" }}
                          onClick={() => cancelBooking(b)}
                          title="Cancel Booking & Release Seats"
                        >
                          <X size={13} />
                        </button>
                      )}

                      <button
                        className="btn btn-ghost"
                        style={{ padding: "5px 8px", color: "var(--gold)" }}
                        onClick={() => setEditingBooking({ ...b, seatsInput: (b.seats || []).join(", ") })}
                        title="Edit Booking Details"
                      >
                        <Edit3 size={13} />
                      </button>

                      <button
                        className="btn btn-ghost"
                        style={{ padding: "5px 8px", color: "var(--red)" }}
                        onClick={() => deleteBooking(b)}
                        title="Permanently Delete Booking"
                      >
                        <Trash2 size={13} />
                      </button>

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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Booking Modal */}
      {editingBooking && (
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
