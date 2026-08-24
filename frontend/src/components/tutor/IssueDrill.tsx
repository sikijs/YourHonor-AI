'use client';

import { useEffect, useRef, useState } from 'react';
import { EmbeddedIssue, DrillSubmitResponse, api } from '@/lib/api';

type Stage = 'setup' | 'running' | 'grading' | 'result';

function fmt(sec: number): string {
  const m = Math.floor(Math.max(sec, 0) / 60);
  const s = Math.max(sec, 0) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function IssueDrill({ topicId, topicName, onError }: {
  topicId: string;
  topicName: string;
  onError: (err: string) => void;
}) {
  const [stage, setStage] = useState<Stage>('setup');
  const [difficulty, setDifficulty] = useState(3);
  const [showCost, setShowCost] = useState(false);
  const [loading, setLoading] = useState(false);

  const [factPattern, setFactPattern] = useState('');
  const [embeddedIssues, setEmbeddedIssues] = useState<EmbeddedIssue[]>([]);
  const [keyConcepts, setKeyConcepts] = useState<string[]>([]);
  const [suggestedMinutes, setSuggestedMinutes] = useState(5);

  const [studentText, setStudentText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const submittingRef = useRef(false);

  const [result, setResult] = useState<DrillSubmitResponse | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [savedDoc, setSavedDoc] = useState(false);

  function listedLines(text: string): string[] {
    return text.split('\n').map(l => l.replace(/^[-•*\s]+/, '').trim()).filter(Boolean);
  }

  async function start() {
    setShowCost(false);
    setLoading(true);
    onError('');
    try {
      const res = await api.tutor.generateDrill(topicId, difficulty);
      setFactPattern(res.fact_pattern);
      setEmbeddedIssues(res.embedded_issues);
      setKeyConcepts(res.key_concepts);
      setSuggestedMinutes(res.suggested_minutes);
      setSecondsLeft(res.suggested_minutes * 60);
      setStudentText('');
      setResult(null);
      setSavedDoc(false);
      setStage('running');
    } catch (err: any) {
      if (err.name !== 'AbortError') onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function grade() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStage('grading');
    onError('');
    try {
      const res = await api.tutor.submitDrill({
        topic_id: topicId,
        difficulty,
        fact_pattern: factPattern,
        embedded_issues: embeddedIssues,
        student_issues: listedLines(studentText),
        time_taken_sec: suggestedMinutes * 60 - secondsLeft,
      });
      setResult(res);
      setStage('result');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err.message);
        setStage('running');
      }
    } finally {
      submittingRef.current = false;
    }
  }

  // Countdown: auto-submits whatever is typed when time expires.
  useEffect(() => {
    if (stage !== 'running') return;
    const id = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(id);
          grade();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  async function saveToDocuments() {
    if (!result) return;
    setSavingDoc(true);
    try {
      const lines = [
        `# Issue-Spotting Drill: ${topicName}`,
        ``,
        `**Score:** ${result.score_pct}% of embedded issues spotted`,
        ``,
        `## Fact pattern`,
        factPattern,
        ``,
        `## Issues I spotted (${result.matched.length})`,
        ...result.matched.map(i => `- ${i}`),
        ``,
        `## Issues I missed (${result.missed.length})`,
        ...result.missed.map(i => `- ${i.issue}${i.rule ? ` — ${i.rule}` : ''}`),
        ``,
        `## False alarms (${result.false_positives.length})`,
        ...result.false_positives.map(i => `- ${i}`),
        ``,
        `## Coach feedback`,
        result.feedback,
        ``,
        `> ${result.disclaimer}`,
      ];
      await api.documents.create(
        `Issue-Spotting Drill: ${topicName}`,
        lines.join('\n'),
        'other',
      );
      setSavedDoc(true);
    } catch (err: any) {
      if (err.name !== 'AbortError') onError(err.message);
    } finally {
      setSavingDoc(false);
    }
  }

  if (stage === 'setup' || loading) {
    return (
      <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
        {loading ? (
          <div className="spinner-container"><span className="spinner" /><p>Writing your fact pattern...</p></div>
        ) : (
          <>
            <h3 style={{ color: 'var(--dark-navy)', marginBottom: '0.75rem' }}>Issue-Spotting Drill</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-text)', marginBottom: '1rem' }}>
              A timed fact pattern hides several legal issues in <strong>{topicName}</strong>. List every issue you spot before the clock runs out — then see what you caught, what you missed, and any false alarms.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.3rem' }}>Difficulty: {difficulty}/5</label>
              <input
                type="range" min="1" max="5" value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                style={{ width: '100%', maxWidth: '300px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '300px', fontSize: '0.75rem', color: 'var(--gray-text)' }}>
                <span>Clear-cut issues</span><span>Nuanced, many issues</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCost(true)}>Start Drill</button>
            {showCost && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>
                  This uses AI API calls to generate a fact pattern and grade your submission on <strong>{topicName}</strong>. Continue?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={start}>Yes, start</button>
                  <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={() => setShowCost(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (stage === 'grading') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <div className="spinner-container"><span className="spinner" /><p>Your professor is grading...</p></div>
      </div>
    );
  }

  if (stage === 'running') {
    const low = secondsLeft <= 30;
    return (
      <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ color: 'var(--dark-navy)', margin: 0 }}>Spot every issue you can</h3>
          <span style={{
            fontSize: '1.25rem', fontWeight: 700,
            fontFamily: 'monospace',
            color: low ? '#c62828' : 'var(--dark-navy)',
            background: low ? '#ffebee' : '#f0f0f0',
            borderRadius: '8px', padding: '0.2rem 0.75rem',
          }} aria-label={`Time remaining ${fmt(secondsLeft)}`}>
            ⏱ {fmt(secondsLeft)}
          </span>
        </div>
        <div style={{ background: '#f7f7f7', border: '1px solid #ddd', borderRadius: '6px', padding: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.55, marginBottom: '1rem' }}>
          {factPattern}
        </div>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.3rem' }}>
          Your issues ({listedLines(studentText).length} listed) — one per line:
        </label>
        <textarea
          value={studentText}
          onChange={(e) => setStudentText(e.target.value)}
          rows={6}
          placeholder={'e.g.\nThe late payment may raise a breach of contract issue…\nThe verbal agreement could violate the Statute of Frauds…'}
          style={{ width: '100%', padding: '0.65rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button className="btn btn-primary" onClick={() => grade()} disabled={listedLines(studentText).length === 0}>
            Submit for grading
          </button>
          <button className="btn btn-outline" onClick={() => grade()} title="End early and see the answer key">
            Give up &amp; reveal
          </button>
        </div>
      </div>
    );
  }

  // stage === 'result'
  const r = result!;
  return (
    <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <h3 style={{ color: 'var(--dark-navy)', margin: 0 }}>Drill results</h3>
        <span style={{ fontSize: '1.6rem', fontWeight: 800, color: r.score_pct >= 60 ? '#1b7f3a' : r.score_pct >= 40 ? '#b8860b' : '#c62828' }}>
          {r.score_pct}%
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>of embedded issues spotted</span>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '6px', padding: '0.75rem 1rem' }}>
          <p style={{ margin: '0 0 0.35rem 0', fontWeight: 700, color: '#1b7f3a' }}>✓ Spotted ({r.matched.length})</p>
          {r.matched.length === 0 ? <p style={{ margin: 0, fontSize: '0.88rem' }}>None this time.</p> : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
              {r.matched.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          )}
        </div>
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '6px', padding: '0.75rem 1rem' }}>
          <p style={{ margin: '0 0 0.35rem 0', fontWeight: 700, color: '#c62828' }}>✗ Missed ({r.missed.length})</p>
          {r.missed.length === 0 ? <p style={{ margin: 0, fontSize: '0.88rem' }}>Nothing missed — full sweep!</p> : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
              {r.missed.map((i, idx) => (
                <li key={idx} style={{ marginBottom: '0.3rem' }}>
                  {i.issue}
                  {i.rule && <div style={{ color: 'var(--gray-text)', marginTop: '0.1rem' }}>Rule: {i.rule}</div>}
                  {i.fact_trigger && <div style={{ color: 'var(--gray-text)', marginTop: '0.1rem' }}>Triggered by: {i.fact_trigger}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '6px', padding: '0.75rem 1rem' }}>
          <p style={{ margin: '0 0 0.35rem 0', fontWeight: 700, color: '#856404' }}>⚠ False alarms ({r.false_positives.length})</p>
          {r.false_positives.length === 0 ? <p style={{ margin: 0, fontSize: '0.88rem' }}>No phantom issues — good discipline.</p> : (
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
              {r.false_positives.map((i, idx) => <li key={idx}>{i}</li>)}
            </ul>
          )}
        </div>
      </div>

      {keyConcepts.length > 0 && (
        <p style={{ marginTop: '0.9rem', fontSize: '0.85rem', color: 'var(--gray-text)' }}>
          Doctrines tested: {keyConcepts.join(' · ')}
        </p>
      )}
      {r.feedback && (
        <div style={{ marginTop: '0.9rem', padding: '0.75rem 1rem', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '6px', fontSize: '0.9rem' }}>
          <strong>Coach:</strong> {r.feedback}
        </div>
      )}
      <p style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--gray-text)' }}>{r.disclaimer}</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={start}>Try Another</button>
        <button className="btn btn-outline" onClick={saveToDocuments} disabled={savingDoc || savedDoc}>
          {savedDoc ? 'Saved ✓' : savingDoc ? 'Saving...' : 'Save to Documents'}
        </button>
      </div>
    </div>
  );
}
