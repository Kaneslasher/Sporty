import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD = 58;
const MAX_PULL = 96;

/**
 * Lightweight touch pull-to-refresh gesture for mobile browsers and standalone PWAs.
 * Only activates when scrolled to the very top of the page and no dialog/popover is open.
 */
export function usePullToRefresh(onRefresh, refreshing = false) {
  const [pullDistance, setPullDistance] = useState(0);
  const startRef = useRef(null);
  const distanceRef = useRef(0);

  useEffect(() => {
    const canStartPull = () => {
      if (window.scrollY > 2) return false;
      if (document.querySelector('dialog[open], :popover-open')) return false;
      return true;
    };

    const handleTouchStart = (event) => {
      if (refreshing || !canStartPull()) {
        startRef.current = null;
        return;
      }
      const touch = event.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY, locked: null };
    };

    const handleTouchMove = (event) => {
      const start = startRef.current;
      if (!start || refreshing) return;
      if (window.scrollY > 2) {
        startRef.current = null;
        distanceRef.current = 0;
        setPullDistance(0);
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (start.locked === null && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
        /* Ignore horizontal swipes (e.g. Live now carousel) or upward scrolls */
        start.locked = deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2 ? 'vertical' : 'ignore';
      }

      if (start.locked !== 'vertical' || deltaY <= 0) {
        if (distanceRef.current > 0) {
          distanceRef.current = 0;
          setPullDistance(0);
        }
        return;
      }

      const damped = Math.min(MAX_PULL, Math.round(deltaY * 0.45));
      distanceRef.current = damped;
      setPullDistance(damped);
    };

    const finishPull = () => {
      const distance = distanceRef.current;
      startRef.current = null;
      distanceRef.current = 0;
      setPullDistance(0);
      if (distance >= PULL_THRESHOLD && !refreshing) {
        onRefresh();
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', finishPull, { passive: true });
    window.addEventListener('touchcancel', finishPull, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', finishPull);
      window.removeEventListener('touchcancel', finishPull);
    };
  }, [onRefresh, refreshing]);

  return {
    pullDistance,
    readyToRefresh: pullDistance >= PULL_THRESHOLD
  };
}
