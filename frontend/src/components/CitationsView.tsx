'use client';

import { useState } from 'react';
import { User } from '@/lib/api';
import CitationMapView from '@/components/CitationMapView';
import BluebookView from '@/components/BluebookView';

type CitationsTab = 'map' | 'bluebook';

export default function CitationsView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [tab, setTab] = useState<CitationsTab>('map');

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <button
          className={tab === 'map' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('map')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Citation Map
        </button>
        <button
          className={tab === 'bluebook' ? 'btn btn-primary' : 'btn btn-outline'}
          onClick={() => setTab('bluebook')}
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.9rem' }}
        >
          Bluebook Formatter
        </button>
      </div>
      {tab === 'map' ? (
        <CitationMapView user={user} onError={onError} />
      ) : (
        <BluebookView user={user} onError={onError} />
      )}
    </div>
  );
}