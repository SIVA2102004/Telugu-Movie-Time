import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

// Default 10×10 layout (A–J, 10 seats each, no gaps)
export function buildDefaultLayout(rows = 10, cols = 10) {
  const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, rows);
  const layout = {
    rows: rowLabels.split(""),
    screenPosition: "top",
    rowTiers: {
      A: "Platinum",
      B: "Gold",
      C: "Gold",
      D: "Gold",
      E: "Gold",
      F: "Gold",
      G: "Gold",
      H: "Gold",
      I: "Gold",
      J: "Silver",
      K: "Silver",
      L: "Silver",
      M: "Silver",
      N: "Silver",
      O: "Silver",
    },
    tierPrices: {
      Platinum: 300,
      Gold: 250,
      Silver: 200,
    }
  };
  layout.seats = {};
  rowLabels.split("").forEach((r) => {
    layout.seats[r] = Array.from({ length: cols }, (_, i) => i + 1);
  });
  return layout;
}

const DEFAULT_LAYOUT = buildDefaultLayout(10, 10);

const DEFAULT_CONFIG = {
  movieName: "Telugu Talkies",
  date: "",
  theater: "",
  showTime: "",
  pricePerSeat: parseInt(import.meta.env.VITE_TICKET_PRICE || "200"),
  blockedSeats: [],
  bookingDeadline: null,
  layout: null,
  blueprintImageUrl: null,
  upiId: "telugutalkies@upi",
  payeeName: "Telugu Talkies",
  adminPhone: "919876543210",
  coAdminCode: "COADMIN2026",
  adminPassword: "admin123",
};

/**
 * Subscribes to movieConfig/current in Firestore with zero-blocking instant load.
 */
export function useMovieConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("telugu_talkies_movie_config");
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {}
    return DEFAULT_CONFIG;
  });

  // Never block UI with loading: false by default since local cache/defaults exist immediately
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      const docRef = doc(db, "movieConfig", "current");
      unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const merged = { ...DEFAULT_CONFIG, ...data };
            setConfig(merged);
            try {
              localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(merged));
            } catch (e) {}
          }
        },
        (error) => {
          console.warn("Firestore snapshot notice:", error);
        }
      );
    } catch (err) {
      console.warn("Firestore offline mode:", err);
    }
    return () => unsubscribe();
  }, []);

  const layout = config.layout || DEFAULT_LAYOUT;

  const getSeatPrice = (seatId) => {
    if (!seatId) return config.pricePerSeat || 200;
    const row = seatId.charAt(0);
    const tier = layout.rowTiers?.[row] || "Silver";
    if (layout.tierPrices && layout.tierPrices[tier] !== undefined) {
      return Number(layout.tierPrices[tier]);
    }
    return Number(config.pricePerSeat || 200);
  };

  const getSeatTier = (seatId) => {
    if (!seatId) return "Silver";
    const row = seatId.charAt(0);
    return layout.rowTiers?.[row] || "Silver";
  };

  return { config, layout, loading, getSeatPrice, getSeatTier };
}
