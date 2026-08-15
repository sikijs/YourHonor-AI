'use client';

import { useState, useEffect } from 'react';
import { User, CaseBriefResponse, LegalSummaryResponse, ArgumentExtractionResponse, MemorandumResponse } from '@/lib/api';
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
  const [sharedQuery, setSharedQuery] = useState(initialQuery ?? '');
  const [results, setResults] = useState<{
    brief: CaseBriefResponse | null;
    summary: LegalSummaryResponse | null;
    arguments: ArgumentExtractionResponse | null;
    memorandum: MemorandumResponse | null;
  }>({ brief: null, summary: null, arguments: null, memorandum: null });

  // Sync when the parent routes in from the URL hash (Back/Forward,
  // refresh, or a shared #drafting?tab=... link).
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialQuery !== undefined) setSharedQuery(initialQuery);
  }, [initialQuery]);

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
      {tab === 'brief' && (
        <CaseBriefView
          user={user}
          onError={onError}
          query={sharedQuery}
          onQueryChange={setSharedQuery}
          sharedResult={results.brief}
          onSharedResultChange={(r) => setResults((prev) => ({ ...prev, brief: r }))}
        />
      )}
      {tab === 'summary' && (
        <SummaryView
          user={user}
          onError={onError}
          query={sharedQuery}
          onQueryChange={setSharedQuery}
          sharedResult={results.summary}
          onSharedResultChange={(r) => setResults((prev) => ({ ...prev, summary: r }))}
        />
      )}
      {tab === 'arguments' && (
        <ArgumentsView
          user={user}
          onError={onError}
          query={sharedQuery}
          onQueryChange={setSharedQuery}
          sharedResult={results.arguments}
          onSharedResultChange={(r) => setResults((prev) => ({ ...prev, arguments: r }))}
        />
      )}
      {tab === 'memorandum' && (
        <MemorandumView
          user={user}
          onError={onError}
          query={sharedQuery}
          onQueryChange={setSharedQuery}
          sharedResult={results.memorandum}
          onSharedResultChange={(r) => setResults((prev) => ({ ...prev, memorandum: r }))}
        />
      )}
    </div>
  );
}