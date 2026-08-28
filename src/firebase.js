import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

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

let app;
try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
} catch (e) {
  console.warn("Firebase initialization notice:", e);
  app = initializeApp(firebaseConfig, "tmt-prod");
}

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export default app;
