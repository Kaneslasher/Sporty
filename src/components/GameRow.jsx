import React, { memo } from 'react';
import { Pin, Heart } from 'lucide-react';
import TeamLogo from './TeamLogo';
import Score from './Score';
import BaseballSituation from './BaseballSituation';
import { formatStartTime } from '../utils/format';

function TeamLine({ team, side, game, isFavorite }) {
  const other = side === 'home' ? game.awayTeam : game.homeTeam;
  const isFinal = game.state === 'post';
  const isWinner = isFinal && team.score > other.score;
  const isLoser = isFinal && team.score < other.score;
  const hasBall = game.state === 'in' && game.situation?.possessionSide === side;

  return (
    <span className="team-line" data-dimmed={isLoser}>
      <TeamLogo team={team} size={24} />
      <span className="team-line__name">
        {team.rank ? <span className="team-line__rank">{team.rank}</span> : null}
        <span className="team-line__label">{team.name}</span>
        {hasBall ? <span className="possession-dot" aria-label="Has possession" /> : null}
        {isFavorite ? (
          <Heart className="team-line__fav" size={12} strokeWidth={2.5} aria-label="Following" />
        ) : null}
        {team.record ? <span className="team-line__record">{team.record}</span> : null}
      </span>
      {game.state !== 'pre' && !game.isF1 ? (
        <Score value={team.score} className="team-line__score" winner={isWinner} />
      ) : null}
    </span>
  );
}

function StatusColumn({ game }) {
  if (game.isF1 && game.state === 'pre') {
    const d = new Date(game.startTimeMs);
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return (
      <span className="row-status" data-state="pre">
        <span className="row-status__main">{formatStartTime(game.startTimeMs)}</span>
        <span className="row-status__detail">{weekday}</span>
      </span>
    );
  }
  if (game.state === 'in') {
    const situation = game.situation || {};
    return (
      <span className="row-status" data-state="in">
        <span className="live-label">Live</span>
        <span className="row-status__detail">{game.shortDetail}</span>
        {situation.type === 'baseball' && situation.bases ? (
          <BaseballSituation bases={situation.bases} outs={situation.outs} />
        ) : null}
      </span>
    );
  }
  if (game.state === 'post') {
    return (
      <span className="row-status" data-state="post">
        <span className="row-status__main">{game.shortDetail || 'Final'}</span>
      </span>
    );
  }
  return (
    <span className="row-status" data-state="pre">
      <span className="row-status__main">{formatStartTime(game.startTimeMs)}</span>
      {game.broadcast ? <span className="row-status__detail">{game.broadcast}</span> : null}
    </span>
  );
}

function GameRow({ game, isPinned, homeFavorite, awayFavorite, onOpen, onTogglePin }) {
  const situation = game.situation || {};
  const showContext = game.state === 'in' && situation.type !== 'baseball' && situation.contextLine;

  return (
    <article className="game-row" data-state={game.state}>
      <button
        type="button"
        className="game-row__main"
        onClick={() => onOpen(game.id)}
        aria-label={`${game.awayTeam.fullName} at ${game.homeTeam.fullName}. Open game details.`}
      >
        <StatusColumn game={game} />
        <span className="game-row__teams">
          <TeamLine team={game.awayTeam} side="away" game={game} isFavorite={awayFavorite} />
          <TeamLine team={game.homeTeam} side="home" game={game} isFavorite={homeFavorite} />
          {showContext ? (
            <span className="game-row__context">
              {situation.isRedZone ? <span className="redzone-label">Red zone</span> : null}
              <span className="game-row__context-text">{situation.contextLine}</span>
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        className="pin-toggle"
        aria-pressed={isPinned}
        aria-label={isPinned ? 'Unpin game' : 'Pin game'}
        onClick={() => onTogglePin(game)}
      >
        <Pin size={17} strokeWidth={2.25} />
      </button>
    </article>
  );
}

export default memo(GameRow);
