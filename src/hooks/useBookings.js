import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";

/**
 * Universal real-time synchronization hook for bookings directly from Firestore.
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
  const [refreshing, setRefreshing] = useState(false);

  // Helper to deduplicate, sort, and save bookings
  const updateBookings = useCallback((list) => {
    if (!Array.isArray(list)) return;
    const map = new Map();
    list.forEach((b) => {
      if (b && b.id) {
        map.set(b.id, b);
      }
    });

    const sorted = Array.from(map.values());
    sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    setBookings(sorted);
    try {
      localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(sorted));
    } catch (e) {}
  }, []);

  // Manual one-click cloud fetch
  const refreshBookings = useCallback(async () => {
    setRefreshing(true);
    try {
      const snap = await getDocs(collection(db, "bookings"));
      const items = snap.docs.map((d) => {
        const val = d.data() || {};
        return {
          id: d.id,
          ...val,
          createdAt: val.createdAt?.toDate ? val.createdAt.toDate().toISOString() : (val.createdAt || new Date().toISOString()),
        };
      });
      updateBookings(items);
    } catch (err) {
      console.warn("Firestore fetch error:", err);
    } finally {
      setRefreshing(false);
    }
  }, [updateBookings]);

  useEffect(() => {
    // 1. Cross-tab storage listener
    const handleStorageChange = () => {
      try {
        const cached = localStorage.getItem("telugu_talkies_bookings_cache");
        if (cached) {
          setBookings(JSON.parse(cached));
        }
      } catch (e) {}
    };
    window.addEventListener("storage", handleStorageChange);

    // 2. Real-Time Cloud Firestore Listener
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        collection(db, "bookings"),
        (snapshot) => {
          const list = snapshot.docs.map((d) => {
            const val = d.data() || {};
            return {
              id: d.id,
              ...val,
              createdAt: val.createdAt?.toDate ? val.createdAt.toDate().toISOString() : (val.createdAt || new Date().toISOString()),
            };
          });
          updateBookings(list);
        },
        (err) => {
          console.warn("Firestore onSnapshot error:", err);
        }
      );
    } catch (e) {}

    // 3. Periodic cloud refresh safeguard every 3 seconds
    refreshBookings();
    const interval = setInterval(() => {
      refreshBookings();
    }, 3000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
      unsubscribe();
    };
  }, [refreshBookings, updateBookings]);

  return { bookings, setBookings, loading, refreshing, refreshBookings };
}
