'use client';

import { useEffect, useState } from 'react';
import { api, IssuePromptData, IssueAnswer } from '@/lib/api';
import { IconSearch } from '@/components/icons';

// Daily issue-spotting warm-up shown above the Issue Spotter form. Asks the
// student to phrase today's featured landmark case as one issue sentence; the
// subject hint and the court's own issue/holding are revealed only on demand
// via the existing /api/dashboard/today/issue-answer endpoint. Hides itself
// entirely if the prompt cannot load — the main tool must never break.
export default function DailyWarmupCard({
  onUseCaseName,
}: {
  onUseCaseName: (caseName: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [promptData, setPromptData] = useState<IssuePromptData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [hintShown, setHintShown] = useState(false);
  const [issueShown, setIssueShown] = useState(false);
  const [answerData, setAnswerData] = useState<IssueAnswer | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.dashboard
      .issuePrompt()
      .then((data) => {
        if (!cancelled) {
          if (data.prompt && data.case_name) setPromptData(data);
          else setLoadFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadIssueAnswer() {
    setAnswerLoading(true);
    setAnswerError(false);
    try {
      setAnswerData(await api.dashboard.todayIssueAnswer());
    } catch {
      setAnswerError(true);
    } finally {
      setAnswerLoading(false);
    }
  }

  async function toggleHint() {
    if (hintShown) {
      setHintShown(false);
      return;
    }
    if (!answerData) await loadIssueAnswer();
    if (!answerError) setHintShown(true);
  }

  async function toggleIssue() {
    if (issueShown) {
      setIssueShown(false);
      return;
    }
    if (!answerData) await loadIssueAnswer();
    if (!answerError) setIssueShown(true);
  }

  if (loadFailed || !promptData) return null;

  return (
    <div
      className="card"
      style={{ marginBottom: '1rem', padding: '0.9rem 1.1rem', borderTop: '3px solid var(--blue-primary)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <p className="stat-label" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <IconSearch size={15} color="var(--blue-primary)" />
          Daily warm-up · new case every day
        </p>
        <button
          className="btn btn-outline"
          onClick={() => setCollapsed(!collapsed)}
          style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          <p style={{ margin: '0.6rem 0 0.75rem', fontSize: '0.9rem', color: 'var(--dark-navy)', lineHeight: 1.5 }}>
            {promptData.prompt}
          </p>

          {hintShown && answerData && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
              <strong>Hint:</strong> this case is about <strong>{answerData.subject}</strong> — specifically
              the <strong>{answerData.doctrine_name}</strong> doctrine. {answerData.doctrine_description}{' '}
              Look for who sued whom, what each side wanted, and which law or right is at stake.
            </p>
          )}
          {issueShown && answerData && (
            <div style={{ margin: '0 0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--dark-navy)', lineHeight: 1.5, background: '#f0f4f8', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <strong>The court&apos;s issue:</strong> {answerData.issue || answerData.holding}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--dark-navy)', lineHeight: 1.5, background: '#f0f4f8', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <strong>The court&apos;s holding (in plain English):</strong>{' '}
                {answerData.plain_holding || answerData.holding}
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
                Your sentence is the <em>question</em>; the holding is the court&apos;s <em>answer</em> to it.
              </p>
            </div>
          )}
          {answerError && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#8b0000' }}>
              Couldn&apos;t load the issue — try again.
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-outline" onClick={toggleHint} disabled={answerLoading} style={{ fontSize: '0.82rem' }}>
              {hintShown ? 'Hide subject hint' : 'Show subject hint'}
            </button>
            <button
              className="btn btn-outline"
              onClick={toggleIssue}
              disabled={answerLoading}
              style={{ fontSize: '0.82rem' }}
            >
              {answerLoading ? 'Loading…' : issueShown ? "Hide the court's issue" : "Reveal the court's issue"}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                onUseCaseName(promptData.case_name);
                setCollapsed(true);
              }}
              style={{ fontSize: '0.82rem' }}
            >
              Spot issues in this case &rarr;
            </button>
          </div>
        </>
      )}
    </div>
  );
}
