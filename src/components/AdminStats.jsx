import { IndianRupee, Tag, ShieldAlert, KeyRound, UserCheck, Smartphone, QrCode, ShieldCheck, Copy, Download, Check } from "lucide-react";
import toast from "react-hot-toast";
import "./AdminStats.css";

export default function AdminStats({ bookings, config, layout, onInstallApp, isInstalled }) {
  // Compute total actual seats directly from dynamic layout
  const totalSeats = layout?.rows && layout?.seats
    ? layout.rows.reduce((sum, r) => {
        return sum + (layout.seats[r] || []).filter((s) => s !== null).length;
      }, 0)
    : 274;

  const blockedSeatsCount = (config?.blockedSeats || []).length;

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
  const tierPrices = config?.tierPrices || layout?.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

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

  const copyText = (txt, label) => {
    navigator.clipboard.writeText(txt);
    toast.success(`Copied ${label}: ${txt}`);
  };

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

      {/* ── ADMIN APP INSTALL BANNER ── */}
      <div className="card" style={{ marginTop: 20, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, background: "linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(22,33,62,0.6) 100%)", borderColor: "var(--gold)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: "var(--gold)", color: "#0d0d1a", padding: 10, borderRadius: 10, display: "flex" }}>
            <Smartphone size={24} />
          </div>
          <div>
            <h4 style={{ color: "var(--gold)", margin: 0, fontSize: "1rem" }}>Install TMT Admin App on Your Device</h4>
            <p style={{ color: "var(--text-muted)", margin: "2px 0 0", fontSize: "0.82rem" }}>
              Install this portal directly on your Android / iPhone home screen or PC desktop for instant full-screen app access.
            </p>
          </div>
        </div>

        <div>
          {isInstalled ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--green)", fontSize: "0.85rem", fontWeight: 700 }}>
              <Check size={16} /> App Installed
            </span>
          ) : (
            <button type="button" className="btn btn-gold" onClick={onInstallApp} style={{ padding: "8px 16px", fontSize: "0.85rem", gap: 6 }}>
              <Download size={15} /> Install Admin App
            </button>
          )}
        </div>
      </div>

      {/* ── ADMIN & CO-ADMIN CREDENTIALS & SYSTEM DETAILS CARD ── */}
      <div className="card admin-credentials-card" style={{ marginTop: 20, padding: "20px 24px" }}>
        <h3 style={{ fontSize: "1.05rem", color: "var(--gold)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldCheck size={20} /> Admin & Co-Admin Credentials & Live Settings
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          {/* Master Admin Details */}
          <div style={{ background: "var(--surface2)", padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--gold)", fontWeight: 700, marginBottom: 8 }}>
              <KeyRound size={16} /> Master Admin Access
            </div>
            <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 6 }}>
              <div><strong>Role:</strong> Master Administrator</div>
              <div><strong>Password:</strong> <code style={{ color: "var(--gold)", background: "rgba(255,215,0,0.1)", padding: "2px 6px", borderRadius: 4 }}>{config?.adminPassword || "admin123"}</code></div>
              <div><strong>Master Recovery PIN:</strong> <code style={{ color: "#4fc3f7" }}>9999</code></div>
              <small style={{ color: "var(--text-muted)", marginTop: 4 }}>Full control: Edit movie, pricing, layout & delete/confirm bookings.</small>
            </div>
          </div>

          {/* Co-Admin Joining Code */}
          <div style={{ background: "var(--surface2)", padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4fc3f7", fontWeight: 700, marginBottom: 8 }}>
              <UserCheck size={16} /> Co-Admin Joining Code
            </div>
            <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 6 }}>
              <div><strong>Joining Code:</strong> <code style={{ color: "#4fc3f7", background: "rgba(79,195,247,0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{config?.coAdminCode || "COADMIN2026"}</code></div>
              <div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "4px 8px", fontSize: "0.76rem", gap: 4 }}
                  onClick={() => copyText(config?.coAdminCode || "COADMIN2026", "Co-Admin Code")}
                >
                  <Copy size={13} /> Copy Joining Code for Helpers
                </button>
              </div>
              <small style={{ color: "var(--text-muted)", marginTop: 4 }}>Share with volunteer teammates to log in and confirm bookings together.</small>
            </div>
          </div>

          {/* UPI Gateway & Contact Info */}
          <div style={{ background: "var(--surface2)", padding: 16, borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--green)", fontWeight: 700, marginBottom: 8 }}>
              <QrCode size={16} /> Payment Gateway & WhatsApp
            </div>
            <div style={{ fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: 6 }}>
              <div><strong>Active UPI ID:</strong> <span style={{ color: "var(--gold)" }}>{config?.upiId || "telugumovietime@upi"}</span></div>
              <div><strong>Payee Name:</strong> {config?.payeeName || "Telugu Movie Time"}</div>
              <div><strong>Admin WhatsApp:</strong> +{config?.adminPhone || "919876543210"}</div>
            </div>
          </div>
        </div>
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
