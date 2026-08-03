'use client';

import { useState } from 'react';
import { User, LegalSummaryResponse, api } from '@/lib/api';
import { printContent, summaryHtml, resultToPlainText } from '@/lib/print';
import { useLegalTool } from '@/hooks/useLegalTool';
import SourcePanel from '@/components/SourcePanel';
import ActionBar from '@/components/ActionBar';
import LoadingStatus from '@/components/LoadingStatus';

export default function SummaryView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [summaryType, setSummaryType] = useState('general');
  const {
    query, setQuery,
    result, loading,
    saved, setSaved,
    copied, setCopied,
    documents, selectedDocId, setSelectedDocId,
    elapsed, handleSubmit, cancel,
  } = useLegalTool<LegalSummaryResponse>(
    (q, docId, signal) => api.legal.summary(q, summaryType, docId, signal),
    onError,
  );

  return (
    <div>
      <h2>Legal Summary Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A legal summary condenses a case, statute, or doctrine into its essential components — helping you quickly grasp core principles and key findings without reading the full text.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a legal topic, case name, or statute to generate a structured summary.
      </p>
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Miranda v. Arizona, First Amendment, tort law"
            style={{ flex: 1, minWidth: '200px' }}
            disabled={loading}
          />
          <select value={summaryType} onChange={(e) => setSummaryType(e.target.value)} disabled={loading}
            style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem' }} aria-label="Summary type">
            <option value="general">General</option>
            <option value="case">Case Summary</option>
            <option value="statute">Statute Summary</option>
            <option value="doctrine">Legal Doctrine</option>
          </select>
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-text)', whiteSpace: 'nowrap' }}>
            {summaryType === 'general' ? 'general summary' :
             summaryType === 'case' ? 'case-focused' :
             summaryType === 'statute' ? 'statute-focused' : 'doctrine-focused'}
          </span>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Summary'}
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
          <LoadingStatus message="Retrieving content and generating summary" elapsed={elapsed} />
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
            <h2>{result.title}</h2>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              Type: {result.summary_type}
            </p>
          </div>
          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Overview</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{result.overview}</p>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Key Findings</h3>
            <ul>
              {result.key_findings.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Legal Principles</h3>
            <ul>
              {result.legal_principles.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Impact</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{result.impact}</p>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Key Points</h3>
            <ul>
              {result.key_points.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <SourcePanel sources={result.sources} sourcesConsulted={result.sources_consulted} />

          <ActionBar
            saved={saved}
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(resultToPlainText(summaryHtml(result)));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            onSavePdf={() => printContent('Legal Summary: ' + result.title, summaryHtml(result))}
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
