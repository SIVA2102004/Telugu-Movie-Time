import { IndianRupee, Tag, ShieldAlert } from "lucide-react";
import "./AdminStats.css";

export default function AdminStats({ bookings, config, layout }) {
  // Compute total actual seats directly from dynamic layout
  const totalSeats = layout?.rows && layout?.seats
    ? layout.rows.reduce((sum, r) => {
        return sum + (layout.seats[r] || []).filter((s) => s !== null).length;
      }, 0)
    : 100;

  const blockedSeatsCount = (config.blockedSeats || []).length;

  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const pending   = bookings.filter((b) => b.status === "pending");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  const confirmedSeatCount = confirmed.reduce((sum, b) => sum + (b.seats?.length || 0), 0);
  const pendingSeatCount   = pending.reduce((sum, b) => sum + (b.seats?.length || 0), 0);
  const revenue            = confirmed.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  
  // Available = Total seats in layout minus booked/pending/admin blocked
  const available = Math.max(0, totalSeats - confirmedSeatCount - pendingSeatCount - blockedSeatsCount);

  // Calculate potential full-house revenue based on category tier pricing
  const rowTiers = layout?.rowTiers || {};
  const tierPrices = layout?.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

  const tierBreakdown = (layout?.rows || []).reduce((acc, rowLabel) => {
    const tier = rowTiers[rowLabel] || "Silver";
    const seatsInRow = (layout?.seats?.[rowLabel] || []).filter((s) => s !== null).length;
    acc[tier] = (acc[tier] || 0) + seatsInRow;
    return acc;
  }, {});

  const cards = [
    {
      label: "Total Hall Seats",
      value: totalSeats,
      sub: `${layout?.rows?.length || 0} rows in layout`,
      color: "var(--gold)",
      bg: "rgba(255,215,0,0.08)",
    },
    {
      label: "Confirmed Seats",
      value: confirmedSeatCount,
      sub: `${confirmed.length} bookings`,
      color: "var(--green)",
      bg: "rgba(0,200,81,0.08)",
    },
    {
      label: "Pending Requests",
      value: pendingSeatCount,
      sub: `${pending.length} requests`,
      color: "var(--yellow)",
      bg: "rgba(255,215,0,0.05)",
    },
    {
      label: "Available to Book",
      value: available,
      sub: blockedSeatsCount > 0 ? `${blockedSeatsCount} blocked by admin` : "seats left",
      color: "#4fc3f7",
      bg: "rgba(79,195,247,0.08)",
    },
    {
      label: "Confirmed Revenue",
      value: `₹${revenue.toLocaleString("en-IN")}`,
      sub: "total collected",
      color: "var(--green)",
      bg: "rgba(0,200,81,0.08)",
    },
  ];

  return (
    <div className="admin-overview-wrapper">
      <div className="admin-stats">
        {cards.map((c) => (
          <div key={c.label} className="stat-card card" style={{ borderColor: c.color + "55", background: c.bg }}>
            <div className="stat-card__label">{c.label}</div>
            <div className="stat-card__value" style={{ color: c.color }}>{c.value}</div>
            <div className="stat-card__sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Tier Category Breakdown Card */}
      {Object.keys(tierBreakdown).length > 0 && (
        <div className="card admin-overview-tier-card" style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--gold)", marginBottom: 12 }}>
            Layout Category Breakdown
          </h3>
          <div className="admin-overview-tiers">
            {Object.entries(tierBreakdown).map(([tier, count]) => (
              <div key={tier} className={`overview-tier-pill overview-tier-pill--${tier.toLowerCase()}`}>
                <span className="tier-name">{tier}</span>
                <span className="tier-rate">₹{tierPrices[tier] || 0}</span>
                <span className="tier-count">{count} seats</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
