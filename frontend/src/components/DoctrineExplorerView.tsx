'use client';

import { useState, useEffect, useMemo } from 'react';
import { User, Doctrine, DoctrineMapResponse, api } from '@/lib/api';
import { TimelineCase } from '@/lib/doctrine';
import DoctrineCardList from '@/components/DoctrineCardList';
import DoctrineDetail from '@/components/DoctrineDetail';
import DoctrineTimeline from '@/components/DoctrineTimeline';
import CompareView from '@/components/CompareView';

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
  const [compareCases, setCompareCases] = useState<string[] | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

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

  function togglePick(name: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function enterPickMode() {
    setPickMode(true);
    setPicked(new Set());
    setSelectedId(null);
    setCompareCases(null);
  }

  function renderBody() {
    if (compareCases) {
      return (
        <CompareView
          caseNames={compareCases}
          onError={setError}
          onBack={() => setCompareCases(null)}
        />
      );
    }
    if (selected) {
      return (
        <DoctrineDetail
          doctrine={selected}
          user={user}
          onBack={() => setSelectedId(null)}
          onBrief={handleBrief}
          onCompare={(names) => setCompareCases(names)}
        />
      );
    }
    if (pickMode) {
      return (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Compare Any Two Landmark Cases</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
            Select two cases from the full curated library of 70, then compare. Use the search box above to narrow the list.
          </p>
          <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', padding: '0.5rem' }}>
            {timelineCases
              .filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()))
              .map((c) => (
                <label key={c.name} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', padding: '0.4rem 0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={picked.has(c.name)}
                    onChange={() => togglePick(c.name)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                  />
                  <span>{c.name}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--gray-text)' }}>{c.year} &middot; {c.citation}</span>
                </label>
              ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
            <button
              className="btn btn-primary"
              disabled={picked.size !== 2}
              onClick={() => setCompareCases(Array.from(picked))}
            >
              Compare ({picked.size}/2)
            </button>
            <button className="btn btn-outline" onClick={() => setPickMode(false)}>
              Cancel
            </button>
          </div>
        </div>
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
              onClick={() => { setTimeline(false); setSelectedId(null); setPickMode(false); }}
              style={{ whiteSpace: 'nowrap' }}
            >
              Cards
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { enterPickMode(); setTimeline(false); }}
              style={{ whiteSpace: 'nowrap' }}
            >
              Compare Cases
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
