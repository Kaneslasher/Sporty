const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit'
});

const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dayNumberFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric' });
const longDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric'
});
const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric'
});
const monthDayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric'
});

export function formatStartTime(ms) {
  if (!Number.isFinite(ms)) return '';
  return timeFormatter.format(new Date(ms));
}

export function getDayChip(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const isRelative = offset === -1 || offset === 0 || offset === 1;
  let label = shortDateFormatter.format(d);
  if (offset === 0) label = 'Today';
  if (offset === -1) label = 'Yesterday';
  if (offset === 1) label = 'Tomorrow';
  return {
    offset,
    isRelative,
    label,
    monthDay: monthDayFormatter.format(d),
    dayNumber: dayNumberFormatter.format(d),
    shortDate: shortDateFormatter.format(d),
    fullLabel: longDateFormatter.format(d)
  };
}

export function formatUpdatedAgo(date, nowMs = Date.now()) {
  if (!date) return 'Not updated yet';
  const seconds = Math.max(0, Math.round((nowMs - date.getTime()) / 1000));
  if (seconds < 5) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `Updated ${minutes}m ago`;
}

export function formatPollingCadence(seconds) {
  if (seconds < 60) return `every ${seconds}s`;
  return `every ${Math.round(seconds / 60)} min`;
}

/**
 * Human status label for a game card or detail header.
 */
export function getStatusLabel(game) {
  if (game.state === 'pre') return formatStartTime(game.startTimeMs);
  if (game.state === 'post') return game.shortDetail || 'Final';
  return game.shortDetail || 'Live';
}

const PERIOD_LABELS = {
  nfl: ['1', '2', '3', '4'],
  ncaaf: ['1', '2', '3', '4'],
  nba: ['1', '2', '3', '4'],
  nhl: ['1', '2', '3'],
  soccer: ['1H', '2H'],
  mlb: ['1', '2', '3', '4', '5', '6', '7', '8', '9']
};

/**
 * Column headers for the line score table, extending into overtime or extra innings.
 */
export function getLinescoreColumns(leagueId, maxPlayed) {
  const base = PERIOD_LABELS[leagueId] || ['1', '2', '3', '4'];
  const count = Math.max(base.length, maxPlayed);
  const columns = [];
  for (let i = 0; i < count; i += 1) {
    if (i < base.length) {
      columns.push(base[i]);
    } else if (leagueId === 'mlb') {
      columns.push(String(i + 1));
    } else {
      const otIndex = i - base.length + 1;
      columns.push(otIndex === 1 ? 'OT' : `${otIndex}OT`);
    }
  }
  return columns;
}
