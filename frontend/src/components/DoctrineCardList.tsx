'use client';

import { Doctrine } from '@/lib/api';
import { subjectColor } from '@/lib/doctrine';

export default function DoctrineCardList({ doctrines, onOpen }: { doctrines: Doctrine[]; onOpen: (id: string) => void }) {
  if (doctrines.length === 0) {
    return (
      <p style={{ color: 'var(--gray-text)', textAlign: 'center', padding: '2rem' }}>
        No doctrines match your filters. Try a different subject or search term.
      </p>
    );
  }

  return (
    <div className="features" style={{ marginTop: '1rem' }}>
      {doctrines.map((d) => {
        const years = d.cases.map((c) => c.year);
        const range = years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : String(years[0]);
        return (
          <div
            key={d.id}
            className="card feature-card"
            onClick={() => onOpen(d.id)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
          >
            <span style={{
              alignSelf: 'flex-start',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#fff',
              background: subjectColor(d.subject),
              padding: '0.15rem 0.6rem',
              borderRadius: '10px',
              marginBottom: '0.5rem',
            }}>
              {d.subject}
            </span>
            <h3 style={{ marginBottom: '0.4rem', fontSize: '1.05rem' }}>{d.name}</h3>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: '#444', flex: 1 }}>{d.description}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginBottom: '0.5rem' }}>
              {d.cases.length} case{d.cases.length !== 1 ? 's' : ''} · {range}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {d.cases.slice(0, 4).map((c) => (
                <span key={c.name} style={{
                  fontSize: '0.72rem',
                  background: '#f0f4f8',
                  border: '1px solid #dde6ee',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  color: '#37516e',
                }}>
                  {c.year} {c.name.length > 28 ? c.name.slice(0, 27) + '…' : c.name}
                </span>
              ))}
              {d.cases.length > 4 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--blue-primary)', padding: '0.15rem 0.3rem' }}>
                  +{d.cases.length - 4} more
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
