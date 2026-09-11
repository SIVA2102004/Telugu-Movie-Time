import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqOCrbBaQ_bFSkrL8lIOQdZlCN-HRABjo",
  authDomain: "telugu-movie-time.firebaseapp.com",
  projectId: "telugu-movie-time",
  storageBucket: "telugu-movie-time.firebasestorage.app",
  messagingSenderId: "800548997459",
  appId: "1:800548997459:web:cfcf6822bcd51bf92439a6",
  measurementId: "G-TWMSNHK0V3",
  databaseURL: "https://telugu-movie-time-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BLUEPRINT_LAYOUT = {
  rows: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"],
  screenPosition: "top",
  rowTiers: {
    A: "Platinum", B: "Gold", C: "Gold", D: "Gold", E: "Gold",
    F: "Gold", G: "Gold", H: "Gold", I: "Gold", J: "Gold",
    K: "Gold", L: "Gold", M: "Gold", N: "Gold", O: "Gold",
  },
  tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
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
    O: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
  },
};

async function seed() {
  console.log("🌱 Seeding Cloud Firestore now...");

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
    adminPassword: "Siva@200456",
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

  // 1. Seed movieConfig/current
  await setDoc(doc(db, "movieConfig", "current"), defaultConfig, { merge: true });
  console.log("✓ Created collection 'movieConfig' -> document 'current'");

  // 2. Seed theaters/th_default_123
  await setDoc(doc(db, "theaters", defaultTheaterId), defaultTheater, { merge: true });
  console.log("✓ Created collection 'theaters' -> document 'th_default_123'");

  // 3. Seed movieConfig/th_default_123
  await setDoc(doc(db, "movieConfig", defaultTheaterId), { ...defaultConfig, id: defaultTheaterId }, { merge: true });
  console.log("✓ Created collection 'movieConfig' -> document 'th_default_123'");

  // 4. Seed users/demo_owner_123
  await setDoc(doc(db, "users", "demo_owner_123"), defaultUser, { merge: true });
  console.log("✓ Created collection 'users' -> document 'demo_owner_123'");

  console.log("🚀 Firestore successfully seeded! Check your Firebase Console now!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
