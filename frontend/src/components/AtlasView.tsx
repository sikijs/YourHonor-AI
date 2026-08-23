'use client';

import { useState } from 'react';
import { User } from '@/lib/api';
import { AtlasTabName } from '@/lib/hashRouter';
import DoctrineExplorerView from '@/components/DoctrineExplorerView';
import LandmarkGuideSection from '@/components/LandmarkGuideSection';

// Tab wrapper for the Case Law Atlas nav link: the interactive doctrine map
// plus a reference guide to all built-in landmark cases. Same pattern as
// DraftingView/CitationsView — page.tsx owns the tab via hash routing so a
// refresh or bookmark on #doctrines?tab=guide lands back on the guide.
export default function AtlasView({
  user,
  onNavigate,
  initialTab,
  onTabChange,
}: {
  user: User | null;
  onNavigate: (view: string, initialQuery?: string) => void;
  initialTab?: AtlasTabName;
  onTabChange?: (tab: AtlasTabName) => void;
}) {
  const [tab, setTab] = useState<AtlasTabName>(initialTab ?? 'map');

  function selectTab(next: AtlasTabName) {
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
          Doctrine Map
        </button>
        <button
          className={tab === 'guide' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => selectTab('guide')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Case Guide
        </button>
      </div>
      {tab === 'map' ? (
        <DoctrineExplorerView user={user} onNavigate={onNavigate} />
      ) : (
        <LandmarkGuideSection />
      )}
    </div>
  );
}
