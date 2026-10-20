/**
 * Pro Basketball (NBA) Live Situation & Score Normalizer
 * Extracts basketball-specific live context: Period, clock, and last play.
 */
export const NBA_CONFIG = {
  id: 'nba',
  label: 'Pro Basketball',
  shortLabel: 'Basketball',
  sport: 'basketball',
  leagueSlug: 'nba',
  endpoint: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  defaultNotificationPrefs: {
    gameStart: true,
    everyScore: false,
    leadChange: true,
    closeGame: true,
    periodEnd: true,
    finalScore: true
  }
};

export function normalizeNbaSituation(competition, statusObj, homeTeam, awayTeam) {
  const lastPlayText = competition?.situation?.lastPlay?.text || '';

  return {
    type: 'basketball',
    possessionTeamId: null,
    possessionSide: null,
    primaryBadge: statusObj?.type?.shortDetail || 'Live',
    contextLine: lastPlayText || 'In Progress',
    secondaryDetail: lastPlayText,
    isRedZone: false,
    bases: null,
    outs: null
  };
}
