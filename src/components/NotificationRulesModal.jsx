import React from 'react';
import { X, BellOff, Share, SquarePlus } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';
import { useSports } from '../context/SportsContext';
import { NOTIFICATION_RULE_OPTIONS } from '../services/notificationEngine';

/**
 * Per-team or per-game alert rules. Target shape:
 * { type: 'team' | 'game', key, leagueId, title, subtitle, game? }
 */
export default function NotificationRulesModal({ target, onClose }) {
  const dialogRef = useModalDialog(Boolean(target), onClose);
  const {
    getNotificationPrefsForTarget,
    updateNotificationPrefsForTarget,
    pushEnabled,
    pwaEnv,
    enablePushNotifications,
    isGamePinned,
    isGameFollowed,
    togglePinGame
  } = useSports();

  const prefs = target
    ? getNotificationPrefsForTarget(target.type, target.key, target.leagueId)
    : {};

  const handleToggle = (ruleKey, checked) => {
    if (!target) return;
    const nextPrefs = { ...prefs, [ruleKey]: checked };

    /* Alerts only fire for followed games, so turning a rule on pins an unfollowed game
       and saves the new rules in the same write. */
    if (
      checked &&
      target.type === 'game' &&
      target.game &&
      !isGamePinned(target.game.id) &&
      !isGameFollowed(target.game)
    ) {
      togglePinGame(target.game, nextPrefs);
      return;
    }
    updateNotificationPrefsForTarget(target.type, target.key, nextPrefs);
  };

  const titleId = 'rules-modal-title';

  return (
    <dialog
      ref={dialogRef}
      className="single-sheet-modal"
      closedby="any"
      aria-labelledby={titleId}
    >
      {target ? (
        <div className="sheet">
          <header className="sheet__header">
            <div className="sheet__heading">
              <h2 id={titleId} className="sheet__title">{target.title}</h2>
              <p className="sheet__subtitle">{target.subtitle}</p>
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
            {!pushEnabled ? (
              <div className="sheet-notice">
                <BellOff size={18} className="sheet-notice__icon" aria-hidden="true" />
                <div className="sheet-notice__text">
                  {pwaEnv?.needsIosHomeScreenInstall ? (
                    <>
                      <p className="sheet-notice__title">Install Sporty to get phone alerts</p>
                      <p className="sheet-notice__body">
                        Tap <Share size={14} aria-label="Share" className="inline-icon" /> Share, then{' '}
                        <SquarePlus size={14} aria-label="Add" className="inline-icon" /> Add to Home Screen.
                        Open Sporty from your home screen and turn alerts on.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="sheet-notice__title">Phone alerts are off</p>
                      <p className="sheet-notice__body">
                        Your choices below are saved, but nothing will buzz until alerts are on.
                      </p>
                    </>
                  )}
                </div>
                {!pwaEnv?.needsIosHomeScreenInstall ? (
                  <button type="button" className="text-button" onClick={enablePushNotifications}>
                    Turn on
                  </button>
                ) : null}
              </div>
            ) : null}

            <ul className="rule-list">
              {NOTIFICATION_RULE_OPTIONS.map((rule) => {
                const inputId = `rule-${rule.key}`;
                return (
                  <li key={rule.key} className="rule-row">
                    <label htmlFor={inputId} className="rule-row__text">
                      <span className="rule-row__label">{rule.label}</span>
                      <span className="rule-row__description">{rule.description}</span>
                    </label>
                    <input
                      id={inputId}
                      type="checkbox"
                      switch=""
                      className="switch-input"
                      checked={Boolean(prefs[rule.key])}
                      onChange={(event) => handleToggle(rule.key, event.target.checked)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="sheet__footer">
            <button
              type="button"
              className="primary-button"
              onClick={() => dialogRef.current?.close()}
            >
              Done
            </button>
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
