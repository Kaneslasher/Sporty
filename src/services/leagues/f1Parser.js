/**
 * Formula 1 (F1) Scoreboard & Grand Prix Session Normalizer
 */

export const F1_CONFIG = {
  id: 'f1',
  label: 'Formula 1',
  shortLabel: 'Formula 1',
  sport: 'racing',
  leagueSlug: 'f1',
  endpoint: 'https://site.api.espn.com/apis/site/v2/sports/racing/f1/scoreboard',
  defaultNotificationPrefs: {
    gameStart: true,
    everyScore: false,
    leadChange: true,
    closeGame: false,
    periodEnd: false,
    finalScore: true
  }
};

const SESSION_LABELS = {
  FP1: 'Practice 1',
  FP2: 'Practice 2',
  FP3: 'Practice 3',
  Qual: 'Qualifying',
  SQ: 'Sprint Qualifying',
  Sprint: 'Sprint Race',
  Race: 'Grand Prix Race'
};

export function formatF1SessionLabel(rawAbbr = '') {
  if (!rawAbbr) return 'Race Session';
  return SESSION_LABELS[rawAbbr] || rawAbbr;
}

/**
 * Normalize an ESPN Formula 1 Grand Prix event into a Sporty scoreboard item.
 * Includes full weekend session schedule (`f1Sessions`) and 20-driver classification (`f1Drivers`).
 */
export function normalizeF1Event(event, dateCode = '') {
  const competitions = event.competitions || [];
  const circuitName = event.circuit?.fullName || 'Grand Prix Circuit';
  const city = event.circuit?.address?.city || '';
  const country = event.circuit?.address?.country || '';
  const locationText = [city, country].filter(Boolean).join(', ');

  const f1Sessions = competitions.map((comp) => {
    const rawType = comp.type?.abbreviation || comp.type?.text || 'Session';
    const statusObj = comp.status || {};
    const state = statusObj.type?.state || 'pre';
    const broadcasts = (comp.broadcasts || [])
      .flatMap((b) => b.names || [])
      .filter(Boolean);
    const competitors = (comp.competitors || [])
      .slice()
      .sort((a, b) => Number(a.order || 99) - Number(b.order || 99))
      .map((c, idx) => ({
        id: String(c.id || idx + 1),
        position: Number(c.order || idx + 1),
        name: c.athlete?.displayName || c.athlete?.fullName || 'Driver',
        shortName: c.athlete?.shortName || c.athlete?.displayName || 'Driver',
        flag: c.athlete?.flag?.href || '',
        winner: Boolean(c.winner)
      }));

    return {
      id: String(comp.id || rawType),
      rawType,
      label: formatF1SessionLabel(rawType),
      startTime: comp.date,
      startTimeMs: new Date(comp.date).getTime(),
      state,
      completed: Boolean(statusObj.type?.completed),
      shortDetail: statusObj.type?.shortDetail || statusObj.type?.detail || '',
      broadcast: broadcasts.slice(0, 2).join(', '),
      drivers: competitors
    };
  });

  /* Choose the active session: live session first, or session matching dateCode, or next upcoming session, or final Race */
  const matchingDaySessions = dateCode
    ? f1Sessions.filter((s) => {
        const d = new Date(s.startTimeMs);
        const code = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        return code === dateCode;
      })
    : [];

  const activeSession =
    f1Sessions.find((s) => s.state === 'in') ||
    matchingDaySessions.find((s) => s.state !== 'post') ||
    matchingDaySessions[matchingDaySessions.length - 1] ||
    f1Sessions.find((s) => s.state === 'pre') ||
    f1Sessions[f1Sessions.length - 1] || {
      id: String(event.id),
      label: 'Grand Prix Race',
      startTime: event.date,
      startTimeMs: new Date(event.date).getTime(),
      state: 'pre',
      completed: false,
      shortDetail: '',
      broadcast: '',
      drivers: []
    };

  const raceSession = f1Sessions[f1Sessions.length - 1] || activeSession;
  const drivers =
    activeSession.drivers?.length > 0
      ? activeSession.drivers
      : raceSession.drivers || [];

  const gpName = (event.name || 'Formula 1 Grand Prix')
    .replace(/^MSC Cruises\s+/i, '')
    .replace(/^Qatar Airways\s+/i, '')
    .replace(/^Heineken\s+/i, '')
    .replace(/^Aramco\s+/i, '')
    .replace(/^Gulf Air\s+/i, '')
    .replace(/^STC\s+/i, '')
    .replace(/^Crypto\.com\s+/i, '')
    .replace(/^Singapore Airlines\s+/i, '')
    .replace(/^Lenovo\s+/i, '')
    .replace(/^Pirelli\s+/i, '');

  const top1 = drivers[0];
  const top2 = drivers[1];
  const top3 = drivers[2];

  /* Provide compatible awayTeam / homeTeam objects for pinning, following, and search */
  const awayTeam = top1
    ? {
        id: top1.id,
        teamKey: 'f1:series',
        leagueId: 'f1',
        name: `P1 ${top1.shortName}`,
        fullName: `${gpName} (${top1.name})`,
        abbreviation: top1.shortName,
        logo: top1.flag,
        color: '#ef4444',
        score: 1,
        winner: true,
        record: activeSession.label,
        rank: null,
        linescores: []
      }
    : {
        id: 'f1-gp',
        teamKey: 'f1:series',
        leagueId: 'f1',
        name: gpName,
        fullName: gpName,
        abbreviation: 'F1',
        logo: '',
        color: '#ef4444',
        score: 0,
        winner: false,
        record: activeSession.label,
        rank: null,
        linescores: []
      };

  const homeTeam = top2
    ? {
        id: top2.id,
        teamKey: 'f1:series',
        leagueId: 'f1',
        name: `P2 ${top2.shortName}${top3 ? ` · P3 ${top3.shortName}` : ''}`,
        fullName: `${circuitName}${locationText ? `, ${locationText}` : ''}`,
        abbreviation: top2.shortName,
        logo: top2.flag,
        color: '#1e293b',
        score: 2,
        winner: false,
        record: '',
        rank: null,
        linescores: []
      }
    : {
        id: String(event.circuit?.id || 'circuit'),
        teamKey: 'f1:series',
        leagueId: 'f1',
        name: circuitName,
        fullName: `${circuitName}${locationText ? `, ${locationText}` : ''}`,
        abbreviation: city || 'Track',
        logo: '',
        color: '#1e293b',
        score: 0,
        winner: false,
        record: locationText,
        rank: null,
        linescores: []
      };

  const leaders = drivers.slice(0, 3).map((d) => ({
    category: `P${d.position}`,
    player: d.name,
    value: d.position === 1 ? 'Leader / Winner' : `Position ${d.position}`
  }));

  return {
    id: String(event.id),
    isF1: true,
    gpName,
    circuitName,
    locationText,
    f1Sessions,
    f1ActiveSession: activeSession,
    f1Drivers: drivers,
    leagueId: 'f1',
    leagueLabel: 'Formula 1',
    startTime: activeSession.startTime || event.date,
    startTimeMs: activeSession.startTimeMs || new Date(event.date).getTime(),
    state: activeSession.state,
    completed: activeSession.completed,
    period: 0,
    displayClock: '',
    clockSeconds: 0,
    shortDetail: activeSession.shortDetail || activeSession.label,
    broadcast: activeSession.broadcast || raceSession.broadcast || '',
    venue: `${circuitName}${locationText ? `, ${locationText}` : ''}`,
    headline: activeSession.label,
    homeTeam,
    awayTeam,
    situation: {
      type: 'racing',
      possessionTeamId: null,
      possessionSide: null,
      primaryBadge: activeSession.label,
      contextLine:
        activeSession.state === 'in'
          ? `${gpName} (${activeSession.label})`
          : `${circuitName}${locationText ? `, ${locationText}` : ''}`,
      secondaryDetail: locationText,
      isRedZone: false,
      bases: null,
      outs: null
    },
    leaders
  };
}
