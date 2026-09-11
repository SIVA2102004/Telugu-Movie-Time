import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { BLUEPRINT_LAYOUT } from "../hooks/useMovieConfig";

/**
 * Self-healing Auto-Seed helper:
 * If Firestore database was wiped/cleared in Firebase Console,
 * this function automatically populates initial collections & default documents!
 */
export async function seedFirestoreIfEmpty() {
  try {
    const currentDocRef = doc(db, "movieConfig", "current");
    const snap = await getDoc(currentDocRef);

    if (!snap.exists()) {
      console.log("🌱 Firestore database is empty. Auto-seeding default collections…");

      const todayStr = new Date().toISOString().split("T")[0];

      const defaultScreens = [
        {
          id: "screen-1",
          name: "Screen 1 (Main Hall)",
          movieName: "TELUGU MOVIE TIME",
          theater: "My Cinema Hall (Screen 1)",
          date: todayStr,
          showTime: "6:00 PM",
          pricePerSeat: 200,
          posterUrl: null,
          movieTagline: "Experience Cinema Like Never Before",
          movieDescription: "Book your tickets now for the biggest blockbuster experience.",
          genre: "Action / Drama · Telugu (U/A)",
          locationAddress: "Crystal Mall, 3rd Floor, Kalawad Road",
          mapsUrl: "",
          tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
          blockedSeats: [],
          layout: BLUEPRINT_LAYOUT,
          isPublished: true,
        },
        {
          id: "screen-2",
          name: "Screen 2 (Audi 2)",
          movieName: "SPECIAL SHOW",
          theater: "My Cinema Hall (Screen 2)",
          date: todayStr,
          showTime: "9:00 PM",
          pricePerSeat: 200,
          posterUrl: null,
          movieTagline: "",
          movieDescription: "",
          genre: "Action / Drama · Telugu (U/A)",
          locationAddress: "Crystal Mall, 3rd Floor, Kalawad Road",
          mapsUrl: "",
          tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
          blockedSeats: [],
          layout: BLUEPRINT_LAYOUT,
          isPublished: false,
        },
      ];

      const defaultConfig = {
        id: "current",
        activeScreenId: "screen-1",
        screens: defaultScreens,
        movieName: "TELUGU MOVIE TIME",
        date: todayStr,
        theater: "My Cinema Hall",
        showTime: "6:00 PM",
        pricePerSeat: 200,
        enableCategoryPricing: true,
        posterUrl: null,
        movieTagline: "Experience Cinema Like Never Before",
        movieDescription: "Book your tickets now for the biggest blockbuster experience.",
        genre: "Action / Drama · Telugu (U/A)",
        locationAddress: "Crystal Mall, 3rd Floor, Kalawad Road",
        mapsUrl: "",
        tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
        blockedSeats: [],
        layout: BLUEPRINT_LAYOUT,
        upiId: "mycinemahall@upi",
        payeeName: "My Cinema Hall",
        adminPhone: "9876543210",
        coAdminCode: "COADMIN2026",
        adminPassword: "admin123",
      };

      const defaultTheaterId = "th_default_123";
      const defaultTheater = {
        id: defaultTheaterId,
        name: "My Cinema Hall",
        location: "Hyderabad",
        upiId: "mycinemahall@upi",
        payeeName: "My Cinema Hall",
        adminPhone: "9876543210",
        coAdminCode: "COADMIN2026",
        activeScreenId: "screen-1",
        screens: defaultScreens,
        createdAt: new Date().toISOString(),
      };

      const defaultUser = {
        userId: "demo_owner_123",
        name: "Demo Theater Owner",
        email: "demo@theater.com",
        role: "THEATER_OWNER",
        theaterId: defaultTheaterId,
        createdAt: new Date().toISOString(),
      };

      // Seed movieConfig/current
      await setDoc(doc(db, "movieConfig", "current"), defaultConfig, { merge: true });

      // Seed theaters/th_default_123
      await setDoc(doc(db, "theaters", defaultTheaterId), defaultTheater, { merge: true });

      // Seed movieConfig/th_default_123
      await setDoc(doc(db, "movieConfig", defaultTheaterId), { ...defaultConfig, id: defaultTheaterId }, { merge: true });

      // Seed users/demo_owner_123
      await setDoc(doc(db, "users", "demo_owner_123"), defaultUser, { merge: true });

      console.log("✅ Auto-seeded Cloud Firestore successfully!");
    }
  } catch (err) {
    console.warn("Auto-seed notice:", err);
  }
}
