import { useState } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Lock, Unlock, ShieldAlert, Check, RefreshCw, Eye } from "lucide-react";
import toast from "react-hot-toast";
import "./AdminSeatMap.css";

import { DEFAULT_SCREENS } from "../hooks/useMovieConfig";

/**
 * Interactive Admin Seat Map:
 * Highlights Confirmed (Red), Pending (Orange), and Blocked (Grey).
 * Master Admin has full block/unblock controls. Co-Admin has view-only monitoring.
 */
export default function AdminSeatMap({ seatMap, bookings, config, layout, readOnly = false }) {
  const [selectedScreenId, setSelectedScreenId] = useState(() => config?.activeScreenId || "screen-1");
  const [saving, setSaving] = useState(false);

  const screens = config?.screens || DEFAULT_SCREENS;

  const currentScreen = screens.find((s) => s.id === selectedScreenId) || screens[0];

  // Whenever selected screen changes, load that screen's blocked seats
  const [blockedSeats, setBlockedSeats] = useState(() => {
    const scr = screens.find((s) => s.id === (config?.activeScreenId || "screen-1")) || screens[0];
    return new Set(scr?.blockedSeats || config?.blockedSeats || []);
  });

  const handleScreenChange = (screenId) => {
    setSelectedScreenId(screenId);
    const targetScr = screens.find((s) => s.id === screenId) || screens[0];
    setBlockedSeats(new Set(targetScr?.blockedSeats || []));
  };

  const bookedByMap = {};
  const seatStatusMap = {};

  (bookings || [])
    .filter((b) => b && b.status !== "cancelled")
    .forEach((b) => {
      const bScreen = b.screenId || "screen-1";
      if (bScreen !== selectedScreenId) return; // STRICTLY ISOLATE BY SCREEN

      const isConfirmed = b.status === "confirmed";
      const isPending = b.status === "pending";

      (b.seats || []).forEach((seatId) => {
        bookedByMap[seatId] = b.name;
        seatStatusMap[seatId] = isConfirmed ? "booked" : isPending ? "pending" : "available";
      });
    });

  const screenLayout = currentScreen?.layout || (selectedScreenId === (config?.activeScreenId || "screen-1") ? config?.layout : null) || layout;
  const screenPosition = screenLayout?.screenPosition || "top";
  const screenAtBottom = screenPosition === "bottom";
  const displayRows = screenAtBottom
    ? [...(screenLayout?.rows || [])].reverse()
    : (screenLayout?.rows || []);

  const rowTiers = screenLayout?.rowTiers || {};
  const tierPrices = currentScreen?.tierPrices || screenLayout?.tierPrices || config?.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

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

  const [clickMode, setClickMode] = useState("block"); // "block" (Grey 🔒) or "booked" (Red 🔴)

  // Handle seat click based on clickMode (block vs booked)
  const handleSeatClick = async (seatId) => {
    if (readOnly) return;

    const targetDocId = config?.id || config?.theaterId || sessionStorage.getItem("adminTheaterId") || "current";

    if (clickMode === "booked") {
      const isAlreadyBooked = seatStatusMap[seatId] === "booked";
      if (isAlreadyBooked) {
        try {
          const { getDocs, collection, query, where, deleteDoc } = await import("firebase/firestore");
          const q = query(collection(db, "bookings"), where("seats", "array-contains", seatId));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            if (d.data().screenId === selectedScreenId || d.data().screenId === (currentScreen?.id || "screen-1")) {
              await deleteDoc(d.ref);
            }
          }
          toast.success(`Seat ${seatId} marked as Available 🟢`);
        } catch (e) {
          toast.error("Failed to unmark booking");
        }
      } else {
        try {
          const bookingId = `admin_bkg_${selectedScreenId}_${seatId}_${Date.now()}`;
          await setDoc(doc(db, "bookings", bookingId), {
            id: bookingId,
            screenId: selectedScreenId,
            theaterId: targetDocId,
            name: "Admin Reserved",
            email: "admin@theater.com",
            phone: "0000000000",
            upiId: "ADMIN-RESERVED",
            seats: [seatId],
            totalAmount: 0,
            status: "confirmed",
            createdAt: new Date().toISOString(),
          });
          setBlockedSeats((prev) => {
            const next = new Set(prev);
            next.delete(seatId);
            return next;
          });
          toast.success(`Seat ${seatId} marked as CONFIRMED BOOKED 🔴`);
        } catch (e) {
          toast.error("Failed to mark seat as booked");
        }
      }
    } else {
      toggleSeatBlock(seatId);
    }
  };

  const handleRowClick = async (rowLabel) => {
    if (readOnly) return;

    const rowSlots = screenLayout?.seats?.[rowLabel] || [];
    const totalCols = rowSlots.length;
    const seatDirection = screenLayout?.seatDirection || "ltr";
    const isRTL = seatDirection === "rtl";
    const isFixed = screenLayout?.numberingMode === "fixed";
    const activeSlots = rowSlots.filter((s) => s !== null).length;
    const numsInRow = rowSlots.filter((s) => typeof s === "number");
    const maxRowSeatNum = numsInRow.length > 0 ? Math.max(...numsInRow) : activeSlots;

    let seqNum = 0;
    const rowSeatIds = [];
    rowSlots.forEach((slot, idx) => {
      if (slot !== null) {
        seqNum++;
        let num;
        if (typeof slot === "number") {
          num = isRTL ? (maxRowSeatNum - slot + 1) : slot;
        } else if (isFixed) {
          num = isRTL ? (totalCols - idx) : (idx + 1);
        } else {
          num = isRTL ? (activeSlots - seqNum + 1) : seqNum;
        }
        rowSeatIds.push(`${rowLabel}${num}`);
      }
    });

    if (clickMode === "booked") {
      const targetDocId = config?.id || config?.theaterId || sessionStorage.getItem("adminTheaterId") || "current";
      const allBooked = rowSeatIds.every((id) => seatStatusMap[id] === "booked");

      if (allBooked) {
        try {
          const { getDocs, collection, query, where, deleteDoc } = await import("firebase/firestore");
          for (const seatId of rowSeatIds) {
            const q = query(collection(db, "bookings"), where("seats", "array-contains", seatId));
            const snap = await getDocs(q);
            snap.docs.forEach(async (d) => {
              if (d.data().screenId === selectedScreenId) await deleteDoc(d.ref);
            });
          }
          toast.success(`Row ${rowLabel} unbooked 🟢`);
        } catch (e) {}
      } else {
        try {
          const bookingId = `admin_bkg_${selectedScreenId}_${rowLabel}_${Date.now()}`;
          await setDoc(doc(db, "bookings", bookingId), {
            id: bookingId,
            screenId: selectedScreenId,
            theaterId: targetDocId,
            name: "Admin Reserved Row",
            email: "admin@theater.com",
            phone: "0000000000",
            upiId: "ADMIN-RESERVED",
            seats: rowSeatIds,
            totalAmount: 0,
            status: "confirmed",
            createdAt: new Date().toISOString(),
          });
          setBlockedSeats((prev) => {
            const next = new Set(prev);
            rowSeatIds.forEach((id) => next.delete(id));
            return next;
          });
          toast.success(`Row ${rowLabel} marked as CONFIRMED BOOKED 🔴`);
        } catch (e) {}
      }
    } else {
      toggleRowBlock(rowLabel);
    }
  };

  const clearAllBlocks = () => {
    if (readOnly) return;
    setBlockedSeats(new Set());
    toast.success(`Cleared all seat blocks for ${currentScreen?.name}! 🟢`);
  };

  const saveAvailability = async () => {
    if (readOnly) return;
    setSaving(true);
    const blockedList = Array.from(blockedSeats);

    const updatedScreens = screens.map((s) => {
      if (s.id === selectedScreenId) {
        return {
          ...s,
          blockedSeats: blockedList,
        };
      }
      return s;
    });

    const updated = {
      ...config,
      screens: updatedScreens,
      blockedSeats: selectedScreenId === (config?.activeScreenId || "screen-1") ? blockedList : config?.blockedSeats,
    };

    const targetDocId = config?.id || config?.theaterId || sessionStorage.getItem("adminTheaterId") || "current";

    try {
      localStorage.setItem(`telugu_talkies_movie_config_${targetDocId}`, JSON.stringify(updated));
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    try {
      await setDoc(doc(db, "movieConfig", targetDocId), updated, { merge: true });
      if (targetDocId && targetDocId !== "current") {
        await setDoc(doc(db, "theaters", targetDocId), { screens: updatedScreens }, { merge: true });
      }
      toast.success(`Saved blocked seats for ${currentScreen?.name}! 🚀`);
    } catch (err) {
      toast.success("Saved locally! ✅");
    }
    setSaving(false);
  };

  return (
    <div className="admin-seatmap-wrapper">
      {/* Screen Switcher */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16, background: "rgba(255, 215, 0, 0.06)", border: "1px solid rgba(255, 215, 0, 0.2)", borderRadius: 10, padding: "10px 16px" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--gold)", fontWeight: 800 }}>
          🖥️ View Screen Layout:
        </span>
        {screens.map((scr) => {
          const isCurrent = scr.id === selectedScreenId;
          return (
            <button
              key={scr.id}
              type="button"
              className={`btn ${isCurrent ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "6px 14px", fontSize: "0.82rem", fontWeight: 700 }}
              onClick={() => handleScreenChange(scr.id)}
            >
              {scr.name} {scr.isPublished ? "✓ LIVE" : ""}
            </button>
          );
        })}
      </div>

      {/* Top Toolbar */}
      <div className="admin-seatmap-toolbar">
        <div>
          <h3 className="admin-seatmap-title">
            {readOnly ? `Live Theater Seat Map — ${currentScreen?.name || "Screen"}` : `Manage Seat Availability — ${currentScreen?.name || "Screen"}`}
          </h3>
          <p className="admin-seatmap-sub">
            {readOnly
              ? "View live confirmed (Red), pending verification (Orange), and available seats (Green)."
              : "Click any seat or row button to toggle seat status. Choose Click Mode below:"}
          </p>
        </div>

        {!readOnly && (
          <div className="admin-seatmap-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,0.06)", padding: 4, borderRadius: 8, border: "1px solid var(--border)" }}>
              <button
                type="button"
                className={`btn ${clickMode === "block" ? "btn-gold" : "btn-ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.8rem", fontWeight: 700, borderRadius: 6 }}
                onClick={() => setClickMode("block")}
              >
                🔒 Block Mode (Grey ⬛)
              </button>
              <button
                type="button"
                className={`btn ${clickMode === "booked" ? "btn-danger" : "btn-ghost"}`}
                style={{ padding: "6px 14px", fontSize: "0.8rem", fontWeight: 700, borderRadius: 6, background: clickMode === "booked" ? "#E50914" : "", color: "#FFF" }}
                onClick={() => setClickMode("booked")}
              >
                🔴 Mark Booked (Red 🔴)
              </button>
            </div>

            {blockedSeats.size > 0 && (
              <button className="btn btn-ghost" onClick={clearAllBlocks} style={{ fontSize: "0.8rem" }}>
                <Unlock size={14} /> Clear All ({blockedSeats.size}) Blocks
              </button>
            )}

            <button
              className="btn btn-gold"
              onClick={saveAvailability}
              disabled={saving}
              style={{ fontSize: "0.85rem", padding: "8px 18px", gap: 6, fontWeight: 700 }}
            >
              <Check size={16} /> {saving ? "Saving…" : "Save Seat Availability"}
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
          const rowSlots = screenLayout?.seats?.[rowLabel] || [];
          const totalCols = rowSlots.length;
          const tier = rowTiers[rowLabel] || "Silver";
          const tierPrice = tierPrices[tier] || 200;

          const seatDirection = screenLayout?.seatDirection || "ltr";
          const isRTL = seatDirection === "rtl";
          const isFixed = screenLayout?.numberingMode === "fixed";
          const activeSlots = rowSlots.filter((s) => s !== null).length;
          const numsInRow = rowSlots.filter((s) => typeof s === "number");
          const maxRowSeatNum = numsInRow.length > 0 ? Math.max(...numsInRow) : activeSlots;

          let seqNum = 0;
          return (
            <div className="seatmap-row" key={rowLabel}>
              <div className="seatmap-row-label-group">
                <button
                  type="button"
                  className={`admin-row-toggle-btn ${readOnly ? "admin-row-toggle-btn--readonly" : ""}`}
                  onClick={() => handleRowClick(rowLabel)}
                  disabled={readOnly}
                  title={readOnly ? `Row ${rowLabel}` : `Click to toggle Row ${rowLabel} as ${clickMode === "booked" ? "Booked (Red)" : "Blocked (Grey)"}`}
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

                  seqNum++;
                  let num;
                  if (typeof slot === "number") {
                    num = isRTL ? (maxRowSeatNum - slot + 1) : slot;
                  } else if (isFixed) {
                    num = isRTL ? (totalCols - idx) : (idx + 1);
                  } else {
                    num = isRTL ? (activeSlots - seqNum + 1) : seqNum;
                  }

                  const seatId = `${rowLabel}${num}`;
                  const isBlocked = blockedSeats.has(seatId);
                  const status = isBlocked ? "blocked" : (seatStatusMap[seatId] || "available");
                  const booker = bookedByMap[seatId];

                  return (
                    <button
                      key={`${rowLabel}-${idx}-${num}`}
                      type="button"
                      className={`seat seat--${status} ${!readOnly ? "seat--clickable" : ""} seat--tier-${tier.toLowerCase()}`}
                      onClick={() => handleSeatClick(seatId)}
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
