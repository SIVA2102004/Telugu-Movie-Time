import { MapPin, Calendar, Clock, Lock } from "lucide-react";
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
          <h1 className="movie-header__title">{movieName}</h1>
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

        {/* Direct Admin Portal Login Link */}
        <div className="movie-header__admin-link">
          <a href="/admin" className="btn btn-outline" style={{ padding: "6px 14px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 6, borderColor: "var(--gold)", color: "var(--gold)" }}>
            <Lock size={14} /> Admin Portal
          </a>
        </div>
      </div>
    </header>
  );
}
