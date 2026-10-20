import React, { useEffect, useState } from 'react';
import { X, Heart, Pin, Bell, Tv, MapPin } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';
import { useSports } from '../context/SportsContext';
import { fetchGameSummary } from '../services/espnApi';
import TeamLogo from './TeamLogo';
import Score from './Score';
import BaseballSituation from './BaseballSituation';
import { getStatusLabel, getLinescoreColumns, formatStartTime } from '../utils/format';

const SUMMARY_REFRESH_MS = 30000;

function ScoreSide({ team, align, showScore, isLoser }) {
  return (
    <div className="detail-side" data-align={align} data-dimmed={isLoser}>
      <TeamLogo team={team} size={48} />
      <span className="detail-side__name">{team.name}</span>
      {team.record ? <span className="detail-side__record">{team.record}</span> : null}
      {showScore ? <Score value={team.score} className="detail-side__score" /> : <span className="detail-side__score" />}
    </div>
  );
}

function Linescore({ game }) {
  const away = game.awayTeam.linescores || [];
  const home = game.homeTeam.linescores || [];
  const played = Math.max(away.length, home.length);
  if (played === 0) return null;
  const columns = getLinescoreColumns(game.leagueId, played);

  return (
    <div className="linescore" role="region" aria-label="Line score" tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th scope="col"><span className="visually-hidden">Team</span></th>
            {columns.map((col) => (
              <th key={col} scope="col">{col}</th>
            ))}
            <th scope="col" className="linescore__total">{game.leagueId === 'mlb' ? 'R' : 'T'}</th>
          </tr>
        </thead>
        <tbody>
          {[game.awayTeam, game.homeTeam].map((team) => (
            <tr key={team.teamKey}>
              <th scope="row">{team.abbreviation}</th>
              {columns.map((col, i) => (
                <td key={col}>{team.linescores?.[i] ?? ''}</td>
              ))}
              <td className="linescore__total">{team.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WinProbability({ game, summary }) {
  if (!summary || summary.homeWinPct === null || game.state === 'post') return null;
  return (
    <section className="detail-section">
      <h3 className="detail-section__title">Win probability</h3>
      <div className="win-prob">
        <span className="win-prob__label">{game.awayTeam.abbreviation} {summary.awayWinPct}%</span>
        <div
          className="win-prob__bar"
          role="img"
          aria-label={`${game.awayTeam.name} ${summary.awayWinPct} percent, ${game.homeTeam.name} ${summary.homeWinPct} percent`}
        >
          <span style={{ width: `${summary.awayWinPct}%` }} />
        </div>
        <span className="win-prob__label">{summary.homeWinPct}% {game.homeTeam.abbreviation}</span>
      </div>
    </section>
  );
}

export default function GameDetailSheet({ game, onClose, onOpenTeamAlerts, onOpenGameAlerts }) {
  const dialogRef = useModalDialog(Boolean(game), onClose);
  const { isTeamFavorited, toggleFavoriteTeam, isGamePinned, togglePinGame } = useSports();
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const gameId = game?.id;
  const leagueId = game?.leagueId;
  const isLive = game?.state === 'in';
  const isPre = game?.state === 'pre';

  /* Fetch the play-by-play summary on open, and refresh it every 30s only while the game is live and the sheet is open. */
  useEffect(() => {
    if (!gameId || isPre || game?.isF1) {
      setSummary(null);
      return undefined;
    }
    let cancelled = false;
    const load = async (showSpinner) => {
      if (showSpinner) setSummaryLoading(true);
      const data = await fetchGameSummary(leagueId, gameId);
      if (!cancelled) {
        setSummary(data);
        setSummaryLoading(false);
      }
    };
    load(true);
    const timer = isLive ? setInterval(() => load(false), SUMMARY_REFRESH_MS) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [gameId, leagueId, isLive, isPre]);

  const titleId = 'detail-sheet-title';

  return (
    <dialog
      ref={dialogRef}
      className="single-sheet-modal single-sheet-modal--wide"
      closedby="any"
      aria-labelledby={titleId}
    >
      {game ? (
        <div className="sheet">
          <header className="sheet__header">
            <div className="sheet__heading">
              <h2 id={titleId} className="sheet__title">
                {game.isF1 ? game.gpName : `${game.awayTeam.name} at ${game.homeTeam.name}`}
              </h2>
              <p className="sheet__subtitle">
                {game.isF1
                  ? `${game.leagueLabel} · ${game.venue}`
                  : `${game.leagueLabel}${game.headline ? `, ${game.headline}` : ''}`}
              </p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </header>

          <div className="sheet__body">
            {game.isF1 ? (
              <>
                {game.f1Sessions?.length ? (
                  <section className="detail-section">
                    <h3 className="detail-section__title">Grand Prix weekend schedule</h3>
                    <ul className="leader-list">
                      {game.f1Sessions.map((session) => {
                        const dt = new Date(session.startTimeMs);
                        const dayStr = dt.toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric'
                        });
                        const timeStr = formatStartTime(session.startTimeMs);
                        return (
                          <li key={session.id} className="leader-row">
                            <span className="leader-row__category">{session.label}</span>
                            <span className="leader-row__player">
                              {dayStr} · {timeStr}
                              {session.broadcast ? ` (${session.broadcast})` : ''}
                            </span>
                            <span className="leader-row__value">
                              {session.state === 'post'
                                ? session.drivers?.[0]?.shortName || 'Final'
                                : session.state === 'in'
                                  ? 'Live'
                                  : 'Scheduled'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}

                {game.f1Drivers?.length ? (
                  <section className="detail-section">
                    <h3 className="detail-section__title">
                      Driver classification ({game.f1ActiveSession?.label || 'Race'})
                    </h3>
                    <ol className="leader-list">
                      {game.f1Drivers.map((driver) => (
                        <li key={driver.id} className="leader-row">
                          <span className="leader-row__category">P{driver.position}</span>
                          <span className="leader-row__player">{driver.name}</span>
                          <span className="leader-row__value">
                            {driver.position === 1 ? 'P1' : `#${driver.position}`}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}
              </>
            ) : (
              <>
                <section className="detail-scoreboard" aria-live="polite">
                  <ScoreSide
                    team={game.awayTeam}
                    align="start"
                    showScore={!isPre}
                    isLoser={game.state === 'post' && game.awayTeam.score < game.homeTeam.score}
                  />
                  <div className="detail-status">
                    {isLive ? <span className="live-label">Live</span> : null}
                    <span className="detail-status__text">{getStatusLabel(game)}</span>
                    {isLive && game.situation?.type === 'baseball' && game.situation.bases ? (
                      <BaseballSituation bases={game.situation.bases} outs={game.situation.outs} />
                    ) : null}
                  </div>
                  <ScoreSide
                    team={game.homeTeam}
                    align="end"
                    showScore={!isPre}
                    isLoser={game.state === 'post' && game.homeTeam.score < game.awayTeam.score}
                  />
                </section>

                {isLive && game.situation?.contextLine ? (
                  <p className="detail-context" data-redzone={game.situation.isRedZone}>
                    {game.situation.isRedZone ? <span className="redzone-label">Red zone</span> : null}
                    {game.situation.contextLine}
                  </p>
                ) : null}

                <Linescore game={game} />
              </>
            )}

            <section className="detail-section">
              <h3 className="detail-section__title">Follow and alerts</h3>
              <ul className="follow-list">
                {(game.isF1
                  ? [
                      {
                        teamKey: 'f1:series',
                        id: 'series',
                        leagueId: 'f1',
                        name: 'Formula 1',
                        fullName: 'Formula 1 Championship',
                        abbreviation: 'F1',
                        logo: ''
                      }
                    ]
                  : [game.awayTeam, game.homeTeam]
                ).map((team) => {
                  const favorited = isTeamFavorited(team.teamKey);
                  return (
                    <li key={team.teamKey} className="follow-row">
                      <TeamLogo team={team} size={24} />
                      <span className="follow-row__name">{team.fullName}</span>
                      {favorited ? (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => onOpenTeamAlerts(team)}
                          aria-label={`Alert settings for ${team.fullName}`}
                        >
                          <Bell size={18} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="follow-button"
                        aria-pressed={favorited}
                        onClick={() => toggleFavoriteTeam(team)}
                      >
                        <Heart size={16} strokeWidth={2.25} />
                        <span>{favorited ? 'Following' : 'Follow'}</span>
                      </button>
                    </li>
                  );
                })}
                <li className="follow-row">
                  <Pin size={20} className="follow-row__icon" aria-hidden="true" />
                  <span className="follow-row__name">Just this game</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => onOpenGameAlerts(game)}
                    aria-label="Alert settings for this game"
                  >
                    <Bell size={18} />
                  </button>
                  <button
                    type="button"
                    className="follow-button"
                    aria-pressed={isGamePinned(game.id)}
                    onClick={() => togglePinGame(game)}
                  >
                    <Pin size={16} strokeWidth={2.25} />
                    <span>{isGamePinned(game.id) ? 'Pinned' : 'Pin'}</span>
                  </button>
                </li>
              </ul>
            </section>

            <WinProbability game={game} summary={summary} />

            {summary?.scoringPlays?.length ? (
              <section className="detail-section">
                <h3 className="detail-section__title">Scoring plays</h3>
                <ol className="play-list">
                  {summary.scoringPlays.map((play) => (
                    <li key={play.id} className="play-row">
                      <span className="play-row__time">
                        {play.teamAbbr ? <strong>{play.teamAbbr}</strong> : null}
                        <span>{play.clock}</span>
                      </span>
                      <span className="play-row__text">{play.text}</span>
                      {play.awayScore !== null && play.homeScore !== null ? (
                        <span className="play-row__score">
                          {play.awayScore}-{play.homeScore}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {isLive && summary?.recentPlays?.length ? (
              <section className="detail-section">
                <h3 className="detail-section__title">Latest plays</h3>
                <ol className="play-list">
                  {summary.recentPlays.filter((p) => p.text).slice(0, 6).map((play) => (
                    <li key={play.id} className="play-row">
                      <span className="play-row__time"><span>{play.clock}</span></span>
                      <span className="play-row__text">{play.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {summaryLoading && !summary ? (
              <p className="detail-muted">Loading play-by-play...</p>
            ) : null}

            {!game.isF1 && game.leaders?.length ? (
              <section className="detail-section">
                <h3 className="detail-section__title">Leaders</h3>
                <ul className="leader-list">
                  {game.leaders.map((leader) => (
                    <li key={`${leader.category}-${leader.player}`} className="leader-row">
                      <span className="leader-row__category">{leader.category}</span>
                      <span className="leader-row__player">{leader.player}</span>
                      <span className="leader-row__value">{leader.value}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="detail-meta">
              {isPre ? (
                <p>Starts at {formatStartTime(game.startTimeMs)}</p>
              ) : null}
              {game.broadcast ? (
                <p><Tv size={15} aria-hidden="true" /> {game.broadcast}</p>
              ) : null}
              {game.venue ? (
                <p><MapPin size={15} aria-hidden="true" /> {game.venue}</p>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
