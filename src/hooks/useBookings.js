import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";

/**
 * Universal real-time synchronization hook for bookings directly from Firestore.
 */
export function useBookings(filterTheaterId = null, filterOwnerId = null) {
  const [bookings, setBookings] = useState(() => {
    try {
      const cached = localStorage.getItem("telugu_talkies_bookings_cache");
      const list = cached ? JSON.parse(cached) : [];
      if (!Array.isArray(list)) return [];
      return list.filter((b) => {
        if (filterTheaterId && b.theaterId && b.theaterId !== filterTheaterId) return false;
        if (filterOwnerId && b.ownerId && b.ownerId !== filterOwnerId) return false;
        return true;
      });
    } catch (e) {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const lastJSONRef = useRef("");

  // Helper to deduplicate, sort, filter, and save bookings
  const updateBookings = useCallback((list) => {
    if (!Array.isArray(list)) return;
    const map = new Map();
    list.forEach((b) => {
      if (b && b.id) {
        // Enforce owner / theater isolation filter
        if (filterTheaterId && filterTheaterId !== "default-theater" && filterTheaterId !== "current") {
          if (b.theaterId && b.theaterId !== filterTheaterId && b.theaterId !== "default-theater" && b.theaterId !== "current") {
            return;
          }
        }
        if (filterOwnerId && b.ownerId && b.ownerId !== filterOwnerId) return;
        map.set(b.id, b);
      }
    });

    const sorted = Array.from(map.values());
    sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const jsonStr = JSON.stringify(sorted);
    if (jsonStr === lastJSONRef.current) return;
    lastJSONRef.current = jsonStr;

    setBookings(sorted);
    try {
      localStorage.setItem("telugu_talkies_bookings_cache", jsonStr);
    } catch (e) {}
  }, [filterTheaterId, filterOwnerId]);

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
          const list = JSON.parse(cached);
          if (Array.isArray(list)) {
            updateBookings(list);
          }
        }
      } catch (e) {}
    };
    window.addEventListener("storage", handleStorageChange);

    // 2. Real-Time Cloud Firestore Listener (sub-second push updates)
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

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      unsubscribe();
    };
  }, [updateBookings]);

  return { bookings, setBookings, loading, refreshing, refreshBookings };
}
