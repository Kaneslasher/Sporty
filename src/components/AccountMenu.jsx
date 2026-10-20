import React from 'react';
import { Bell, BellRing, Download, Heart, LogOut, ShieldCheck } from 'lucide-react';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import GoogleMark from './GoogleMark';

/**
 * Header account control modeled on the itsAndroid profile pattern:
 * signed out shows a Google sign-in pill; signed in shows an avatar that opens a
 * right-aligned menu with name and email, app links, and Sign out at the bottom.
 */
export default function AccountMenu({
  user,
  isAdmin,
  onSignIn,
  onSignOut,
  onOpenAlerts,
  onInstallApp,
  isPwaInstalled,
  followingCount,
  pushEnabled
}) {
  const { triggerRef, panelRef, closePanel } = useAnchoredPopover({ align: 'end', maxWidth: 272 });

  if (!user) {
    return (
      <button type="button" className="google-button" onClick={onSignIn}>
        <GoogleMark size={18} />
        <span>Sign in</span>
      </button>
    );
  }

  const name = user.displayName || 'Signed in';
  const initial = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();

  const runAndClose = (action) => {
    closePanel();
    action();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="avatar-button"
        popoverTarget="account-menu"
        aria-label={`Account menu for ${name}`}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" width={36} height={36} referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar-button__initial" aria-hidden="true">{initial}</span>
        )}
      </button>

      <div ref={panelRef} id="account-menu" popover="auto" className="account-menu" aria-label="Account">
        <div className="account-menu__identity">
          <p className="account-menu__name">{name}</p>
          {user.email ? <p className="account-menu__email">{user.email}</p> : null}
        </div>

        <div className="account-menu__group">
          <button type="button" className="account-menu__item" onClick={() => runAndClose(onOpenAlerts)}>
            {pushEnabled ? <BellRing size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
            <span>Alerts</span>
            <span className="account-menu__meta">{pushEnabled ? 'On' : 'Off'}</span>
          </button>
          <button type="button" className="account-menu__item" onClick={() => runAndClose(onOpenAlerts)}>
            <Heart size={20} aria-hidden="true" />
            <span>Teams you follow</span>
            <span className="account-menu__meta">{followingCount}</span>
          </button>
          {!isPwaInstalled ? (
            <button type="button" className="account-menu__item" onClick={() => runAndClose(onInstallApp)}>
              <Download size={20} aria-hidden="true" />
              <span>Install app</span>
            </button>
          ) : null}
          {isAdmin ? (
            <p className="account-menu__item account-menu__item--admin" role="note">
              <ShieldCheck size={20} aria-hidden="true" />
              <span>Admin account</span>
            </p>
          ) : null}
        </div>

        <div className="account-menu__group">
          <button type="button" className="account-menu__item" onClick={() => runAndClose(onSignOut)}>
            <LogOut size={20} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}
