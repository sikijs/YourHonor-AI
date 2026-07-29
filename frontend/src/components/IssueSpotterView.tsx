'use client';

import { User, IssueSpotterResponse, api } from '@/lib/api';
import { printContent, issueSpotterHtml, resultToPlainText } from '@/lib/print';
import { useLegalTool } from '@/hooks/useLegalTool';
import SourcePanel from '@/components/SourcePanel';
import ActionBar from '@/components/ActionBar';

export default function IssueSpotterView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const {
    query, setQuery,
    result, loading,
    saved, setSaved,
    copied, setCopied,
    documents, selectedDocId, setSelectedDocId,
    elapsed, handleSubmit, cancel,
  } = useLegalTool<IssueSpotterResponse>(
    (q, docId, signal) => api.legal.issueSpotter(q, docId, signal),
    onError,
  );

  return (
    <div>
      <h2>Issue Spotter</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        Paste a fact pattern to identify all legal issues, governing rules, and how they apply to the facts. Built for law students practicing exam issue-spotting.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a fact pattern, hypothetical, or describe a legal scenario.
      </p>
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Paste a fact pattern here...\n\nExample:\nOfficer Jones stopped the defendant's car after observing it swerve twice. The officer smelled alcohol and asked the defendant to step out. Without reading Miranda rights, the officer asked "How much have you had to drink?" The defendant admitted to "a couple of beers." The officer then searched the glove compartment and found a bag of cocaine.`}
          style={{ width: '100%', minHeight: '150px', marginBottom: '0.5rem', padding: '0.5rem', fontSize: '0.95rem', border: '1px solid #ccc', borderRadius: '6px', fontFamily: 'inherit', resize: 'vertical' }}
          disabled={loading}
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Spotting Issues...' : 'Spot Issues'}
        </button>
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
                <option value="">Analyze without uploaded document (default)</option>
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
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container"><span className="spinner" /><p>Analyzing fact pattern and identifying issues... ({elapsed}s)</p></div>
          <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Results are saved to My Documents automatically.</p>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      {result && (
        <div className="issue-spotter-result">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--dark-navy)' }}>Overview</h3>
            <p>{result.overview}</p>
          </div>

          {Object.keys(result.issues_by_area).length > 0 && (
            <div className="card" style={{ marginBottom: '1rem', padding: '0.75rem 1rem' }}>
              <h4 style={{ color: 'var(--gray-text)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Legal Areas Detected</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {Object.entries(result.issues_by_area).map(([area, issueTexts]) => (
                  <span
                    key={area}
                    style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      background: '#e8f4f8',
                      borderRadius: '16px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--blue-primary)',
                      border: '1px solid #c5e4f0',
                    }}
                  >
                    {area} <span style={{ fontWeight: 400, opacity: 0.7 }}>({issueTexts.length})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.issues.map((issue, i) => (
            <div
              key={i}
              className="card"
              style={{
                marginBottom: '0.75rem',
                borderLeft: '4px solid var(--accent-yellow)',
                padding: '1rem 1rem 0.75rem',
              }}
            >
              <h3 style={{ color: 'var(--dark-navy)', fontSize: '1.05rem', marginBottom: '0.75rem' }}>
                Issue {i + 1}: {issue.issue}
              </h3>

              <div style={{ marginBottom: '0.6rem' }}>
                <strong style={{ color: 'var(--purple-secondary)' }}>Rule: </strong>
                <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{issue.rule}</p>
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <strong style={{ color: 'var(--dark-navy)' }}>Application: </strong>
                <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{issue.application}</p>
              </div>

              <div style={{ marginBottom: '0.6rem' }}>
                <strong>Conclusion: </strong>
                <span style={{ fontWeight: 500 }}>{issue.conclusion}</span>
              </div>

              {issue.missing_information && (
                <div style={{
                  background: '#fff8e1',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem',
                  border: '1px solid #ffe082',
                }}>
                  <strong>Needs more info: </strong>
                  {issue.missing_information}
                </div>
              )}

              {issue.relevant_authorities.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>Authorities: </strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                    {issue.relevant_authorities.map((auth, j) => (
                      <span
                        key={j}
                        style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          background: '#f0f0f0',
                          borderRadius: '4px',
                          fontSize: '0.82rem',
                          color: '#555',
                        }}
                      >
                        {auth}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {result.practice_tips && (
            <div className="card" style={{ marginBottom: '0.75rem', background: '#f0f7ff', border: '1px solid #d4e6f5' }}>
              <h4 style={{ color: 'var(--blue-primary)', marginBottom: '0.4rem' }}>Exam Tips</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{result.practice_tips}</p>
            </div>
          )}

          <SourcePanel sources={result.sources} sourcesConsulted={result.sources_consulted} />

          <ActionBar
            saved={saved}
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(resultToPlainText(issueSpotterHtml(result)));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            onSavePdf={() => printContent('Issue Spotter Analysis', issueSpotterHtml(result))}
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
