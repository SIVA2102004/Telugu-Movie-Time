import { useState, useEffect, useRef, useCallback } from "react";
import { db, rtdb } from "../firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { ref, onValue, get } from "firebase/database";

/**
 * Universal real-time synchronization hook for bookings.
 * Actively syncs across Firestore, Firebase Realtime Database (RTDB), and local storage cache.
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

  // Helper to merge and clean bookings
  const processAndSetBookings = useCallback((newList) => {
    if (!Array.isArray(newList)) return;
    const map = new Map();

    // Deduplicate by booking ID
    newList.forEach((b) => {
      if (b && b.id) {
        map.set(b.id, b);
      }
    });

    const combined = Array.from(map.values());
    combined.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (throttleRef.current) clearTimeout(throttleRef.current);
    throttleRef.current = setTimeout(() => {
      setBookings(combined);
      try {
        localStorage.setItem("telugu_talkies_bookings_cache", JSON.stringify(combined));
      } catch (e) {}
    }, 10);
  }, []);

  // Manual one-click cloud pull across both Firestore & RTDB
  const refreshBookings = useCallback(async () => {
    setRefreshing(true);
    const collected = [];

    // 1. Fetch from Firestore
    try {
      const snap = await getDocs(collection(db, "bookings"));
      snap.docs.forEach((d) => {
        const val = d.data();
        if (val) {
          collected.push({
            id: d.id,
            ...val,
            createdAt: val.createdAt?.toDate ? val.createdAt.toDate().toISOString() : (val.createdAt || new Date().toISOString()),
          });
        }
      });
    } catch (fsErr) {
      console.warn("Firestore fetch error:", fsErr);
    }

    // 2. Fetch from Realtime Database backup
    try {
      const rtdbSnap = await get(ref(rtdb, "all_bookings"));
      if (rtdbSnap.exists()) {
        const val = rtdbSnap.val() || {};
        Object.keys(val).forEach((k) => {
          if (val[k]) {
            collected.push({ id: k, ...val[k] });
          }
        });
      }
    } catch (rtdbErr) {
      console.warn("RTDB fetch notice:", rtdbErr);
    }

    // 3. Include local storage cache if any
    try {
      const localCached = JSON.parse(localStorage.getItem("telugu_talkies_bookings_cache") || "[]");
      if (Array.isArray(localCached)) {
        localCached.forEach((b) => collected.push(b));
      }
    } catch (e) {}

    if (collected.length > 0) {
      processAndSetBookings(collected);
    }
    setRefreshing(false);
  }, [processAndSetBookings]);

  useEffect(() => {
    // 1. Local Cross-Tab Storage Listener
    const handleStorageChange = () => {
      try {
        const cached = localStorage.getItem("telugu_talkies_bookings_cache");
        if (cached) {
          setBookings(JSON.parse(cached));
        }
      } catch (e) {}
    };
    window.addEventListener("storage", handleStorageChange);

    // 2. Real-Time Cloud Firestore Listener (handles both empty and non-empty changes)
    let unsubFirestore = () => {};
    try {
      unsubFirestore = onSnapshot(
        collection(db, "bookings"),
        (snapshot) => {
          const list = snapshot.docs.map((d) => {
            const val = d.data();
            return {
              id: d.id,
              ...val,
              createdAt: val.createdAt?.toDate ? val.createdAt.toDate().toISOString() : (val.createdAt || new Date().toISOString()),
            };
          });
          if (list.length > 0) {
            processAndSetBookings(list);
          }
        },
        (err) => {
          console.warn("Firestore live listener notice:", err);
        }
      );
    } catch (e) {}

    // 3. Real-Time Firebase Realtime Database (RTDB) Listener
    let unsubRTDB = () => {};
    try {
      const bookingsRef = ref(rtdb, "all_bookings");
      unsubRTDB = onValue(
        bookingsRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.val() || {};
            const list = Object.keys(data).map((k) => ({ id: k, ...data[k] }));
            processAndSetBookings(list);
          }
        },
        (err) => {
          console.warn("RTDB live listener notice:", err);
        }
      );
    } catch (e) {}

    // 4. Initial fetch on mount & periodic 5-second polling safeguard
    refreshBookings();
    const pollInterval = setInterval(() => {
      refreshBookings();
    }, 5000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      if (throttleRef.current) clearTimeout(throttleRef.current);
      clearInterval(pollInterval);
      unsubFirestore();
      unsubRTDB();
    };
  }, [processAndSetBookings, refreshBookings]);

  return { bookings, setBookings, loading, refreshing, refreshBookings };
}
