'use client';

import { useState, useEffect } from 'react';
import { User, Document, GlossaryResponse, api } from '@/lib/api';
import { printContent, glossaryHtml } from '@/lib/print';

export default function GlossaryView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<GlossaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult(null);
    onError('');
    try {
      const entry = await api.legal.glossary(query, selectedDocId);
      setResult(entry);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Legal Glossary</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A legal glossary defines key terms and concepts with etymology, usage examples, and practice tips. Mastering legal terminology is essential for reading cases and understanding the law.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a legal term to get a definition with etymology, usage examples, related terms, and practice tips.
      </p>
      <form onSubmit={handleLookup} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a legal term (e.g., habeas corpus, mens rea, stare decisis)..."
            style={{ marginBottom: 0 }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
            {loading ? 'Looking up...' : 'Look Up'}
          </button>
        </div>
        {documents.length > 0 && (
          <select
            value={selectedDocId ?? ''}
            onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : undefined)}
            style={{ fontSize: '0.85rem', marginBottom: 0 }}
          >
            <option value="">General (no specific document)</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container"><span className="spinner" /><p>Searching legal sources and generating definition...</p></div>
        </div>
      )}

      {result && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <h3 style={{ marginBottom: 0 }}>{result.term}</h3>
              {result.also_known_as && (
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
                  also known as: {result.also_known_as}
                </span>
              )}
            </div>
            {result.etymology && (
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', marginBottom: '0.75rem' }}>
                <em>Etymology:</em> {result.etymology}
              </p>
            )}
            <div style={{ background: '#e3f2fd', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{result.definition}</p>
            </div>
            {result.jurisdiction && (
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <strong>Jurisdiction:</strong> {result.jurisdiction}
              </p>
            )}
          </div>

          {result.usage_example && (
            <div className="card" style={{ background: '#f9f9f9', borderLeft: '4px solid var(--blue-primary)' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Usage Example</h4>
              <p style={{ fontStyle: 'italic', margin: 0, color: '#555' }}>{result.usage_example}</p>
            </div>
          )}

          {result.related_terms.length > 0 && (
            <div className="card">
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Related Terms</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {result.related_terms.map((term, i) => (
                  <span key={i} style={{
                    background: '#e8eaf6',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    color: '#283593',
                  }}>
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.practice_tips && (
            <div className="card" style={{ background: '#fff8e1', border: '1px solid #ffe082' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#e65100' }}>Practice Tips</h4>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{result.practice_tips}</p>
            </div>
          )}

          {result.citations.length > 0 && (
            <div className="card">
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Sources</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                {result.citations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => printContent('Glossary: ' + result.term, glossaryHtml(result))}>
              Save PDF
            </button>
          </div>

          {result.from_seed && (
            <div className="card" style={{ background: '#e8f5e9', border: '1px solid #4caf50', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--blue-primary)', margin: 0 }}>
                This entry is from the curated legal glossary. Definitions have been verified from established legal sources.
              </p>
            </div>
          )}

          {!result.from_seed && (
            <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#856404', margin: 0 }}>
                {result.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
