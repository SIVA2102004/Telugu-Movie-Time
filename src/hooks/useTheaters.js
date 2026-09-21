import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { DEFAULT_SCREENS, BLUEPRINT_LAYOUT, CURVED_AMPHITHEATER_LAYOUT } from "./useMovieConfig";

/**
 * Universal hook for multi-tenant Theater & Cinema Hall management.
 */
export function useTheaters(ownerId = null, activeTheaterId = null) {
  const [theaters, setTheaters] = useState([]);
  const [currentTheater, setCurrentTheater] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Subscribe to all theaters or owner's specific theater
  useEffect(() => {
    let unsub = () => {};
    try {
      const colRef = collection(db, "theaters");
      unsub = onSnapshot(
        colRef,
        (snap) => {
          const rawList = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          // Deduplicate by theater ID and ownerId
          const uniqueMap = new Map();
          rawList.forEach((t) => {
            const key = t.id || t.ownerId;
            if (!uniqueMap.has(key)) {
              uniqueMap.set(key, t);
            }
          });

          const list = Array.from(uniqueMap.values());
          setTheaters(list);

          // Find current active theater for owner or selected ID
          if (activeTheaterId) {
            const found = list.find((t) => t.id === activeTheaterId);
            if (found) setCurrentTheater(found);
          } else if (ownerId) {
            const found = list.find((t) => t.ownerId === ownerId);
            if (found) setCurrentTheater(found);
          } else if (list.length > 0) {
            setCurrentTheater(list[0]);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("Theaters subscription notice:", err);
          setLoading(false);
        }
      );
    } catch (e) {
      setLoading(false);
    }

    return () => unsub();
  }, [ownerId, activeTheaterId]);

  // 2. Create a new Theater for an owner
  const createTheater = useCallback(
    async ({ name, location, upiId, payeeName, adminPhone, ownerId }) => {
      const id = `th_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const initialScreens = [
        {
          id: "screen-1",
          name: "Screen 1 (Main Hall)",
          movieName: "PARADISE",
          theater: `${name} (Screen 1)`,
          date: "2026-09-26",
          showTime: "8:00 AM",
          pricePerSeat: 200,
          posterUrl: null,
          tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
          layout: BLUEPRINT_LAYOUT,
          isPublished: true,
        },
        {
          id: "screen-2",
          name: "Screen 2 (Audi 2)",
          movieName: "TELUGU SPECIAL SHOW",
          theater: `${name} (Screen 2)`,
          date: "2026-09-26",
          showTime: "11:30 AM",
          pricePerSeat: 200,
          posterUrl: null,
          tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
          layout: BLUEPRINT_LAYOUT,
          isPublished: false,
        },
      ];

      const newTheater = {
        id,
        ownerId,
        name,
        location: location || "Hyderabad",
        upiId: upiId || `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@upi`,
        payeeName: payeeName || name,
        adminPhone: adminPhone || "919876543210",
        screens: initialScreens,
        activeScreenId: "screen-1",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "theaters", id), newTheater);
      return newTheater;
    },
    []
  );

  // 3. Add a new Cinema Hall to current theater
  const addHall = useCallback(
    async (theaterId, { hallName, movieName, showTime, date, pricePerSeat, layoutType }) => {
      const activeId = theaterId || currentTheater?.id || "default-theater";
      let targetTheater = theaters.find((t) => t.id === activeId) || currentTheater;

      if (!targetTheater) {
        targetTheater = {
          id: activeId,
          name: "My Cinema Hall",
          screens: DEFAULT_SCREENS,
        };
      }

      const existingScreens = targetTheater.screens || DEFAULT_SCREENS;
      const nextIndex = existingScreens.length + 1;
      const newHallId = `screen-${Date.now()}`;

      const chosenLayout =
        layoutType === "amphitheater"
          ? CURVED_AMPHITHEATER_LAYOUT
          : BLUEPRINT_LAYOUT;

      const newHall = {
        id: newHallId,
        name: hallName || `Screen ${nextIndex}`,
        movieName: movieName || "NEW SHOW",
        theater: `${targetTheater.name || "Cinema"} (${hallName || `Screen ${nextIndex}`})`,
        date: date || new Date().toISOString().split("T")[0],
        showTime: showTime || "6:00 PM",
        pricePerSeat: Number(pricePerSeat) || 200,
        posterUrl: null,
        tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
        layout: chosenLayout,
        isPublished: true,
      };

      const updatedScreens = [...existingScreens.filter((s) => s.id !== newHallId), newHall];

      const updatedTheater = {
        ...targetTheater,
        screens: updatedScreens,
      };

      // Update Firestore theaters document
      try {
        await setDoc(doc(db, "theaters", activeId), updatedTheater, { merge: true });
      } catch (e) {
        console.warn("Firestore theater update notice:", e);
      }

      // Synchronize with movieConfig so multi-screen manager & booking pages update instantly
      try {
        const storageKey = activeId ? `telugu_talkies_movie_config_${activeId}` : "telugu_talkies_movie_config";
        const savedConfigStr = localStorage.getItem(storageKey) || localStorage.getItem("telugu_talkies_movie_config");
        let currentConfig = savedConfigStr ? JSON.parse(savedConfigStr) : {};
        const configScreens = currentConfig.screens || DEFAULT_SCREENS;
        const nextConfigScreens = [...configScreens.filter((s) => s.id !== newHallId), newHall];
        const nextConfig = {
          ...currentConfig,
          id: activeId,
          theaterId: activeId,
          screens: nextConfigScreens,
          activeScreenId: newHallId,
        };

        localStorage.setItem(storageKey, JSON.stringify(nextConfig));
        localStorage.setItem(`telugu_talkies_movie_config_${activeId}`, JSON.stringify(nextConfig));
        localStorage.setItem("telugu_talkies_movie_config_default-theater", JSON.stringify(nextConfig));
        localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(nextConfig));
        window.dispatchEvent(new Event("storage"));

        await setDoc(doc(db, "movieConfig", activeId), nextConfig, { merge: true });
        await setDoc(doc(db, "movieConfig", "default-theater"), nextConfig, { merge: true });
        await setDoc(doc(db, "movieConfig", "current"), nextConfig, { merge: true });
      } catch (err) {
        console.warn("Movie config sync notice:", err);
      }

      return newHall;
    },
    [theaters, currentTheater]
  );

  // 4. Update an existing Cinema Hall inside a theater
  const updateHall = useCallback(
    async (theaterId, hallId, updatedData) => {
      const activeId = theaterId || currentTheater?.id || "default-theater";
      let targetTheater = theaters.find((t) => t.id === activeId) || currentTheater;

      const existingScreens = targetTheater?.screens || DEFAULT_SCREENS;
      const updatedScreens = existingScreens.map((scr) => {
        if (scr.id === hallId) {
          return { ...scr, ...updatedData };
        }
        return scr;
      });

      const updatedTheater = {
        ...targetTheater,
        screens: updatedScreens,
      };

      try {
        await setDoc(doc(db, "theaters", activeId), updatedTheater, { merge: true });
      } catch (e) {}

      try {
        const storageKey = activeId ? `telugu_talkies_movie_config_${activeId}` : "telugu_talkies_movie_config";
        const savedConfigStr = localStorage.getItem(storageKey) || localStorage.getItem("telugu_talkies_movie_config");
        let currentConfig = savedConfigStr ? JSON.parse(savedConfigStr) : {};
        const configScreens = (currentConfig.screens || DEFAULT_SCREENS).map((scr) => {
          if (scr.id === hallId) {
            return { ...scr, ...updatedData };
          }
          return scr;
        });

        const nextConfig = {
          ...currentConfig,
          id: activeId,
          theaterId: activeId,
          screens: configScreens,
        };

        localStorage.setItem(storageKey, JSON.stringify(nextConfig));
        localStorage.setItem(`telugu_talkies_movie_config_${activeId}`, JSON.stringify(nextConfig));
        localStorage.setItem("telugu_talkies_movie_config_default-theater", JSON.stringify(nextConfig));
        localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(nextConfig));
        window.dispatchEvent(new Event("storage"));

        await setDoc(doc(db, "movieConfig", activeId), nextConfig, { merge: true });
        await setDoc(doc(db, "movieConfig", "default-theater"), nextConfig, { merge: true });
        await setDoc(doc(db, "movieConfig", "current"), nextConfig, { merge: true });
      } catch (err) {}
    },
    [theaters, currentTheater]
  );

  // 5. Delete a Cinema Hall
  const deleteHall = useCallback(
    async (theaterId, hallId) => {
      const activeId = theaterId || currentTheater?.id || "default-theater";
      let targetTheater = theaters.find((t) => t.id === activeId) || currentTheater;

      const existingScreens = targetTheater?.screens || DEFAULT_SCREENS;
      if (existingScreens.length <= 1) {
        throw new Error("A theater must have at least one cinema hall.");
      }

      const updatedScreens = existingScreens.filter((s) => s.id !== hallId);
      const nextActiveId = updatedScreens[0]?.id || "screen-1";

      const updatedTheater = {
        ...targetTheater,
        screens: updatedScreens,
        activeScreenId: nextActiveId,
      };

      try {
        await setDoc(doc(db, "theaters", activeId), updatedTheater, { merge: true });
      } catch (e) {}

      try {
        const storageKey = activeId ? `telugu_talkies_movie_config_${activeId}` : "telugu_talkies_movie_config";
        const savedConfigStr = localStorage.getItem(storageKey) || localStorage.getItem("telugu_talkies_movie_config");
        let currentConfig = savedConfigStr ? JSON.parse(savedConfigStr) : {};
        const configScreens = (currentConfig.screens || DEFAULT_SCREENS).filter((s) => s.id !== hallId);

        const nextConfig = {
          ...currentConfig,
          id: activeId,
          theaterId: activeId,
          screens: configScreens,
          activeScreenId: nextActiveId,
        };

        localStorage.setItem(storageKey, JSON.stringify(nextConfig));
        localStorage.setItem(`telugu_talkies_movie_config_${activeId}`, JSON.stringify(nextConfig));
        localStorage.setItem("telugu_talkies_movie_config_default-theater", JSON.stringify(nextConfig));
        localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(nextConfig));
        window.dispatchEvent(new Event("storage"));

        await setDoc(doc(db, "movieConfig", activeId), nextConfig, { merge: true });
        await setDoc(doc(db, "movieConfig", "default-theater"), nextConfig, { merge: true });
        await setDoc(doc(db, "movieConfig", "current"), nextConfig, { merge: true });
      } catch (err) {}
    },
    [theaters, currentTheater]
  );

  return {
    theaters,
    currentTheater,
    loading,
    createTheater,
    addHall,
    updateHall,
    deleteHall,
  };
}
