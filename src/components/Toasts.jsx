import React, { useEffect, useRef } from 'react';
import { X, BellRing, Download } from 'lucide-react';
import { useSports } from '../context/SportsContext';

export default function Toasts({ onOpenGame, onInstallApp }) {
  const {
    toasts,
    dismissToast,
    isPwaInstalled,
    showInstallToast,
    dismissInstallToast
  } = useSports();
  const stackRef = useRef(null);

  const activeToast = toasts[0] || null;
  const showingInstallBanner = !activeToast && showInstallToast && !isPwaInstalled;
  const hasVisibleToast = Boolean(activeToast || showingInstallBanner);

  /* Manual popover keeps the single top toast in the top layer above open dialogs. */
  useEffect(() => {
    const stack = stackRef.current;
    if (!stack || typeof stack.showPopover !== 'function') return;
    const isOpen = stack.matches(':popover-open');
    if (hasVisibleToast) {
      if (!isOpen) stack.showPopover();
    } else if (isOpen) {
      stack.hidePopover();
    }
  }, [hasVisibleToast, activeToast?.id]);

  return (
    <div
      ref={stackRef}
      className="toast-stack"
      popover="manual"
      role="status"
      aria-live="polite"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {activeToast ? (
        <div key={activeToast.id} className="toast">
          <BellRing size={18} className="toast__icon" aria-hidden="true" />
          {activeToast.gameId ? (
            <button
              type="button"
              className="toast__text toast__text--link"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const targetId = activeToast.gameId;
                dismissToast(activeToast.id);
                onOpenGame(targetId);
              }}
            >
              <span className="toast__title">{activeToast.title}</span>
              {activeToast.body ? <span className="toast__body">{activeToast.body}</span> : null}
            </button>
          ) : (
            <span className="toast__text">
              <span className="toast__title">{activeToast.title}</span>
              {activeToast.body ? <span className="toast__body">{activeToast.body}</span> : null}
            </span>
          )}
          <button
            type="button"
            className="icon-button icon-button--small toast__close"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dismissToast(activeToast.id);
            }}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      ) : showingInstallBanner ? (
        <div className="toast toast--install">
          <Download size={18} className="toast__icon" aria-hidden="true" />
          <span className="toast__text">
            <span className="toast__title">Install Sporty app</span>
            <span className="toast__body">Add to your home screen for live score alerts.</span>
          </span>
          <button
            type="button"
            className="toast__action"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onInstallApp();
            }}
          >
            Install
          </button>
          <button
            type="button"
            className="icon-button icon-button--small toast__close"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              dismissInstallToast();
            }}
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
