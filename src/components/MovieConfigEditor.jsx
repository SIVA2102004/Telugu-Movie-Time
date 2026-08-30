import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { Save, QrCode, Smartphone, CreditCard, KeyRound, UserCheck, ShieldCheck, Copy, IndianRupee, Tag } from "lucide-react";
import toast from "react-hot-toast";
import "./MovieConfigEditor.css";

export default function MovieConfigEditor({ config, layout }) {
  const [form, setForm] = useState({
    movieName: "Telugu Movie Time",
    date: "2026-08-30",
    theater: "Rajshree Cinema (Screen 1)",
    showTime: "6:30 PM",
    pricePerSeat: 200,
    tierPrices: {
      Platinum: 300,
      Gold: 250,
      Silver: 200,
      ...(config?.tierPrices || layout?.tierPrices || {}),
    },
    upiId: "telugumovietime@upi",
    payeeName: "Telugu Movie Time",
    adminPhone: "919876543210",
    coAdminCode: "COADMIN2026",
    adminPassword: "admin123",
    ...config,
  });

  const [saving, setSaving] = useState(false);
  const [blockedInput, setBlockedInput] = useState(() => (config?.blockedSeats || []).join(", "));
  const [isEditingBlocked, setIsEditingBlocked] = useState(false);

  // Sync state if config changes in background (only if user is not actively editing)
  useEffect(() => {
    if (config) {
      setForm((prev) => ({
        ...prev,
        ...config,
        tierPrices: {
          Platinum: 300,
          Gold: 250,
          Silver: 200,
          ...(config.tierPrices || layout?.tierPrices || prev.tierPrices || {}),
        },
      }));
      if (!isEditingBlocked) {
        setBlockedInput((config.blockedSeats || []).join(", "));
      }
    }
  }, [config, layout, isEditingBlocked]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "pricePerSeat" ? Number(value) : value,
    }));
  };

  const handleTierPriceChange = (tier, val) => {
    const num = Math.max(0, parseInt(val) || 0);
    setForm((prev) => ({
      ...prev,
      tierPrices: {
        ...(prev.tierPrices || {}),
        [tier]: num,
      },
    }));
  };

  const copyCoAdminCode = () => {
    navigator.clipboard.writeText(form.coAdminCode || "COADMIN2026");
    toast.success(`Copied Co-Admin Joining Code: ${form.coAdminCode || "COADMIN2026"}`);
  };

  const handleClearBlockedSeats = async () => {
    setBlockedInput("");
    setIsEditingBlocked(false);
    const updated = {
      ...form,
      blockedSeats: [],
    };
    setForm(updated);
    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      await setDoc(doc(db, "movieConfig", "current"), { blockedSeats: [] }, { merge: true });
      toast.success("All blocked seats cleared and saved to database! 🟢");
    } catch (e) {
      toast.success("Blocked seats cleared locally! 🟢");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setIsEditingBlocked(false);

    const parsedBlocked = blockedInput
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const updated = {
      ...form,
      blockedSeats: parsedBlocked,
      pricePerSeat: Number(form.pricePerSeat || 200),
      layout: {
        ...(layout || {}),
        tierPrices: form.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 },
      },
    };

    setForm(updated);

    // Instant local save and cross-tab event dispatch
    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {}

    // Cloud firestore save
    try {
      await setDoc(doc(db, "movieConfig", "current"), updated, { merge: true });
      toast.success("Settings, Prices & Details updated live! 🚀");
    } catch (err) {
      toast.success("Saved to local workspace cache! ✅");
    }
    setSaving(false);
  };

  const screens = form.screens || DEFAULT_SCREENS;
  const activeScreenId = form.activeScreenId || "screen-1";

  const handleSelectScreen = (screenId) => {
    const selectedScreen = screens.find((s) => s.id === screenId);
    if (!selectedScreen) return;

    setForm((prev) => ({
      ...prev,
      activeScreenId: screenId,
      movieName: selectedScreen.movieName || prev.movieName,
      theater: selectedScreen.theater || prev.theater,
      date: selectedScreen.date || prev.date,
      showTime: selectedScreen.showTime || prev.showTime,
      pricePerSeat: selectedScreen.pricePerSeat || prev.pricePerSeat,
      posterUrl: selectedScreen.posterUrl || prev.posterUrl,
      tierPrices: selectedScreen.tierPrices || prev.tierPrices,
    }));
    toast.success(`Switched editor to ${selectedScreen.name}`);
  };

  const handleTogglePublishScreen = async (screenId) => {
    const updatedScreens = screens.map((s) => {
      if (s.id === screenId) {
        return { ...s, isPublished: !s.isPublished };
      }
      return s;
    });

    // Ensure at least one published screen is active
    const anyPublished = updatedScreens.some((s) => s.isPublished);
    if (!anyPublished) {
      toast.error("At least one screen must remain published!");
      return;
    }

    const currentScreenStillPublished = updatedScreens.find((s) => s.id === form.activeScreenId)?.isPublished;
    const nextActiveId = currentScreenStillPublished
      ? form.activeScreenId
      : updatedScreens.find((s) => s.isPublished)?.id || screenId;

    const activeScr = updatedScreens.find((s) => s.id === nextActiveId) || updatedScreens[0];

    const updated = {
      ...form,
      activeScreenId: nextActiveId,
      screens: updatedScreens,
      movieName: activeScr.movieName || form.movieName,
      theater: activeScr.theater || form.theater,
      date: activeScr.date || form.date,
      showTime: activeScr.showTime || form.showTime,
      pricePerSeat: activeScr.pricePerSeat || form.pricePerSeat,
      posterUrl: activeScr.posterUrl || form.posterUrl,
      tierPrices: activeScr.tierPrices || form.tierPrices,
    };

    setForm(updated);

    try {
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
      await setDoc(doc(db, "movieConfig", "current"), updated, { merge: true });
      const pubCount = updatedScreens.filter((s) => s.isPublished).length;
      toast.success(`🎉 Updated! ${pubCount} Screen${pubCount > 1 ? "s are" : " is"} now LIVE on Student Portal!`);
    } catch (e) {
      toast.success(`Published screens updated locally!`);
    }
  };

  const handlePosterUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const posterData = reader.result;
        setForm((prev) => {
          const updatedScreens = (prev.screens || DEFAULT_SCREENS).map((s) =>
            s.id === (prev.activeScreenId || "screen-1") ? { ...s, posterUrl: posterData } : s
          );
          const nextState = { ...prev, posterUrl: posterData, screens: updatedScreens };
          try {
            localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(nextState));
            window.dispatchEvent(new Event("storage"));
          } catch (err) {}
          return nextState;
        });
        toast.success("Movie poster uploaded & dynamic UI theme applied! 🎬🔥");
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <form className="config-editor card" onSubmit={handleSave}>
      <h2 className="config-editor__title">Movie, Pricing & Multi-Screen Manager</h2>

      {/* ── MULTI-SCREEN SELECTOR & PUBLISHER ── */}
      <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid var(--gold)", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0, color: "var(--gold)", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 6 }}>
              🎬 Multi-Screen & Audi Manager (Admin Decides Which Screen is Live)
            </h3>
            <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Configure up to 4 different screens / movie showtimes and click <strong>"Publish Live"</strong> to make that screen live for student bookings.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {screens.map((screen) => {
            const isEditing = form.activeScreenId === screen.id;
            const isLive = !!screen.isPublished;
            return (
              <div
                key={screen.id}
                style={{
                  background: isLive ? "rgba(0, 230, 118, 0.12)" : "var(--surface)",
                  border: isLive ? "2px solid var(--green)" : "1px solid var(--border)",
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ color: isLive ? "var(--green)" : "var(--gold)", fontSize: "0.88rem" }}>
                      {screen.name}
                    </strong>
                    {isLive ? (
                      <span style={{ background: "var(--green)", color: "#0d0d1a", fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4, fontWeight: 900 }}>
                        ✓ LIVE
                      </span>
                    ) : (
                      <span style={{ background: "rgba(255,255,255,0.1)", color: "var(--text-muted)", fontSize: "0.65rem", padding: "1px 6px", borderRadius: 4 }}>
                        OFFLINE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text)", marginTop: 4 }}>
                    🎬 {screen.movieName}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    ⏰ {screen.showTime} · {screen.theater}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button
                    type="button"
                    className={`btn ${isEditing ? "btn-outline" : "btn-ghost"}`}
                    style={{ flex: 1, padding: "5px 8px", fontSize: "0.75rem" }}
                    onClick={() => handleSelectScreen(screen.id)}
                  >
                    {isEditing ? "✏️ Editing" : "Edit"}
                  </button>
                  <button
                    type="button"
                    className={`btn ${isLive ? "btn-outline" : "btn-green"}`}
                    style={{ flex: 1.3, padding: "5px 8px", fontSize: "0.75rem", fontWeight: 700 }}
                    onClick={() => handleTogglePublishScreen(screen.id)}
                  >
                    {isLive ? "🔴 Unpublish" : "🟢 Publish Live"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="config-grid">
        {/* Movie Poster Uploader */}
        <div className="form-field form-field--full" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
          <label className="label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>Movie Poster / Image (Automatically converts into WhatsApp Vintage Ticket)</span>
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
            {form.posterUrl ? (
              <img
                src={form.posterUrl}
                alt="Movie Poster"
                style={{ width: 70, height: 95, objectFit: "cover", borderRadius: 6, border: "2px solid var(--gold)" }}
              />
            ) : (
              <div style={{ width: 70, height: 95, background: "#1a1a2e", borderRadius: 6, border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>
                🎬
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="btn btn-outline" style={{ cursor: "pointer", padding: "8px 14px", fontSize: "0.82rem", gap: 6 }}>
                📁 Upload Poster Image
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePosterUpload} />
              </label>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Upload PNG/JPG. This image is directly embedded on the WhatsApp Vintage Ticket!
              </span>
            </div>
          </div>
        </div>
        {/* Movie Info */}
        <div className="form-field">
          <label className="label" htmlFor="movieName">Movie Name</label>
          <input className="input" id="movieName" name="movieName"
            value={form.movieName || ""} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="genre">Genre / Language / Certificate</label>
          <input className="input" id="genre" name="genre"
            placeholder="Action / Thriller · Telugu (U/A)"
            value={form.genre || "Action / Drama · Telugu (U/A)"} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="date">Show Date</label>
          <input className="input" type="date" id="date" name="date"
            value={form.date || ""} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="showTime">Show Time</label>
          <input className="input" id="showTime" name="showTime"
            placeholder="8:00 AM" value={form.showTime || ""} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="theater">Theater / Mall Name</label>
          <input className="input" id="theater" name="theater"
            value={form.theater || ""} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="locationAddress">Venue Address & Google Maps Location *</label>
          <input className="input" id="locationAddress" name="locationAddress"
            placeholder="Crystal Mall, 3rd Floor, Kalawad Road, Rajkot"
            value={form.locationAddress || "Crystal Mall, 3rd Floor, Kalawad Road, Rajkot"} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="mapsUrl">Google Maps Link (for Direction button)</label>
          <input className="input" id="mapsUrl" name="mapsUrl"
            placeholder="https://maps.google.com/?q=Crystal+Mall"
            value={form.mapsUrl || "https://maps.google.com/?q=Crystal+Mall"} onChange={handleChange} />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="movieTagline">Movie Tagline / Highlight</label>
          <input className="input" id="movieTagline" name="movieTagline"
            placeholder="Experience the Grand Telugu Premiere with Student Special Treats!"
            value={form.movieTagline || "Experience the Grand Telugu Premiere with Student Special Treats!"} onChange={handleChange} />
        </div>

        <div className="form-field form-field--full">
          <label className="label" htmlFor="movieDescription">Movie Synopsis & Event Details</label>
          <textarea
            className="input"
            id="movieDescription"
            name="movieDescription"
            rows={3}
            style={{ resize: "vertical", fontFamily: "inherit" }}
            placeholder="Write a brief overview of the movie, special food & beverage vouchers, and student community perks."
            value={form.movieDescription || "Join fellow movie enthusiasts for an exclusive cinematic screening organized by Telugu Movie Time! Experience premium Dolby Atmos sound, crystal-clear projection, luxury seating, and exciting Telugu student community vibes."}
            onChange={handleChange}
          />
        </div>

        {/* ── TIER PRICING CONTROLS (DIRECTLY EDIT FROM MOVIE CONFIG) ── */}
        <div className="form-field form-field--full" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <IndianRupee size={18} /> Category Tier Pricing (Reflects in Header & Seat Map)
          </h3>
          <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Updating prices here will immediately update the "From ₹..." badge on the student webpage and seat calculation.
          </small>
        </div>

        <div className="form-field">
          <label className="label">
            <span className="tier-tag tier-tag--platinum" style={{ display: "inline-flex", marginRight: 6 }}>Platinum</span>
            Recliner Price (₹)
          </label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.tierPrices?.Platinum ?? 300}
            onChange={(e) => handleTierPriceChange("Platinum", e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="label">
            <span className="tier-tag tier-tag--gold" style={{ display: "inline-flex", marginRight: 6 }}>Gold</span>
            Gold Tier Price (₹)
          </label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.tierPrices?.Gold ?? 250}
            onChange={(e) => handleTierPriceChange("Gold", e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="label">
            <span className="tier-tag tier-tag--silver" style={{ display: "inline-flex", marginRight: 6 }}>Silver</span>
            Silver Tier Price (₹)
          </label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.tierPrices?.Silver ?? 200}
            onChange={(e) => handleTierPriceChange("Silver", e.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="pricePerSeat">Base Default Price (₹)</label>
          <input className="input" type="number" id="pricePerSeat" name="pricePerSeat"
            min={1} value={form.pricePerSeat || ""} onChange={handleChange} />
        </div>

        {/* ── MASTER ADMIN SECURITY SECTION ── */}
        <div className="form-field form-field--full" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <KeyRound size={18} /> Master Admin Password
          </h3>
          <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            Change your master administrator login password. (Co-admins are now managed in the dedicated "Co-Admins" tab).
          </small>
        </div>

        <div className="form-field">
          <label className="label" htmlFor="adminPassword">
            <KeyRound size={13} style={{ display: "inline", marginRight: 4 }} />
            Master Admin Password
          </label>
          <input
            className="input"
            id="adminPassword"
            name="adminPassword"
            type="password"
            placeholder="Master admin password"
            value={form.adminPassword || "admin123"}
            onChange={handleChange}
          />
        </div>

        {/* ── PAYMENT GATEWAY CONFIGURATION ── */}
        <div className="form-field form-field--full" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <h3 style={{ fontSize: "1rem", color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
            <QrCode size={18} /> UPI Payment Gateway Settings
          </h3>
          <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
            When an account fills up or changes, change the UPI ID here. QR codes on student checkout will automatically update.
          </small>
        </div>

        <div className="form-field">
          <label className="label" htmlFor="upiId">
            <CreditCard size={13} style={{ display: "inline", marginRight: 4 }} />
            Active UPI ID (for QR & Payment) *
          </label>
          <input
            className="input"
            id="upiId"
            name="upiId"
            placeholder="example@upi or phone@paytm"
            value={form.upiId || ""}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="payeeName">Payee Name (Business / Name)</label>
          <input
            className="input"
            id="payeeName"
            name="payeeName"
            placeholder="Telugu Movie Time Admin"
            value={form.payeeName || ""}
            onChange={handleChange}
          />
        </div>

        <div className="form-field">
          <label className="label" htmlFor="adminPhone">
            <Smartphone size={13} style={{ display: "inline", marginRight: 4 }} />
            Admin WhatsApp Phone (with Country Code)
          </label>
          <input
            className="input"
            id="adminPhone"
            name="adminPhone"
            placeholder="919876543210"
            value={form.adminPhone || ""}
            onChange={handleChange}
          />
        </div>

        {/* ── BLOCKED SEATS CONFIGURATION PER SCREEN ── */}
        <div className="form-field form-field--full" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <label className="label" htmlFor="blockedSeats" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
            <span>
              🔒 Blocked Seats for <strong>{screens.find((s) => s.id === form.activeScreenId)?.name || "Screen 1"}</strong> (comma-separated, e.g. A1, J10)
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "3px 10px", fontSize: "0.75rem", color: "var(--green)", fontWeight: 700, border: "1px solid var(--green)", borderRadius: 6 }}
                onClick={handleClearBlockedSeats}
              >
                🔓 Clear / Unblock All Now
              </button>
            </div>
          </label>
          <input
            className="input"
            id="blockedSeats"
            value={blockedInput}
            onFocus={() => setIsEditingBlocked(true)}
            onBlur={() => setIsEditingBlocked(false)}
            onChange={(e) => {
              setIsEditingBlocked(true);
              setBlockedInput(e.target.value);
            }}
            placeholder="Leave empty for 100% available, or type: A1, A2, A3"
          />
          <small style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>
            💡 Tip: Leave this input empty to keep all seats available for booking. You can also block/unblock visually with 1 click in the <strong>"Seat Map"</strong> tab.
          </small>
        </div>
      </div>

      <button className="btn btn-gold" style={{ alignSelf: "flex-start", marginTop: 8 }} disabled={saving}>
        {saving ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : <><Save size={15} /> Save All Settings</>}
      </button>
    </form>
  );
}
