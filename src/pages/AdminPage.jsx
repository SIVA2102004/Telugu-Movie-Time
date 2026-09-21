import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheaters } from "../hooks/useTheaters";
import { useBookings } from "../hooks/useBookings";
import { useSeats } from "../hooks/useSeats";
import { useMovieConfig } from "../hooks/useMovieConfig";
import AdminLogin from "../components/AdminLogin";
import AdminStats from "../components/AdminStats";
import BookingTable from "../components/BookingTable";
import AdminSeatMap from "../components/AdminSeatMap";
import MovieConfigEditor from "../components/MovieConfigEditor";
import TheaterLayoutEditor from "../components/TheaterLayoutEditor";
import CoAdminManager from "../components/CoAdminManager";
import { Toaster, toast } from "react-hot-toast";
import { Film, LayoutDashboard, List, Map, Settings, LogOut, LayoutTemplate, Smartphone, Download, Check, ShieldCheck, UserCheck, RefreshCw, Users, Share2, Plus, Building2 } from "lucide-react";
import "../styles/globals.css";
import "./AdminPage.css";

export default function AdminPage() {
  const { userProfile, role, ownerId, theaterId, logoutUser } = useAuth();
  const [authed, setAuthed] = useState(
    sessionStorage.getItem("adminAuth") === "true" || !!userProfile
  );

  const isMasterAdmin = role === "SUPER_ADMIN" || sessionStorage.getItem("adminRole") === "master";
  const isTheaterOwner = role === "THEATER_OWNER" || sessionStorage.getItem("adminRole") === "owner" || isMasterAdmin;
  const adminRole = isMasterAdmin ? "master" : isTheaterOwner ? "owner" : "co-admin";

  // Multi-tenant theaters & halls hook
  const { theaters, currentTheater, addHall } = useTheaters(ownerId, theaterId);

  // PWA Install prompt listener
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("TMT Admin App installed successfully! 📱");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      toast("To install on iPhone/Safari: Tap 'Share' → 'Add to Home Screen'. On Android/Chrome: Tap '⋮' → 'Install App'.", {
        duration: 6000,
        icon: "📱",
      });
    }
  };

  // Modal state for adding a new Cinema Hall
  const [showAddHallModal, setShowAddHallModal] = useState(false);
  const [newHallForm, setNewHallForm] = useState({
    hallName: "",
    movieName: "",
    showTime: "6:00 PM",
    pricePerSeat: 200,
    layoutType: "standard",
  });

  // Filter bookings strictly by active theater for owner isolation
  const [selectedAdminTheaterId, setSelectedAdminTheaterId] = useState(null);
  const storedTheaterId = sessionStorage.getItem("adminTheaterId");
  const activeTheaterId = selectedAdminTheaterId || theaterId || storedTheaterId || currentTheater?.id || "default-theater";

  const { bookings = [], setBookings, loading: bLoading, refreshing, refreshBookings } = useBookings(
    isMasterAdmin && !selectedAdminTheaterId ? null : activeTheaterId,
    isMasterAdmin && !selectedAdminTheaterId ? null : ownerId
  );

  const { config = {}, layout = {} } = useMovieConfig(activeTheaterId);
  const activeScreenId = config?.activeScreenId || "screen-1";
  const { seatMap = {} } = useSeats(activeScreenId, activeTheaterId);

  // Tab definitions: Co-Admins see all theater management modules EXCEPT the Co-Admin management tab itself
  const allTabs = [
    { id: "overview",  label: "Overview",         icon: LayoutDashboard },
    { id: "bookings",  label: "Bookings",          icon: List },
    { id: "seatmap",   label: "Seat Map",          icon: Map },
    { id: "coadmins",  label: "Co-Admins",         icon: Users },
    { id: "layout",    label: "Layout Editor",     icon: LayoutTemplate },
    { id: "config",    label: "Movie Config",      icon: Settings },
  ];

  const allowedTabs = allTabs.filter((t) => {
    if (adminRole === "co-admin" && t.id === "coadmins") return false;
    return true;
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [layoutScreenId, setLayoutScreenId] = useState("screen-1");

  const handleOpenLayoutForScreen = (screenId) => {
    setLayoutScreenId(screenId);
    setActiveTab("layout");
  };

  const handleAddHallSubmit = async (e) => {
    e.preventDefault();
    if (!newHallForm.hallName.trim()) {
      toast.error("Please enter a Hall Name.");
      return;
    }
    try {
      await addHall(activeTheaterId, {
        hallName: newHallForm.hallName.trim(),
        movieName: newHallForm.movieName.trim() || "NEW BLOCKBUSTER",
        showTime: newHallForm.showTime.trim() || "6:00 PM",
        pricePerSeat: newHallForm.pricePerSeat || 200,
        layoutType: newHallForm.layoutType,
      });
      toast.success(`Cinema Hall "${newHallForm.hallName}" created successfully! 🎬`);
      setShowAddHallModal(false);
      setNewHallForm({
        hallName: "",
        movieName: "",
        showTime: "6:00 PM",
        pricePerSeat: 200,
        layoutType: "standard",
      });
    } catch (err) {
      toast.error("Failed to create hall: " + err.message);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setAuthed(false);
  };

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} config={config} />;
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: "#1A1A2E", color: "#F0F0F0", border: "1px solid #2A2A4A" },
        }}
      />
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className="admin-sidebar">
          <div className="admin-sidebar__brand">
            <span style={{ background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)", color: "#0d0d1a", fontWeight: 900, fontSize: "0.75rem", padding: "2px 6px", borderRadius: 4, letterSpacing: 1 }}>
              TMT
            </span>
            <span>Telugu Movie Time</span>
            <span
              style={{
                fontSize: "0.68rem",
                background: isMasterAdmin ? "rgba(255,215,0,0.15)" : "rgba(79,195,247,0.15)",
                color: isMasterAdmin ? "var(--gold)" : "#4fc3f7",
                padding: "2px 6px",
                borderRadius: 4,
                marginLeft: "auto",
                textTransform: "uppercase",
                fontWeight: 800,
              }}
            >
              {isMasterAdmin ? "MASTER" : "CO-ADMIN"}
            </span>
          </div>

          <nav className="admin-sidebar__nav">
            {allowedTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  className={`sidebar-item ${activeTab === t.id ? "sidebar-item--active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  <Icon size={17} />
                  <span>{t.label}</span>
                  {t.id === "layout" && (
                    <span className="sidebar-new-badge">NEW</span>
                  )}
                </button>
              );
            })}
            <button className="sidebar-item sidebar-item--logout" onClick={handleLogout}>
              <LogOut size={17} /> <span>Logout</span>
            </button>
          </nav>
        </aside>

        {/* Main */}
        <main className="admin-main">
          <div className="admin-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: "1 1 auto" }}>
              {/* Mobile Tab Selector Dropdown */}
              <select
                className="admin-mobile-tab-select"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                aria-label="Select Admin Section"
              >
                {allowedTabs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>

              <h1 className="admin-topbar__title" style={{ margin: 0 }}>
                {allowedTabs.find((t) => t.id === activeTab)?.label}
              </h1>

              {/* Theater Badge & Active Screen Pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {isMasterAdmin && theaters.length > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255, 215, 0, 0.12)", border: "1px solid var(--gold)", padding: "3px 10px", borderRadius: 20 }}>
                    <Building2 size={13} color="var(--gold)" />
                    <span style={{ fontSize: "0.76rem", color: "var(--gold)", fontWeight: 800 }}>Super Admin View:</span>
                    <select
                      style={{ background: "#1A1A2E", color: "#fff", border: "1px solid var(--gold)", padding: "2px 8px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}
                      value={activeTheaterId || ""}
                      onChange={(e) => setSelectedAdminTheaterId(e.target.value)}
                    >
                      {theaters.map((th) => (
                        <option key={th.id} value={th.id}>
                          {th.name} ({th.location || "Hyderabad"})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : currentTheater ? (
                  <span style={{ fontSize: "0.76rem", background: "rgba(255,215,0,0.12)", border: "1px solid var(--gold)", color: "var(--gold)", fontWeight: 800, padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 4 }}>
                    <Building2 size={13} /> {currentTheater.name}
                  </span>
                ) : null}
                {isTheaterOwner && (
                  <button
                    type="button"
                    className="btn btn-gold"
                    style={{ padding: "3px 10px", fontSize: "0.75rem", fontWeight: 800, gap: 4 }}
                    onClick={() => setShowAddHallModal(true)}
                    title="Add a new Cinema Hall under your theater"
                  >
                    <Plus size={13} /> Add Hall
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
              {!isInstalled && (
                <button
                  type="button"
                  onClick={installApp}
                  className="btn btn-outline admin-topbar-install-btn"
                  style={{ padding: "5px 10px", fontSize: "0.75rem", gap: 4, color: "var(--gold)", borderColor: "var(--gold)" }}
                  title="Install Admin App"
                >
                  <Smartphone size={13} /> App
                </button>
              )}
              {/* Direct Student Portal Share Button */}
              <button
                type="button"
                onClick={() => {
                  const studentUrl = activeTheaterId && activeTheaterId !== "default-theater"
                    ? `${window.location.origin}/?theater=${activeTheaterId}`
                    : window.location.origin;
                  if (navigator.share) {
                    navigator.share({
                      title: `Book Tickets — ${config?.movieName || currentTheater?.name || "Telugu Movie Time"}`,
                      url: studentUrl,
                    });
                  } else {
                    navigator.clipboard.writeText(studentUrl);
                    toast.success(`Copied direct Student Booking Portal link for "${currentTheater?.name || "Theater"}"! 📋`);
                  }
                }}
                className="btn btn-gold"
                style={{ padding: "6px 12px", fontSize: "0.78rem", gap: 5, fontWeight: 700 }}
                title="Copy / Share Student Booking Portal link for your theater"
              >
                <Share2 size={14} /> Share Student Portal
              </button>

              {/* Open Student Portal in new tab */}
              <a
                href={activeTheaterId && activeTheaterId !== "default-theater" ? `/?theater=${activeTheaterId}` : "/"}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ padding: "6px 10px", fontSize: "0.78rem", gap: 5, color: "#4fc3f7" }}
                title="Open live student booking portal for your theater"
              >
                <Film size={14} /> Open Portal ↗
              </a>

              {/* Manual Cloud Refresh Button */}
              <button
                type="button"
                onClick={() => {
                  refreshBookings();
                  toast.success("Synced latest bookings with cloud database! 🔄");
                }}
                className="btn btn-ghost"
                disabled={refreshing}
                style={{ padding: "6px 10px", fontSize: "0.78rem", gap: 5, color: "var(--gold)" }}
                title="Force refresh bookings from cloud database"
              >
                <RefreshCw size={14} className={refreshing ? "spin" : ""} /> {refreshing ? "Syncing…" : "Sync Cloud"}
              </button>

              {!isInstalled && (
                <button
                  type="button"
                  onClick={installApp}
                  className="btn btn-outline"
                  style={{ padding: "6px 12px", fontSize: "0.78rem", gap: 6, borderColor: "var(--gold)", color: "var(--gold)" }}
                >
                  <Download size={14} /> Install App
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--text)", fontWeight: 600 }}>
                  {sessionStorage.getItem("adminName") || (isMasterAdmin ? "Master Admin" : "Co-Admin")}
                </span>
                <span style={{ fontSize: "0.65rem", background: isMasterAdmin ? "var(--gold)" : "#4fc3f7", color: "#0d0d1a", padding: "1px 6px", borderRadius: 10, fontWeight: 900, textTransform: "uppercase" }}>
                  {isMasterAdmin ? "Master" : "Co-Admin"}
                </span>
              </div>
              <div className="admin-topbar__movie">
                {config.movieName && (
                  <span>{config.movieName} · {config.date} · {config.theater}</span>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Mobile Horizontal Tab Switcher Pills */}
          <div className="admin-mobile-tab-pills">
            {allowedTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`admin-mobile-pill-btn ${isActive ? "admin-mobile-pill-btn--active" : ""}`}
                  onClick={() => {
                    setActiveTab(t.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="admin-content">
            {activeTab === "overview" && (
              <AdminStats bookings={bookings} config={config} layout={layout} onInstallApp={installApp} isInstalled={isInstalled} />
            )}
            {activeTab === "bookings" && (
              <BookingTable
                bookings={bookings}
                setBookings={setBookings}
                config={config}
                adminRole={adminRole}
                refreshBookings={refreshBookings}
                refreshing={refreshing}
              />
            )}
            {activeTab === "seatmap" && (
              <div className="card">
                <AdminSeatMap
                  seatMap={seatMap}
                  bookings={bookings}
                  config={config}
                  layout={layout}
                  readOnly={false}
                />
              </div>
            )}
            {activeTab === "coadmins" && (
              <CoAdminManager config={config} bookings={bookings} />
            )}
            {activeTab === "layout" && (
              <TheaterLayoutEditor config={config} selectedScreenId={layoutScreenId} />
            )}
            {activeTab === "config" && (
              <MovieConfigEditor config={config} layout={layout} onOpenLayout={handleOpenLayoutForScreen} onAddHall={() => setShowAddHallModal(true)} />
            )}
          </div>
        </main>
      </div>

      {/* Add Hall Modal Overlay */}
      {showAddHallModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 480, width: "100%", background: "#1A1A2E", border: "1px solid var(--gold)", padding: 24, borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.8)" }}>
            <h2 style={{ margin: "0 0 8px", fontSize: "1.2rem", color: "var(--gold)", display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 size={20} /> Add Cinema Hall / Screen
            </h2>
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>
              Add a new cinema hall to <strong>{currentTheater?.name || "your theater"}</strong>.
            </p>

            <form onSubmit={handleAddHallSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label className="label">Hall / Screen Name *</label>
                <input
                  className="input"
                  type="text"
                  value={newHallForm.hallName}
                  onChange={(e) => setNewHallForm({ ...newHallForm, hallName: e.target.value })}
                  placeholder="e.g. Screen 3 (Audi 3) or IMAX Hall"
                  required
                />
              </div>

              <div>
                <label className="label">Movie Name</label>
                <input
                  className="input"
                  type="text"
                  value={newHallForm.movieName}
                  onChange={(e) => setNewHallForm({ ...newHallForm, movieName: e.target.value })}
                  placeholder="e.g. TELUGU MOVIE TIME"
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="label">Show Time</label>
                  <input
                    className="input"
                    type="text"
                    value={newHallForm.showTime}
                    onChange={(e) => setNewHallForm({ ...newHallForm, showTime: e.target.value })}
                    placeholder="e.g. 6:00 PM"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Base Seat Price (₹)</label>
                  <input
                    className="input"
                    type="number"
                    value={newHallForm.pricePerSeat}
                    onChange={(e) => setNewHallForm({ ...newHallForm, pricePerSeat: e.target.value })}
                    placeholder="200"
                  />
                </div>
              </div>

              <div>
                <label className="label">Initial Layout Pattern</label>
                <select
                  className="input"
                  value={newHallForm.layoutType}
                  onChange={(e) => setNewHallForm({ ...newHallForm, layoutType: e.target.value })}
                >
                  <option value="standard">Hall Blueprint (14 Rows · Recliner A1-A18, Gold B-N 20 Seats · 278 Seats)</option>
                  <option value="amphitheater">Amphitheater / Curved Fan (8 Rows · 152 Seats)</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowAddHallModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-gold"
                  style={{ fontWeight: 800 }}
                >
                  Create Cinema Hall 🚀
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
