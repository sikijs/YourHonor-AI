'use client';

import { useState } from 'react';
import { User, BluebookFormatResponse, BluebookEntry, api } from '@/lib/api';
import { bluebookHtml, resultToPlainText } from '@/lib/print';
import ActionBar from '@/components/ActionBar';
import LoadingStatus from '@/components/LoadingStatus';

const CONFIDENCE_COLORS: Record<string, { bg: string; color: string }> = {
  high: { bg: '#e8f5e9', color: '#2e7d32' },
  medium: { bg: '#fff3e0', color: '#e65100' },
  low: { bg: '#ffebee', color: '#c62828' },
};

const TYPE_COLORS: Record<string, string> = {
  case: '#209dd7',
  statute: '#753991',
  constitution: '#753991',
  regulation: '#753991',
  rule: '#753991',
  internet: '#ecad0a',
};

const TOOLTIP_STYLES: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#032147',
  color: '#fff',
  fontSize: '0.75rem',
  lineHeight: 1.45,
  padding: '0.45rem 0.6rem',
  borderRadius: '6px',
  width: '240px',
  maxWidth: '240px',
  zIndex: 20,
  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  fontWeight: 400,
  textAlign: 'left',
};

function TipBadge({ label, bg, color, tip }: { label: string; bg: string; color: string; tip: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: 'relative', display: 'inline-block', cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
      aria-label={tip}
    >
      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '3px', fontWeight: 600, background: bg, color }}>
        {label}
      </span>
      {show && <span style={TOOLTIP_STYLES}>{tip}</span>}
    </span>
  );
}

const AUTHORITY_TIP =
  'What kind of authority this citation is. The Bluebook has different formatting rules for each type: cases (Rule 10), statutes (Rule 12), constitutions (Rule 8), rules (Rule 14), and internet sources (Rule 18).';

const CONFIDENCE_TIP =
  'How sure the formatter is that this citation is correct. High = reliable. Medium or low means the input was incomplete or ambiguous — read the note below the citation for what is missing.';

const CURATED_TIP =
  'This citation matched one of the 70 landmark cases in the offline library, so it was formatted from its official reporter citation and year — instantly and at no AI cost. No badge means the citation was formatted by AI.';

export default function BluebookView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<BluebookFormatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  function startElapsed() {
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return timer;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    const timer = startElapsed();
    try {
      const res = await api.legal.bluebookFormat(text);
      setResult(res);
    } catch (err: any) {
      onError(err.message || 'Formatting failed');
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  }

  async function copyEntry(entry: BluebookEntry) {
    await navigator.clipboard.writeText(entry.formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyAll() {
    if (!result) return;
    navigator.clipboard.writeText(result.entries.map((e) => e.formatted).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <h2>Bluebook Citation Formatter</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        Paste raw, sloppy, or incomplete citations and get them reformatted to Bluebook style — the standard citation system for U.S. legal writing. Case names, reporter abbreviations, pin cites, and parenthetical years are normalized per the Bluebook rules.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter one citation per line (separate multiple citations on one line with semicolons). Citations matching the 70 curated landmark cases are formatted instantly with no AI cost.
      </p>
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'e.g.\nMiranda vs Arizona 384 US 436\n42 USC 1983\nroper v simmons 543 u s 551 (2005)'}
          rows={5}
          disabled={loading}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: '0.95rem', padding: '0.6rem', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={loading || !text.trim()}>
            {loading ? 'Formatting...' : 'Format Citations'}
          </button>
          {result && (
            <button type="button" className="btn btn-outline" onClick={copyAll} style={{ fontSize: '0.85rem' }}>
              Copy All
            </button>
          )}
          {copied && <span style={{ fontSize: '0.85rem', color: 'var(--blue-primary)' }}>Copied!</span>}
        </div>
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingStatus message="Formatting citations" elapsed={elapsed} />
        </div>
      )}

      {result && (
        <div className="brief-result">
          {result.entries.map((entry, i) => (
            <div key={i} className="card" style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', margin: '0 0 0.25rem 0' }}>
                    Raw: {entry.raw_input}
                  </p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0.4rem 0', color: 'var(--dark-navy)' }}>
                    {entry.formatted}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <TipBadge
                    label={entry.authority_type}
                    bg={TYPE_COLORS[entry.authority_type] || '#eee'}
                    color="#fff"
                    tip={AUTHORITY_TIP}
                  />
                  <TipBadge
                    label={entry.confidence}
                    bg={CONFIDENCE_COLORS[entry.confidence]?.bg || '#eee'}
                    color={CONFIDENCE_COLORS[entry.confidence]?.color || '#333'}
                    tip={CONFIDENCE_TIP}
                  />
                  {entry.from_local && (
                    <TipBadge
                      label="curated match"
                      bg="#e8f5e9"
                      color="#2e7d32"
                      tip={CURATED_TIP}
                    />
                  )}
                  <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }} onClick={() => copyEntry(entry)}>
                    Copy
                  </button>
                </div>
              </div>
              {entry.rules_applied.length > 0 && (
                <div style={{ margin: '0.5rem 0' }}>
                  {entry.rules_applied.map((rule, j) => (
                    <span key={j} style={{
                      display: 'inline-block', background: '#e8f4f8', color: 'var(--blue-primary)',
                      fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '3px', margin: '0.15rem',
                    }}>
                      {rule}
                    </span>
                  ))}
                </div>
              )}
              {entry.notes && (
                <p style={{ fontSize: '0.85rem', color: '#555', margin: '0.25rem 0 0 0', lineHeight: 1.5 }}>
                  {entry.notes}
                </p>
              )}
            </div>
          ))}

          {result.general_notes && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--accent-yellow)', marginTop: 0 }}>General Notes</h3>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{result.general_notes}</p>
            </div>
          )}

          <ActionBar
            saved={false}
            copied={false}
            onCopy={() => {
              navigator.clipboard.writeText(resultToPlainText(bluebookHtml(result)));
            }}
            content={bluebookHtml(result)}
            filename={'Bluebook Citations'}
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