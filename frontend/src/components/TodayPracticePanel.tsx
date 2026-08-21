'use client';

import { useState } from 'react';
import { api, DashboardToday, IssueAnswer, QuestionAnswer } from '@/lib/api';
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
// backend from the app's curated libraries (92 landmark cases, 260 tutor
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
  const [selected, setSelected] = useState<number | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [answerShown, setAnswerShown] = useState(false);
  const [answerData, setAnswerData] = useState<QuestionAnswer | null>(null);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState(false);

  const [issueHintShown, setIssueHintShown] = useState(false);
  const [issueShown, setIssueShown] = useState(false);
  const [issueData, setIssueData] = useState<IssueAnswer | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState(false);

  if (!today) return null;

  const caseDay = today.case_of_the_day;
  const drill = today.citation_drill;
  const term = today.term_of_the_day;
  const question = today.question_of_the_day;
  const prompt = today.issue_prompt_of_the_day;
  const focus = today.suggested_focus;
  const correctIndex = drill.options.findIndex((o) => o.is_correct);

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

  const loadIssueAnswer = async () => {
    setIssueLoading(true);
    setIssueError(false);
    try {
      setIssueData(await api.dashboard.todayIssueAnswer());
    } catch {
      setIssueError(true);
    } finally {
      setIssueLoading(false);
    }
  };

  const toggleIssueHint = async () => {
    if (issueHintShown) {
      setIssueHintShown(false);
      return;
    }
    if (!issueData) await loadIssueAnswer();
    if (!issueError) setIssueHintShown(true);
  };

  const toggleIssue = async () => {
    if (issueShown) {
      setIssueShown(false);
      return;
    }
    if (!issueData) await loadIssueAnswer();
    if (!issueError) setIssueShown(true);
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

        <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--blue-primary)' }}>
          <div className="icon-chip icon-chip--blue"><IconLink /></div>
          <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Citation Drill</p>
          <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--dark-navy)' }}>
            Which of these is the correct Bluebook citation for
          </p>
          <p style={{
            margin: '0 0 0.75rem 0', fontFamily: 'monospace', fontSize: '0.9rem',
            background: '#f0f4f8', padding: '0.4rem 0.6rem', borderRadius: '6px',
          }}>
            {drill.raw}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {drill.options.map((option, i) => {
              const answered = selected !== null;
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
                    fontSize: '0.85rem',
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
          {selected !== null && (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 0.4rem 0', color: selected === correctIndex ? '#1b7f3a' : '#8b0000', fontWeight: 600 }}>
                {selected === correctIndex ? 'Correct!' : 'Not quite — try again tomorrow or study the rules below.'}
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
          <button className="btn btn-outline" onClick={() => onNavigate('citations')}>
            Format more citations &rarr;
          </button>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem', borderTop: '3px solid var(--blue-primary)' }}>
          <div className="icon-chip icon-chip--blue"><IconSearch /></div>
          <p className="stat-label" style={{ margin: '0 0 0.4rem 0' }}>Issue-Spotting Prompt</p>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
            {prompt.prompt}
          </p>
          {issueHintShown && issueData && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
              <strong>Hint:</strong> this case is about <strong>{issueData.subject}</strong> — specifically
              the <strong>{issueData.doctrine_name}</strong> doctrine. {issueData.doctrine_description}{' '}
              Look for who sued whom, what each side wanted, and which law or right is at stake.
            </p>
          )}
          {issueShown && issueData && (
            <div style={{ margin: '0 0 0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--dark-navy)', lineHeight: 1.5, background: '#f0f4f8', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <strong>The court&apos;s issue:</strong> {issueData.issue || issueData.holding}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--dark-navy)', lineHeight: 1.5, background: '#f0f4f8', padding: '0.5rem 0.6rem', borderRadius: '6px' }}>
                <strong>The court&apos;s holding (in plain English):</strong> {issueData.plain_holding || issueData.holding}
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-text)', lineHeight: 1.5 }}>
                Your sentence is the <em>question</em>; the holding is the court&apos;s <em>answer</em> to it.
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <button className="btn btn-outline" onClick={toggleIssueHint} disabled={issueLoading}>
              {issueHintShown ? 'Hide subject hint' : 'Show subject hint'}
            </button>
            <button className="btn btn-outline" onClick={toggleIssue} disabled={issueLoading}>
              {issueLoading ? 'Loading…' : issueShown ? "Hide the court's issue" : "Reveal the court's issue"}
            </button>
          </div>
          {issueError && (
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#8b0000' }}>
              Couldn&apos;t load the issue — try again.
            </p>
          )}
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