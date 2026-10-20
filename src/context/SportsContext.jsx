import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} from 'react';
import { LEAGUES, fetchAllScoreboards } from '../services/espnApi';
import {
  subscribeToAuth,
  signInWithGoogleOnly,
  signOutUser,
  fetchUserProfile,
  syncUserPreferencesToCloud,
  registerWebPushToken,
  isBootstrapAdminUser
} from '../services/firebase';
import {
  getDefaultPrefsForLeague,
  detectPwaEnvironment,
  evaluateLiveTransitions,
  dispatchBrowserNotification
} from '../services/notificationEngine';

const LOCAL_STORAGE_KEY = 'sporty_preferences_v1';

const SportsContext = createContext(null);

function loadLocalPreferences() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[SportsContext]: Failed reading local preferences', err);
    return null;
  }
}

function saveLocalPreferences(prefs) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('[SportsContext]: Failed saving local preferences', err);
  }
}

export function formatDateToEspnCode(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function SportsProvider({ children }) {
  const initialLocal = useMemo(() => loadLocalPreferences() || {}, []);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [favoriteTeams, setFavoriteTeams] = useState(initialLocal.favoriteTeams || []);
  const [pinnedGames, setPinnedGames] = useState(initialLocal.pinnedGames || []);
  const [teamPrefs, setTeamPrefs] = useState(initialLocal.teamPrefs || {});
  const [gamePrefs, setGamePrefs] = useState(initialLocal.gamePrefs || {});
  const [pushEnabled, setPushEnabled] = useState(Boolean(initialLocal.pushEnabled));
  const [fcmTokens, setFcmTokens] = useState(initialLocal.fcmTokens || []);

  const allLeagueIds = useMemo(() => LEAGUES.map((l) => l.id), []);
  const [selectedLeagues, setSelectedLeagues] = useState(() => {
    if (Array.isArray(initialLocal.selectedLeagues) && initialLocal.selectedLeagues.length > 0) {
      /* Ensure newly added leagues like 'f1' are included if user previously had all leagues selected */
      const saved = initialLocal.selectedLeagues.filter((id) =>
        LEAGUES.some((l) => l.id === id)
      );
      if (saved.length > 0) return saved;
    }
    return LEAGUES.map((l) => l.id);
  });
  const [activeLeague, setActiveLeague] = useState('all');
  const [selectedDateOffset, setSelectedDateOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [syncStatus, setSyncStatus] = useState({
    state: 'local',
    message: 'Saved locally on this device. Sign in with Google to sync across devices and enable cloud alerts.'
  });
  const [pwaEnv, setPwaEnv] = useState(() => detectPwaEnvironment());
  const [toasts, setToasts] = useState([]);
  const [isPwaInstalled, setIsPwaInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true
    );
  });
  const [showInstallToast, setShowInstallToast] = useState(() => {
    if (typeof window === 'undefined') return false;
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator?.standalone === true;
    const dismissed = sessionStorage.getItem('sporty_install_dismissed_v1') === '1';
    return !standalone && !dismissed;
  });

  const deferredInstallPromptRef = useRef(null);
  const toastTimerRef = useRef(null);
  const prevGamesMapRef = useRef(new Map());
  const closeAlertsSentRef = useRef(new Set());

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      deferredInstallPromptRef.current = event;
    };
    const handleInstalled = () => {
      deferredInstallPromptRef.current = null;
      setIsPwaInstalled(true);
      setShowInstallToast(false);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismissInstallToast = useCallback(() => {
    setShowInstallToast(false);
    try {
      sessionStorage.setItem('sporty_install_dismissed_v1', '1');
    } catch (err) {
      console.warn('[SportsContext]: Could not persist install banner dismissal', err);
    }
  }, []);

  const triggerInstallPwa = useCallback(async () => {
    const promptEvent = deferredInstallPromptRef.current;
    if (promptEvent) {
      promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        deferredInstallPromptRef.current = null;
        setIsPwaInstalled(true);
        setShowInstallToast(false);
      }
      return 'prompted';
    }
    return 'manual';
  }, []);

  /* Single-slot toast replacement: never stacks multiple notifications */
  const pushToast = useCallback((toast) => {
    const id = toast.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToasts([{ ...toast, id }]);
    toastTimerRef.current = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismissToast = useCallback((id) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToasts((prev) => (id ? prev.filter((t) => t.id !== id) : []));
  }, []);

  /* Auth subscription & initial cloud profile merge */
  useEffect(() => {
    const unsub = subscribeToAuth(async (currentUser) => {
      setUser(currentUser);
      setIsAdmin(isBootstrapAdminUser(currentUser));
      setAuthLoading(false);

      if (currentUser) {
        const res = await fetchUserProfile(currentUser.uid);
        if (res.ok && res.data) {
          const cloud = res.data;
          if (Array.isArray(cloud.favoriteTeams)) setFavoriteTeams(cloud.favoriteTeams);
          if (Array.isArray(cloud.pinnedGames)) setPinnedGames(cloud.pinnedGames);
          if (Array.isArray(cloud.selectedLeagues) && cloud.selectedLeagues.length > 0) {
            const validCloudLeagues = cloud.selectedLeagues.filter((id) =>
              LEAGUES.some((l) => l.id === id)
            );
            if (validCloudLeagues.length > 0) setSelectedLeagues(validCloudLeagues);
          }
          if (cloud.teamPrefs) setTeamPrefs(cloud.teamPrefs);
          if (cloud.gamePrefs) setGamePrefs(cloud.gamePrefs);
          if (typeof cloud.pushEnabled === 'boolean') setPushEnabled(cloud.pushEnabled);
          if (Array.isArray(cloud.fcmTokens)) setFcmTokens(cloud.fcmTokens);
          setSyncStatus({
            state: 'synced',
            message: 'Synced to your Google account.'
          });
        } else if (!res.ok) {
          setSyncStatus({
            state: 'error',
            message: `Saved locally on this device, but remote cloud sync failed because ${res.error}`
          });
        }
      } else {
        setSyncStatus({
          state: 'local',
          message: 'Saved locally on this device. Sign in with Google to sync across devices.'
        });
      }
    });
    return () => unsub();
  }, []);

  /* Persist preferences locally & to Firestore when signed in */
  const persistPreferences = useCallback(
    async (nextState) => {
      const merged = {
        favoriteTeams: nextState.favoriteTeams ?? favoriteTeams,
        pinnedGames: nextState.pinnedGames ?? pinnedGames,
        selectedLeagues: nextState.selectedLeagues ?? selectedLeagues,
        teamPrefs: nextState.teamPrefs ?? teamPrefs,
        gamePrefs: nextState.gamePrefs ?? gamePrefs,
        pushEnabled: nextState.pushEnabled ?? pushEnabled,
        fcmTokens: nextState.fcmTokens ?? fcmTokens
      };

      saveLocalPreferences(merged);

      if (user) {
        const result = await syncUserPreferencesToCloud(user, merged);
        if (result.synced) {
          setSyncStatus({
            state: 'synced',
            message: 'Synced to your Google account.'
          });
        } else {
          setSyncStatus({
            state: 'error',
            message: `Saved locally on this device, but remote cloud sync failed because ${result.reason}`
          });
        }
      }
    },
    [favoriteTeams, pinnedGames, selectedLeagues, teamPrefs, gamePrefs, pushEnabled, fcmTokens, user]
  );

  const toggleLeagueSelection = useCallback(
    (leagueId) => {
      const exists = selectedLeagues.includes(leagueId);
      let nextLeagues;
      if (exists) {
        const remaining = selectedLeagues.filter((id) => id !== leagueId);
        nextLeagues = remaining.length > 0 ? remaining : allLeagueIds;
      } else {
        nextLeagues = [...selectedLeagues, leagueId];
      }
      setSelectedLeagues(nextLeagues);
      if (activeLeague === 'following') {
        setActiveLeague('all');
      }
      persistPreferences({ selectedLeagues: nextLeagues });
    },
    [selectedLeagues, allLeagueIds, activeLeague, persistPreferences]
  );

  const selectAllLeagues = useCallback(() => {
    setSelectedLeagues(allLeagueIds);
    setActiveLeague('all');
    persistPreferences({ selectedLeagues: allLeagueIds });
  }, [allLeagueIds, persistPreferences]);

  const favoriteTeamKeys = useMemo(
    () => favoriteTeams.map((t) => t.teamKey),
    [favoriteTeams]
  );

  /* Fetch scoreboards and evaluate live score transitions */
  const refreshNow = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      const dateCode = formatDateToEspnCode(selectedDateOffset);
      const fetched = await fetchAllScoreboards(
        LEAGUES.map((l) => l.id),
        dateCode
      );

      if (prevGamesMapRef.current.size > 0 && selectedDateOffset === 0) {
        const alerts = evaluateLiveTransitions({
          prevGamesMap: prevGamesMapRef.current,
          nextGames: fetched,
          favoriteTeamKeys,
          pinnedGameIds: pinnedGames,
          teamPrefs,
          gamePrefs,
          closeAlertsSentSet: closeAlertsSentRef.current
        });

        for (const alertItem of alerts) {
          pushToast({
            title: alertItem.title,
            body: alertItem.body,
            gameId: alertItem.gameId,
            type: alertItem.type
          });
          if (pushEnabled) {
            dispatchBrowserNotification(alertItem);
          }
        }
      }

      const nextMap = new Map();
      fetched.forEach((g) => nextMap.set(g.id, g));
      prevGamesMapRef.current = nextMap;

      setGames(fetched);
      setLastUpdated(new Date());
      setLoading(false);
    },
    [selectedDateOffset, favoriteTeamKeys, pinnedGames, teamPrefs, gamePrefs, pushEnabled, pushToast]
  );

  /* Adaptive Polling Engine: 15s when live games are active, 120s when pregame soon, 300s when idle */
  const pollingIntervalSec = useMemo(() => {
    if (selectedDateOffset !== 0) return 300;
    const hasLive = games.some((g) => g.state === 'in');
    if (hasLive) return 15;
    const now = Date.now();
    const startingSoon = games.some(
      (g) => g.state === 'pre' && g.startTimeMs - now <= 30 * 60 * 1000 && g.startTimeMs >= now
    );
    return startingSoon ? 60 : 180;
  }, [games, selectedDateOffset]);

  useEffect(() => {
    prevGamesMapRef.current.clear();
    refreshNow(false);
  }, [selectedDateOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshNow(true);
      }
    }, pollingIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [pollingIntervalSec, refreshNow]);

  /* Favorite Team & Pin Game handlers */
  const isTeamFavorited = useCallback(
    (teamKey) => favoriteTeamKeys.includes(teamKey),
    [favoriteTeamKeys]
  );

  const toggleFavoriteTeam = useCallback(
    (team) => {
      const exists = favoriteTeams.some((t) => t.teamKey === team.teamKey);
      const nextTeams = exists
        ? favoriteTeams.filter((t) => t.teamKey !== team.teamKey)
        : [
            ...favoriteTeams,
            {
              teamKey: team.teamKey,
              id: team.id,
              leagueId: team.leagueId,
              name: team.name,
              fullName: team.fullName,
              abbreviation: team.abbreviation,
              logo: team.logo
            }
          ];

      const nextTeamPrefs = { ...teamPrefs };
      if (!exists && !nextTeamPrefs[team.teamKey]) {
        nextTeamPrefs[team.teamKey] = getDefaultPrefsForLeague(team.leagueId);
      }

      setFavoriteTeams(nextTeams);
      setTeamPrefs(nextTeamPrefs);
      persistPreferences({ favoriteTeams: nextTeams, teamPrefs: nextTeamPrefs });
    },
    [favoriteTeams, teamPrefs, persistPreferences]
  );

  const isGamePinned = useCallback(
    (gameId) => pinnedGames.includes(gameId),
    [pinnedGames]
  );

  const togglePinGame = useCallback(
    (game, prefsOverride = null) => {
      const exists = pinnedGames.includes(game.id);
      const nextPinned = exists
        ? pinnedGames.filter((id) => id !== game.id)
        : [...pinnedGames, game.id];

      const nextGamePrefs = { ...gamePrefs };
      if (!exists && prefsOverride) {
        nextGamePrefs[game.id] = prefsOverride;
      } else if (!exists && !nextGamePrefs[game.id]) {
        nextGamePrefs[game.id] = getDefaultPrefsForLeague(game.leagueId);
      }

      setPinnedGames(nextPinned);
      setGamePrefs(nextGamePrefs);
      persistPreferences({ pinnedGames: nextPinned, gamePrefs: nextGamePrefs });
    },
    [pinnedGames, gamePrefs, persistPreferences]
  );

  const getNotificationPrefsForTarget = useCallback(
    (targetType, key, leagueId) => {
      if (targetType === 'game') {
        return gamePrefs[key] || getDefaultPrefsForLeague(leagueId);
      }
      return teamPrefs[key] || getDefaultPrefsForLeague(leagueId);
    },
    [gamePrefs, teamPrefs]
  );

  const updateNotificationPrefsForTarget = useCallback(
    (targetType, key, nextPrefs) => {
      if (targetType === 'game') {
        const updated = { ...gamePrefs, [key]: nextPrefs };
        setGamePrefs(updated);
        persistPreferences({ gamePrefs: updated });
      } else {
        const updated = { ...teamPrefs, [key]: nextPrefs };
        setTeamPrefs(updated);
        persistPreferences({ teamPrefs: updated });
      }
    },
    [gamePrefs, teamPrefs, persistPreferences]
  );

  /* Enable PWA Web Push Notifications */
  const enablePushNotifications = useCallback(async () => {
    const env = detectPwaEnvironment();
    setPwaEnv(env);

    if (env.needsIosHomeScreenInstall) {
      pushToast({
        title: 'Add to Home Screen First',
        body: 'On iPhone or iPad, tap Share then Add to Home Screen to unlock Web Push alerts.'
      });
      return false;
    }

    if (!('Notification' in window)) {
      pushToast({
        title: 'Notifications Unavailable',
        body: 'This browser does not support Web Push notifications.'
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    setPwaEnv(detectPwaEnvironment());

    if (permission !== 'granted') {
      setPushEnabled(false);
      persistPreferences({ pushEnabled: false });
      pushToast({
        title: 'Notifications Blocked',
        body: 'Allow notifications in your browser site settings to receive score alerts.'
      });
      return false;
    }

    const tokenRes = await registerWebPushToken();
    const nextTokens = tokenRes.token
      ? Array.from(new Set([...fcmTokens, tokenRes.token]))
      : fcmTokens;

    setPushEnabled(true);
    setFcmTokens(nextTokens);
    await persistPreferences({ pushEnabled: true, fcmTokens: nextTokens });

    pushToast({
      title: 'Push Alerts Enabled',
      body: tokenRes.reason || 'You will receive alerts for your favorite teams and pinned games.'
    });
    return true;
  }, [fcmTokens, persistPreferences, pushToast]);

  const disablePushNotifications = useCallback(async () => {
    setPushEnabled(false);
    await persistPreferences({ pushEnabled: false });
    pushToast({
      title: 'Push Alerts Paused',
      body: 'Score notifications are muted until you turn them back on.'
    });
  }, [persistPreferences, pushToast]);

  /* Instant Test & Live Score Simulator for verifying notifications anytime */
  const simulateLiveScoreUpdate = useCallback(
    (targetGame) => {
      const candidate =
        targetGame ||
        games.find((g) => pinnedGames.includes(g.id)) ||
        games.find(
          (g) =>
            favoriteTeamKeys.includes(g.homeTeam.teamKey) ||
            favoriteTeamKeys.includes(g.awayTeam.teamKey)
        ) ||
        games[0];

      if (!candidate) {
        pushToast({
          title: 'No Games Loaded',
          body: 'Switch to a day with scheduled games to test live score simulation.'
        });
        return;
      }

      const pointsAdded = candidate.leagueId === 'nfl' || candidate.leagueId === 'ncaaf' ? 7 : 2;
      const nextHomeScore = candidate.homeTeam.score + pointsAdded;
      const scoreLine = `${candidate.awayTeam.abbreviation} ${candidate.awayTeam.score} - ${candidate.homeTeam.abbreviation} ${nextHomeScore}`;

      setGames((prev) =>
        prev.map((g) =>
          g.id === candidate.id
            ? {
                ...g,
                state: 'in',
                shortDetail: '2:14 - 4th',
                homeTeam: { ...g.homeTeam, score: nextHomeScore },
                situation: {
                  ...g.situation,
                  primaryBadge: '2:14 - 4th',
                  contextLine: `Scoring play by ${g.homeTeam.name} (+${pointsAdded})`
                }
              }
            : g
        )
      );

      const alertPayload = {
        id: `sim-${candidate.id}-${Date.now()}`,
        gameId: candidate.id,
        leagueId: candidate.leagueId,
        type: 'everyScore',
        title: `Live Score Update: ${scoreLine}`,
        body: `${candidate.homeTeam.name} just scored (+${pointsAdded}) with 2:14 left in the 4th.`
      };

      pushToast(alertPayload);
      if (pushEnabled) {
        dispatchBrowserNotification(alertPayload);
      }
    },
    [games, pinnedGames, favoriteTeamKeys, pushEnabled, pushToast]
  );

  const signIn = useCallback(async () => {
    try {
      await signInWithGoogleOnly();
      pushToast({
        title: 'Signed In with Google',
        body: 'Your favorites and push settings are now linked to your Google account.'
      });
    } catch (err) {
      console.warn('[SportsContext]: Google Sign-In error', err);
      pushToast({
        title: 'Google Sign-In Cancelled',
        body: err?.message || 'Could not complete Google Sign-In.'
      });
    }
  }, [pushToast]);

  const signOut = useCallback(async () => {
    await signOutUser();
    pushToast({
      title: 'Signed Out',
      body: 'Using device-local preferences.'
    });
  }, [pushToast]);

  /* Computed lists: followed games pinned to top, sorted by Live -> Upcoming -> Final */
  const isGameFollowed = useCallback(
    (game) =>
      pinnedGames.includes(game.id) ||
      favoriteTeamKeys.includes(game.homeTeam.teamKey) ||
      favoriteTeamKeys.includes(game.awayTeam.teamKey),
    [pinnedGames, favoriteTeamKeys]
  );

  const sortedGames = useMemo(() => {
    const stateOrder = { in: 0, pre: 1, post: 2 };
    return [...games].sort((a, b) => {
      const aFollowed = isGameFollowed(a) ? 0 : 1;
      const bFollowed = isGameFollowed(b) ? 0 : 1;
      if (aFollowed !== bFollowed) return aFollowed - bFollowed;

      const aState = stateOrder[a.state] ?? 3;
      const bState = stateOrder[b.state] ?? 3;
      if (aState !== bState) return aState - bState;

      return a.startTimeMs - b.startTimeMs;
    });
  }, [games, isGameFollowed]);

  const followedGames = useMemo(
    () => sortedGames.filter((g) => isGameFollowed(g)),
    [sortedGames, isGameFollowed]
  );

  const filteredGames = useMemo(() => {
    return sortedGames.filter((g) => {
      if (activeLeague === 'following') {
        if (!isGameFollowed(g)) return false;
      } else if (!selectedLeagues.includes(g.leagueId)) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          g.homeTeam.fullName.toLowerCase().includes(q) ||
          g.awayTeam.fullName.toLowerCase().includes(q) ||
          g.homeTeam.abbreviation.toLowerCase().includes(q) ||
          g.awayTeam.abbreviation.toLowerCase().includes(q) ||
          g.leagueLabel.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [sortedGames, activeLeague, selectedLeagues, searchQuery, isGameFollowed]);

  const liveCount = useMemo(
    () => games.filter((g) => g.state === 'in').length,
    [games]
  );

  const value = {
    user,
    authLoading,
    isAdmin,
    signIn,
    signOut,
    syncStatus,
    leagues: LEAGUES,
    selectedLeagues,
    toggleLeagueSelection,
    selectAllLeagues,
    activeLeague,
    setActiveLeague,
    selectedDateOffset,
    setSelectedDateOffset,
    searchQuery,
    setSearchQuery,
    games: sortedGames,
    filteredGames,
    followedGames,
    liveCount,
    loading,
    lastUpdated,
    pollingIntervalSec,
    refreshNow,
    favoriteTeams,
    isTeamFavorited,
    toggleFavoriteTeam,
    pinnedGames,
    isGamePinned,
    togglePinGame,
    isGameFollowed,
    getNotificationPrefsForTarget,
    updateNotificationPrefsForTarget,
    pushEnabled,
    pwaEnv,
    isPwaInstalled,
    showInstallToast,
    dismissInstallToast,
    triggerInstallPwa,
    enablePushNotifications,
    disablePushNotifications,
    simulateLiveScoreUpdate,
    toasts,
    dismissToast
  };

  return <SportsContext.Provider value={value}>{children}</SportsContext.Provider>;
}

export function useSports() {
  const ctx = useContext(SportsContext);
  if (!ctx) {
    throw new Error('useSports must be used inside a SportsProvider');
  }
  return ctx;
}
