'use client';

import { Doctrine, User } from '@/lib/api';
import { subjectColor } from '@/lib/doctrine';

export default function DoctrineDetail({
  doctrine,
  user,
  onBack,
  onBrief,
}: {
  doctrine: Doctrine;
  user: User | null;
  onBack: () => void;
  onBrief: (caseName: string) => void;
}) {
  const sorted = [...doctrine.cases].sort((a, b) => a.year - b.year);
  return (
    <div>
      <button className="btn btn-outline" onClick={onBack} style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        &larr; All Doctrines
      </button>

      <div className="card" style={{ background: '#f8faff', borderLeft: '4px solid var(--blue-primary)', marginBottom: '1rem' }}>
        <span style={{
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#fff',
          background: subjectColor(doctrine.subject),
          padding: '0.15rem 0.6rem',
          borderRadius: '10px',
        }}>
          {doctrine.subject}
        </span>
        <h2 style={{ margin: '0.5rem 0' }}>{doctrine.name}</h2>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#444' }}>{doctrine.description}</p>
      </div>

      {sorted.map((c, idx) => (
        <div key={c.name} className="card" style={{ marginBottom: '0.75rem', borderLeft: '4px solid ' + subjectColor(doctrine.subject) }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: 'var(--dark-navy)',
              background: '#f0f4f8',
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              marginTop: '0.1rem',
            }}>
              {c.year}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.15rem 0', fontSize: '1.05rem' }}>{c.name}</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--gray-text)' }}>{c.citation}</p>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', whiteSpace: 'nowrap' }}
                  onClick={() => onBrief(c.name)}
                >
                  Generate Case Brief
                </button>
              </div>
              <p style={{ margin: '0.6rem 0 0 0', fontSize: '0.9rem', lineHeight: 1.55, color: '#333' }}>
                {c.holding}
              </p>
            </div>
          </div>
        </div>
      ))}

      {!user && (
        <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginTop: '0.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#856404' }}>
            Sign in to generate case briefs and save your work.
          </p>
        </div>
      )}
    </div>
  );
}
