/**
 * Soccer (MLS / USA.1) Live Situation & Score Normalizer
 * Extracts soccer-specific live context: Half, stoppage time, and last play.
 */
export const SOCCER_CONFIG = {
  id: 'soccer',
  label: 'Soccer',
  shortLabel: 'Soccer',
  sport: 'soccer',
  leagueSlug: 'usa.1',
  endpoint: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
  defaultNotificationPrefs: {
    gameStart: true,
    everyScore: true,
    leadChange: true,
    closeGame: true,
    periodEnd: false,
    finalScore: true
  }
};

export function normalizeSoccerSituation(competition, statusObj, homeTeam, awayTeam) {
  const lastPlayText = competition?.situation?.lastPlay?.text || '';

  return {
    type: 'soccer',
    possessionTeamId: null,
    possessionSide: null,
    primaryBadge: statusObj?.type?.shortDetail || 'Live',
    contextLine: lastPlayText || 'Match in Progress',
    secondaryDetail: lastPlayText,
    isRedZone: false,
    bases: null,
    outs: null
  };
}
