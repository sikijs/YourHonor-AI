'use client';

import { useEffect, useState } from 'react';
import { api, CitationDrillData } from '@/lib/api';

// Daily Bluebook citation quiz, served from the same day-seeded landmark-case
// pick as the Dashboard's Case of the Day. One correct citation plus three
// deterministic distractors, each carrying the Bluebook rule it violates.
export default function CitationDrillView({
  onError,
  onOpenFormatter,
}: {
  onError: (err: string) => void;
  onOpenFormatter?: () => void;
}) {
  const [drill, setDrill] = useState<CitationDrillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.dashboard
      .citationDrill()
      .then((data) => {
        if (!cancelled) setDrill(data);
      })
      .catch((err) => {
        if (!cancelled) onError(err.message || "Could not load today's citation drill");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div>
        <h2>Daily Drill</h2>
        <p style={{ color: 'var(--gray-text)' }}>Loading today&apos;s citation quiz…</p>
      </div>
    );
  }

  if (!drill || !drill.options.length) {
    return (
      <div>
        <h2>Daily Drill</h2>
        <p style={{ color: 'var(--gray-text)' }}>No drill is available right now — check back tomorrow.</p>
      </div>
    );
  }

  const correctIndex = drill.options.findIndex((o) => o.is_correct);
  const answered = selected !== null;

  return (
    <div>
      <h2>Daily Drill</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        One Bluebook question every day, drawn from the app&apos;s built-in library of 92 landmark cases.
        Pick the correctly formatted citation and learn the rule behind each wrong option.
      </p>

      <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--blue-primary)', maxWidth: '720px' }}>
        <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Citation Drill</p>
        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', color: 'var(--dark-navy)' }}>
          Which of these is the correct Bluebook citation for
        </p>
        <p style={{
          margin: '0 0 0.75rem 0', fontFamily: 'monospace', fontSize: '0.95rem',
          background: '#f0f4f8', padding: '0.4rem 0.6rem', borderRadius: '6px',
        }}>
          {drill.raw}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {drill.options.map((option, i) => {
            const isPicked = selected === i;
            const showCorrect = answered && option.is_correct;
            const showWrong = answered && isPicked && !option.is_correct;
            return (
              <button
                key={`${option.text}-${i}`}
                className="btn"
                disabled={answered}
                onClick={() => setSelected(i)}
                style={{
                  textAlign: 'left',
                  fontSize: '0.9rem',
                  lineHeight: 1.4,
                  justifyContent: 'flex-start',
                  borderColor: showCorrect ? '#2e8b57' : showWrong ? '#c0392b' : undefined,
                  background: showCorrect ? '#e8f5ee' : showWrong ? '#fdecea' : undefined,
                  color: showCorrect ? '#1b5e20' : showWrong ? '#8b0000' : undefined,
                }}
              >
                {option.text}
                {showCorrect && ' ✓'}
                {showWrong && ' ✗'}
              </button>
            );
          })}
        </div>
        {answered && (
          <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 0.4rem 0', color: selected === correctIndex ? '#1b7f3a' : '#8b0000', fontWeight: 600 }}>
              {selected === correctIndex ? 'Correct!' : 'Not quite — come back tomorrow for a new case.'}
            </p>
            {drill.options[selected].is_correct ? (
              <p style={{ margin: 0, color: 'var(--gray-text)' }}>{drill.options[selected].rule_note}</p>
            ) : (
              <p style={{ margin: 0, color: 'var(--gray-text)' }}>
                <em>{drill.options[selected].text}</em> — {drill.options[selected].rule_note}
              </p>
            )}
          </div>
        )}
        {onOpenFormatter && (
          <button className="btn btn-outline" onClick={onOpenFormatter}>
            Format your own citations &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
