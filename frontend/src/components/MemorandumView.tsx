'use client';

import { User, MemorandumResponse, api } from '@/lib/api';
import { memorandumHtml, resultToPlainText } from '@/lib/print';
import { useLegalTool } from '@/hooks/useLegalTool';
import SourcePanel from '@/components/SourcePanel';
import ActionBar from '@/components/ActionBar';
import LoadingStatus from '@/components/LoadingStatus';

export default function MemorandumView({ user, onError, query, onQueryChange, sharedResult, onSharedResultChange }: { user: User; onError: (err: string) => void; query?: string; onQueryChange?: (q: string) => void; sharedResult?: MemorandumResponse | null; onSharedResultChange?: (r: MemorandumResponse | null) => void }) {
  const {
    query: currentQuery, setQuery,
    result, loading,
    saved, setSaved,
    copied, setCopied,
    documents, selectedDocId, setSelectedDocId,
    elapsed, handleSubmit, cancel,
  } = useLegalTool<MemorandumResponse>(
    (q, docId, signal) => api.legal.memorandum(q, docId, signal),
    onError,
    undefined,
    { sharedQuery: query, onSharedQueryChange: onQueryChange, sharedResult, onSharedResultChange },
  );

  return (
    <div>
      <h2>Legal Memorandum Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A legal memorandum analyzes a legal question using IRAC — Issue, Rule, Application, Conclusion. It is the core document format every law student and practicing lawyer must master.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Describe a legal question or scenario to draft a structured legal memorandum with IRAC analysis.
      </p>
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <textarea
            value={currentQuery}
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
          <LoadingStatus message="Retrieving sources and drafting memorandum" elapsed={elapsed} />
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={cancel}>
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
          </div>

          <SourcePanel sources={result.sources} sourcesConsulted={result.sources_consulted} />

          <ActionBar
            saved={saved}
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(resultToPlainText(memorandumHtml(result)));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            content={memorandumHtml(result)}
            filename={'Legal Memorandum - ' + result.re}
            contentType="html"
            onExportError={onError}
          />

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
