import { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { DEFAULT_SCREENS, BLUEPRINT_LAYOUT, buildFreshTheaterConfig } from "../hooks/useMovieConfig";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = sessionStorage.getItem("tmt_user_profile");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const profile = { userId: user.uid, ...userDoc.data() };
            setUserProfile(profile);
            sessionStorage.setItem("tmt_user_profile", JSON.stringify(profile));
            if (profile.theaterId) {
              sessionStorage.setItem("adminTheaterId", profile.theaterId);
            }
          } else {
            // Fresh clean slate initialization for wiped/existing accounts
            const freshTheaterId = `th_${user.uid.slice(0, 8)}_${Date.now().toString(36).slice(-4)}`;
            const freshName = user.displayName || user.email?.split("@")[0] || "Theater Owner";

            const defaultProfile = {
              userId: user.uid,
              email: user.email,
              name: freshName,
              role: "THEATER_OWNER",
              theaterId: freshTheaterId,
              createdAt: new Date().toISOString(),
            };

            const freshConfig = buildFreshTheaterConfig(freshTheaterId, freshName, "Hyderabad", user.uid);

            await setDoc(doc(db, "users", user.uid), defaultProfile, { merge: true });
            await setDoc(doc(db, "theaters", freshTheaterId), { ...freshConfig, name: freshName }, { merge: true });
            await setDoc(doc(db, "movieConfig", freshTheaterId), freshConfig, { merge: true });

            try {
              localStorage.setItem(`telugu_talkies_movie_config_${freshTheaterId}`, JSON.stringify(freshConfig));
              localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(freshConfig));
            } catch (e) {}

            setUserProfile(defaultProfile);
            sessionStorage.setItem("tmt_user_profile", JSON.stringify(defaultProfile));
            sessionStorage.setItem("adminAuth", "true");
            sessionStorage.setItem("adminRole", "owner");
            sessionStorage.setItem("adminName", freshName);
            sessionStorage.setItem("adminTheaterId", freshTheaterId);
          }
        } catch (err) {
          console.warn("User profile fetch notice:", err);
        }
      } else {
        // If not logged into Firebase Auth, check if legacy session exists
        const legacyAuth = sessionStorage.getItem("adminAuth") === "true";
        const legacyRole = sessionStorage.getItem("adminRole");
        const legacyName = sessionStorage.getItem("adminName");
        const legacyTheaterId = sessionStorage.getItem("adminTheaterId") || "default-theater";

        if (legacyAuth) {
          const profile = {
            userId: legacyRole === "master" ? "master_admin_id" : "co_admin_id",
            name: legacyName || "Admin User",
            email: legacyRole === "master" ? "admin@telugumovietime.com" : "coadmin@telugumovietime.com",
            role: legacyRole === "master" ? "SUPER_ADMIN" : "CO_ADMIN",
            theaterId: legacyTheaterId,
          };
          setUserProfile(profile);
        } else {
          setUserProfile(null);
          sessionStorage.removeItem("tmt_user_profile");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1. REGISTER NEW THEATER OWNER (Handles new & existing Firebase Auth emails)
  const registerTheaterOwner = async ({ name, email, password, theaterName, location }) => {
    let user = null;
    let uid = null;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      user = userCredential.user;
      uid = user.uid;
    } catch (authErr) {
      if (authErr.code === "auth/email-already-in-use") {
        // Sign in with existing credentials and re-initialize fresh theater
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
        uid = user.uid;
      } else {
        throw authErr;
      }
    }

    const theaterId = `th_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newProfile = {
      userId: uid,
      name,
      email,
      role: "THEATER_OWNER",
      theaterId,
      createdAt: new Date().toISOString(),
    };

    // Save User Profile to Firestore
    await setDoc(doc(db, "users", uid), {
      ...newProfile,
      createdAt: serverTimestamp(),
    });

    // Create Initial Fresh Theater Config (100% isolated & clean)
    const freshConfig = buildFreshTheaterConfig(theaterId, theaterName, location || "Hyderabad", uid);

    await setDoc(doc(db, "theaters", theaterId), {
      ...freshConfig,
      name: theaterName,
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "movieConfig", theaterId), {
      ...freshConfig,
      createdAt: serverTimestamp(),
    });

    // Create halls subcollections for fast querying
    for (const scr of freshConfig.screens) {
      await setDoc(doc(db, "theaters", theaterId, "halls", scr.id), {
        ...scr,
        theaterId,
        ownerId: uid,
      });
    }

    try {
      localStorage.setItem(`telugu_talkies_movie_config_${theaterId}`, JSON.stringify(freshConfig));
      localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(freshConfig));
    } catch (e) {}

    setUserProfile(newProfile);
    sessionStorage.setItem("tmt_user_profile", JSON.stringify(newProfile));
    sessionStorage.setItem("adminAuth", "true");
    sessionStorage.setItem("adminRole", "owner");
    sessionStorage.setItem("adminName", name);
    sessionStorage.setItem("adminTheaterId", theaterId);

    return { user, profile: newProfile };
  };

  // 2. LOGIN USER (FIREBASE AUTH)
  const loginUser = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    let profile = null;
    if (userDoc.exists()) {
      profile = { userId: user.uid, ...userDoc.data() };
    } else {
      const freshTheaterId = `th_${user.uid.slice(0, 8)}_${Date.now().toString(36).slice(-4)}`;
      const freshName = user.displayName || user.email?.split("@")[0] || "Theater Owner";

      profile = {
        userId: user.uid,
        email: user.email,
        name: freshName,
        role: "THEATER_OWNER",
        theaterId: freshTheaterId,
        createdAt: new Date().toISOString(),
      };

      const freshConfig = buildFreshTheaterConfig(freshTheaterId, freshName, "Hyderabad", user.uid);

      await setDoc(doc(db, "users", user.uid), profile, { merge: true });
      await setDoc(doc(db, "theaters", freshTheaterId), { ...freshConfig, name: freshName }, { merge: true });
      await setDoc(doc(db, "movieConfig", freshTheaterId), freshConfig, { merge: true });

      try {
        localStorage.setItem(`telugu_talkies_movie_config_${freshTheaterId}`, JSON.stringify(freshConfig));
        localStorage.setItem("telugu_talkies_movie_config", JSON.stringify(freshConfig));
      } catch (e) {}
    }

    setUserProfile(profile);
    sessionStorage.setItem("tmt_user_profile", JSON.stringify(profile));
    sessionStorage.setItem("adminAuth", "true");
    sessionStorage.setItem("adminRole", profile.role === "SUPER_ADMIN" ? "master" : "owner");
    sessionStorage.setItem("adminName", profile.name);
    if (profile.theaterId) {
      sessionStorage.setItem("adminTheaterId", profile.theaterId);
    }

    return { user, profile };
  };

  // 3. LOGOUT USER
  const logoutUser = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    sessionStorage.removeItem("tmt_user_profile");
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("adminRole");
    sessionStorage.removeItem("adminName");
    sessionStorage.removeItem("adminTheaterId");
    setUserProfile(null);
    setCurrentUser(null);
  };

  const value = {
    currentUser,
    userProfile,
    role: userProfile?.role || "CUSTOMER",
    ownerId: userProfile?.userId || null,
    theaterId: userProfile?.theaterId || "default-theater",
    loading,
    registerTheaterOwner,
    loginUser,
    logoutUser,
    setUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
