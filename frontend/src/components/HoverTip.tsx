'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';

// Shared copy so every due-count badge explains itself identically.
export function dueCardsTip(n: number): string {
  return (
    `${n} card${n === 1 ? '' : 's'} you flagged are due again today. ` +
    `Right answers wait longer to appear once again; wrong ones come back soon.`
  );
}

/**
 * Shows a dark explanatory bubble under the wrapped content while active.
 *
 * Two modes:
 * - Uncontrolled (default): reveals on hover/focus of the wrapped content.
 *   Use when the wrapped element is itself focusable/hoverable.
 * - Controlled (`show` prop): the caller wires hover/focus handlers on a
 *   PARENT interactive element (e.g. the tab button containing this badge)
 *   and passes visibility down — focus events targeting the parent never
 *   reach a child wrapper, so self-management can't see them.
 *
 * The bubble uses `position: fixed` anchored under the trigger because both
 * call sites sit inside `overflow: hidden` containers.
 */
export default function HoverTip({ tip, children, show }: { tip: string; children: ReactNode; show?: boolean }) {
  const [selfOpen, setSelfOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const open = show ?? selfOpen;

  function measure() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      // Center under the trigger, clamped so the bubble stays on-screen.
      const center = rect.left + rect.width / 2;
      const halfWidth = 150;
      setAnchor({
        top: rect.bottom + 8,
        left: Math.min(Math.max(center, halfWidth), window.innerWidth - halfWidth),
      });
    }
  }

  useEffect(() => {
    if (open) measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlers =
    show === undefined
      ? {
          onMouseEnter: () => setSelfOpen(true),
          onMouseLeave: () => setSelfOpen(false),
          onFocus: () => setSelfOpen(true),
          onBlur: () => setSelfOpen(false),
        }
      : {};

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }} {...handlers}>
      {children}
      {open && anchor && (
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: anchor.top,
            left: anchor.left,
            transform: 'translateX(-50%)',
            width: 'max-content',
            maxWidth: '300px',
            background: 'var(--dark-navy)',
            color: '#fff',
            fontSize: '0.78rem',
            lineHeight: 1.45,
            padding: '0.55rem 0.75rem',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
            zIndex: 30,
            pointerEvents: 'none',
            textAlign: 'left',
          }}
        >
          {tip}
        </span>
      )}
    </span>
  );
}
