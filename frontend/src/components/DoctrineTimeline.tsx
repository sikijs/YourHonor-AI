'use client';

import { User } from '@/lib/api';
import { TIMELINE_ERAS, TimelineCase, subjectColor } from '@/lib/doctrine';

export default function DoctrineTimeline({
  cases,
  user,
  onBrief,
}: {
  cases: TimelineCase[];
  user: User | null;
  onBrief: (caseName: string) => void;
}) {
  const sorted = [...cases].sort((a, b) => a.year - b.year);
  const eras = TIMELINE_ERAS.filter((era) =>
    sorted.some((c) => c.year >= era.min && c.year <= era.max)
  );

  if (sorted.length === 0) {
    return (
      <p style={{ color: 'var(--gray-text)', textAlign: 'center', padding: '2rem' }}>
        No cases match your filters.
      </p>
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
        {sorted.length} landmark case{sorted.length !== 1 ? 's' : ''} · dots are colored by subject
      </p>
      <div style={{ position: 'relative', paddingLeft: '1.75rem', borderLeft: '3px solid var(--blue-primary)' }}>
        {eras.map((era) => {
          const inEra = sorted.filter((c) => c.year >= era.min && c.year <= era.max);
          return (
            <div key={era.label} style={{ marginBottom: '1.5rem' }}>
              <h4 style={{
                margin: '0 0 0.75rem 0',
                color: 'var(--dark-navy)',
                fontSize: '0.95rem',
                borderBottom: '1px solid #e0e6ed',
                paddingBottom: '0.3rem',
              }}>
                {era.label} <span style={{ color: 'var(--gray-text)', fontWeight: 400 }}>({inEra.length})</span>
              </h4>
              {inEra.map((c) => (
                <div key={c.name} style={{ marginBottom: '0.75rem', position: 'relative' }}>
                  <span style={{
                    position: 'absolute',
                    left: '-2.35rem',
                    top: '1.1rem',
                    width: '0.85rem',
                    height: '0.85rem',
                    borderRadius: '50%',
                    background: subjectColor(c.subjects[0] || ''),
                    border: '2px solid #fff',
                    boxShadow: '0 0 0 1px #c6d2de',
                  }} />
                  <div className="card" style={{ padding: '0.75rem 1rem', borderLeft: '4px solid ' + subjectColor(c.subjects[0] || '') }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 700, color: 'var(--dark-navy)', fontSize: '0.95rem' }}>
                          {c.year} &nbsp;{c.name}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginLeft: '0.5rem' }}>
                          {c.citation}
                        </span>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', whiteSpace: 'nowrap' }}
                        onClick={() => onBrief(c.name)}
                      >
                        Case Brief
                      </button>
                    </div>
                    <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.82rem', color: '#555', lineHeight: 1.5 }}>
                      {c.holding}
                    </p>
                    {c.subjects.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.45rem' }}>
                        {c.subjects.map((s) => (
                          <span key={s} style={{
                            fontSize: '0.7rem',
                            color: subjectColor(s),
                            background: subjectColor(s) + '1a',
                            padding: '0.1rem 0.5rem',
                            borderRadius: '9px',
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
