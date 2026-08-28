import { MapPin, Calendar, Clock } from "lucide-react";
import "./MovieHeader.css";

export default function MovieHeader({ config = {}, layout = {} }) {
  const { movieName = "Telugu Movie Time", date = "", theater = "", showTime = "" } = config || {};

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

        {/* Movie info */}
        <div className="movie-header__movie">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 className="movie-header__title" style={{ margin: 0 }}>{movieName}</h1>
            {config?.screens && (
              <span
                style={{
                  background: "var(--gold)",
                  color: "#0d0d1a",
                  fontWeight: 900,
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: 4,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {config.screens.find((s) => s.id === config.activeScreenId)?.name || "Screen 1"}
              </span>
            )}
          </div>
          <div className="movie-header__meta">
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
