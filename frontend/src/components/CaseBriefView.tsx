'use client';

import { useState } from 'react';
import { User, CaseBriefResponse, COMPLEXITY_OPTIONS, api } from '@/lib/api';
import { caseBriefHtml, resultToPlainText } from '@/lib/print';
import { useLegalTool } from '@/hooks/useLegalTool';
import SourcePanel from '@/components/SourcePanel';
import ActionBar from '@/components/ActionBar';
import LoadingStatus from '@/components/LoadingStatus';

export default function CaseBriefView({ user, onError, initialQuery }: { user: User; onError: (err: string) => void; initialQuery?: string }) {
  const [complexity, setComplexity] = useState('standard');
  const {
    query, setQuery,
    result, loading,
    saved, setSaved,
    copied, setCopied,
    documents, selectedDocId, setSelectedDocId,
    elapsed, handleSubmit, cancel,
  } = useLegalTool<CaseBriefResponse>(
    (q, docId, signal) => api.legal.caseBrief(q, docId, signal, complexity),
    onError,
    initialQuery,
  );

  return (
    <div>
      <h2>Case Brief Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A case brief is a structured summary of a court opinion that distills the facts, issues, holding, reasoning, and significance. Law students use briefs to prepare for class, organize complex cases, and study for exams.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a case name or citation to generate a structured legal brief.
      </p>
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Marbury v. Madison, 5 U.S. 137"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
            <select value={complexity} onChange={(e) => setComplexity(e.target.value)} disabled={loading}
              style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem' }} aria-label="Complexity level">
              {COMPLEXITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="tooltip-wrap" tabIndex={0}>
              <span className="tooltip-icon" aria-hidden="true">?</span>
              <span className="tooltip-text" role="tooltip">
                <strong>Introductory</strong> — plain language, defined terms, black-letter rule.<br />
                <strong>Standard</strong> — balanced depth for law students.<br />
                <strong>Advanced</strong> — policy debate, nuance, dissent/concurrence analysis, exam-style depth.
              </span>
            </span>
          </span>
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
          <LoadingStatus message="Retrieving case and generating brief" elapsed={elapsed} />
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={cancel}>
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
              {result.citation.join(', ')} | {result.court} | {result.date_filed}
              {result.complexity && result.complexity !== 'standard' && (
                <> | {COMPLEXITY_OPTIONS.find((o) => o.value === result.complexity)?.label}</>
              )}
            </p>
          </div>

          {[
            { label: 'Facts', content: result.facts },
            { label: 'Procedural History', content: result.procedural_history },
            { label: 'Holding', content: result.holding },
            { label: 'Reasoning', content: result.reasoning },
            { label: 'Rule of Law', content: result.rule_of_law },
            { label: 'Significance', content: result.significance },
          ].map((section) => (
            <div key={section.label} className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>{section.label}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{section.content}</p>
            </div>
          ))}

          {result.issues.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Issues</h3>
              <ul>
                {result.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {result.concurrence && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Concurrence</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{result.concurrence}</p>
            </div>
          )}

          {result.dissent && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Dissent</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{result.dissent}</p>
            </div>
          )}

          <SourcePanel sources={result.sources} sourcesConsulted={result.sources_consulted} />

          <ActionBar
            saved={saved}
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(resultToPlainText(caseBriefHtml(result)));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            content={caseBriefHtml(result)}
            filename={'Case Brief - ' + result.case_name}
            contentType="html"
            onExportError={onError}
          />

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
