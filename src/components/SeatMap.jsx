import React, { useMemo } from "react";
import "./SeatMap.css";

/**
 * Optimized individual seat button with Blue (Male), Pink (Female), Red (General Booked), Orange (Pending), and Green (Available).
 */
const SeatButton = React.memo(function SeatButton({
  seatId,
  num,
  status,
  gender,
  tier,
  tierPrice,
  clickable,
  readOnly,
  bookedBy,
  onToggle
}) {
  let statusClass = `seat--${status}`;
  if (status === "booked" && gender) {
    statusClass += ` seat--booked-${gender.toLowerCase()}`;
  }

  const tooltip = bookedBy
    ? `Booked by: ${bookedBy} (${gender || "Confirmed"})`
    : status === "pending"
    ? `${seatId} (Pending Payment Verification)`
    : status === "booked"
    ? `${seatId} Confirmed (${gender ? (gender === "Male" ? "Male / Boy" : "Female / Girl") : "Booked"})`
    : status === "locked"
    ? "Someone is selecting this seat…"
    : status === "blocked"
    ? "Not available"
    : `${seatId} (${tier} - ₹${tierPrice || ""})`;

  return (
    <button
      className={`seat ${statusClass} seat--tier-${tier.toLowerCase()}${clickable ? " seat--clickable" : ""}`}
      onClick={() => clickable && onToggle(seatId)}
      disabled={readOnly || (!clickable && status !== "selected")}
      title={tooltip}
      aria-label={`Seat ${seatId}: ${status} (${tier})`}
    >
      {num}
    </button>
  );
});

/**
 * High-performance SeatMap component.
 */
export default function SeatMap({
  layout,
  seatMap = {},
  selectedSeats = [],
  bookings = [],
  onSeatToggle,
  maxSeats = 6,
  blockedSeats = [],
  readOnly = false,
  bookedByMap = {},
}) {
  const screenPosition = layout?.screenPosition || "top";
  const screenAtBottom = screenPosition === "bottom";

  const displayRows = useMemo(() => {
    return screenAtBottom
      ? [...(layout?.rows || [])].reverse()
      : (layout?.rows || []);
  }, [screenAtBottom, layout?.rows]);

  const rowTiers = layout?.rowTiers || {};
  const tierPrices = layout?.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

  const blockedSet = useMemo(() => new Set(blockedSeats), [blockedSeats]);
  const selectedSet = useMemo(() => new Set(selectedSeats), [selectedSeats]);

  // Compute map of confirmed seat genders and statuses from bookings
  const { bookingSeatStatus, bookingSeatGender, bookingSeatUser } = useMemo(() => {
    const statusMap = {};
    const genderMap = {};
    const userMap = {};

    (bookings || []).forEach((b) => {
      const isConfirmed = b.status === "confirmed";
      const isPending = b.status === "pending";

      (b.attendees || []).forEach((a) => {
        if (a.seatId) {
          genderMap[a.seatId] = a.gender || b.gender || "Male";
          userMap[a.seatId] = a.name || b.name;
          if (isConfirmed) statusMap[a.seatId] = "booked";
          else if (isPending) statusMap[a.seatId] = "pending";
        }
      });

      // Fallback for bookings without per-seat attendees array
      (b.seats || []).forEach((seatId) => {
        if (!genderMap[seatId]) {
          genderMap[seatId] = b.gender || "Male";
          userMap[seatId] = b.name;
        }
        if (isConfirmed) statusMap[seatId] = "booked";
        else if (isPending) statusMap[seatId] = "pending";
      });
    });

    return { bookingSeatStatus: statusMap, bookingSeatGender: genderMap, bookingSeatUser: userMap };
  }, [bookings]);

  const getSeatStatus = (seatId) => {
    if (blockedSet.has(seatId)) return "blocked";
    if (selectedSet.has(seatId)) return "selected";
    if (bookingSeatStatus[seatId]) return bookingSeatStatus[seatId];
    return seatMap[seatId] || "available";
  };

  const canToggle = (seatId) => {
    const status = getSeatStatus(seatId);
    if (status === "selected") return true;
    if (status !== "available") return false;
    return selectedSeats.length < maxSeats;
  };

  if (!layout || !layout.rows || !layout.seats) {
    return (
      <p style={{ color: "var(--text-muted)", textAlign: "center", padding: 24 }}>
        No layout configured.
      </p>
    );
  }

  const ScreenBar = () => (
    <div className="screen-bar">
      <div className="screen-bar__line" />
      <span>SCREEN THIS SIDE</span>
      <div className="screen-bar__line" />
    </div>
  );

  return (
    <div className="seatmap-wrapper">
      {/* Tier Price Summary Bar */}
      <div className="seatmap-tier-summary">
        {Object.entries(tierPrices).map(([tier, price]) => (
          <div key={tier} className={`seatmap-tier-pill seatmap-tier-pill--${tier.toLowerCase()}`}>
            <span className="pill-name">{tier}</span>
            <span className="pill-price">₹{price}</span>
          </div>
        ))}
      </div>

      {/* Screen at TOP */}
      {!screenAtBottom && <ScreenBar />}

      {/* Seat grid */}
      <div className="seatmap-grid">
        {displayRows.map((rowLabel) => {
          const rowSlots = layout.seats[rowLabel] || [];
          const tier = rowTiers[rowLabel] || "Silver";
          const tierPrice = tierPrices[tier];

          let seatNum = 0;
          return (
            <div className="seatmap-row" key={rowLabel}>
              <div className="seatmap-row-label-group">
                <span className="seatmap-row-label">{rowLabel}</span>
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
                  const status = getSeatStatus(seatId);
                  const gender = bookingSeatGender[seatId];
                  const clickable = !readOnly && canToggle(seatId);

                  return (
                    <SeatButton
                      key={seatId}
                      seatId={seatId}
                      num={num}
                      status={status}
                      gender={gender}
                      tier={tier}
                      tierPrice={tierPrice}
                      clickable={clickable}
                      readOnly={readOnly}
                      bookedBy={bookedByMap[seatId] || bookingSeatUser[seatId]}
                      onToggle={onSeatToggle}
                    />
                  );
                })}
              </div>

              <span className="seatmap-row-label seatmap-row-label--right">{rowLabel}</span>
            </div>
          );
        })}
      </div>

      {/* Screen at BOTTOM */}
      {screenAtBottom && <ScreenBar />}

      {/* Legend */}
      <div className="seatmap-legend">
        <LegendItem color="var(--green)" label="Available" />
        <LegendItem color="#FF9800"      label="Pending Verification" />
        <LegendItem color="#2979FF"      label="Confirmed Male (Boy)" />
        <LegendItem color="#FF4081"      label="Confirmed Female (Girl)" />
        <LegendItem color="var(--yellow)" label="Your Selection" />
        <LegendItem color="var(--grey)"   label="Blocked" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="legend-item">
      <span className="legend-dot" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
