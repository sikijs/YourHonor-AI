'use client';

import { SourceDocument } from '@/lib/api';
import { getBadge } from '@/lib/sources';

export default function SourcePanel({ sources, sourcesConsulted }: {
  sources: SourceDocument[];
  sourcesConsulted?: string[];
}) {
  const hasSources = sources && sources.length > 0;
  const hasConsulted = sourcesConsulted && sourcesConsulted.length > 0;

  if (!hasSources && !hasConsulted) return null;

  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <h3 style={{ color: 'var(--blue-primary)', marginBottom: '0.75rem' }}>
        Sources Consulted
        <span style={{ fontSize: '0.75rem', color: 'var(--gray-text)', fontWeight: 'normal', marginLeft: '0.5rem' }}>
          — Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </h3>

      {hasSources && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: hasConsulted ? '0.75rem' : 0 }}>
          {sources.map((s, i) => {
            const badge = getBadge(s.source_type);
            return (
              <div key={i} style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: 'var(--dark-navy)' }}>{s.title}</span>
                  <span style={{ background: badge.bg, color: badge.color, padding: '0.1rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 600 }}>
                    {badge.label}
                  </span>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--blue-primary)', textDecoration: 'none' }}>
                      View on CourtListener ↗
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem', marginTop: '0.15rem', color: 'var(--gray-text)', fontSize: '0.78rem' }}>
                  {s.citation && <span>{s.citation}</span>}
                  {s.court && <span>{s.court}</span>}
                  {s.date_filed && <span>{s.date_filed}</span>}
                  {s.relevance_score != null && (
                    <span>Score: {s.relevance_score.toFixed(3)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasConsulted && (
        <>
          {hasSources && <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '0.5rem 0' }} />}
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
            {(sourcesConsulted ?? []).map((item, i) => (
              <li key={i}>
                <a href={`https://www.courtlistener.com/?q=${encodeURIComponent(item)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-primary)', textDecoration: 'none' }}>
                  {item} ↗
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
