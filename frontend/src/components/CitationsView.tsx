'use client';

import { useState } from 'react';
import { User } from '@/lib/api';
import { CitationsTabName } from '@/lib/hashRouter';
import CitationMapView from '@/components/CitationMapView';
import BluebookView from '@/components/BluebookView';
import CitationDrillView from '@/components/CitationDrillView';

// Tab wrapper for the Citations nav link. page.tsx owns the tab via hash
// routing (#citations?tab=drill) so a refresh or bookmark lands back on it.
export default function CitationsView({
  user,
  onError,
  initialTab,
  onTabChange,
}: {
  user: User;
  onError: (err: string) => void;
  initialTab?: CitationsTabName;
  onTabChange?: (tab: CitationsTabName) => void;
}) {
  const [tab, setTab] = useState<CitationsTabName>(initialTab ?? 'map');

  function selectTab(next: CitationsTabName) {
    setTab(next);
    onTabChange?.(next);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button
          className={tab === 'map' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('map')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Citation Map
        </button>
        <button
          className={tab === 'bluebook' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('bluebook')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Bluebook Formatter
        </button>
        <button
          className={tab === 'drill' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('drill')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Daily Drill
        </button>
      </div>
      {tab === 'map' && <CitationMapView user={user} onError={onError} />}
      {tab === 'bluebook' && <BluebookView user={user} onError={onError} />}
      {tab === 'drill' && (
        <CitationDrillView onError={onError} onOpenFormatter={() => selectTab('bluebook')} />
      )}
    </div>
  );
}
