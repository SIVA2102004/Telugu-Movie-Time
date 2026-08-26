import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

// The exact blueprint hall layout (15 Rows, 274 Seats, Recliner / Gold / Silver with Aisle gaps)
export const BLUEPRINT_LAYOUT = {
  rows: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"],
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
  },
  seats: {
    A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    B: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    C: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    E: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    F: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    G: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    H: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    I: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    J: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    K: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    L: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    M: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    N: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    O: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
};

export function buildDefaultLayout() {
  return JSON.parse(JSON.stringify(BLUEPRINT_LAYOUT));
}

const DEFAULT_CONFIG = {
  movieName: "Telugu Movie Time",
  date: "2026-08-30",
  theater: "Rajshree Cinema (Screen 1)",
  showTime: "6:30 PM",
  pricePerSeat: 200,
  tierPrices: {
    Platinum: 300,
    Gold: 250,
    Silver: 200,
  },
  blockedSeats: [],
  bookingDeadline: null,
  layout: BLUEPRINT_LAYOUT,
  blueprintImageUrl: null,
  upiId: "telugumovietime@upi",
  payeeName: "Telugu Movie Time",
  adminPhone: "919876543210",
  coAdminCode: "COADMIN2026",
  adminPassword: "admin123",
};

/**
 * Subscribes to movieConfig/current in Firestore with cross-tab local storage synchronization.
 */
export function useMovieConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("telugu_talkies_movie_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          layout: parsed.layout || BLUEPRINT_LAYOUT,
        };
      }
    } catch (e) {}
    return DEFAULT_CONFIG;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Cross-tab and local storage instant sync
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem("telugu_talkies_movie_config");
        if (saved) {
          const parsed = JSON.parse(saved);
          setConfig({
            ...DEFAULT_CONFIG,
            ...parsed,
            layout: parsed.layout || BLUEPRINT_LAYOUT,
          });
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorage);

    // 2. Real-time Firestore sync
    let unsubscribe = () => {};
    try {
      const docRef = doc(db, "movieConfig", "current");
      unsubscribe = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const merged = {
              ...DEFAULT_CONFIG,
              ...data,
              layout: data.layout || BLUEPRINT_LAYOUT,
            };
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

    return () => {
      window.removeEventListener("storage", handleStorage);
      unsubscribe();
    };
  }, []);

  const layout = config.layout || BLUEPRINT_LAYOUT;

  // Prefer tier prices from config or layout
  const effectiveTierPrices = config.tierPrices || layout.tierPrices || { Platinum: 300, Gold: 250, Silver: 200 };

  const getSeatPrice = (seatId) => {
    if (!seatId) return config.pricePerSeat || 200;
    const row = seatId.charAt(0);
    const tier = layout.rowTiers?.[row] || "Silver";
    if (effectiveTierPrices[tier] !== undefined) {
      return Number(effectiveTierPrices[tier]);
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
