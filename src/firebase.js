import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForSafeRender123456",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "telugu-talkies.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "telugu-talkies",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "telugu-talkies.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://telugu-talkies-default-rtdb.firebaseio.com",
};

let app;
try {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
} catch (e) {
  console.warn("Firebase initialization notice:", e);
  app = initializeApp(firebaseConfig, "fallback");
}

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
