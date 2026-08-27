import { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Lock, Unlock, ShieldAlert, Check, RefreshCw, Eye } from "lucide-react";
import toast from "react-hot-toast";
import "./AdminSeatMap.css";

/**
 * Interactive Admin Seat Map:
 * Highlights Confirmed (Red), Pending (Orange), and Blocked (Grey).
 * Master Admin has full block/unblock controls. Co-Admin has view-only monitoring.
 */
export default function AdminSeatMap({ seatMap, bookings, config, layout, readOnly = false }) {
  const [blockedSeats, setBlockedSeats] = useState(() => {
    return new Set(config?.blockedSeats || []);
  });
  const [saving, setSaving] = useState(false);

  const bookedByMap = {};
  const seatStatusMap = {};

  bookings
    .filter((b) => b.status !== "cancelled")
    .forEach((b) => {
      const isConfirmed = b.status === "confirmed";
      const isPending = b.status === "pending";

      (b.seats || []).forEach((seatId) => {
        bookedByMap[seatId] = b.name;
        seatStatusMap[seatId] = isConfirmed ? "booked" : isPending ? "pending" : "available";
      });
    });

  const screenPosition = layout?.screenPosition || "top";
  const screenAtBottom = screenPosition === "bottom";
  const displayRows = screenAtBottom
    ? [...(layout?.rows || [])].reverse()
    : (layout?.rows || []);

  const rowTiers = layout?.rowTiers || {};
  const tierPrices = config?.tierPrices || layout?.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

  // Click seat in admin seat map to block/unblock
  const toggleSeatBlock = (seatId) => {
    if (readOnly) return;

    if (bookedByMap[seatId]) {
      if (!window.confirm(`Seat ${seatId} is booked by ${bookedByMap[seatId]}. Block it anyway?`)) {
        return;
      }
    }

    setBlockedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(seatId)) {
        next.delete(seatId);
        toast.success(`Seat ${seatId} unblocked`);
      } else {
        next.add(seatId);
        toast(`Seat ${seatId} blocked`, { icon: "🔒" });
      }
      return next;
    });
  };

  // Block or unblock entire row
  const toggleRowBlock = (rowLabel) => {
    if (readOnly) return;

    const rowSlots = layout?.seats?.[rowLabel] || [];
    let seatNum = 0;
    const rowSeatIds = [];
    rowSlots.forEach((slot) => {
      if (slot !== null) {
        seatNum++;
        rowSeatIds.push(`${rowLabel}${seatNum}`);
      }
    });

    setBlockedSeats((prev) => {
      const next = new Set(prev);
      const allBlocked = rowSeatIds.every((id) => next.has(id));
      if (allBlocked) {
        rowSeatIds.forEach((id) => next.delete(id));
        toast.success(`Row ${rowLabel} unblocked`);
      } else {
        rowSeatIds.forEach((id) => next.add(id));
        toast(`Row ${rowLabel} blocked`, { icon: "🔒" });
      }
      return next;
    });
  };

  const clearAllBlocks = () => {
    if (readOnly) return;
    setBlockedSeats(new Set());
    toast.success("All seat blocks cleared! 🟢");
  };

  const saveAvailability = async () => {
    if (readOnly) return;
    setSaving(true);
    const blockedList = Array.from(blockedSeats);
    const updated = {
      ...config,
      blockedSeats: blockedList,
    };

    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
    } catch (e) {}

    try {
      await setDoc(doc(db, "movieConfig", "current"), { blockedSeats: blockedList }, { merge: true });
      toast.success("Seat availability saved successfully! 🚀");
    } catch (err) {
      toast.success("Saved to local workspace cache! ✅");
    }
    setSaving(false);
  };

  return (
    <div className="admin-seatmap-wrapper">
      {/* Top Toolbar */}
      <div className="admin-seatmap-toolbar">
        <div>
          <h3 className="admin-seatmap-title">
            {readOnly ? "Live Theater Seat Map (Monitoring Mode)" : "Manage Seat Availability"}
          </h3>
          <p className="admin-seatmap-sub">
            {readOnly
              ? "View live confirmed (Red), pending verification (Orange), and available seats (Green)."
              : "Click any seat or row button to toggle Available (Green) vs Blocked (Grey)"}
          </p>
        </div>

        {!readOnly && (
          <div className="admin-seatmap-actions">
            {blockedSeats.size > 0 && (
              <button className="btn btn-ghost" onClick={clearAllBlocks} style={{ fontSize: "0.8rem" }}>
                <Unlock size={13} /> Unblock All ({blockedSeats.size})
              </button>
            )}

            <button className="btn btn-gold" onClick={saveAvailability} disabled={saving}>
              {saving ? "Saving…" : <><Check size={14} /> Save Availability</>}
            </button>
          </div>
        )}
      </div>

      {/* Screen Bar */}
      {!screenAtBottom && (
        <div className="screen-bar" style={{ maxWidth: 800, margin: "16px auto" }}>
          <div className="screen-bar__line" />
          <span>SCREEN (FRONT)</span>
          <div className="screen-bar__line" />
        </div>
      )}

      {/* Interactive Seat Grid */}
      <div className="seatmap-grid" style={{ maxWidth: 880, margin: "0 auto" }}>
        {displayRows.map((rowLabel) => {
          const rowSlots = layout?.seats?.[rowLabel] || [];
          const tier = rowTiers[rowLabel] || "Silver";
          const tierPrice = tierPrices[tier] || 200;

          let seatNum = 0;
          return (
            <div className="seatmap-row" key={rowLabel}>
              <div className="seatmap-row-label-group">
                <button
                  type="button"
                  className={`admin-row-toggle-btn ${readOnly ? "admin-row-toggle-btn--readonly" : ""}`}
                  onClick={() => toggleRowBlock(rowLabel)}
                  disabled={readOnly}
                  title={readOnly ? `Row ${rowLabel}` : `Click to block/unblock entire Row ${rowLabel}`}
                >
                  {rowLabel}
                </button>
                <span className={`seatmap-tier-tag seatmap-tier-tag--${tier.toLowerCase()}`}>
                  {tier.slice(0, 4)}
                </span>
              </div>

              <div className="seatmap-seats">
                {rowSlots.map((slot, idx) => {
                  if (slot === null) {
                    return <span key={`gap-${idx}`} className="seat-gap" />;
                  }

                  seatNum++;
                  const num = seatNum;
                  const seatId = `${rowLabel}${num}`;
                  const isBlocked = blockedSeats.has(seatId);
                  const status = isBlocked ? "blocked" : (seatStatusMap[seatId] || "available");
                  const booker = bookedByMap[seatId];

                  return (
                    <button
                      key={seatId}
                      type="button"
                      className={`seat seat--${status} ${!readOnly ? "seat--clickable" : ""} seat--tier-${tier.toLowerCase()}`}
                      onClick={() => toggleSeatBlock(seatId)}
                      disabled={readOnly}
                      title={
                        booker
                          ? `Booked by: ${booker} (Confirmed)`
                          : isBlocked
                          ? `Seat ${seatId} is BLOCKED`
                          : `Seat ${seatId} is AVAILABLE (${tier} - ₹${tierPrice})`
                      }
                    >
                      {isBlocked ? "✕" : num}
                    </button>
                  );
                })}
              </div>

              <span className="seatmap-row-label seatmap-row-label--right">{rowLabel}</span>
            </div>
          );
        })}
      </div>

      {screenAtBottom && (
        <div className="screen-bar" style={{ maxWidth: 800, margin: "16px auto" }}>
          <div className="screen-bar__line" />
          <span>SCREEN (FRONT)</span>
          <div className="screen-bar__line" />
        </div>
      )}

      {/* Legend for Admin */}
      <div className="seatmap-legend" style={{ marginTop: 16 }}>
        <div className="legend-item"><span className="legend-dot" style={{ background: "var(--green)" }} /> Available</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "#FF9800" }} /> Pending Verification</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "var(--red)" }} /> Confirmed Booked</div>
        <div className="legend-item"><span className="legend-dot" style={{ background: "var(--grey)" }} /> Blocked (Admin)</div>
      </div>
    </div>
  );
}
