import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const BOOTSTRAP_ADMIN_EMAIL = 'krbean0@gmail.com';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sporty-6b3e9.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sporty-6b3e9',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sporty-6b3e9.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '863839455587',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:863839455587:web:903ef428f7a87a3c9feb56'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function isBootstrapAdminUser(user) {
  return Boolean(
    user &&
    user.emailVerified &&
    user.email &&
    user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL
  );
}

/**
 * Google Sign-In only (strictly enforced per user configuration).
 */
export async function signInWithGoogleOnly() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser() {
  await firebaseSignOut(auth);
}

export function subscribeToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Load user profile from `users/{uid}`.
 */
export async function fetchUserProfile(uid) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { ok: true, data: snap.data() };
    }
    return { ok: true, data: null };
  } catch (err) {
    console.warn('[FirebaseService]: Failed reading user profile from Firestore', err);
    return {
      ok: false,
      error: err?.message || 'Unable to read cloud profile.'
    };
  }
}

/**
 * Save user favorites, pinned games, and notification preferences to `users/{uid}`
 * and mirror compact push state into `system/pushRegistry` (Single-Document pattern).
 * Explicitly reports local vs. remote cloud sync status.
 */
export async function syncUserPreferencesToCloud(user, preferences) {
  if (!user || !user.uid) {
    return {
      synced: false,
      reason: 'Not signed in with Google. Changes are saved locally on this device only.'
    };
  }

  const nowMs = Date.now();
  const userRef = doc(db, 'users', user.uid);

  const profilePayload = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || 'Sports Fan',
    photoURL: user.photoURL || '',
    favoriteTeams: Array.isArray(preferences.favoriteTeams) ? preferences.favoriteTeams : [],
    pinnedGames: Array.isArray(preferences.pinnedGames) ? preferences.pinnedGames : [],
    selectedLeagues: Array.isArray(preferences.selectedLeagues) ? preferences.selectedLeagues : [],
    teamPrefs: preferences.teamPrefs || {},
    gamePrefs: preferences.gamePrefs || {},
    defaultPrefs: preferences.defaultPrefs || {},
    pushEnabled: Boolean(preferences.pushEnabled),
    fcmTokens: Array.isArray(preferences.fcmTokens) ? preferences.fcmTokens : [],
    updatedAt: nowMs
  };

  try {
    await setDoc(userRef, profilePayload, { merge: true });

    /* Write only this user's key with a merge so the client never reads other users' push tokens. */
    const registryRef = doc(db, 'system', 'pushRegistry');

    const activeLeagues = new Set(['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'soccer', 'f1']);
    const subscriberEntry = {
      enabled: Boolean(preferences.pushEnabled),
      tokens: Array.isArray(preferences.fcmTokens) ? preferences.fcmTokens : [],
      teamIds: profilePayload.favoriteTeams.map((t) =>
        typeof t === 'string' ? t : `${t.leagueId}:${t.id}`
      ),
      gameIds: profilePayload.pinnedGames.map((g) => (typeof g === 'string' ? g : g.id)),
      leagues: Array.from(activeLeagues),
      teamPrefs: profilePayload.teamPrefs,
      gamePrefs: profilePayload.gamePrefs,
      defaultPrefs: profilePayload.defaultPrefs,
      updatedAt: nowMs
    };

    await setDoc(
      registryRef,
      {
        subscribers: {
          [user.uid]: subscriberEntry
        },
        updatedAt: nowMs
      },
      { merge: true }
    );

    return { synced: true, reason: null };
  } catch (err) {
    console.warn('[FirebaseService]: Cloud sync failed', err);
    return {
      synced: false,
      reason: err?.message || 'Firestore write permission or network error.'
    };
  }
}

/**
 * Register browser Web Push / FCM token using the service worker.
 */
export async function registerWebPushToken() {
  try {
    const supported = await isSupported();
    if (!supported) {
      return {
        token: null,
        mode: 'local-sw',
        reason: 'Firebase Cloud Messaging is not supported in this browser context; using Service Worker local notifications while open.'
      };
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

    if (!vapidKey) {
      return {
        token: null,
        registration,
        mode: 'local-sw',
        reason: 'Service Worker active for live alerts. Add VITE_FIREBASE_VAPID_KEY in Firebase Console > Cloud Messaging to enable locked-screen FCM wakeups.'
      };
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    return {
      token,
      registration,
      mode: 'fcm-cloud',
      reason: null
    };
  } catch (err) {
    console.warn('[FirebaseService]: Web push token registration warning', err);
    return {
      token: null,
      mode: 'local-sw',
      reason: err?.message || 'Push token registration fell back to local Service Worker notifications.'
    };
  }
}
