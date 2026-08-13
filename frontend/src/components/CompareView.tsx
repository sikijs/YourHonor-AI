'use client';

import { useState } from 'react';
import { api, CaseCompareResponse } from '@/lib/api';
import { compareHtml, resultToPlainText } from '@/lib/print';
import ActionBar from '@/components/ActionBar';
import LoadingStatus from '@/components/LoadingStatus';

const RELATIONSHIP_COLORS: Record<string, { bg: string; color: string }> = {
  overruled: { bg: '#ffebee', color: '#c62828' },
  distinguished: { bg: '#fff3e0', color: '#e65100' },
  refined: { bg: '#f3e8f7', color: '#753991' },
  applied: { bg: '#e8f5e9', color: '#2e7d32' },
  independent: { bg: '#e3f2fd', color: '#1565c0' },
};

export default function CompareView({
  caseNames,
  onError,
  onBack,
}: {
  caseNames: string[];
  onError: (err: string) => void;
  onBack: () => void;
}) {
  const [result, setResult] = useState<CaseCompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  function startElapsed() {
    setElapsed(0);
    return window.setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  async function generate() {
    setLoading(true);
    const timer = startElapsed();
    try {
      const res = await api.doctrine.compare(caseNames);
      setResult(res);
    } catch (err: any) {
      onError(err.message || 'Comparison failed');
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  }

  function factCell(facts: CaseCompareResponse['case_a']) {
    const rows: [string, string][] = [
      ['Citation', facts.citation],
      ['Year', String(facts.year)],
      ['Court', facts.court],
      ['Decided', facts.date_filed],
      ['Doctrines', facts.subjects.join(', ')],
    ];
    return (
      <td style={{ verticalAlign: 'top', width: '50%', padding: '0.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td style={{ fontWeight: 600, padding: '0.25rem 0', color: 'var(--gray-text)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                  {label}
                </td>
                <td style={{ padding: '0.25rem 0 0.25rem 0.5rem', fontSize: '0.88rem' }}>{value}</td>
              </tr>
            ))}
            {facts.holdings.length > 0 && (
              <tr>
                <td style={{ fontWeight: 600, padding: '0.25rem 0', color: 'var(--gray-text)', whiteSpace: 'nowrap', fontSize: '0.82rem', verticalAlign: 'top' }}>
                  Holding
                </td>
                <td style={{ padding: '0.25rem 0 0.25rem 0.5rem', fontSize: '0.88rem' }}>
                  {facts.holdings.map((h, i) => (
                    <p key={i} style={{ margin: '0 0 0.4rem 0', lineHeight: 1.5 }}>{h}</p>
                  ))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </td>
    );
  }

  return (
    <div>
      <button className="btn btn-outline" onClick={onBack} style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        &larr; Back to Doctrines
      </button>

      <div className="card" style={{ background: '#f8faff', borderLeft: '4px solid var(--blue-primary)', marginBottom: '1rem' }}>
        <h2 style={{ margin: '0.5rem 0' }}>
          {caseNames[0]} vs {caseNames[1]}
        </h2>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
          The facts table below is curated static data — free and instant. The AI narrative comparison is generated on demand from the full opinions.
        </p>
      </div>

      {!result && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ marginBottom: '1rem' }}>Compare these two landmark cases side by side.</p>
          <button className="btn btn-primary" onClick={generate}>
            Generate AI Comparison
          </button>
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingStatus message="Comparing cases" elapsed={elapsed} />
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => setLoading(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="brief-result">
          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)', marginTop: 0 }}>Quick Facts</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem', borderBottom: '2px solid #e0e0e0', color: 'var(--dark-navy)' }}>{result.case_a.name}</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem', borderBottom: '2px solid #e0e0e0', color: 'var(--dark-navy)' }}>{result.case_b.name}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {factCell(result.case_a)}
                  {factCell(result.case_b)}
                </tr>
              </tbody>
            </table>
          </div>

          {result.comparison && (
            <>
              <div className="card" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ color: 'var(--purple-secondary)', marginTop: 0 }}>Similarities</h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {result.comparison.similarities.map((s, i) => (
                    <li key={i} style={{ marginBottom: '0.4rem', lineHeight: 1.5 }}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="card" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ color: 'var(--accent-yellow)', marginTop: 0 }}>Differences</h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {result.comparison.differences.map((d, i) => (
                    <li key={i} style={{ marginBottom: '0.4rem', lineHeight: 1.5 }}>{d}</li>
                  ))}
                </ul>
              </div>

              <div className="card" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ marginTop: 0 }}>Doctrinal Relationship</h3>
                <p style={{ margin: '0 0 0.5rem 0' }}>
                  <span style={{
                    fontSize: '0.8rem', padding: '0.15rem 0.5rem', borderRadius: '3px', fontWeight: 600, marginRight: '0.4rem',
                    background: RELATIONSHIP_COLORS[result.comparison.relationship_type]?.bg || '#eee',
                    color: RELATIONSHIP_COLORS[result.comparison.relationship_type]?.color || '#333',
                  }}>
                    {result.comparison.relationship_type}
                  </span>
                  {result.comparison.relationship}
                </p>
              </div>

              <div className="card" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ marginTop: 0 }}>Significance</h3>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{result.comparison.significance}</p>
              </div>

              <div className="card" style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ marginTop: 0 }}>Exam Practice Note</h3>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{result.comparison.practice_note}</p>
              </div>
            </>
          )}

          <ActionBar
            saved={false}
            copied={copied}
            onCopy={() => {
              navigator.clipboard.writeText(resultToPlainText(compareHtml(result)));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            content={compareHtml(result)}
            filename={'Case Comparison - ' + result.case_a.name + ' vs ' + result.case_b.name}
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