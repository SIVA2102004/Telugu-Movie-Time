import { useState, useEffect } from "react";
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
import { Film, LayoutDashboard, List, Map, Settings, LogOut, LayoutTemplate, Smartphone, Download, Check, ShieldCheck, UserCheck, RefreshCw, Users, Share2 } from "lucide-react";
import "../styles/globals.css";
import "./AdminPage.css";

export default function AdminPage() {
  const [authed, setAuthed] = useState(
    sessionStorage.getItem("adminAuth") === "true"
  );
  const adminRole = sessionStorage.getItem("adminRole") || "master";
  const isMasterAdmin = adminRole === "master";

  // Tab definitions based on role
  const allowedTabs = isMasterAdmin
    ? [
        { id: "overview",  label: "Overview",         icon: LayoutDashboard },
        { id: "bookings",  label: "Bookings",          icon: List },
        { id: "seatmap",   label: "Seat Map",          icon: Map },
        { id: "coadmins",  label: "Co-Admins",         icon: Users },
        { id: "layout",    label: "Layout Editor",     icon: LayoutTemplate },
        { id: "config",    label: "Movie Config",      icon: Settings },
      ]
    : [
        { id: "bookings",  label: "Booking & Confirm", icon: List },
        { id: "seatmap",   label: "Seat Map",          icon: Map },
      ];

  const [activeTab, setActiveTab] = useState(isMasterAdmin ? "overview" : "bookings");
  const [layoutScreenId, setLayoutScreenId] = useState("screen-1");

  const handleOpenLayoutForScreen = (screenId) => {
    setLayoutScreenId(screenId);
    setActiveTab("layout");
  };

  // Keep activeTab in sync with allowed tabs if role changes
  useEffect(() => {
    if (!isMasterAdmin && (activeTab === "overview" || activeTab === "layout" || activeTab === "config")) {
      setActiveTab("bookings");
    }
  }, [isMasterAdmin, activeTab]);

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

  const { bookings = [], setBookings, loading: bLoading, refreshing, refreshBookings } = useBookings();
  const { seatMap = {} } = useSeats();
  const { config = {}, layout = {}, loading: cLoading } = useMovieConfig();

  const logout = () => {
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("adminRole");
    sessionStorage.removeItem("adminName");
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
                  {t.label}
                  {t.id === "layout" && (
                    <span className="sidebar-new-badge">NEW</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Install App Button in Sidebar */}
          {!isInstalled && (
            <div style={{ padding: "0 12px", marginBottom: 10 }}>
              <button
                type="button"
                onClick={installApp}
                className="btn btn-gold"
                style={{ width: "100%", padding: "8px 10px", fontSize: "0.78rem", justifyContent: "center", gap: 6 }}
                title="Install TMT Admin as an App on Phone/Desktop"
              >
                <Smartphone size={15} /> Install Admin App
              </button>
            </div>
          )}

          <button className="sidebar-item sidebar-item--logout" onClick={logout}>
            <LogOut size={17} /> Logout
          </button>
        </aside>

        {/* Main */}
        <main className="admin-main">
          <div className="admin-topbar">
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 className="admin-topbar__title" style={{ margin: 0 }}>
                {allowedTabs.find((t) => t.id === activeTab)?.label}
              </h1>
              {config?.screens && (
                <div
                  style={{
                    background: "rgba(0, 200, 81, 0.15)",
                    border: "1px solid var(--green)",
                    color: "var(--green)",
                    fontSize: "0.76rem",
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: 20,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                  Live: <strong>{config.screens.find((s) => s.id === config.activeScreenId)?.name || "Screen 1"}</strong> ({config.movieName || "Movie"})
                </div>
              )}
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexWrap: "wrap" }}>
              {/* Direct Student Portal Share Button */}
              <button
                type="button"
                onClick={() => {
                  const studentUrl = window.location.origin;
                  if (navigator.share) {
                    navigator.share({
                      title: `Book Tickets — ${config?.movieName || "Telugu Movie Time"}`,
                      url: studentUrl,
                    });
                  } else {
                    navigator.clipboard.writeText(studentUrl);
                    toast.success("Student Portal link copied to clipboard! 📋");
                  }
                }}
                className="btn btn-gold"
                style={{ padding: "6px 12px", fontSize: "0.78rem", gap: 5, fontWeight: 700 }}
                title="Copy / Share Student Booking Portal link"
              >
                <Share2 size={14} /> Share Student Portal
              </button>

              {/* Open Student Portal in new tab */}
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ padding: "6px 10px", fontSize: "0.78rem", gap: 5, color: "#4fc3f7" }}
                title="Open live student booking portal"
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

          <div className="admin-content">
            {isMasterAdmin && activeTab === "overview" && (
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
                  readOnly={!isMasterAdmin}
                />
              </div>
            )}
            {isMasterAdmin && activeTab === "coadmins" && (
              <CoAdminManager config={config} bookings={bookings} />
            )}
            {isMasterAdmin && activeTab === "layout" && (
              <TheaterLayoutEditor config={config} selectedScreenId={layoutScreenId} />
            )}
            {isMasterAdmin && activeTab === "config" && (
              <MovieConfigEditor config={config} layout={layout} onOpenLayout={handleOpenLayoutForScreen} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
