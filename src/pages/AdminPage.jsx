import { useState } from "react";
import { useBookings } from "../hooks/useBookings";
import { useSeats } from "../hooks/useSeats";
import { useMovieConfig } from "../hooks/useMovieConfig";
import AdminLogin from "../components/AdminLogin";
import AdminStats from "../components/AdminStats";
import BookingTable from "../components/BookingTable";
import AdminSeatMap from "../components/AdminSeatMap";
import MovieConfigEditor from "../components/MovieConfigEditor";
import TheaterLayoutEditor from "../components/TheaterLayoutEditor";
import { Toaster } from "react-hot-toast";
import { Film, LayoutDashboard, List, Map, Settings, LogOut, LayoutTemplate } from "lucide-react";
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
            <div className="admin-topbar__movie">
              {config.movieName && (
                <span>{config.movieName} · {config.date} · {config.theater}</span>
              )}
            </div>
          </div>

          <div className="admin-content">
            {activeTab === "overview" && (
              <AdminStats bookings={bookings} config={config} layout={layout} />
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
