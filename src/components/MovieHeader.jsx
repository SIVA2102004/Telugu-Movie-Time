import { MapPin, Calendar, Clock } from "lucide-react";
import "./MovieHeader.css";

export default function MovieHeader({ config = {}, layout = {}, activeScreen = null }) {
  const currentScr = activeScreen || (config?.screens || []).find((s) => s.id === config?.activeScreenId) || config?.screens?.[0] || {};

  const movieName = currentScr.movieName || "Telugu Movie Time";
  const date = currentScr.date || "";
  const theater = currentScr.theater || "";
  const showTime = currentScr.showTime || "";
  const screenBadge = currentScr.name || "Screen 1";

  let formattedDate = "";
  if (date) {
    try {
      formattedDate = new Date(date).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      formattedDate = date;
    }
  }

  return (
    <header className="movie-header">
      <div className="movie-header__inner">
        {/* App brand with TMT logo */}
        <div className="movie-header__brand">
          <div className="tmt-logo-badge">
            <span>TMT</span>
          </div>
          <span className="tmt-brand-text">Telugu Movie Time</span>
        </div>

        {/* Movie info - Centered in Header */}
        <div className="movie-header__movie" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 className="movie-header__title" style={{ margin: 0, textAlign: "center" }}>{movieName}</h1>
            <span
              style={{
                background: "linear-gradient(135deg, #FF4444 0%, #B22222 100%)",
                color: "#ffffff",
                fontWeight: 900,
                fontSize: "0.72rem",
                padding: "3px 10px",
                borderRadius: 6,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                boxShadow: "0 0 10px rgba(255, 68, 68, 0.4)",
              }}
            >
              {screenBadge}
            </span>
          </div>
          <div className="movie-header__meta" style={{ justifyContent: "center" }}>
            {formattedDate && (
              <span>
                <Calendar size={14} />
                {formattedDate}
              </span>
            )}
            {theater && (
              <span>
                <MapPin size={14} />
                {theater}
              </span>
            )}
            {showTime && (
              <span>
                <Clock size={14} />
                {showTime}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
