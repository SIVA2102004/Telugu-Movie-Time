import { useState, useEffect, useRef } from "react";
import { db, rtdb } from "../firebase";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { ref, onValue } from "firebase/database";

/**
 * High-performance hook for real-time seat tracking.
 * Reacts to Firestore bookings, RTDB seats node, and local storage cache.
 */
export function useSeats() {
  const [seatMap, setSeatMap] = useState(() => {
    try {
      const cached = localStorage.getItem("telugu_talkies_seats_cache");
      return cached ? JSON.parse(cached) : {};
    } catch (e) {
      return {};
    }
  });

  const throttleRef = useRef(null);

  useEffect(() => {
    // 1. Cross-tab and local storage listener for instant 0ms seat map refresh
    const handleStorage = () => {
      try {
        const cached = localStorage.getItem("telugu_talkies_seats_cache");
        if (cached) {
          setSeatMap(JSON.parse(cached));
        }
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorage);

    // 2. Realtime Database listener
    let unsubRTDB = () => {};
    try {
      const seatsRef = ref(rtdb, "seats");
      unsubRTDB = onValue(
        seatsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val() || {};
            if (throttleRef.current) clearTimeout(throttleRef.current);
            throttleRef.current = setTimeout(() => {
              setSeatMap((prev) => ({ ...prev, ...data }));
              try {
                const current = JSON.parse(localStorage.getItem("telugu_talkies_seats_cache") || "{}");
                localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify({ ...current, ...data }));
              } catch (e) {}
            }, 30);
          }
        },
        (error) => {
          console.warn("RTDB seats listener notice:", error);
        }
      );
    } catch (err) {
      console.warn("RTDB offline mode:", err);
    }

    // 3. Firestore bookings listener for seat map (guarantees seats turn Orange/Red across all devices)
    let unsubFirestore = () => {};
    try {
      unsubFirestore = onSnapshot(
        collection(db, "bookings"),
        (snapshot) => {
          const map = {};
          snapshot.docs.forEach((d) => {
            const b = d.data();
            if (b && b.status !== "cancelled" && Array.isArray(b.seats)) {
              b.seats.forEach((seatId) => {
                map[seatId] = b.status === "confirmed" ? "booked" : "pending";
              });
            }
          });

          if (Object.keys(map).length > 0) {
            setSeatMap((prev) => {
              const updated = { ...prev, ...map };
              try {
                localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
          }
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
      unsubFirestore();
    };
  }, []);

  return { seatMap, setSeatMap };
}
