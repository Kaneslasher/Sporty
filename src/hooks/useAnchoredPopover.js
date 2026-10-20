import { useCallback, useRef } from 'react';

/**
 * Positions a popover="auto" panel under its trigger button using the trigger's bounding box.
 * CSS anchor positioning is not broadly available yet, so this is the manual fallback the
 * platform guidance recommends. align: 'start' (left edges line up) or 'end' (right edges line up).
 */
export function useAnchoredPopover({ align = 'start', maxWidth = 340, gap = 8 } = {}) {
  const triggerRef = useRef(null);
  const panelNodeRef = useRef(null);

  const positionPanel = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelNodeRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const gutter = 12;
    const width = Math.min(maxWidth, window.innerWidth - gutter * 2);
    const preferredLeft = align === 'end' ? rect.right - width : rect.left;
    const left = Math.max(gutter, Math.min(preferredLeft, window.innerWidth - width - gutter));
    const right = Math.max(gutter, window.innerWidth - rect.right);
    panel.style.setProperty('--panel-top', `${rect.bottom + gap}px`);
    panel.style.setProperty('--panel-left', `${left}px`);
    panel.style.setProperty('--panel-right', `${right}px`);
    panel.style.setProperty('--panel-width', `${width}px`);
  }, [align, maxWidth, gap]);

  const handleToggle = useCallback(
    (event) => {
      if (event.newState === 'open') {
        positionPanel();
        window.addEventListener('resize', positionPanel);
      } else {
        window.removeEventListener('resize', positionPanel);
      }
    },
    [positionPanel]
  );

  const panelRef = useCallback(
    (node) => {
      if (panelNodeRef.current) {
        panelNodeRef.current.removeEventListener('beforetoggle', handleToggle);
        window.removeEventListener('resize', positionPanel);
      }
      panelNodeRef.current = node;
      if (node) {
        node.addEventListener('beforetoggle', handleToggle);
      }
    },
    [handleToggle, positionPanel]
  );

  const closePanel = useCallback(() => {
    if (panelNodeRef.current?.matches(':popover-open')) panelNodeRef.current.hidePopover();
  }, []);

  return { triggerRef, panelRef, closePanel };
}
