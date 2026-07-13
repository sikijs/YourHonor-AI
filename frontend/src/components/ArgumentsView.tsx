'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Document, ArgumentExtractionResponse, SourceDocument, api } from '@/lib/api';
import { printContent, argumentsHtml, resultToPlainText } from '@/lib/print';

const BADGE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  courtlistener: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  courtlistener_ingested: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  rag: { bg: '#e8f8e8', color: '#2e7d32', label: 'RAG' },
  user_upload: { bg: '#fff3e0', color: '#e65100', label: 'Uploaded' },
  web: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Web' },
  seed: { bg: '#e0f7fa', color: '#00838f', label: 'Seed' },
  none: { bg: '#f5f5f5', color: '#757575', label: 'None' },
};

export default function ArgumentsView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ArgumentExtractionResponse | null>(null);
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

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    cancellingRef.current = false;
    setLoading(true);
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const args = await api.legal.arguments(query, selectedDocId, cancelRef.current.signal);
      setResult(args);
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

  return (
    <div>
      <h2>Argument Extraction</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        Legal argument analysis examines the reasoning presented by each party in a case. Understanding how petitioners and respondents construct their arguments is fundamental to thinking — and writing — like a lawyer.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a case name to extract and analyze legal arguments made by each party.
      </p>
      <form onSubmit={handleExtract} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Miranda v. Arizona"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Extracting...' : 'Extract Arguments'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.25rem' }}>
              Use an uploaded PDF:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={selectedDocId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedDocId(id);
                  if (id) {
                    const doc = documents.find(d => d.id === id);
                    if (doc) setQuery(doc.title);
                  }
                }}
                disabled={loading}
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
              >
                <option value="">Search all legal sources (default)</option>
                {documents.filter(d => d.file_path).map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title}</option>
                ))}
              </select>
              {selectedDocId && (
                <span style={{ fontSize: '0.8rem', color: 'var(--purple-secondary)', fontWeight: 600 }}>
                  PDF selected
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.25rem' }}>
              {selectedDocId
                ? 'The analysis will be based on your uploaded document. Type a query above and click Generate.'
                : 'Select one of your uploaded PDFs to analyze it directly.'}
            </p>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container"><span className="spinner" /><p>Retrieving case and analyzing arguments... ({elapsed}s)</p></div>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancellingRef.current = true; cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="brief-result">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{result.case_name}</h2>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              {result.petitioner} vs {result.respondent}
            </p>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--purple-secondary)' }}>Parties</h3>
            <p><strong>Petitioner:</strong> {result.petitioner}</p>
            <p><strong>Respondent:</strong> {result.respondent}</p>
          </div>

          {result.petitioner_arguments.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--purple-secondary)' }}>{result.petitioner}&apos;s Arguments</h3>
              {result.petitioner_arguments.map((arg, i) => (
                <div key={i} style={{ marginBottom: i < result.petitioner_arguments.length - 1 ? '1rem' : 0, paddingBottom: i < result.petitioner_arguments.length - 1 ? '1rem' : 0, borderBottom: i < result.petitioner_arguments.length - 1 ? '1px solid #eee' : 'none' }}>
                  <p><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Authorities:</strong> {arg.authorities.join(', ')}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Court Resolution:</strong> {arg.court_resolution}</p>
                </div>
              ))}
            </div>
          )}
          {result.respondent_arguments.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>{result.respondent}&apos;s Arguments</h3>
              {result.respondent_arguments.map((arg, i) => (
                <div key={i} style={{ marginBottom: i < result.respondent_arguments.length - 1 ? '1rem' : 0, paddingBottom: i < result.respondent_arguments.length - 1 ? '1rem' : 0, borderBottom: i < result.respondent_arguments.length - 1 ? '1px solid #eee' : 'none' }}>
                  <p><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Authorities:</strong> {arg.authorities.join(', ')}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Court Resolution:</strong> {arg.court_resolution}</p>
                </div>
              ))}
            </div>
          )}

          {result.counterarguments_considered.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Counterarguments Considered</h3>
              <ul>
                {result.counterarguments_considered.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {result.key_doctrines_statutes.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Key Doctrines &amp; Statutes</h3>
              <ul>
                {result.key_doctrines_statutes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--accent-yellow)' }}>Outcome</h3>
            <p><strong>Winning Party:</strong> {result.winning_party}</p>
            <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}><strong>Rationale:</strong> {result.rationale}</p>
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
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(argumentsHtml(result))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Argument Map: ' + result.case_name, argumentsHtml(result))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
              {result.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
