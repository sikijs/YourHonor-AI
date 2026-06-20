'use client';

import { useState, useEffect, useRef } from 'react';
import { User, Document, MemorandumResponse, api } from '@/lib/api';
import { printContent, memorandumHtml, resultToPlainText } from '@/lib/print';

export default function MemorandumView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<MemorandumResponse | null>(null);
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
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const memo = await api.legal.memorandum(query, selectedDocId, cancelRef.current.signal);
      setResult(memo);
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
      <h2>Legal Memorandum Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A legal memorandum analyzes a legal question using IRAC — Issue, Rule, Application, Conclusion. It is the core document format every law student and practicing lawyer must master.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Describe a legal question or scenario to draft a structured legal memorandum with IRAC analysis.
      </p>
      <form onSubmit={handleGenerate} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Is a clickwrap agreement enforceable under contract law? Analyze the requirements for offer, acceptance, and consideration."
            style={{ flex: 1, minWidth: '300px', minHeight: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: 'inherit', resize: 'vertical' }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Drafting...' : 'Draft Memorandum'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.25rem' }}>
              Use an uploaded PDF:
            </label>
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
              style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem', width: '100%' }}
            >
              <option value="">Use RAG search (default)</option>
              {documents.filter(d => d.file_path).map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container"><span className="spinner" /><p>Retrieving sources and drafting memorandum...</p></div>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div>
          <div className="card" style={{ marginBottom: '1rem', background: '#f0f7ff', border: '1px solid #cce5ff' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem' }}>
              <span><strong>TO:</strong> {result.to}</span>
              <span><strong>FROM:</strong> {result.author}</span>
              <span><strong>DATE:</strong> {result.date}</span>
              <span><strong>RE:</strong> {result.re}</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Question Presented</h3>
            <p>{result.question_presented}</p>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Brief Answer</h3>
            <p>{result.brief_answer}</p>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Facts</h3>
            <p>{result.facts}</p>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Discussion</h3>
            {result.issues.map((iss, i) => (
              <div key={i} style={{ marginBottom: i < result.issues.length - 1 ? '1.5rem' : 0, paddingBottom: i < result.issues.length - 1 ? '1.5rem' : 0, borderBottom: i < result.issues.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                <h4 style={{ color: 'var(--purple-secondary)', marginBottom: '0.75rem' }}>{iss.issue}</h4>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--dark-navy)' }}>Rule:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', lineHeight: 1.6 }}>{iss.rule}</p>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--dark-navy)' }}>Application:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', lineHeight: 1.6 }}>{iss.application}</p>
                </div>
                <div>
                  <strong style={{ color: 'var(--dark-navy)' }}>Conclusion:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', lineHeight: 1.6 }}>{iss.conclusion}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Conclusion</h3>
            <p>{result.overall_conclusion}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.5rem' }}>
              Source: {result.source}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(memorandumHtml(result))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Legal Memorandum: ' + result.re, memorandumHtml(result))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#856404', margin: 0 }}>
              {result.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
