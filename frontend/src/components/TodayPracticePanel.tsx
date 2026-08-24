'use client';

import { useState } from 'react';
import { api, DashboardToday, QuestionAnswer } from '@/lib/api';
import {
  IconGavel,
  IconBookmark,
  IconQuestion,
  IconTarget,
} from '@/components/icons';

type NavigateFn = (view: string, q?: string) => void;

// "Today's Legal Practice" — deterministic daily study content seeded by the
// backend from the app's curated libraries (92 landmark cases, 260 tutor
// cards, 123 glossary terms). Zero LLM cost; picks change every day. The
// citation drill and issue-spotting prompt live inside their own tools now
// (Citations "Daily Drill" tab and the Issue Spotter warm-up card).
export default function TodayPracticePanel({
  today,
  onNavigate,
  onOpenReview,
}: {
  today: DashboardToday | null;
  onNavigate: NavigateFn;
  onOpenReview: (topicId?: string) => void;
}) {
  const [hintShown, setHintShown] = useState(false);
  const [answerShown, setAnswerShown] = useState(false);
  const [answerData, setAnswerData] = useState<QuestionAnswer | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState(false);

  if (!today) return null;

  const caseDay = today.case_of_the_day;
  const term = today.term_of_the_day;
  const question = today.question_of_the_day;
  const focus = today.suggested_focus;

  const loadAnswer = async () => {
    setAnswerLoading(true);
    setAnswerError(false);
    try {
      setAnswerData(await api.dashboard.todayAnswer());
    } catch {
      setAnswerError(true);
    } finally {
      setAnswerLoading(false);
    }
  };

  const toggleHint = async () => {
    if (hintShown) {
      setHintShown(false);
      return;
    }
    if (!answerData) await loadAnswer();
    if (!answerError) setHintShown(true);
  };

  const toggleAnswer = async () => {
    if (answerShown) {
      setAnswerShown(false);
      return;
    }
    if (!answerData) await loadAnswer();
    if (!answerError) setAnswerShown(true);
  };

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 0.25rem 0', fontSize: '1.05rem' }}>
          Today&apos;s Legal Practice
        </h3>
        <span style={{ color: 'var(--gray-text)', fontSize: '0.8rem' }}>new picks every day · free &amp; offline</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--accent-yellow)' }}>
          <div className="icon-chip icon-chip--yellow"><IconGavel /></div>
          <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Case of the Day</p>
          <p style={{ fontWeight: 700, color: 'var(--dark-navy)', margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>
            {caseDay.case_name}
          </p>
          <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.85rem', color: 'var(--gray-text)' }}>
            {caseDay.citation}{caseDay.year ? ` (${caseDay.year})` : ''}
          </p>
          {caseDay.case_summary && (
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
              {caseDay.case_summary}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('briefs', caseDay.case_name)}>
              Brief this case
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('summaries', caseDay.case_name)}>
              Summarize
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--purple-secondary)' }}>
          <div className="icon-chip icon-chip--purple"><IconBookmark /></div>
          <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Term of the Day</p>
          <p style={{ fontWeight: 700, color: 'var(--dark-navy)', margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>
            {term.term}
          </p>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
            {term.definition}
          </p>
          <button className="btn btn-outline" onClick={() => onNavigate('glossary')}>
            Open Glossary
          </button>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--accent-yellow)' }}>
          <div className="icon-chip icon-chip--yellow"><IconQuestion /></div>
          <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Question of the Day</p>
          <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--dark-navy)', lineHeight: 1.5 }}>
            {question.question}
          </p>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--gray-text)' }}>
            {question.topic_name} · difficulty {question.difficulty}/5
          </p>
          {hintShown && answerData && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--gray-text)', lineHeight: 1.5 }}>
              Hint: {answerData.hint}
            </p>
          )}
          {answerShown && answerData && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--dark-navy)', lineHeight: 1.5, background: '#f0f4f8', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
              {answerData.answer}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <button className="btn btn-outline" onClick={toggleHint} disabled={answerLoading}>
              {hintShown ? 'Hide hint' : 'Show hint'}
            </button>
            <button className="btn btn-outline" onClick={toggleAnswer} disabled={answerLoading}>
              {answerLoading ? 'Loading…' : answerShown ? 'Hide answer' : 'Reveal answer'}
            </button>
          </div>
          {answerError && (
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#8b0000' }}>
              Couldn&apos;t load the answer — try again.
            </p>
          )}
          <button className="btn btn-secondary" onClick={() => onNavigate('tutor')}>
            Practice in the AI Tutor
          </button>
        </div>
      </div>

      {focus && (
        <div style={{
          marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px',
          background: '#fff8e1', border: '1px solid #ffe082',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '0.9rem', color: '#856404', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <IconTarget size={16} color="#856404" />
            <span><strong>Suggested focus:</strong> {focus.topic_name} — {focus.weak_count} card{focus.weak_count === 1 ? '' : 's'} waiting in your review queue.</span>
          </span>
          <button className="btn btn-outline" onClick={() => onOpenReview(focus.topic_id)}>
            Review now
          </button>
        </div>
      )}
    </div>
  );
}