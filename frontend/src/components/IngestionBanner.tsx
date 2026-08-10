'use client';

import { useEffect, useState } from 'react';
import { api, IngestionStatus } from '@/lib/api';

const POLL_INTERVAL_MS = 10_000;

export default function IngestionBanner() {
  const [status, setStatus] = useState<IngestionStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const s = await api.rag.ingestionStatus();
        if (!cancelled) setStatus(s);
      } catch {
        // Backend unreachable (e.g. still booting) — stay quiet and retry.
      }
    }
    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (
    dismissed ||
    !status ||
    !status.running ||
    status.total === 0 ||
    status.done >= status.total
  ) {
    return null;
  }

  const pct = Math.round((status.done / status.total) * 100);

  return (
    <div
      role="status"
      style={{
        background: 'var(--accent-yellow)',
        color: 'var(--dark-navy)',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      <span>
        Loading landmark cases… {status.done} of {status.total} ({pct}%)
        {status.current ? ` — ${status.current}` : ''}
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--dark-navy)',
          fontSize: '1rem',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        ×
      </button>
    </div>
  );
}
