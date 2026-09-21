import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";

// Theater Blueprint Layout (14 Rows · 278 Seats matching exact physical hall blueprint sheet)
export const BLUEPRINT_LAYOUT = {
  rows: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"],
  screenPosition: "top",
  seatDirection: "ltr",
  numberingMode: "sequential",
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
  },
  tierPrices: {
    Platinum: 500,
    Gold: 320,
    Silver: 200,
  },
  seats: {
    A: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    B: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    C: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    D: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    E: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    F: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    G: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    H: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    I: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    J: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    K: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    L: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    M: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    N: [1, 2, 3, 4, null, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
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
    movieName: "",
    theater: "Cinema Hall (Screen 1)",
    date: new Date().toISOString().split("T")[0],
    showTime: "6:00 PM",
    pricePerSeat: 200,
    posterUrl: null,
    movieTagline: "",
    movieDescription: "",
    genre: "",
    locationAddress: "",
    mapsUrl: "",
    tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    layout: BLUEPRINT_LAYOUT,
    isPublished: true,
  },
  {
    id: "screen-2",
    name: "Screen 2 (Audi 2)",
    movieName: "",
    theater: "Cinema Hall (Screen 2)",
    date: new Date().toISOString().split("T")[0],
    showTime: "9:00 PM",
    pricePerSeat: 200,
    posterUrl: null,
    movieTagline: "",
    movieDescription: "",
    genre: "",
    locationAddress: "",
    mapsUrl: "",
    tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    layout: BLUEPRINT_LAYOUT,
    isPublished: false,
  },
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
  movieName: "",
  date: new Date().toISOString().split("T")[0],
  theater: "My Cinema Hall",
  showTime: "6:00 PM",
  pricePerSeat: 200,
  enableCategoryPricing: true,
  posterUrl: null,
  movieTagline: "",
  movieDescription: "",
  genre: "",
  locationAddress: "",
  mapsUrl: "",
  tierPrices: {
    Platinum: 500,
    Gold: 320,
    Silver: 200,
  },
  blockedSeats: [],
  bookingDeadline: null,
  layout: BLUEPRINT_LAYOUT,
  blueprintImageUrl: null,
  upiId: "",
  payeeName: "",
  adminPhone: "",
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
    seatDirection: layout.seatDirection || "ltr",
    numberingMode: layout.numberingMode || "sequential",
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

export function buildFreshTheaterConfig(theaterId, theaterName, location = "Hyderabad", ownerId = null) {
  const todayStr = new Date().toISOString().split("T")[0];

  const freshScreens = [
    {
      id: "screen-1",
      name: "Screen 1 (Main Hall)",
      movieName: "",
      theater: `${theaterName} (Screen 1)`,
      date: todayStr,
      showTime: "6:00 PM",
      pricePerSeat: 200,
      posterUrl: null,
      movieTagline: "",
      movieDescription: "",
      genre: "Action / Drama · Telugu (U/A)",
      locationAddress: location,
      mapsUrl: "",
      tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
      blockedSeats: [],
      layout: BLUEPRINT_LAYOUT,
      isPublished: true,
    },
    {
      id: "screen-2",
      name: "Screen 2 (Audi 2)",
      movieName: "",
      theater: `${theaterName} (Screen 2)`,
      date: todayStr,
      showTime: "9:00 PM",
      pricePerSeat: 200,
      posterUrl: null,
      movieTagline: "",
      movieDescription: "",
      genre: "Action / Drama · Telugu (U/A)",
      locationAddress: location,
      mapsUrl: "",
      tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
      blockedSeats: [],
      layout: BLUEPRINT_LAYOUT,
      isPublished: false,
    },
  ];

  return {
    id: theaterId,
    ownerId,
    activeScreenId: "screen-1",
    screens: freshScreens,
    movieName: "",
    date: todayStr,
    theater: theaterName,
    location: location,
    showTime: "6:00 PM",
    pricePerSeat: 200,
    enableCategoryPricing: true,
    posterUrl: null,
    movieTagline: "",
    movieDescription: "",
    genre: "Action / Drama · Telugu (U/A)",
    tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    blockedSeats: [],
    layout: BLUEPRINT_LAYOUT,
    upiId: `${theaterName.toLowerCase().replace(/[^a-z0-9]/g, "")}@upi`,
    payeeName: theaterName,
    adminPhone: "",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Subscribes to movieConfig/[theaterId] in Firestore with cross-tab local storage synchronization.
 */
export function useMovieConfig(theaterId = null) {
  const effectiveTheaterId = theaterId || sessionStorage.getItem("adminTheaterId") || null;
  const storageKey = effectiveTheaterId ? `telugu_talkies_movie_config_${effectiveTheaterId}` : "telugu_talkies_movie_config";

  const [config, setConfig] = useState(() => {
    try {
      const savedSpecific = localStorage.getItem(storageKey);
      if (savedSpecific) {
        return sanitizeConfig(JSON.parse(savedSpecific));
      }
      const savedGlobal = localStorage.getItem("telugu_talkies_movie_config");
      if (savedGlobal) {
        return sanitizeConfig(JSON.parse(savedGlobal));
      }
    } catch (e) {}

    return DEFAULT_CONFIG;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Cross-tab and local storage instant sync
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem(storageKey) || localStorage.getItem("telugu_talkies_movie_config");
        if (saved) {
          const parsed = JSON.parse(saved);
          setConfig(sanitizeConfig(parsed));
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorage);

    // 2. Real-time Firestore sync
    let unsubscribeConfig = () => {};
    let unsubscribeTheater = () => {};
    let unsubscribeCurrent = () => {};

    try {
      const targetDocId = effectiveTheaterId || "current";
      const docRef = doc(db, "movieConfig", targetDocId);
      unsubscribeConfig = onSnapshot(
        docRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const sanitized = sanitizeConfig({ id: snap.id, theaterId: snap.id, ...data });
            setConfig(sanitized);
            try {
              localStorage.setItem(storageKey, JSON.stringify(sanitized));
            } catch (e) {}
          } else {
            // Fallback 1: Listen to master movieConfig/current document
            const currentRef = doc(db, "movieConfig", "current");
            unsubscribeCurrent = onSnapshot(currentRef, (currSnap) => {
              if (currSnap.exists()) {
                const sanitized = sanitizeConfig({ id: "current", theaterId: "current", ...currSnap.data() });
                setConfig(sanitized);
              }
            });

            // Fallback 2: Listen to theaters collection document
            if (effectiveTheaterId) {
              const thRef = doc(db, "theaters", effectiveTheaterId);
              unsubscribeTheater = onSnapshot(thRef, (thSnap) => {
                if (thSnap.exists()) {
                  const thData = thSnap.data();
                  const constructed = sanitizeConfig({
                    id: thSnap.id,
                    theaterId: thSnap.id,
                    theater: thData.name,
                    upiId: thData.upiId,
                    payeeName: thData.payeeName,
                    adminPhone: thData.adminPhone,
                    screens: thData.screens || DEFAULT_SCREENS,
                    activeScreenId: thData.activeScreenId || "screen-1",
                    ownerId: thData.ownerId,
                  });
                  setConfig(constructed);
                }
              });
            }
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
      unsubscribeConfig();
      unsubscribeTheater();
      unsubscribeCurrent();
    };
  }, [effectiveTheaterId, storageKey]);

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

/**
 * Universal system data wipe: deletes all accounts, blueprints, seat layouts, and bookings
 * for a fresh start.
 */
export async function resetAllSystemData() {
  localStorage.clear();
  sessionStorage.clear();

  try {
    const { getDocs, collection, deleteDoc, doc, setDoc } = await import("firebase/firestore");
    const { ref, set } = await import("firebase/database");
    const { db, rtdb } = await import("../firebase");

    const collectionsToClear = ["bookings", "theaters", "users", "coAdmins", "activeLocks"];
    for (const colName of collectionsToClear) {
      try {
        const snap = await getDocs(collection(db, colName));
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      } catch (e) {}
    }

    // Reset movieConfig/current to fresh clean state
    const freshScreens = DEFAULT_SCREENS.map((s) => ({
      ...s,
      blueprintImageUrl: null,
      posterUrl: null,
    }));

    const freshConfig = {
      activeScreenId: "screen-1",
      screens: freshScreens,
      movieName: "NEW SHOW",
      date: "2026-09-26",
      theater: "My Cinema Hall",
      showTime: "6:00 PM",
      pricePerSeat: 200,
      enableCategoryPricing: true,
      posterUrl: null,
      tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
      blockedSeats: [],
      layout: BLUEPRINT_LAYOUT,
      blueprintImageUrl: null,
      upiId: "",
      payeeName: "",
      adminPhone: "",
      coAdminCode: "COADMIN2026",
      adminPassword: "admin123",
    };

    await setDoc(doc(db, "movieConfig", "current"), freshConfig);

    for (let i = 1; i <= 4; i++) {
      try {
        await set(ref(rtdb, `seats_screen-${i}`), null);
      } catch (e) {}
    }
  } catch (err) {
    console.warn("Wipe notice:", err);
  }

  window.location.reload();
}
