/**
 * Baseball (MLB) Live Situation & Score Normalizer
 * Extracts baseball-specific live context: Count (balls/strikes), outs,
 * baserunners (first, second, third), and last play.
 */
export const MLB_CONFIG = {
  id: 'mlb',
  label: 'Baseball',
  shortLabel: 'Baseball',
  sport: 'baseball',
  leagueSlug: 'mlb',
  endpoint: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  defaultNotificationPrefs: {
    gameStart: true,
    everyScore: true,
    leadChange: true,
    closeGame: true,
    periodEnd: false,
    finalScore: true
  }
};

export function normalizeMlbSituation(competition, statusObj, homeTeam, awayTeam) {
  const situation = competition?.situation || {};
  const balls = typeof situation.balls === 'number' ? situation.balls : null;
  const strikes = typeof situation.strikes === 'number' ? situation.strikes : null;
  const outs = typeof situation.outs === 'number' ? situation.outs : 0;
  const lastPlayText = situation.lastPlay?.text || '';

  let countText = '';
  if (balls !== null && strikes !== null) {
    countText = `${balls}-${strikes} Count`;
  }

  const contextLine = countText || lastPlayText || 'In Progress';
  const secondaryDetail = lastPlayText;

  return {
    type: 'baseball',
    possessionTeamId: null,
    possessionSide: null,
    primaryBadge: statusObj?.type?.shortDetail || 'Live',
    contextLine,
    secondaryDetail,
    isRedZone: false,
    bases: {
      first: Boolean(situation.onFirst),
      second: Boolean(situation.onSecond),
      third: Boolean(situation.onThird)
    },
    outs
  };
}
