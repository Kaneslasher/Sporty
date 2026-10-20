/**
 * Smart Sport-Aware Notification Engine
 * Evaluates live score transitions and fires local Service Worker notifications
 * as well as in-app toast alerts without overwhelming users.
 */

const CLOSE_MARGIN_BY_LEAGUE = {
  nfl: 8,
  ncaaf: 8,
  nba: 6,
  mlb: 2,
  nhl: 1,
  soccer: 1
};

const REGULATION_PERIODS_BY_LEAGUE = {
  nfl: 4,
  ncaaf: 4,
  nba: 4,
  mlb: 9,
  nhl: 3,
  soccer: 2
};

export const NOTIFICATION_RULE_OPTIONS = [
  {
    key: 'gameStart',
    label: 'Game Start',
    description: 'Alert when kickoff, tip-off, or first pitch begins.'
  },
  {
    key: 'everyScore',
    label: 'Every Score',
    description: 'Alert on every touchdown, goal, or run scored.'
  },
  {
    key: 'leadChange',
    label: 'Lead Changes Only',
    description: 'Low-noise option that alerts only when a new team takes the lead.'
  },
  {
    key: 'closeGame',
    label: 'Close Game Alert',
    description: 'Triggers when a game is within 1 score in the final 2 minutes or final inning.'
  },
  {
    key: 'periodEnd',
    label: 'Quarter & Period Summaries',
    description: 'End-of-quarter score check-ins (recommended for Basketball).'
  },
  {
    key: 'finalScore',
    label: 'Final Score',
    description: 'Summary alert as soon as the game ends.'
  }
];

export function getDefaultPrefsForLeague(leagueId) {
  if (leagueId === 'nba') {
    return {
      gameStart: true,
      everyScore: false,
      leadChange: true,
      closeGame: true,
      periodEnd: true,
      finalScore: true
    };
  }
  return {
    gameStart: true,
    everyScore: true,
    leadChange: true,
    closeGame: true,
    periodEnd: false,
    finalScore: true
  };
}

export function detectPwaEnvironment() {
  if (typeof window === 'undefined') {
    return { isIos: false, isStandalone: false, supportsNotifications: false };
  }
  const ua = window.navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true;
  const supportsNotifications = 'Notification' in window && 'serviceWorker' in navigator;

  return {
    isIos,
    isStandalone,
    needsIosHomeScreenInstall: isIos && !isStandalone,
    supportsNotifications,
    permission: 'Notification' in window ? Notification.permission : 'denied'
  };
}

function getLeader(game) {
  if (game.homeTeam.score > game.awayTeam.score) return 'home';
  if (game.awayTeam.score > game.homeTeam.score) return 'away';
  return 'tie';
}

function isCloseLateGame(game) {
  if (game.state !== 'in') return false;
  const maxPeriod = REGULATION_PERIODS_BY_LEAGUE[game.leagueId] || 4;
  if (game.period < maxPeriod) return false;
  const diff = Math.abs(game.homeTeam.score - game.awayTeam.score);
  const threshold = CLOSE_MARGIN_BY_LEAGUE[game.leagueId] || 3;
  if (diff > threshold) return false;
  if (game.leagueId === 'mlb') return game.period >= 8;
  return game.clockSeconds > 0 && game.clockSeconds <= 150;
}

/**
 * Compare previous game map against latest games and return triggered alerts
 * for followed teams or pinned games.
 */
export function evaluateLiveTransitions({
  prevGamesMap,
  nextGames,
  favoriteTeamKeys,
  pinnedGameIds,
  teamPrefs,
  gamePrefs,
  closeAlertsSentSet
}) {
  const triggeredAlerts = [];

  for (const game of nextGames) {
    const homeKey = game.homeTeam.teamKey;
    const awayKey = game.awayTeam.teamKey;
    const isPinned = pinnedGameIds.includes(game.id);
    const followsHome = favoriteTeamKeys.includes(homeKey);
    const followsAway = favoriteTeamKeys.includes(awayKey);

    if (!isPinned && !followsHome && !followsAway) {
      continue;
    }

    const prev = prevGamesMap.get(game.id);
    if (!prev) continue;

    const activePrefs =
      gamePrefs[game.id] ||
      (followsHome && teamPrefs[homeKey]) ||
      (followsAway && teamPrefs[awayKey]) ||
      getDefaultPrefsForLeague(game.leagueId);

    const scoreLine = `${game.awayTeam.abbreviation} ${game.awayTeam.score} - ${game.homeTeam.abbreviation} ${game.homeTeam.score}`;

    if (prev.state === 'pre' && game.state === 'in' && activePrefs.gameStart) {
      triggeredAlerts.push({
        id: `${game.id}-start-${Date.now()}`,
        gameId: game.id,
        leagueId: game.leagueId,
        type: 'gameStart',
        title: `Game Started: ${game.awayTeam.abbreviation} at ${game.homeTeam.abbreviation}`,
        body: `${game.awayTeam.name} vs ${game.homeTeam.name} is now live.`
      });
    }

    if (
      game.state === 'in' &&
      (game.homeTeam.score !== prev.homeTeam.score || game.awayTeam.score !== prev.awayTeam.score)
    ) {
      const prevLeader = getLeader(prev);
      const nextLeader = getLeader(game);
      const isLeadChange = prevLeader !== nextLeader && nextLeader !== 'tie';

      if (isLeadChange && (activePrefs.leadChange || activePrefs.everyScore)) {
        triggeredAlerts.push({
          id: `${game.id}-lead-${game.homeTeam.score}-${game.awayTeam.score}`,
          gameId: game.id,
          leagueId: game.leagueId,
          type: 'leadChange',
          title: `Lead Change: ${scoreLine}`,
          body: game.situation?.contextLine || game.shortDetail
        });
      } else if (activePrefs.everyScore) {
        triggeredAlerts.push({
          id: `${game.id}-score-${game.homeTeam.score}-${game.awayTeam.score}`,
          gameId: game.id,
          leagueId: game.leagueId,
          type: 'everyScore',
          title: `Score Update: ${scoreLine}`,
          body: game.situation?.contextLine || game.shortDetail
        });
      }
    }

    if (
      game.state === 'in' &&
      game.period > prev.period &&
      prev.period > 0 &&
      activePrefs.periodEnd
    ) {
      triggeredAlerts.push({
        id: `${game.id}-period-${game.period}`,
        gameId: game.id,
        leagueId: game.leagueId,
        type: 'periodEnd',
        title: `End of Period ${prev.period}: ${scoreLine}`,
        body: `${game.awayTeam.name} at ${game.homeTeam.name}`
      });
    }

    if (
      activePrefs.closeGame &&
      !closeAlertsSentSet.has(game.id) &&
      isCloseLateGame(game)
    ) {
      closeAlertsSentSet.add(game.id);
      triggeredAlerts.push({
        id: `${game.id}-close`,
        gameId: game.id,
        leagueId: game.leagueId,
        type: 'closeGame',
        title: `Close Game Alert: ${scoreLine}`,
        body: `Down to the wire (${game.shortDetail}).`
      });
    }

    if (prev.state !== 'post' && game.state === 'post' && activePrefs.finalScore) {
      triggeredAlerts.push({
        id: `${game.id}-final`,
        gameId: game.id,
        leagueId: game.leagueId,
        type: 'finalScore',
        title: `Final: ${scoreLine}`,
        body: `${game.awayTeam.name} at ${game.homeTeam.name} has finished.`
      });
    }
  }

  return triggeredAlerts;
}

/**
 * Trigger a browser / Service Worker push notification when permission is granted.
 */
export async function dispatchBrowserNotification(alertItem) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification(alertItem.title, {
          body: alertItem.body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag: alertItem.id,
          renotify: true,
          data: { gameId: alertItem.gameId, leagueId: alertItem.leagueId, url: `/?game=${alertItem.gameId}` }
        });
        return true;
      }
    }
    new Notification(alertItem.title, {
      body: alertItem.body,
      icon: '/icon.svg',
      tag: alertItem.id
    });
    return true;
  } catch (err) {
    console.warn('[NotificationEngine]: Failed showing browser notification', err);
    return false;
  }
}
