'use client';

import { useState, useEffect } from 'react';
import { User } from '@/lib/api';
import type { DraftingTabName } from '@/lib/hashRouter';
import CaseBriefView from '@/components/CaseBriefView';
import SummaryView from '@/components/SummaryView';
import ArgumentsView from '@/components/ArgumentsView';
import MemorandumView from '@/components/MemorandumView';

export default function DraftingView({
  user,
  onError,
  initialTab = 'brief',
  initialQuery,
  onTabChange,
}: {
  user: User;
  onError: (err: string) => void;
  initialTab?: DraftingTabName;
  initialQuery?: string;
  onTabChange?: (tab: DraftingTabName) => void;
}) {
  const [tab, setTab] = useState<DraftingTabName>(initialTab);

  // Sync when the parent routes in from the URL hash (Back/Forward,
  // refresh, or a shared #drafting?tab=... link).
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  function selectTab(next: DraftingTabName) {
    setTab(next);
    onTabChange?.(next);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button
          className={tab === 'brief' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('brief')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Case Brief
        </button>
        <button
          className={tab === 'summary' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('summary')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Summary
        </button>
        <button
          className={tab === 'arguments' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('arguments')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Arguments
        </button>
        <button
          className={tab === 'memorandum' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('memorandum')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Memorandum
        </button>
      </div>
      {tab === 'brief' && <CaseBriefView user={user} onError={onError} initialQuery={initialQuery} />}
      {tab === 'summary' && <SummaryView user={user} onError={onError} />}
      {tab === 'arguments' && <ArgumentsView user={user} onError={onError} />}
      {tab === 'memorandum' && <MemorandumView user={user} onError={onError} />}
    </div>
  );
}