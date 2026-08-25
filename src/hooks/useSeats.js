import { useState, useEffect, useRef } from "react";
import { rtdb } from "../firebase";
import { ref, onValue } from "firebase/database";

/**
 * High-performance hook for real-time seat tracking.
 * Reacts to localStorage updates, Storage events, and Firebase RTDB.
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
    let unsubscribe = () => {};
    try {
      const seatsRef = ref(rtdb, "seats");
      unsubscribe = onValue(
        seatsRef,
        (snapshot) => {
          const data = snapshot.val() || {};
          if (throttleRef.current) clearTimeout(throttleRef.current);
          throttleRef.current = setTimeout(() => {
            setSeatMap(data);
            try {
              localStorage.setItem("telugu_talkies_seats_cache", JSON.stringify(data));
            } catch (e) {}
          }, 30);
        },
        (error) => {
          console.warn("RTDB seats listener notice:", error);
        }
      );
    } catch (err) {
      console.warn("RTDB offline mode:", err);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      if (throttleRef.current) clearTimeout(throttleRef.current);
      unsubscribe();
    };
  }, []);

  return { seatMap, setSeatMap };
}
