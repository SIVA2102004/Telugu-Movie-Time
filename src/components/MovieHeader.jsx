import { Film, MapPin, Calendar, Clock, IndianRupee } from "lucide-react";
import "./MovieHeader.css";

export default function MovieHeader({ config = {}, layout = {} }) {
  const { movieName = "Movie TBA", date = "", theater = "", showTime = "", pricePerSeat = 200 } = config || {};

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

  const tierPrices = layout?.tierPrices;
  const priceDisplay = tierPrices && Object.values(tierPrices).length > 0
    ? `From ₹${Math.min(...Object.values(tierPrices))}`
    : `₹${pricePerSeat || 200}`;

  return (
    <header className="movie-header">
      <div className="movie-header__inner">
        {/* App brand */}
        <div className="movie-header__brand">
          <Film size={22} color="#FFD700" />
          <span>Telugu Talkies</span>
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

        {/* Price badge */}
        <div className="movie-header__price">
          <span>{priceDisplay}</span>
          <small>per seat</small>
        </div>
      </div>
    </header>
  );
}
