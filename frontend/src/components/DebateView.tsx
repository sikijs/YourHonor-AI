'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Document, DebateResponse, SourceDocument, api } from '@/lib/api';
import { printContent, debateHtml, resultToPlainText } from '@/lib/print';

const BADGE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  courtlistener: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  courtlistener_ingested: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  rag: { bg: '#e8f8e8', color: '#2e7d32', label: 'RAG' },
  user_upload: { bg: '#fff3e0', color: '#e65100', label: 'Uploaded' },
  web: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Web' },
  seed: { bg: '#e0f7fa', color: '#00838f', label: 'Seed' },
  none: { bg: '#f5f5f5', color: '#757575', label: 'None' },
};

export default function DebateView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DebateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const cancelRef = useRef<AbortController | null>(null);
  const cancellingRef = useRef(false);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    cancellingRef.current = false;
    setLoading(true);
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const debate = await api.legal.debate(query, selectedDocId, cancelRef.current.signal);
      setResult(debate);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (!cancellingRef.current) onError('Request timed out. Legal analysis can take up to 2 minutes. Please try again.');
        return;
      }
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function strengthColor(strength: string): string {
    switch (strength) {
      case 'strong': return '#2e7d32';
      case 'moderate': return '#e65100';
      case 'weak': return '#c62828';
      default: return 'var(--gray-text)';
    }
  }

  function predictedWinnerLabel(winner: string): string {
    switch (winner) {
      case 'supporting': return 'Supporting Arguments (Your Position)';
      case 'opposing': return 'Opposing Arguments';
      case 'balanced': return 'Balanced — Neither Side Clearly Prevails';
      default: return winner;
    }
  }

  return (
    <div>
      <h2>Legal Debate Analysis</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        Legal debate analysis generates structured arguments for and against a legal position. Testing both sides of an issue sharpens your reasoning and prepares you for advocacy and exams.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a legal position or argument to generate structured pro/con analysis with counter-rebuttals.
      </p>
      <form onSubmit={handleAnalyze} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. A non-compete clause should be enforced because it protects trade secrets"
            disabled={loading}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem' }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>Include uploaded document:</label>
            <select
              value={selectedDocId ?? ''}
              onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={loading}
              style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
            >
              <option value="">Search all legal sources (default)</option>
              {documents.filter(d => d.file_path).map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container"><span className="spinner" /><p>Retrieving sources and analyzing arguments... ({elapsed}s)</p></div>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancellingRef.current = true; cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{result.topic}</h2>
            <div style={{ background: '#e3f2fd', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.9rem', margin: 0, color: '#1565c0' }}>
                <strong>Your Position:</strong> {result.user_position}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ color: 'var(--blue-primary)', marginBottom: '0.75rem' }}>Supporting Arguments</h3>
              {result.supporting_arguments.map((arg, i) => (
                <div key={i} className="card" style={{ marginBottom: '0.75rem', borderLeft: `4px solid ${strengthColor(arg.strength)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--dark-navy)' }}>{arg.title}</h4>
                    <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: '#e8f5e9', color: strengthColor(arg.strength), fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {arg.strength}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: '0.25rem 0' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  {arg.authorities.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--blue-primary)', margin: '0.25rem 0' }}>
                      <strong>Authorities:</strong> {arg.authorities.join(', ')}
                    </p>
                  )}
                  {arg.counter_rebuttal && (
                    <div style={{ marginTop: '0.25rem', padding: '0.4rem', background: '#fff3e0', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid #ffe0b2' }}>
                      <strong style={{ color: '#e65100' }}>Counter-Rebuttal:</strong> {arg.counter_rebuttal}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ color: 'var(--purple-secondary)', marginBottom: '0.75rem' }}>Opposing Arguments</h3>
              {result.opposing_arguments.map((arg, i) => (
                <div key={i} className="card" style={{ marginBottom: '0.75rem', borderLeft: `4px solid ${strengthColor(arg.strength)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--dark-navy)' }}>{arg.title}</h4>
                    <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: '#ffebee', color: strengthColor(arg.strength), fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {arg.strength}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: '0.25rem 0' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  {arg.authorities.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--blue-primary)', margin: '0.25rem 0' }}>
                      <strong>Authorities:</strong> {arg.authorities.join(', ')}
                    </p>
                  )}
                  {arg.counter_rebuttal && (
                    <div style={{ marginTop: '0.25rem', padding: '0.4rem', background: '#e8f5e9', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid #c8e6c9' }}>
                      <strong style={{ color: 'var(--blue-primary)' }}>Counter-Rebuttal:</strong> {arg.counter_rebuttal}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--dark-navy)' }}>Analysis</h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Predicted Winner: </span>
              <span style={{ fontSize: '0.85rem', padding: '0.15rem 0.5rem', borderRadius: '3px', background: result.predicted_winner === 'supporting' ? '#e8f5e9' : result.predicted_winner === 'opposing' ? '#ffebee' : '#fff3e0', color: result.predicted_winner === 'supporting' ? '#2e7d32' : result.predicted_winner === 'opposing' ? '#c62828' : '#e65100', fontWeight: 600 }}>
                {predictedWinnerLabel(result.predicted_winner)}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: '0.5rem 0' }}><strong>Rationale:</strong> {result.rationale}</p>
            {result.key_doctrines_statutes.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Key Doctrines & Statutes:</p>
                <ul style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.25rem', color: 'var(--gray-text)' }}>
                  {result.key_doctrines_statutes.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {result.practice_tips.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f3e5f5', borderRadius: '6px', border: '1px solid #ce93d8' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#7b1fa2', marginBottom: '0.25rem' }}>Practice Tips</p>
                <ul style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.25rem', color: '#4a148c' }}>
                  {result.practice_tips.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </div>
            )}
          </div>

          {(result.sources?.length ?? 0) > 0 || (result.sources_consulted?.length ?? 0) > 0 ? (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)', marginBottom: '0.75rem' }}>
                Sources Consulted
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-text)', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                  — Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </h3>
              {(result.sources?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: (result.sources_consulted?.length ?? 0) > 0 ? '0.75rem' : 0 }}>
                  {(result.sources ?? []).map((s, i) => {
                    const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575', label: s.source_type };
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {(result.sources_consulted?.length ?? 0) > 0 && (
                <>
                  {(result.sources?.length ?? 0) > 0 && <hr style={{ border: 'none', borderTop: '1px solid #e0e0e0', margin: '0.5rem 0' }} />}
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
                    {(result.sources_consulted ?? []).map((item, i) => (
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
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(debateHtml(result))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Debate Analysis: ' + result.topic, debateHtml(result))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#856404', margin: 0 }}>
              {result.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
