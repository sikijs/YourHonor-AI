'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Document, CaseBriefResponse, api } from '@/lib/api';
import { printContent, caseBriefHtml, resultToPlainText } from '@/lib/print';
import SourcePanel from '@/components/SourcePanel';

export default function CaseBriefView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [brief, setBrief] = useState<CaseBriefResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    setLoading(true);
    setBrief(null);
    setSaved(false);
    onError('');
    try {
      const result = await api.legal.caseBrief(query, selectedDocId, cancelRef.current.signal);
      setBrief(result);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Case Brief Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A case brief is a structured summary of a court opinion that distills the facts, issues, holding, reasoning, and significance. Law students use briefs to prepare for class, organize complex cases, and study for exams.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a case name or citation to generate a structured legal brief.
      </p>
      <form onSubmit={handleGenerate} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Marbury v. Madison, 5 U.S. 137"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Brief'}
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
          <div className="spinner-container"><span className="spinner" /><p>Retrieving case and generating brief...</p></div>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {brief && (
        <div className="brief-result">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{brief.case_name}</h2>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              {brief.citation.join(', ')} | {brief.court} | {brief.date_filed}
            </p>
          </div>
          <SourcePanel sources={brief.sources} />

          {[
            { label: 'Facts', content: brief.facts },
            { label: 'Procedural History', content: brief.procedural_history },
            { label: 'Holding', content: brief.holding },
            { label: 'Reasoning', content: brief.reasoning },
            { label: 'Rule of Law', content: brief.rule_of_law },
            { label: 'Significance', content: brief.significance },
          ].map((section) => (
            <div key={section.label} className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>{section.label}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{section.content}</p>
            </div>
          ))}

          {brief.issues.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Issues</h3>
              <ul>
                {brief.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {brief.concurrence && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Concurrence</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{brief.concurrence}</p>
            </div>
          )}

          {brief.dissent && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Dissent</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{brief.dissent}</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(caseBriefHtml(brief))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Case Brief: ' + brief.case_name, caseBriefHtml(brief))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
              {brief.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
