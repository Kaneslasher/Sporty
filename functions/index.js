const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const LEAGUE_ENDPOINTS = {
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  soccer: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard'
};

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

function parseSimpleGame(event, leagueId) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
  const away = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};
  const statusObj = event.status || competition.status || {};
  const state = statusObj.type?.state || 'pre';
  const period = Number(statusObj.period || 0);
  const displayClock = statusObj.displayClock || '';
  const clockSeconds = Number(statusObj.clock || 0);
  const shortDetail = statusObj.type?.shortDetail || '';

  return {
    id: String(event.id),
    leagueId,
    startTimeMs: new Date(event.date).getTime(),
    state,
    period,
    displayClock,
    clockSeconds,
    shortDetail,
    homeId: String(home.team?.id || ''),
    homeName: home.team?.shortDisplayName || home.team?.displayName || 'Home',
    homeAbbr: home.team?.abbreviation || 'Home',
    homeScore: Number(home.score || 0),
    awayId: String(away.team?.id || ''),
    awayName: away.team?.shortDisplayName || away.team?.displayName || 'Away',
    awayAbbr: away.team?.abbreviation || 'Away',
    awayScore: Number(away.score || 0)
  };
}

function isCloseLateGame(game) {
  if (game.state !== 'in') return false;
  const maxPeriod = REGULATION_PERIODS_BY_LEAGUE[game.leagueId] || 4;
  if (game.period < maxPeriod) return false;
  const diff = Math.abs(game.homeScore - game.awayScore);
  const threshold = CLOSE_MARGIN_BY_LEAGUE[game.leagueId] || 3;
  if (diff > threshold) return false;

  if (game.leagueId === 'mlb') {
    return game.period >= 8;
  }
  return game.clockSeconds > 0 && game.clockSeconds <= 150;
}

function getLeader(game) {
  if (game.homeScore > game.awayScore) return 'home';
  if (game.awayScore > game.homeScore) return 'away';
  return 'tie';
}

/**
 * Scheduled every 1 minute, but gated by single-document read (`system/pushRegistry`)
 * and `nextWakeTime` so daily reads stay well under 3% of the Firebase free tier.
 */
exports.checkLiveScoresAndNotify = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'America/Chicago',
    memory: '256MiB',
    maxInstances: 1
  },
  async () => {
    const nowMs = Date.now();
    const registryRef = db.doc('system/pushRegistry');
    const registrySnap = await registryRef.get();

    if (!registrySnap.exists) {
      return;
    }

    const registry = registrySnap.data() || {};
    const subscribersMap = registry.subscribers || {};
    const subscriberEntries = Object.entries(subscribersMap).filter(
      ([, sub]) =>
        sub &&
        sub.enabled === true &&
        Array.isArray(sub.tokens) &&
        sub.tokens.length > 0 &&
        ((Array.isArray(sub.teamIds) && sub.teamIds.length > 0) ||
          (Array.isArray(sub.gameIds) && sub.gameIds.length > 0))
    );

    if (subscriberEntries.length === 0) {
      return;
    }

    const nextWakeTime = Number(registry.nextWakeTime || 0);
    const registryUpdatedAt = Number(registry.updatedAt || 0);
    const lastCheckedAt = Number(registry.lastCheckedAt || 0);

    if (nextWakeTime > nowMs && registryUpdatedAt <= lastCheckedAt) {
      return;
    }

    const neededLeagues = new Set();
    for (const [, sub] of subscriberEntries) {
      (sub.leagues || ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'soccer']).forEach((lg) => {
        if (LEAGUE_ENDPOINTS[lg]) neededLeagues.add(lg);
      });
    }

    const stateRef = db.doc('system/liveScoreState');
    const stateSnap = await stateRef.get();
    const prevGames = (stateSnap.exists && stateSnap.data()?.games) || {};
    const nextGames = { ...prevGames };
    const notificationsToSend = [];
    let earliestUpcomingMs = Infinity;
    let hasActiveLiveGame = false;

    for (const leagueId of neededLeagues) {
      try {
        const res = await fetch(LEAGUE_ENDPOINTS[leagueId]);
        if (!res.ok) continue;
        const data = await res.json();
        const events = data.events || [];

        for (const rawEvent of events) {
          const game = parseSimpleGame(rawEvent, leagueId);
          const matchingSubscribers = subscriberEntries.filter(([, sub]) => {
            const followsGame = Array.isArray(sub.gameIds) && sub.gameIds.includes(game.id);
            const followsTeam =
              Array.isArray(sub.teamIds) &&
              (sub.teamIds.includes(`${leagueId}:${game.homeId}`) ||
                sub.teamIds.includes(`${leagueId}:${game.awayId}`));
            return followsGame || followsTeam;
          });

          if (matchingSubscribers.length === 0) continue;

          if (game.state === 'in') {
            hasActiveLiveGame = true;
          } else if (game.state === 'pre' && game.startTimeMs > nowMs) {
            if (game.startTimeMs < earliestUpcomingMs) {
              earliestUpcomingMs = game.startTimeMs;
            }
          }

          const prev = prevGames[game.id];
          const closeAlertSent = prev?.closeAlertSent || false;
          let nextCloseAlertSent = closeAlertSent;

          if (prev) {
            const scoreLine = `${game.awayAbbr} ${game.awayScore} - ${game.homeAbbr} ${game.homeScore}`;
            const eventsTriggered = [];

            if (prev.state === 'pre' && game.state === 'in') {
              eventsTriggered.push({
                type: 'gameStart',
                title: `Game Started: ${game.awayAbbr} at ${game.homeAbbr}`,
                body: `${game.awayName} vs ${game.homeName} is now live.`
              });
            }

            if (
              game.state === 'in' &&
              (game.homeScore !== prev.homeScore || game.awayScore !== prev.awayScore)
            ) {
              const prevLeader = getLeader(prev);
              const newLeader = getLeader(game);
              const isLeadChange = prevLeader !== newLeader && newLeader !== 'tie';

              eventsTriggered.push({
                type: isLeadChange ? 'leadChange' : 'everyScore',
                isLeadChange,
                title: isLeadChange ? `Lead Change: ${scoreLine}` : `Score Update: ${scoreLine}`,
                body: `${game.shortDetail}`
              });
            }

            if (game.state === 'in' && game.period > prev.period && prev.period > 0) {
              eventsTriggered.push({
                type: 'periodEnd',
                title: `End of Period ${prev.period}: ${scoreLine}`,
                body: `${game.awayName} at ${game.homeName}`
              });
            }

            if (!closeAlertSent && isCloseLateGame(game)) {
              nextCloseAlertSent = true;
              eventsTriggered.push({
                type: 'closeGame',
                title: `Close Game Alert: ${scoreLine}`,
                body: `Down to the wire (${game.shortDetail}).`
              });
            }

            if (prev.state !== 'post' && game.state === 'post') {
              eventsTriggered.push({
                type: 'finalScore',
                title: `Final: ${scoreLine}`,
                body: `${game.awayName} at ${game.homeName} has ended.`
              });
            }

            for (const trig of eventsTriggered) {
              const tokensForEvent = new Set();
              for (const [, sub] of matchingSubscribers) {
                const prefs =
                  sub.gamePrefs?.[game.id] ||
                  sub.teamPrefs?.[`${leagueId}:${game.homeId}`] ||
                  sub.teamPrefs?.[`${leagueId}:${game.awayId}`] ||
                  sub.defaultPrefs ||
                  {};

                const wantsEvent =
                  (trig.type === 'gameStart' && prefs.gameStart !== false) ||
                  (trig.type === 'finalScore' && prefs.finalScore !== false) ||
                  (trig.type === 'closeGame' && prefs.closeGame !== false) ||
                  (trig.type === 'periodEnd' && prefs.periodEnd === true) ||
                  (trig.type === 'leadChange' &&
                    (prefs.leadChange === true || prefs.everyScore === true)) ||
                  (trig.type === 'everyScore' && prefs.everyScore === true);

                if (wantsEvent) {
                  sub.tokens.forEach((t) => tokensForEvent.add(t));
                }
              }

              if (tokensForEvent.size > 0) {
                notificationsToSend.push({
                  tokens: Array.from(tokensForEvent),
                  title: trig.title,
                  body: trig.body,
                  gameId: game.id,
                  leagueId
                });
              }
            }
          }

          nextGames[game.id] = {
            ...game,
            closeAlertSent: nextCloseAlertSent,
            updatedAt: nowMs
          };
        }
      } catch (err) {
        logger.warn(`[SportyPush]: Failed fetching ${leagueId}`, err);
      }
    }

    for (const item of notificationsToSend) {
      try {
        await admin.messaging().sendEachForMulticast({
          tokens: item.tokens,
          notification: {
            title: item.title,
            body: item.body
          },
          data: {
            gameId: item.gameId,
            leagueId: item.leagueId,
            url: `/?game=${item.gameId}`
          }
        });
      } catch (err) {
        logger.warn('[SportyPush]: Multicast send warning', err);
      }
    }

    let computedNextWake = nowMs + 60 * 1000;
    if (!hasActiveLiveGame) {
      if (earliestUpcomingMs < Infinity) {
        const wakeLeadMs = earliestUpcomingMs - 5 * 60 * 1000;
        computedNextWake = Math.max(nowMs + 60 * 1000, Math.min(wakeLeadMs, nowMs + 30 * 60 * 1000));
      } else {
        computedNextWake = nowMs + 30 * 60 * 1000;
      }
    }

    await stateRef.set({ games: nextGames, updatedAt: nowMs }, { merge: true });
    await registryRef.set(
      {
        lastCheckedAt: nowMs,
        nextWakeTime: computedNextWake
      },
      { merge: true }
    );
  }
);
