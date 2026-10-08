import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './HelpTip.module.css';

export interface HelpTipProps {
  /** Explanation shown inside the bubble (Spanish UI copy). */
  text: string;
  /** Accessible name of the trigger, usually the card label without the emoji. */
  label?: string;
}

/** Estimated bubble width used to clamp it inside the viewport (matches CSS max-width). */
const POPUP_WIDTH = 260;
const GAP = 8;
const MARGIN = 8;

/**
 * Tiny ⓘ affix with an explanatory bubble.
 *
 * - Desktop: opens on hover / keyboard focus.
 * - Mobile: tap toggles; tapping outside (or the icon again) closes.
 * - The bubble is portaled to `document.body` and positioned with `position: fixed`,
 *   so card `overflow` and `backdrop-filter` stacking contexts can't clip it.
 */
const HelpTip: React.FC<HelpTipProps> = ({ text, label }) => {
  const reactId = useId();
  const popupId = `helptip-${reactId.replace(/:/g, '')}`;

  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; above: boolean } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  /** True when the user explicitly toggled it (tap/click): hover must not auto-close it. */
  const pinnedRef = useRef(false);

  const reposition = useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth || 1024;
    const vh = window.innerHeight || 768;
    const left = Math.min(
      Math.max(rect.left, MARGIN),
      Math.max(MARGIN, vw - POPUP_WIDTH - MARGIN),
    );
    const belowTop = rect.bottom + GAP;
    const above = rect.top > vh / 2 && belowTop + 120 > vh;
    setCoords({ top: above ? rect.top - GAP : belowTop, left, above });
  }, []);

  const show = useCallback(() => {
    reposition();
    setOpen(true);
  }, [reposition]);

  const hide = useCallback(() => {
    pinnedRef.current = false;
    setOpen(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!pinnedRef.current) show();
  }, [show]);

  const handleMouseLeave = useCallback(() => {
    if (!pinnedRef.current) hide();
  }, [hide]);

  const handleClick = useCallback(() => {
    if (pinnedRef.current) {
      hide();
    } else {
      pinnedRef.current = true;
      show();
    }
  }, [hide, show]);

  /* Close on outside press / Escape. */
  useEffect(() => {
    if (!open) return;
    const onOutsidePress = (event: Event) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      hide();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('mousedown', onOutsidePress);
    document.addEventListener('touchstart', onOutsidePress);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onOutsidePress);
      document.removeEventListener('touchstart', onOutsidePress);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, hide]);

  /* Keep the bubble anchored while the page scrolls or resizes. */
  useEffect(() => {
    if (!open) return;
    const onReflow = () => reposition();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, reposition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label ? `Qué significa ${label}` : 'Más información'}
        aria-expanded={open}
        aria-describedby={open ? popupId : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={hide}
        onClick={handleClick}
      >
        ⓘ
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={popupRef}
              id={popupId}
              role="tooltip"
              className={styles.popup}
              style={{
                top: coords.top,
                left: coords.left,
                transform: coords.above ? 'translateY(-100%)' : undefined,
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default HelpTip;
