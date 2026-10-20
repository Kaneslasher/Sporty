import React, { memo } from 'react';
import TeamLogo from './TeamLogo';
import Score from './Score';
import BaseballSituation from './BaseballSituation';

function TileTeam({ team }) {
  return (
    <span className="live-tile__team">
      <TeamLogo team={team} size={44} />
      <span className="live-tile__abbr">{team.abbreviation}</span>
    </span>
  );
}

/**
 * Large scoreboard tile for a game in progress, shown in the Live now carousel.
 */
function LiveTile({ game, onOpen }) {
  const { awayTeam, homeTeam } = game;
  const situation = game.situation || {};
  const awayTrailing = awayTeam.score < homeTeam.score;
  const homeTrailing = homeTeam.score < awayTeam.score;

  return (
    <button
      type="button"
      className="live-tile"
      onClick={() => onOpen(game.id)}
      aria-label={`Live: ${awayTeam.fullName} ${awayTeam.score}, ${homeTeam.fullName} ${homeTeam.score}, ${game.shortDetail}. Open game details.`}
    >
      <span className="live-tile__top">
        <span className="live-tile__league">{game.leagueLabel}</span>
        <span className="live-tile__status">
          <span className="live-label">Live</span>
          <span>{game.shortDetail}</span>
        </span>
      </span>

      <span className="live-tile__board">
        <TileTeam team={awayTeam} />
        <Score value={awayTeam.score} className="live-tile__score" trailing={awayTrailing} />
        <span className="live-tile__divider" aria-hidden="true" />
        <Score value={homeTeam.score} className="live-tile__score" trailing={homeTrailing} />
        <TileTeam team={homeTeam} />
      </span>

      <span className="live-tile__context">
        {situation.type === 'baseball' && situation.bases ? (
          <BaseballSituation bases={situation.bases} outs={situation.outs} />
        ) : null}
        {situation.isRedZone ? <span className="redzone-label">Red zone</span> : null}
        <span className="live-tile__context-text">{situation.contextLine || 'In progress'}</span>
      </span>
    </button>
  );
}

export default memo(LiveTile);
