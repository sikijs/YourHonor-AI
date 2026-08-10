'use client';

import { useState, useEffect, useMemo } from 'react';
import { User, Doctrine, DoctrineMapResponse, api } from '@/lib/api';
import { TimelineCase } from '@/lib/doctrine';
import DoctrineCardList from '@/components/DoctrineCardList';
import DoctrineDetail from '@/components/DoctrineDetail';
import DoctrineTimeline from '@/components/DoctrineTimeline';

export default function DoctrineExplorerView({
  user,
  onNavigate,
}: {
  user: User | null;
  onNavigate: (view: string, initialQuery?: string) => void;
}) {
  const [data, setData] = useState<DoctrineMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subject, setSubject] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState(false);

  useEffect(() => {
    api.doctrine
      .map()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const subjects = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.doctrines.map((d) => d.subject))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.doctrines.filter((d) => {
      if (subject && d.subject !== subject) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.cases.some((c) => c.name.toLowerCase().includes(q))
      );
    });
  }, [data, subject, search]);

  const timelineCases = useMemo(() => {
    const byName = new Map<string, TimelineCase>();
    for (const d of filtered) {
      for (const c of d.cases) {
        const key = c.name.toLowerCase();
        const existing = byName.get(key);
        if (existing) {
          existing.subjects = Array.from(new Set([...existing.subjects, d.subject]));
        } else {
          byName.set(key, { ...c, subjects: [d.subject] });
        }
      }
    }
    return Array.from(byName.values());
  }, [filtered]);

  const selected = selectedId
    ? (data?.doctrines.find((d) => d.id === selectedId) || null)
    : null;

  function handleBrief(caseName: string) {
    if (user) {
      onNavigate('briefs', caseName);
    } else {
      onNavigate('auth');
    }
  }

  function renderBody() {
    if (selected) {
      return (
        <DoctrineDetail
          doctrine={selected}
          user={user}
          onBack={() => setSelectedId(null)}
          onBrief={handleBrief}
        />
      );
    }
    return timeline ? (
      <DoctrineTimeline cases={timelineCases} user={user} onBrief={handleBrief} />
    ) : (
      <DoctrineCardList doctrines={filtered} onOpen={setSelectedId} />
    );
  }

  return (
    <div>
      <h2>Doctrine Explorer</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
        Explore the landmark cases that define American law, organized by legal doctrine. Each doctrine card links to its cases — and every case can generate a full case brief.
      </p>
      <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Curated educational map of {data ? data.doctrines.length : '…'} doctrines across {data ? subjects.length : '…'} subjects. Timelines reflect decision years. Not legal advice.
      </p>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container"><span className="spinner" /><p>Loading doctrine map...</p></div>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {data && !error && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedId(null); }}
              placeholder="Search doctrines or cases (e.g. privacy, Palsgraf)..."
              style={{ flex: 1, minWidth: '220px', marginBottom: 0 }}
              disabled={!!selected}
            />
            <button
              className={timeline ? 'btn btn-primary' : 'btn btn-outline'}
              onClick={() => { setTimeline(true); setSelectedId(null); }}
              style={{ whiteSpace: 'nowrap' }}
            >
              Timeline
            </button>
            <button
              className={!timeline ? 'btn btn-primary' : 'btn btn-outline'}
              onClick={() => { setTimeline(false); setSelectedId(null); }}
              style={{ whiteSpace: 'nowrap' }}
            >
              Cards
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              className={subject === '' ? 'btn btn-primary' : 'btn btn-outline'}
              onClick={() => { setSubject(''); setSelectedId(null); }}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            >
              All Subjects
            </button>
            {subjects.map((s) => (
              <button
                key={s}
                className={subject === s ? 'btn btn-primary' : 'btn btn-outline'}
                onClick={() => { setSubject(s); setSelectedId(null); }}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
              >
                {s}
              </button>
            ))}
          </div>

          {renderBody()}
        </>
      )}
    </div>
  );
}
