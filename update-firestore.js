import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDqOCrbBaQ_bFSkrL8lIOQdZlCN-HRABjo',
  authDomain: 'telugu-movie-time.firebaseapp.com',
  projectId: 'telugu-movie-time',
  storageBucket: 'telugu-movie-time.firebasestorage.app',
  messagingSenderId: '800548997459',
  appId: '1:800548997459:web:cfcf6822bcd51bf92439a6',
  measurementId: 'G-TWMSNHK0V3',
  databaseURL: 'https://telugu-movie-time-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BLUEPRINT_LAYOUT = {
  rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'],
  screenPosition: 'top',
  rowTiers: {
    A: 'Platinum',
    B: 'Gold',
    C: 'Gold',
    D: 'Gold',
    E: 'Gold',
    F: 'Gold',
    G: 'Gold',
    H: 'Gold',
    I: 'Gold',
    J: 'Gold',
    K: 'Gold',
    L: 'Gold',
    M: 'Gold',
    N: 'Gold',
    O: 'Gold',
  },
  tierPrices: {
    Platinum: 500,
    Gold: 320,
    Silver: 200,
  },
  seats: {
    A: [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, null, null],
    B: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    C: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    D: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    E: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    F: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    G: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    H: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    I: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, 17, 18, 19, 20],
    J: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    K: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    L: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    M: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    N: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
    O: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, null, null, null, null, null],
  },
};

async function sync() {
  try {
    const docRef = doc(db, 'movieConfig', 'current');
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    console.log('Current in Firestore:', existing?.layout?.rows);

    const screens = (existing.screens || []).map((scr) => ({
      ...scr,
      layout: BLUEPRINT_LAYOUT,
      tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
    }));

    const updatePayload = {
      ...existing,
      layout: BLUEPRINT_LAYOUT,
      tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
      screens: screens.length > 0 ? screens : [
        {
          id: 'screen-1',
          name: 'Screen 1 (Main Hall)',
          movieName: existing.movieName || 'PARADISE',
          theater: existing.theater || 'Crystal Mall (Screen 1)',
          date: existing.date || '2026-09-26',
          showTime: existing.showTime || '8:00 AM',
          pricePerSeat: existing.pricePerSeat || 200,
          posterUrl: existing.posterUrl || null,
          tierPrices: { Platinum: 500, Gold: 320, Silver: 200 },
          layout: BLUEPRINT_LAYOUT,
          isPublished: true,
        }
      ],
    };

    await setDoc(docRef, updatePayload, { merge: true });
    console.log('SUCCESS: Firestore movieConfig/current updated to new BLUEPRINT_LAYOUT!');
  } catch (err) {
    console.error('FAIL:', err);
  }
}

sync();
