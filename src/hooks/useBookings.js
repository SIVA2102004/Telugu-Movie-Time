import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

/**
 * Subscribes to bookings across local shared storage and Firestore.
 */
export function useBookings() {
  const [bookings, setBookings] = useState(() => {
    try {
      const cached = localStorage.getItem("telugu_talkies_bookings_cache");
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const throttleRef = useRef(null);

  useEffect(() => {
    // 1. Cross-tab storage listener so student submissions show in admin instantly
    const handleStorageChange = () => {
      try {
        const cached = localStorage.getItem("telugu_talkies_bookings_cache");
        if (cached) {
          setBookings(JSON.parse(cached));
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorageChange);

    // 2. Cloud Firestore real-time listener
    let unsubscribe = () => {};
    try {
      const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (throttleRef.current) clearTimeout(throttleRef.current);
            throttleRef.current = setTimeout(() => {
              setBookings(data);
              try {
                localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(data));
              } catch (e) {}
            }, 30);
          }
        },
        (err) => {
          console.warn("Firestore bookings sync notice:", err);
        }
      );
    } catch (err) {
      console.warn("Firestore offline mode:", err);
    }

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (throttleRef.current) clearTimeout(throttleRef.current);
      unsubscribe();
    };
  }, []);

  return { bookings, setBookings, loading };
}
