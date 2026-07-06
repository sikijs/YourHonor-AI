'use client';

import { SourceDocument } from '@/lib/api';

const BADGE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  courtlistener: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  courtlistener_ingested: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  rag: { bg: '#e8f8e8', color: '#2e7d32', label: 'RAG' },
  user_upload: { bg: '#fff3e0', color: '#e65100', label: 'Uploaded' },
  web: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Web' },
  seed: { bg: '#e0f7fa', color: '#00838f', label: 'Seed' },
  none: { bg: '#f5f5f5', color: '#757575', label: 'None' },
};

function getBadge(sourceType: string) {
  return BADGE_COLORS[sourceType] || { bg: '#f5f5f5', color: '#757575', label: sourceType };
}

export default function SourcePanel({ sources }: { sources: SourceDocument[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--blue-primary)' }}>
      <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--dark-navy)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Sources
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
    </div>
  );
}
