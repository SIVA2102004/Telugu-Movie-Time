import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, getDocs, orderBy, query } from "firebase/firestore";

/**
 * High-performance hook for real-time bookings synchronization across Firestore, local storage, and PWA apps.
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
  const throttleRef = useRef(null);

  // Manual one-click cloud pull for 100% freshness across installed PWA app
  const refreshBookings = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1. Direct query with orderBy
      let snap;
      try {
        const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
        snap = await getDocs(q);
      } catch (orderErr) {
        // Fallback without orderBy if indexing or missing createdAt field
        snap = await getDocs(collection(db, "bookings"));
      }

      const freshData = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt,
      }));

      // Sort in memory by createdAt descending
      freshData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setBookings(freshData);
      try {
        localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(freshData));
      } catch (e) {}
    } catch (err) {
      console.warn("Manual bookings refresh notice:", err);
    } finally {
      setRefreshing(false);
    }
  }, []);

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

    // 2. Cloud Firestore real-time listener (handles both sorted and unsorted collection)
    let unsubscribe = () => {};
    try {
      const colRef = collection(db, "bookings");
      unsubscribe = onSnapshot(
        colRef,
        (snapshot) => {
          const data = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : d.data().createdAt,
          }));

          // Sort in memory descending
          data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

          if (throttleRef.current) clearTimeout(throttleRef.current);
          throttleRef.current = setTimeout(() => {
            setBookings(data);
            try {
              localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(data));
            } catch (e) {}
          }, 30);
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

  return { bookings, setBookings, loading, refreshing, refreshBookings };
}
