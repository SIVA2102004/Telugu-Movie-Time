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
import { Toaster, toast } from "react-hot-toast";
import { Film, LayoutDashboard, List, Map, Settings, LogOut, LayoutTemplate, Smartphone, Download, Check } from "lucide-react";
import "../styles/globals.css";
import "./AdminPage.css";

const TABS = [
  { id: "overview",  label: "Overview",        icon: LayoutDashboard },
  { id: "bookings",  label: "Bookings",         icon: List },
  { id: "seatmap",   label: "Seat Map",         icon: Map },
  { id: "layout",    label: "Layout Editor",    icon: LayoutTemplate },
  { id: "config",    label: "Movie Config",     icon: Settings },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(
    sessionStorage.getItem("adminAuth") === "true"
  );
  const [activeTab, setActiveTab] = useState("overview");

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

  const { bookings, setBookings, loading: bLoading } = useBookings();
  const { seatMap } = useSeats();
  const { config, layout, loading: cLoading } = useMovieConfig();

  const logout = () => {
    sessionStorage.removeItem("adminAuth");
    setAuthed(false);
  };

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} config={config} />;
  }

  const adminRole = sessionStorage.getItem("adminRole") || "master";

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
            <span style={{ fontSize: "0.68rem", background: "rgba(255,215,0,0.15)", color: "var(--gold)", padding: "2px 6px", borderRadius: 4, marginLeft: "auto", textTransform: "uppercase", fontWeight: 800 }}>
              {adminRole}
            </span>
          </div>
          <nav className="admin-sidebar__nav">
            {TABS.map((t) => {
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
            <h1 className="admin-topbar__title">
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
            
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
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
              <div className="admin-topbar__movie">
                {config.movieName && (
                  <span>{config.movieName} · {config.date} · {config.theater}</span>
                )}
              </div>
            </div>
          </div>

          <div className="admin-content">
            {activeTab === "overview" && (
              <AdminStats bookings={bookings} config={config} layout={layout} onInstallApp={installApp} isInstalled={isInstalled} />
            )}
            {activeTab === "bookings" && (
              <BookingTable bookings={bookings} setBookings={setBookings} config={config} />
            )}
            {activeTab === "seatmap" && (
              <div className="card">
                <AdminSeatMap
                  seatMap={seatMap}
                  bookings={bookings}
                  config={config}
                  layout={layout}
                />
              </div>
            )}
            {activeTab === "layout" && (
              <TheaterLayoutEditor config={config} />
            )}
            {activeTab === "config" && (
              <MovieConfigEditor config={config} layout={layout} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
