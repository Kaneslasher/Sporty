import { NFL_CONFIG, normalizeNflSituation } from './leagues/nflParser';
import { NCAAF_CONFIG, normalizeNcaafSituation } from './leagues/ncaafParser';
import { NBA_CONFIG, normalizeNbaSituation } from './leagues/nbaParser';
import { MLB_CONFIG, normalizeMlbSituation } from './leagues/mlbParser';
import { NHL_CONFIG, normalizeNhlSituation } from './leagues/nhlParser';
import { SOCCER_CONFIG, normalizeSoccerSituation } from './leagues/soccerParser';
import { F1_CONFIG, normalizeF1Event } from './leagues/f1Parser';

export const LEAGUES = [
  NFL_CONFIG,
  NBA_CONFIG,
  MLB_CONFIG,
  NHL_CONFIG,
  NCAAF_CONFIG,
  SOCCER_CONFIG,
  F1_CONFIG
];

export const LEAGUE_MAP = Object.fromEntries(LEAGUES.map((l) => [l.id, l]));

const NORMALIZER_MAP = {
  nfl: normalizeNflSituation,
  ncaaf: normalizeNcaafSituation,
  nba: normalizeNbaSituation,
  mlb: normalizeMlbSituation,
  nhl: normalizeNhlSituation,
  soccer: normalizeSoccerSituation
};

function normalizeTeam(competitor, leagueId) {
  const team = competitor?.team || {};
  const records = competitor?.records || [];
  const overallRecord = records.find((r) => r.type === 'total' || r.name === 'overall') || records[0];
  const linescores = (competitor?.linescores || []).map((ls) => Number(ls.value || 0));

  return {
    id: String(team.id || competitor?.id || ''),
    teamKey: `${leagueId}:${String(team.id || competitor?.id || '')}`,
    leagueId,
    name: team.shortDisplayName || team.name || 'Team',
    fullName: team.displayName || team.shortDisplayName || 'Team',
    abbreviation: team.abbreviation || 'Tm',
    logo: team.logo || team.logos?.[0]?.href || '',
    color: team.color ? `#${team.color}` : null,
    score: Number(competitor?.score || 0),
    winner: Boolean(competitor?.winner),
    record: /^0-0(-0)?$/.test(overallRecord?.summary || '') ? '' : overallRecord?.summary || '',
    rank: competitor?.curatedRank?.current <= 25 ? competitor.curatedRank.current : null,
    linescores
  };
}

export function normalizeEspnEvent(event, leagueId) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const homeRaw = competitors.find((c) => c.homeAway === 'home') || competitors[0] || {};
  const awayRaw = competitors.find((c) => c.homeAway === 'away') || competitors[1] || {};

  const homeTeam = normalizeTeam(homeRaw, leagueId);
  const awayTeam = normalizeTeam(awayRaw, leagueId);

  const statusObj = event.status || competition.status || {};
  const state = statusObj.type?.state || 'pre'; // 'pre' | 'in' | 'post'
  const completed = Boolean(statusObj.type?.completed);
  const period = Number(statusObj.period || 0);
  const displayClock = statusObj.displayClock || '';
  const clockSeconds = Number(statusObj.clock || 0);
  const shortDetail = statusObj.type?.shortDetail || statusObj.type?.detail || '';

  const broadcasts = (competition.broadcasts || [])
    .flatMap((b) => b.names || [])
    .filter(Boolean);
  const broadcastText = broadcasts.slice(0, 2).join(', ');

  const venue = competition.venue?.fullName || '';
  const city = competition.venue?.address?.city || '';
  const headline = competition.notes?.[0]?.headline || '';

  const normalizer = NORMALIZER_MAP[leagueId] || normalizeNflSituation;
  const situation =
    state === 'in'
      ? normalizer(competition, statusObj, homeTeam, awayTeam)
      : {
          type: LEAGUE_MAP[leagueId]?.sport || 'sports',
          possessionTeamId: null,
          possessionSide: null,
          primaryBadge: state === 'post' ? 'Final' : shortDetail,
          contextLine:
            state === 'post'
              ? headline || 'Game Completed'
              : broadcastText
                ? `Watch on ${broadcastText}`
                : venue || 'Scheduled',
          secondaryDetail: venue ? `${venue}${city ? `, ${city}` : ''}` : '',
          isRedZone: false,
          bases: null,
          outs: null
        };

  const leaders = (competition.leaders || []).slice(0, 2).map((cat) => {
    const top = cat.leaders?.[0];
    return {
      category: cat.shortDisplayName || cat.displayName || '',
      player: top?.athlete?.shortName || top?.athlete?.displayName || '',
      value: top?.displayValue || ''
    };
  }).filter((l) => l.player);

  return {
    id: String(event.id),
    leagueId,
    leagueLabel: LEAGUE_MAP[leagueId]?.label || 'Sports',
    startTime: event.date,
    startTimeMs: new Date(event.date).getTime(),
    state,
    completed,
    period,
    displayClock,
    clockSeconds,
    shortDetail,
    broadcast: broadcastText,
    venue,
    headline,
    homeTeam,
    awayTeam,
    situation,
    leaders
  };
}

/**
 * Fetch scoreboard for a single league (optionally for a YYYYMMDD date string).
 */
export async function fetchLeagueScoreboard(leagueId, dateCode = '') {
  const config = LEAGUE_MAP[leagueId];
  if (!config) return [];

  const url = dateCode ? `${config.endpoint}?dates=${dateCode}` : config.endpoint;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${leagueId} scoreboard`);
    }
    const data = await response.json();
    let events = data.events || [];

    /* For Formula 1, if the selected day is a non-race weekday, show the active/next Grand Prix weekend */
    if (leagueId === 'f1' && events.length === 0 && dateCode) {
      const fallbackRes = await fetch(config.endpoint, { cache: 'no-store' });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        events = fallbackData.events || [];
      }
    }

    if (leagueId === 'f1') {
      return events.map((ev) => normalizeF1Event(ev, dateCode));
    }

    return events.map((ev) => normalizeEspnEvent(ev, leagueId));
  } catch (err) {
    console.warn(`[EspnApi]: Failed fetching ${leagueId} scoreboard`, err);
    return [];
  }
}

/**
 * Fetch scoreboards across multiple leagues in parallel.
 * Remember: 1 request per league returns the entire league scoreboard.
 */
export async function fetchAllScoreboards(leagueIds = LEAGUES.map((l) => l.id), dateCode = '') {
  const results = await Promise.all(
    leagueIds.map((id) => fetchLeagueScoreboard(id, dateCode))
  );
  return results.flat();
}

/**
 * Fetch rich boxscore / play-by-play summary for a single game when the user opens the detail sheet.
 */
export async function fetchGameSummary(leagueId, gameId) {
  const config = LEAGUE_MAP[leagueId];
  if (!config || !gameId) return null;

  const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.sport}/${config.leagueSlug}/summary?event=${gameId}`;
  try {
    const response = await fetch(summaryUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for game summary ${gameId}`);
    }
    const data = await response.json();
    const scoringPlays = (data.scoringPlays || []).slice(-8).reverse().map((play) => ({
      id: String(play.id || Math.random()),
      period: play.period?.number || 0,
      clock: play.clock?.displayValue || '',
      text: play.text || '',
      awayScore: play.awayScore ?? null,
      homeScore: play.homeScore ?? null,
      teamAbbr: play.team?.abbreviation || '',
      teamLogo: play.team?.logo || ''
    }));

    const recentPlays = (data.plays || []).slice(-10).reverse().map((play) => ({
      id: String(play.id || Math.random()),
      clock: play.clock?.displayValue || '',
      period: play.period?.number || 0,
      text: play.text || ''
    }));

    const winProbList = data.winprobability || [];
    const latestWinProb = winProbList.length > 0 ? winProbList[winProbList.length - 1] : null;
    const homeWinPct = latestWinProb
      ? Math.round(Number(latestWinProb.homeWinPercentage || 0.5) * 100)
      : null;

    return {
      scoringPlays,
      recentPlays,
      homeWinPct,
      awayWinPct: homeWinPct !== null ? 100 - homeWinPct : null
    };
  } catch (err) {
    console.warn(`[EspnApi]: Failed fetching summary for ${gameId}`, err);
    return null;
  }
}
