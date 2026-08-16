'use client';

import { useState } from 'react';
import { DashboardToday } from '@/lib/api';
import {
  IconGavel,
  IconLink,
  IconBookmark,
  IconQuestion,
  IconSearch,
  IconTarget,
} from '@/components/icons';

type NavigateFn = (view: string, q?: string) => void;

// "Today's Legal Practice" — deterministic daily study content seeded by the
// backend from the app's curated libraries (70 landmark cases, 160 tutor
// cards, 123 glossary terms). Zero LLM cost; picks change every day.
export default function TodayPracticePanel({
  today,
  onNavigate,
  onOpenReview,
}: {
  today: DashboardToday | null;
  onNavigate: NavigateFn;
  onOpenReview: (topicId?: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);

  if (!today) return null;

  const caseDay = today.case_of_the_day;
  const drill = today.citation_drill;
  const term = today.term_of_the_day;
  const question = today.question_of_the_day;
  const prompt = today.issue_prompt_of_the_day;
  const focus = today.suggested_focus;

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
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--gray-text)' }}>
            {caseDay.citation}{caseDay.year ? ` (${caseDay.year})` : ''}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('briefs', caseDay.case_name)}>
              Brief this case
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate('summaries', caseDay.case_name)}>
              Summarize
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--blue-primary)' }}>
          <div className="icon-chip icon-chip--blue"><IconLink /></div>
          <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Citation Drill</p>
          <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--dark-navy)' }}>
            Format this citation in Bluebook style:
          </p>
          <p style={{
            margin: '0 0 0.75rem 0', fontFamily: 'monospace', fontSize: '0.9rem',
            background: '#f0f4f8', padding: '0.4rem 0.6rem', borderRadius: '6px',
          }}>
            {drill.raw}
          </p>
          {revealed ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: '#1b7f3a', fontWeight: 600 }}>
                Correct answer:
              </p>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--dark-navy)' }}>
                {drill.formatted}
              </p>
              {drill.rules_applied.length > 0 && (
                <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: 'var(--gray-text)' }}>
                  {drill.rules_applied.join(' · ')}
                </p>
              )}
              {drill.notes && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>{drill.notes}</p>
              )}
            </div>
          ) : (
            <button className="btn btn-outline" onClick={() => setRevealed(true)} style={{ marginBottom: '0.75rem' }}>
              Reveal answer
            </button>
          )}
          <button className="btn btn-outline" onClick={() => onNavigate('citations')}>
            Format more citations &rarr;
          </button>
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
          <button className="btn btn-secondary" onClick={() => onNavigate('tutor')}>
            Practice in the AI Tutor
          </button>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--blue-primary)' }}>
          <div className="icon-chip icon-chip--blue"><IconSearch /></div>
          <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Issue-Spotting Prompt</p>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
            {prompt.prompt}
          </p>
          <button className="btn btn-outline" onClick={() => onNavigate('issuespotter')}>
            Try the Issue Spotter
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