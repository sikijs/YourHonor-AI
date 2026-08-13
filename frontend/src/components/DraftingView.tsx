'use client';

import { useState } from 'react';
import { User } from '@/lib/api';
import CaseBriefView from '@/components/CaseBriefView';
import SummaryView from '@/components/SummaryView';
import ArgumentsView from '@/components/ArgumentsView';
import MemorandumView from '@/components/MemorandumView';

type DraftingTab = 'brief' | 'summary' | 'arguments' | 'memorandum';

export default function DraftingView({
  user,
  onError,
  initialQuery,
}: {
  user: User;
  onError: (err: string) => void;
  initialQuery?: string;
}) {
  const [tab, setTab] = useState<DraftingTab>('brief');

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button
          className={tab === 'brief' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('brief')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Case Brief
        </button>
        <button
          className={tab === 'summary' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('summary')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Summary
        </button>
        <button
          className={tab === 'arguments' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('arguments')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Arguments
        </button>
        <button
          className={tab === 'memorandum' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('memorandum')}
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