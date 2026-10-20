/**
 * Hockey (NHL) Live Situation & Score Normalizer
 * Extracts hockey-specific live context: Period, clock, and last play.
 */
export const NHL_CONFIG = {
  id: 'nhl',
  label: 'Hockey',
  shortLabel: 'Hockey',
  sport: 'hockey',
  leagueSlug: 'nhl',
  endpoint: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  defaultNotificationPrefs: {
    gameStart: true,
    everyScore: true,
    leadChange: true,
    closeGame: true,
    periodEnd: true,
    finalScore: true
  }
};

export function normalizeNhlSituation(competition, statusObj, homeTeam, awayTeam) {
  const lastPlayText = competition?.situation?.lastPlay?.text || '';

  return {
    type: 'hockey',
    possessionTeamId: null,
    possessionSide: null,
    primaryBadge: statusObj?.type?.shortDetail || 'Live',
    contextLine: lastPlayText || 'On Ice',
    secondaryDetail: lastPlayText,
    isRedZone: false,
    bases: null,
    outs: null
  };
}
