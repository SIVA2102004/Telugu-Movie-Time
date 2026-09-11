import { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { DEFAULT_SCREENS, BLUEPRINT_LAYOUT } from "../hooks/useMovieConfig";

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
          } else {
            // Fallback default profile if doc not created yet
            const defaultProfile = {
              userId: user.uid,
              email: user.email,
              name: user.displayName || user.email?.split("@")[0] || "User",
              role: "THEATER_OWNER",
              theaterId: `th_${user.uid.slice(0, 8)}`,
            };
            setUserProfile(defaultProfile);
            sessionStorage.setItem("tmt_user_profile", JSON.stringify(defaultProfile));
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

  // 1. REGISTER NEW THEATER OWNER
  const registerTheaterOwner = async ({ name, email, password, theaterName, location }) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const uid = user.uid;

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

    // Create Initial Theater Document
    const initialScreens = DEFAULT_SCREENS.map((scr, idx) => ({
      ...scr,
      theater: `${theaterName} (${scr.name.split(" - ")[0] || `Screen ${idx + 1}`})`,
    }));

    const newTheater = {
      id: theaterId,
      ownerId: uid,
      name: theaterName,
      location: location || "Hyderabad",
      upiId: `${theaterName.toLowerCase().replace(/[^a-z0-9]/g, "")}@upi`,
      payeeName: theaterName,
      adminPhone: "919876543210",
      screens: initialScreens,
      activeScreenId: "screen-1",
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "theaters", theaterId), {
      ...newTheater,
      createdAt: serverTimestamp(),
    });

    // Create halls subcollections for fast querying
    for (const scr of initialScreens) {
      await setDoc(doc(db, "theaters", theaterId, "halls", scr.id), {
        ...scr,
        theaterId,
        ownerId: uid,
      });
    }

    setUserProfile(newProfile);
    sessionStorage.setItem("tmt_user_profile", JSON.stringify(newProfile));
    sessionStorage.setItem("adminAuth", "true");
    sessionStorage.setItem("adminRole", "owner");
    sessionStorage.setItem("adminName", name);
    sessionStorage.setItem("adminTheaterId", theaterId);

    return { user, profile: newProfile, theater: newTheater };
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
      profile = {
        userId: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split("@")[0] || "Theater Owner",
        role: "THEATER_OWNER",
        theaterId: `th_${user.uid.slice(0, 8)}`,
      };
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
