import { useState, useEffect, useRef } from "react";
import { db, rtdb } from "../firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { ref, onValue } from "firebase/database";

/**
 * High-performance hook for real-time seat tracking.
 * Reacts to Firestore bookings, RTDB seats node, and local storage cache.
 */
export function useSeats(screenId = "screen-1", theaterId = null) {
  const cacheKey = theaterId ? `telugu_talkies_seats_cache_${theaterId}_${screenId}` : `telugu_talkies_seats_cache_${screenId}`;

  const [seatMap, setSeatMap] = useState(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      return {};
    }
  });

  const throttleRef = useRef(null);

  useEffect(() => {
    // 0. Immediately re-initialize state when screenId or theaterId switches
    try {
      const cached = localStorage.getItem(cacheKey);
      setSeatMap(cached ? JSON.parse(cached) : {});
    } catch (e) {
      setSeatMap({});
    }

    // 1. Cross-tab and local storage listener for instant 0ms seat map refresh
    const handleStorage = () => {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setSeatMap(JSON.parse(cached));
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorage);

    // Sources
    let currentRTDB = {};
    let currentLocks = {};
    let currentBookings = {};

    const recomputeSeats = () => {
      const merged = {
        ...currentBookings,
        ...currentRTDB,
        ...currentLocks,
      };
      setSeatMap(merged);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch (e) {}
    };

    // 2. Realtime Database listener per theater + screen
    let unsubRTDB = () => {};
    try {
      const rtdbNode = theaterId ? `seats_${theaterId}_${screenId}` : `seats_${screenId}`;
      const seatsRef = ref(rtdb, rtdbNode);
      unsubRTDB = onValue(
        seatsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            currentRTDB = snapshot.val() || {};
          } else {
            currentRTDB = {};
          }
          recomputeSeats();
        },
        (error) => {
          console.warn("RTDB seats listener notice:", error);
        }
      );
    } catch (err) {
      console.warn("RTDB offline mode:", err);
    }

    // 3. Realtime activeLocks listener from Firestore per theater + screen
    let unsubActiveLocks = () => {};
    try {
      unsubActiveLocks = onSnapshot(
        collection(db, "activeLocks"),
        (snapshot) => {
          const locks = {};
          const now = Date.now();
          snapshot.docs.forEach((d) => {
            const data = d.data();
            // Discard stale locks older than 5 minutes and match screen/theater
            if (data && (!data.timestamp || now - data.timestamp < 5 * 60 * 1000)) {
              const matchesTheater = !theaterId || !data.theaterId || data.theaterId === theaterId;
              if (data.screenId === screenId && matchesTheater) {
                const cleanSeatId = d.id.startsWith(`${screenId}_`)
                  ? d.id.replace(`${screenId}_`, "")
                  : d.id;
                locks[cleanSeatId] = "locked";
              }
            }
          });
          currentLocks = locks;
          recomputeSeats();
        },
        (err) => {
          console.warn("Firestore activeLocks sync notice:", err);
        }
      );
    } catch (e) {}

    // 4. Firestore bookings listener for seat map filtered strictly by theaterId & screenId
    let unsubFirestore = () => {};
    try {
      unsubFirestore = onSnapshot(
        collection(db, "bookings"),
        (snapshot) => {
          const map = {};
          snapshot.docs.forEach((d) => {
            const b = d.data();
            const bScreen = b.screenId || "screen-1";
            const matchesTheater = !theaterId || !b.theaterId || b.theaterId === theaterId;
            if (b && b.status !== "cancelled" && Array.isArray(b.seats) && bScreen === screenId && matchesTheater) {
              b.seats.forEach((seatId) => {
                map[seatId] = b.status === "confirmed" ? "booked" : "pending";
              });
            }
          });
          currentBookings = map;
          recomputeSeats();
        },
        (err) => {
          console.warn("Firestore seat sync notice:", err);
        }
      );
    } catch (e) {}

    return () => {
      window.removeEventListener("storage", handleStorage);
      if (throttleRef.current) clearTimeout(throttleRef.current);
      unsubRTDB();
      unsubActiveLocks();
      unsubFirestore();
    };
  }, [screenId, theaterId, cacheKey]);

  return { seatMap, setSeatMap };
}
