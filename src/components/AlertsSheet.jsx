import React from 'react';
import {
  X,
  Heart,
  Bell,
  Pin,
  LogOut,
  Cloud,
  CloudOff,
  Share,
  SquarePlus,
  FlaskConical,
  CircleAlert
} from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';
import { useSports } from '../context/SportsContext';
import TeamLogo from './TeamLogo';
import GoogleMark from './GoogleMark';

export default function AlertsSheet({ open, onClose, onOpenTeamAlerts, onOpenGame }) {
  const dialogRef = useModalDialog(open, onClose);
  const {
    user,
    signIn,
    signOut,
    syncStatus,
    leagues,
    favoriteTeams,
    toggleFavoriteTeam,
    pinnedGames,
    games,
    togglePinGame,
    pushEnabled,
    pwaEnv,
    isPwaInstalled,
    triggerInstallPwa,
    enablePushNotifications,
    disablePushNotifications,
    simulateLiveScoreUpdate
  } = useSports();

  const leagueLabel = (id) => leagues.find((l) => l.id === id)?.label || '';
  const pinnedLoaded = games.filter((g) => pinnedGames.includes(g.id));
  const permissionBlocked = pwaEnv?.permission === 'denied';
  const titleId = 'alerts-sheet-title';

  const handlePushToggle = (event) => {
    if (event.target.checked) {
      enablePushNotifications();
    } else {
      disablePushNotifications();
    }
  };

  return (
    <dialog ref={dialogRef} className="single-sheet-modal" closedby="any" aria-labelledby={titleId}>
      {open ? (
        <div className="sheet">
          <header className="sheet__header">
            <div className="sheet__heading">
              <h2 id={titleId} className="sheet__title">Alerts and account</h2>
              <p className="sheet__subtitle">Choose what reaches your phone and who you follow.</p>
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
            <section className="detail-section detail-section--flush">
              <div className="settings-row">
                {user ? (
                  <>
                    {user.photoURL ? (
                      <img
                        className="avatar"
                        src={user.photoURL}
                        alt=""
                        width={36}
                        height={36}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <span className="settings-row__text">
                      <span className="settings-row__label">{user.displayName || 'Signed in'}</span>
                      <span className="settings-row__description">{user.email}</span>
                    </span>
                    <button type="button" className="text-button" onClick={signOut}>
                      <LogOut size={16} />
                      <span>Sign out</span>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="settings-row__text">
                      <span className="settings-row__label">Not signed in</span>
                      <span className="settings-row__description">
                        Sign in to keep favorites on every device and get alerts when the app is closed.
                      </span>
                    </span>
                    <button type="button" className="google-button" onClick={signIn}>
                      <GoogleMark size={18} />
                      <span>Sign in with Google</span>
                    </button>
                  </>
                )}
              </div>

              <p className="sync-line" data-state={syncStatus.state}>
                {syncStatus.state === 'error' ? (
                  <CloudOff size={15} aria-hidden="true" />
                ) : (
                  <Cloud size={15} aria-hidden="true" />
                )}
                <span>{syncStatus.message}</span>
              </p>
            </section>

            {!isPwaInstalled ? (
              <section className="detail-section">
                <h3 className="detail-section__title">Install Sporty app</h3>
                <div className="install-steps">
                  <p className="settings-row__label">Add Sporty to your home screen or dock</p>
                  <ol>
                    <li>
                      On iPhone or iPad, tap <Share size={15} aria-label="Share" className="inline-icon" /> Share in Safari, then choose <SquarePlus size={15} aria-label="Add" className="inline-icon" /> Add to Home Screen.
                    </li>
                    <li>
                      On Android or desktop Chrome, tap the Install icon in the address bar or browser menu.
                    </li>
                  </ol>
                </div>
              </section>
            ) : null}

            <section className="detail-section">
              <h3 className="detail-section__title">Phone alerts</h3>
              {pwaEnv?.needsIosHomeScreenInstall ? (
                <div className="install-steps">
                  <p className="settings-row__label">Install Sporty first</p>
                  <ol>
                    <li>
                      Tap <Share size={15} aria-label="Share" className="inline-icon" /> Share in Safari.
                    </li>
                    <li>
                      Choose <SquarePlus size={15} aria-label="Add" className="inline-icon" /> Add to Home Screen.
                    </li>
                    <li>Open Sporty from your home screen, then turn alerts on here.</li>
                  </ol>
                </div>
              ) : (
                <div className="settings-row">
                  <label htmlFor="push-master" className="settings-row__text">
                    <span className="settings-row__label">Score alerts</span>
                    <span className="settings-row__description">
                      For the teams you follow and games you pin.
                    </span>
                  </label>
                  <input
                    id="push-master"
                    type="checkbox"
                    switch=""
                    className="switch-input"
                    checked={pushEnabled}
                    onChange={handlePushToggle}
                    disabled={permissionBlocked && !pushEnabled}
                  />
                </div>
              )}
              {permissionBlocked ? (
                <p className="warning-line">
                  <CircleAlert size={15} aria-hidden="true" />
                  <span>Notifications are blocked for this site. Allow them in your browser site settings.</span>
                </p>
              ) : null}
              <div className="settings-row">
                <span className="settings-row__text">
                  <span className="settings-row__label">Test an alert</span>
                  <span className="settings-row__description">
                    Fakes a score on one of your games so you can see what an alert looks like.
                  </span>
                </span>
                <button type="button" className="text-button" onClick={() => simulateLiveScoreUpdate()}>
                  <FlaskConical size={16} />
                  <span>Send test</span>
                </button>
              </div>
            </section>

            <section className="detail-section">
              <h3 className="detail-section__title">Teams you follow</h3>
              {favoriteTeams.length === 0 ? (
                <p className="detail-muted">
                  Open any game and tap Follow on a team. Their games will show up first, every day.
                </p>
              ) : (
                <ul className="follow-list">
                  {favoriteTeams.map((team) => (
                    <li key={team.teamKey} className="follow-row">
                      <TeamLogo team={team} size={24} />
                      <span className="follow-row__name">
                        {team.fullName || team.name}
                        <span className="follow-row__sub">{leagueLabel(team.leagueId)}</span>
                      </span>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => onOpenTeamAlerts(team)}
                        aria-label={`Alert settings for ${team.fullName || team.name}`}
                      >
                        <Bell size={18} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        data-active="true"
                        onClick={() => toggleFavoriteTeam(team)}
                        aria-label={`Unfollow ${team.fullName || team.name}`}
                      >
                        <Heart size={18} className="icon-filled" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {pinnedLoaded.length > 0 ? (
              <section className="detail-section">
                <h3 className="detail-section__title">Pinned games on this day</h3>
                <ul className="follow-list">
                  {pinnedLoaded.map((game) => (
                    <li key={game.id} className="follow-row">
                      <Pin size={20} className="follow-row__icon" aria-hidden="true" />
                      <button
                        type="button"
                        className="follow-row__name follow-row__link"
                        onClick={() => onOpenGame(game.id)}
                      >
                        {game.awayTeam.abbreviation} at {game.homeTeam.abbreviation}
                        <span className="follow-row__sub">{game.leagueLabel}</span>
                      </button>
                      <button type="button" className="text-button" onClick={() => togglePinGame(game)}>
                        Unpin
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <footer className="sheet__footer">
            <button type="button" className="primary-button" onClick={() => dialogRef.current?.close()}>
              Done
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
