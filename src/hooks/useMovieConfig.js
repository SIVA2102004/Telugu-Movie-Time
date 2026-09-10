import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

// Screen 1 Layout (Default Hall - 274 Seats matching exact physical theater blueprint)
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
    J: "Gold",
    K: "Gold",
    L: "Gold",
    M: "Gold",
    N: "Gold",
    O: "Gold",
  },
  tierPrices: {
    Platinum: 500,
    Gold: 320,
    Silver: 200,
  },
  seats: {
    A: [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, null, null],
    B: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    C: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    E: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    F: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    G: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    H: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    I: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    J: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    K: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    L: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    M: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    N: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
  },
};

// Screen 3 / Amphitheater Layout (8 Curved Rows matching newly uploaded blueprint photo)
export const CURVED_AMPHITHEATER_LAYOUT = {
  rows: ["A", "B", "C", "D", "E", "F", "G", "H"],
  screenPosition: "bottom",
  rowTiers: {
    A: "Platinum",
    B: "Platinum",
    C: "Gold",
    D: "Gold",
    E: "Gold",
    F: "Silver",
    G: "Silver",
    H: "Silver",
  },
  tierPrices: {
    Platinum: 500,
    Gold: 320,
    Silver: 200,
  },
  seats: {
    // Front to back fan layout: Row A (front/12 seats) to Row H (back/26 seats)
    A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    B: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    C: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
    D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    E: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    F: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    G: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    H: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26],
  },
};


export const DEFAULT_SCREENS = [
  {
    id: "screen-1",
    name: "Screen 1 (Main Hall)",
    movieName: "PARADISE",
    theater: "Crystal Mall (Screen 1)",
    date: "2026-09-26",
    showTime: "8:00 AM",
    pricePerSeat: 200,
    posterUrl: null,
    tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    layout: BLUEPRINT_LAYOUT,
    isPublished: true,
  },
  {
    id: "screen-2",
    name: "Screen 2 (Audi 2 - Telugu Special)",
    movieName: "TELUGU SPECIAL SHOW",
    theater: "Crystal Mall (Screen 2)",
    date: "2026-09-26",
    showTime: "11:30 AM",
    pricePerSeat: 200,
    posterUrl: null,
    tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    layout: BLUEPRINT_LAYOUT,
    isPublished: false,
  },
  {
    id: "screen-3",
    name: "Screen 3 (Audi 3 - Matinee Show)",
    movieName: "TELUGU MOVIE TIME",
    theater: "Crystal Mall (Screen 3)",
    date: "2026-09-26",
    showTime: "3:00 PM",
    pricePerSeat: 200,
    posterUrl: null,
    tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    layout: CURVED_AMPHITHEATER_LAYOUT,
    isPublished: false,
  },
  {
    id: "screen-4",
    name: "Screen 4 (Audi 4 - Prime Night)",
    movieName: "BLOCKBUSTER PREMIERE",
    theater: "Crystal Mall (Screen 4)",
    date: "2026-09-26",
    showTime: "7:00 PM",
    pricePerSeat: 250,
    posterUrl: null,
    tierPrices: { Platinum: 550, Gold: 350, Silver: 250 },
    layout: BLUEPRINT_LAYOUT,
    isPublished: false,
  }
];

export function buildDefaultLayout(numRows = 15, numCols = 18) {
  if (numRows === 15 && numCols === 18) {
    return JSON.parse(JSON.stringify(BLUEPRINT_LAYOUT));
  }
  const rows = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, Math.min(26, numRows)).split("");
  const seats = {};
  const rowTiers = {};
  rows.forEach((r, idx) => {
    seats[r] = Array.from({ length: numCols }, (_, i) => i + 1);
    if (idx === 0) rowTiers[r] = "Platinum";
    else if (idx <= 4) rowTiers[r] = "Gold";
    else rowTiers[r] = "Silver";
  });
  return {
    rows,
    screenPosition: "top",
    rowTiers,
    tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    seats,
  };
}

const DEFAULT_CONFIG = {
  activeScreenId: "screen-1",
  screens: DEFAULT_SCREENS,
  movieName: "PARADISE",
  date: "2026-09-26",
  theater: "Crystal Mall",
  showTime: "8:00 AM",
  pricePerSeat: 200,
  enableCategoryPricing: true, // Master Admin can enable/disable Category Rates
  posterUrl: null,
  tierPrices: {
    Platinum: 500,
    Gold: 320,
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

export function sanitizeLayout(layout) {
  if (!layout || !Array.isArray(layout.rows) || !layout.seats || typeof layout.seats !== "object") {
    return JSON.parse(JSON.stringify(BLUEPRINT_LAYOUT));
  }
  return {
    ...layout,
    rows: [...layout.rows],
    seats: { ...layout.seats },
    rowTiers: layout.rowTiers ? { ...layout.rowTiers } : {},
    tierPrices: layout.tierPrices || { Platinum: 500, Gold: 320, Silver: 200 },
    screenPosition: layout.screenPosition || "top",
  };
}

export function sanitizeConfig(cfg) {
  if (!cfg) return DEFAULT_CONFIG;
  const layout = sanitizeLayout(cfg.layout);
  const screens = (cfg.screens || DEFAULT_SCREENS).map((scr) => ({
    ...scr,
    layout: sanitizeLayout(scr.layout),
    blueprintImageUrl: scr.blueprintImageUrl || null,
  }));
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    layout,
    screens,
  };
}

/**
 * Subscribes to movieConfig/current in Firestore with cross-tab local storage synchronization.
 */
export function useMovieConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("telugu_talkies_movie_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        return sanitizeConfig(parsed);
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
          setConfig(sanitizeConfig(parsed));
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
            const sanitized = sanitizeConfig(data);
            setConfig(sanitized);
            try {
              localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(sanitized));
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
  const isCategoryEnabled = config.enableCategoryPricing !== false;

  const getSeatPrice = (seatId) => {
    if (!isCategoryEnabled) {
      return Number(config.pricePerSeat || 200);
    }
    if (!seatId) return config.pricePerSeat || 200;
    const row = seatId.charAt(0);
    const tier = layout.rowTiers?.[row] || "Silver";
    if (effectiveTierPrices[tier] !== undefined) {
      return Number(effectiveTierPrices[tier]);
    }
    return Number(config.pricePerSeat || 200);
  };

  const getSeatTier = (seatId) => {
    if (!isCategoryEnabled) return "Standard";
    if (!seatId) return "Silver";
    const row = seatId.charAt(0);
    return layout.rowTiers?.[row] || "Silver";
  };

  return { config, layout, loading, getSeatPrice, getSeatTier };
}
