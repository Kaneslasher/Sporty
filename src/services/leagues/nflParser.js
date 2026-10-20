/**
 * Golden Template: Pro Football (NFL) Live Situation & Score Normalizer
 * Extracts football-specific live context: Quarter, clock, possession team,
 * down & distance (e.g. "3rd & 4 at KC 35"), red zone status, and last play.
 */
export const NFL_CONFIG = {
  id: 'nfl',
  label: 'Pro Football',
  shortLabel: 'Football',
  sport: 'football',
  leagueSlug: 'nfl',
  endpoint: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  defaultNotificationPrefs: {
    gameStart: true,
    everyScore: true,
    leadChange: true,
    closeGame: true,
    periodEnd: false,
    finalScore: true
  }
};

export function normalizeNflSituation(competition, statusObj, homeTeam, awayTeam) {
  const situation = competition?.situation || {};
  const possessionTeamId = situation.possession ? String(situation.possession) : null;
  const possessionSide =
    possessionTeamId === homeTeam.id
      ? 'home'
      : possessionTeamId === awayTeam.id
        ? 'away'
        : null;

  const downDistanceText =
    situation.shortDownDistanceText ||
    situation.downDistanceText ||
    statusObj.type?.shortDetail ||
    '';

  const possessionText = situation.possessionText || '';
  const isRedZone = Boolean(situation.isRedZone);
  const lastPlayText = situation.lastPlay?.text || '';

  return {
    type: 'football',
    possessionTeamId,
    possessionSide,
    primaryBadge: statusObj.type?.shortDetail || 'Live',
    contextLine: downDistanceText
      ? `${downDistanceText}${possessionText ? ` at ${possessionText}` : ''}`
      : lastPlayText || 'In Progress',
    secondaryDetail: lastPlayText,
    isRedZone,
    bases: null,
    outs: null
  };
}
