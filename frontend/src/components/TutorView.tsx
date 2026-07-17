'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { User, TutorTopic, TutorStartResponse, TutorQuestion, HypotheticalGenerateResponse, HypotheticalEvaluateResponse, api } from '@/lib/api';

export default function TutorView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [topics, setTopics] = useState<TutorTopic[]>([]);
  const [session, setSession] = useState<TutorStartResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<TutorQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState<{ question: string; answer: string; evaluation: string; explanation: string }[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [attemptsExceeded, setAttemptsExceeded] = useState(false);
  const [correctAnswerRevealed, setCorrectAnswerRevealed] = useState<string | null>(null);

  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewCorrect, setReviewCorrect] = useState(0);
  const [reviewWrong, setReviewWrong] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [continueLearningLoading, setContinueLearningLoading] = useState(false);
  const [showCostConfirm, setShowCostConfirm] = useState(false);
  const [dynamicConfirmTopic, setDynamicConfirmTopic] = useState<string | null>(null);

  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceFactPattern, setPracticeFactPattern] = useState('');
  const [practiceIssues, setPracticeIssues] = useState<string[]>([]);
  const [practiceModelAnswer, setPracticeModelAnswer] = useState('');
  const [practiceKeyConcepts, setPracticeKeyConcepts] = useState<string[]>([]);
  const [practiceStudentAnswer, setPracticeStudentAnswer] = useState('');
  const [practiceFeedback, setPracticeFeedback] = useState<HypotheticalEvaluateResponse | null>(null);
  const [practiceDifficulty, setPracticeDifficulty] = useState(3);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceShowCost, setPracticeShowCost] = useState(false);
  const [practiceHasDraft, setPracticeHasDraft] = useState(false);
  const [practiceSaving, setPracticeSaving] = useState(false);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  useEffect(() => {
    api.tutor.listTopics().then(res => setTopics(res.topics)).catch(() => onError('Failed to load topics'));
    const draft = localStorage.getItem('tutor_hypothetical_draft');
    if (draft) {
      try { JSON.parse(draft); setPracticeHasDraft(true); } catch { localStorage.removeItem('tutor_hypothetical_draft'); }
    }
  }, []);

  const savePracticeDraft = useCallback(() => {
    if (practiceFactPattern && !practiceFeedback) {
      localStorage.setItem('tutor_hypothetical_draft', JSON.stringify({
        fact_pattern: practiceFactPattern,
        issues: practiceIssues,
        model_answer: practiceModelAnswer,
        key_concepts: practiceKeyConcepts,
        student_answer: practiceStudentAnswer,
        difficulty: practiceDifficulty,
        topic_id: session?.topic_id,
      }));
    }
  }, [practiceFactPattern, practiceIssues, practiceModelAnswer, practiceKeyConcepts, practiceStudentAnswer, practiceDifficulty, practiceFeedback, session]);

  useEffect(() => {
    savePracticeDraft();
  }, [savePracticeDraft]);

  async function startTopic(topicId: string) {
    setLoading(true);
    setShowHint(false);
    onError('');
    try {
      const res = await api.tutor.startSession(topicId);
      setSession(res);
      setCurrentQuestion(res.current_question);
      setCurrentIndex(res.current_index);
      setTotalQuestions(res.total_questions);
      setHistory([]);
      setCorrectCount(0);
      setWrongCount(0);
      setIsComplete(false);
      setAttemptsExceeded(false);
      setCorrectAnswerRevealed(null);
      setAnswer('');
      setReviewMode(false);
      setPracticeMode(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || loading) return;
    setLoading(true);
    setShowHint(false);
    onError('');
    cancelRef.current = new AbortController();
    try {
      const res = await api.tutor.submitAnswer(answer, cancelRef.current.signal);
      setHistory(prev => [...prev, {
        question: currentQuestion?.question || '',
        answer: answer,
        evaluation: res.evaluation,
        explanation: res.explanation,
      }]);
      setCorrectCount(res.correct_count);
      setWrongCount(res.wrong_count);
      setCurrentIndex(res.current_index);
      setAttemptsExceeded(res.attempts_exceeded || false);
      setCorrectAnswerRevealed(res.correct_answer_revealed || null);
      setAnswer('');

      if (res.is_complete) {
        setIsComplete(true);
        setCurrentQuestion(null);
      } else if (res.follow_up_question) {
        setCurrentQuestion(res.follow_up_question);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      cancelRef.current = null;
      setLoading(false);
    }
  }

  async function handleStartDynamic(topicId: string) {
    setDynamicConfirmTopic(null);
    setLoading(true);
    onError('');
    try {
      const res = await api.tutor.startDynamicSession(topicId);
      setSession(res);
      setCurrentQuestion(res.current_question);
      setCurrentIndex(res.current_index);
      setTotalQuestions(res.total_questions);
      setHistory([]);
      setCorrectCount(0);
      setWrongCount(0);
      setIsComplete(false);
      setAttemptsExceeded(false);
      setCorrectAnswerRevealed(null);
      setAnswer('');
      setReviewMode(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueLearning() {
    setShowCostConfirm(false);
    setContinueLearningLoading(true);
    onError('');
    try {
      const res = await api.tutor.continueLearning();
      setCurrentQuestion(res.question);
      setIsComplete(false);
      setAttemptsExceeded(false);
      setCorrectAnswerRevealed(null);
      setAnswer('');
      setTotalQuestions(prev => prev + 1);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setContinueLearningLoading(false);
    }
  }

  async function generatePracticeHypothetical() {
    setPracticeShowCost(false);
    setPracticeLoading(true);
    onError('');
    cancelRef.current = new AbortController();
    try {
      const res = await api.tutor.generateHypothetical(session!.topic_id, practiceDifficulty, cancelRef.current.signal);
      setPracticeFactPattern(res.fact_pattern);
      setPracticeIssues(res.issues);
      setPracticeModelAnswer(res.model_answer);
      setPracticeKeyConcepts(res.key_concepts);
      setPracticeStudentAnswer('');
      setPracticeFeedback(null);
      practiceHasDraft && setPracticeHasDraft(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      cancelRef.current = null;
      setPracticeLoading(false);
    }
  }

  function resumePracticeDraft() {
    const draft = localStorage.getItem('tutor_hypothetical_draft');
    if (!draft) return;
    try {
      const parsed = JSON.parse(draft);
      if (parsed.topic_id !== session?.topic_id) {
        onError('Saved hypothetical is for a different topic. Start a new one.');
        return;
      }
      setPracticeFactPattern(parsed.fact_pattern);
      setPracticeIssues(parsed.issues || []);
      setPracticeModelAnswer(parsed.model_answer);
      setPracticeKeyConcepts(parsed.key_concepts || []);
      setPracticeStudentAnswer(parsed.student_answer || '');
      setPracticeDifficulty(parsed.difficulty || 3);
      setPracticeFeedback(null);
      setPracticeHasDraft(false);
    } catch { localStorage.removeItem('tutor_hypothetical_draft'); }
  }

  function discardPracticeDraft() {
    localStorage.removeItem('tutor_hypothetical_draft');
    setPracticeHasDraft(false);
    setPracticeFactPattern('');
    setPracticeIssues([]);
    setPracticeModelAnswer('');
    setPracticeKeyConcepts([]);
    setPracticeStudentAnswer('');
    setPracticeFeedback(null);
  }

  async function submitPracticeAnswer() {
    if (!practiceStudentAnswer.trim() || !session) return;
    setPracticeLoading(true);
    onError('');
    cancelRef.current = new AbortController();
    try {
      const res = await api.tutor.evaluateHypothetical(
        session.topic_id, practiceDifficulty,
        practiceFactPattern, practiceStudentAnswer,
        cancelRef.current.signal,
      );
      setPracticeFeedback(res);
      localStorage.removeItem('tutor_hypothetical_draft');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      cancelRef.current = null;
      setPracticeLoading(false);
    }
  }

  async function savePracticeToDocuments() {
    if (!practiceFeedback || !session) return;
    setPracticeSaving(true);
    try {
      const content = `## Difficulty: ${practiceDifficulty}/5\n\n## Fact Pattern\n${practiceFactPattern}\n\n## Your Analysis\n${practiceStudentAnswer}\n\n## Feedback\n${practiceFeedback.feedback}\n\n## Issues Identified\n${practiceFeedback.issues_identified.map(i => `- ${i}`).join('\n')}\n\n## Issues Missed\n${practiceFeedback.issues_missed.map(i => `- ${i}`).join('\n')}\n\n## Score\n${practiceFeedback.overall_score}/10\n\n## Model Answer\n${practiceFeedback.model_answer}`;
      await api.documents.create(
        `Hypothetical: ${session.topic_name} (Difficulty ${practiceDifficulty})`,
        content,
        'other',
      );
      onError('');
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setPracticeSaving(false);
    }
  }

  function resetPractice() {
    setPracticeFactPattern('');
    setPracticeIssues([]);
    setPracticeModelAnswer('');
    setPracticeKeyConcepts([]);
    setPracticeStudentAnswer('');
    setPracticeFeedback(null);
    localStorage.removeItem('tutor_hypothetical_draft');
  }

  function resetSession() {
    setSession(null);
    setCurrentQuestion(null);
    setHistory([]);
    setIsComplete(false);
    setAttemptsExceeded(false);
    setCorrectAnswerRevealed(null);
    setCorrectCount(0);
    setWrongCount(0);
    setCurrentIndex(0);
    setAnswer('');
    setShowHint(false);
    setPracticeMode(false);
    setPracticeFactPattern('');
    setPracticeIssues([]);
    setPracticeModelAnswer('');
    setPracticeKeyConcepts([]);
    setPracticeStudentAnswer('');
    setPracticeFeedback(null);
    setPracticeHasDraft(false);
    localStorage.removeItem('tutor_hypothetical_draft');
  }

  if (loading && !session) {
    return (
      <div>
        <h2 style={{ marginBottom: '1rem' }}>AI Legal Tutor</h2>
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Generating your first question...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div>
        <h2>AI Legal Tutor</h2>
        <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
          The AI Tutor uses Socratic dialogue to help you learn legal concepts through guided questions and adaptive feedback. Choose a topic and it will adjust to your skill level.
        </p>
        <p style={{ color: 'var(--gray-text)', marginBottom: '1rem' }}>
          Pick a topic to begin an interactive Socratic tutoring session.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {topics.map((topic) => {
            const isDynamicConfirming = dynamicConfirmTopic === topic.id;
            return (
              <div key={topic.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ color: 'var(--blue-primary)', margin: '0 0 0.25rem 0' }}>{topic.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: 0 }}>{topic.description}</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-text)' }}>
                    {topic.question_count} questions
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={() => startTopic(topic.id)}>
                    Start
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={() => setDynamicConfirmTopic(topic.id)}>
                      AI Quick Start
                    </button>
                  </div>
                </div>
                {isDynamicConfirming && (
                  <div style={{ padding: '0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>
                      This will use an AI API call (approx. $0.02–0.04) to generate questions on this topic. Continue?
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={() => handleStartDynamic(topic.id)}>Yes, start</button>
                      <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={() => setDynamicConfirmTopic(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading && !currentQuestion) {
    return (
      <div>
        <h2>{session.topic_name}</h2>
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container"><span className="spinner" /><p>Starting your session...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{session.topic_name}</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              className={`btn ${!reviewMode && !practiceMode ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setReviewMode(false); setPracticeMode(false); }}
              style={{ borderRadius: 0, border: 'none', fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            >
              Quiz
            </button>
            <button
              className={`btn ${reviewMode && !practiceMode ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setReviewMode(true); setPracticeMode(false); setReviewIndex(0); setReviewCorrect(0); setReviewWrong(0); setReviewFlipped(false); setReviewComplete(false); }}
              style={{ borderRadius: 0, border: 'none', fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            >
              Review
            </button>
            <button
              className={`btn ${practiceMode ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setPracticeMode(true)}
              style={{ borderRadius: 0, border: 'none', fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            >
              Practice
            </button>
          </div>
          <button className="btn btn-outline" onClick={resetSession}>Change Topic</button>
        </div>
      </div>

      {!practiceMode && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, minWidth: '200px', padding: '0.5rem 1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem' }}>
              <strong>Progress:</strong> {reviewMode ? (reviewComplete ? totalQuestions : reviewIndex) : (isComplete ? totalQuestions : currentIndex)}/{totalQuestions}
            </span>
            <div style={{ flex: 1, height: '8px', background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(reviewMode ? ((reviewComplete ? totalQuestions : reviewIndex) / totalQuestions) : ((isComplete ? totalQuestions : currentIndex) / totalQuestions)) * 100}%`, background: 'var(--blue-primary)', borderRadius: '4px', transition: 'width 0.3s' }} />
            </div>
          </div>
          <div className="card" style={{ padding: '0.5rem 1rem', display: 'flex', gap: '1rem' }}>
            {reviewMode ? (
              <>
                <span style={{ fontSize: '0.85rem', color: 'var(--blue-primary)' }}>✓ {reviewCorrect}</span>
                <span style={{ fontSize: '0.85rem', color: '#c62828' }}>✗ {reviewWrong}</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '0.85rem', color: 'var(--blue-primary)' }}>✓ {correctCount}</span>
                <span style={{ fontSize: '0.85rem', color: '#c62828' }}>✗ {wrongCount}</span>
              </>
            )}
          </div>
        </div>
      )}

      {practiceMode && !practiceFactPattern && !practiceLoading && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--dark-navy)', marginBottom: '0.75rem' }}>Practice: Hypothetical Fact Patterns</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray-text)', marginBottom: '1rem' }}>
            Generate a realistic fact pattern and practice your IRAC analysis. Your work auto-saves so you can pause and resume later.
          </p>
          {practiceHasDraft && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '6px' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#1565c0' }}>
                You have an unfinished hypothetical. Resume where you left off?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={resumePracticeDraft}>Resume</button>
                <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={discardPracticeDraft}>Discard</button>
              </div>
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.3rem' }}>Difficulty: {practiceDifficulty}/5</label>
            <input
              type="range" min="1" max="5" value={practiceDifficulty}
              onChange={(e) => setPracticeDifficulty(Number(e.target.value))}
              style={{ width: '100%', maxWidth: '300px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: '300px', fontSize: '0.75rem', color: 'var(--gray-text)' }}>
              <span>Beginner</span><span>Expert</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setPracticeShowCost(true)}>
            Generate Hypothetical
          </button>
          {practiceShowCost && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>
                This will use an AI API call (approx. $0.02–0.04) to generate a hypothetical on <strong>{session?.topic_name}</strong>. Continue?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={generatePracticeHypothetical}>Yes, generate</button>
                <button className="btn btn-outline" style={{ fontSize: '0.85rem', padding: '0.35rem 1rem' }} onClick={() => setPracticeShowCost(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {practiceMode && practiceLoading && (
        <div className="card" style={{ marginBottom: '1rem', textAlign: 'center', padding: '2rem' }}>
          <div className="spinner-container">
            <span className="spinner" />
            <p>{practiceFactPattern ? 'Evaluating your analysis...' : 'Generating hypothetical...'}</p>
          </div>
        </div>
      )}

      {practiceMode && practiceFactPattern && !practiceLoading && !practiceFeedback && (
        <div>
          <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--blue-primary)' }}>
            <h3 style={{ color: 'var(--dark-navy)', marginBottom: '0.5rem' }}>Fact Pattern</h3>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', margin: 0 }}>{practiceFactPattern}</p>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {practiceKeyConcepts.map((c, i) => (
                <span key={i} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '3px', background: '#e3f2fd', color: '#1565c0' }}>{c}</span>
              ))}
            </div>
          </div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--dark-navy)', marginBottom: '0.5rem' }}>Your IRAC Analysis</h3>
            <textarea
              value={practiceStudentAnswer}
              onChange={(e) => setPracticeStudentAnswer(e.target.value)}
              placeholder="Write your IRAC analysis here...&#10;&#10;Issue: What legal issues are presented?&#10;Rule: What rules of law apply?&#10;Application: How do the rules apply to these facts?&#10;Conclusion: What is your reasoned conclusion?"
              rows={10}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button className="btn btn-primary" onClick={submitPracticeAnswer} disabled={!practiceStudentAnswer.trim() || practiceLoading}>
                Submit Analysis
              </button>
              <button className="btn btn-outline" onClick={resetPractice} style={{ color: '#c62828', borderColor: '#c62828' }}>
                Discard & Try Another
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-text)', marginTop: '0.5rem', marginBottom: 0 }}>
              Your work is auto-saved. You can switch tabs or close the page and resume later.
            </p>
          </div>
        </div>
      )}

      {practiceMode && practiceFeedback && (
        <div>
          <div className="card" style={{ marginBottom: '1rem', background: '#f5f5f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--dark-navy)', margin: 0 }}>Evaluation</h3>
              <span style={{
                fontSize: '1.25rem', fontWeight: 700,
                color: practiceFeedback.overall_score >= 8 ? '#4caf50' : practiceFeedback.overall_score >= 5 ? '#ff9800' : '#f44336',
              }}>
                {practiceFeedback.overall_score}/10
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', background: '#e3f2fd', fontSize: '0.85rem' }}>
                <strong>Rule Accuracy: </strong>
                <span style={{
                  color: practiceFeedback.rule_accuracy === 'correct' ? '#4caf50' : practiceFeedback.rule_accuracy === 'partially_correct' ? '#ff9800' : '#f44336',
                }}>{practiceFeedback.rule_accuracy.replace('_', ' ')}</span>
              </div>
              <div style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', background: '#e3f2fd', fontSize: '0.85rem' }}>
                <strong>Application: </strong>
                <span style={{
                  color: practiceFeedback.application_quality === 'strong' ? '#4caf50' : practiceFeedback.application_quality === 'adequate' ? '#ff9800' : '#f44336',
                }}>{practiceFeedback.application_quality}</span>
              </div>
            </div>

            {practiceFeedback.issues_identified.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#4caf50', marginBottom: '0.25rem' }}>Issues Identified ✓</p>
                <ul style={{ margin: 0, fontSize: '0.85rem' }}>
                  {practiceFeedback.issues_identified.map((i, idx) => <li key={idx}>{i}</li>)}
                </ul>
              </div>
            )}

            {practiceFeedback.issues_missed.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f44336', marginBottom: '0.25rem' }}>Issues Missed ✗</p>
                <ul style={{ margin: 0, fontSize: '0.85rem' }}>
                  {practiceFeedback.issues_missed.map((i, idx) => <li key={idx}>{i}</li>)}
                </ul>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--dark-navy)', marginBottom: '0.25rem' }}>Feedback</p>
              <p style={{ fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>{practiceFeedback.feedback}</p>
            </div>

            <details style={{ marginBottom: '0.5rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--blue-primary)' }}>View Model Answer</summary>
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fff', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
                <p style={{ fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>{practiceFeedback.model_answer}</p>
              </div>
            </details>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={resetPractice}>
                Try Another Hypothetical
              </button>
              <button className="btn btn-secondary" onClick={savePracticeToDocuments} disabled={practiceSaving}>
                {practiceSaving ? 'Saving...' : 'Save to Documents'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!practiceMode && isComplete && !reviewMode && (
        <div className="card" style={{ marginBottom: '1rem', background: '#fff8dc', border: '1px solid var(--accent-yellow)', textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ color: 'var(--accent-yellow)' }}>Topic Complete! 🎉</h3>
          <p>You answered {correctCount} of {totalQuestions} questions correctly.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
            {correctCount === totalQuestions
              ? 'Excellent work! You have a strong understanding of this topic.'
              : correctCount >= totalQuestions * 0.7
              ? 'Good job! Review the areas you missed to strengthen your understanding.'
              : 'Keep practicing! Review the concepts you found challenging and try again.'}
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => startTopic(session.topic_id)}>Retry</button>
            <button className="btn btn-outline" onClick={resetSession}>Pick Another Topic</button>
            <button className="btn btn-secondary" onClick={() => setShowCostConfirm(true)} disabled={continueLearningLoading}>
              {continueLearningLoading ? 'Generating...' : 'Continue Learning'}
            </button>
          </div>
          {showCostConfirm && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', fontSize: '0.85rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', color: '#856404' }}>
                This will use an AI API call (approx. $0.02–0.04) to generate a new question on this topic. Continue?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={handleContinueLearning}>Yes, generate</button>
                <button className="btn btn-outline" onClick={() => setShowCostConfirm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!practiceMode && history.length > 0 && !isComplete && !reviewMode && (
        <div style={{ marginBottom: '1rem' }}>
          {history.map((h, i) => (
            <div key={i} className="card" style={{ marginBottom: '0.5rem', borderLeft: `4px solid ${h.evaluation === 'correct' ? '#4caf50' : h.evaluation === 'partially_correct' ? '#ff9800' : '#f44336'}` }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--dark-navy)' }}><strong>Q:</strong> {h.question}</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}><strong>You:</strong> {h.answer}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: 0 }}>{h.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {!practiceMode && correctAnswerRevealed && !reviewMode && (
        <div className="card" style={{ marginBottom: '1rem', background: '#fff3cd', border: '1px solid #ffc107' }}>
          <h4 style={{ color: '#856404', margin: '0 0 0.5rem 0' }}>Correct Answer</h4>
          <p style={{ fontSize: '0.85rem', color: '#856404', marginBottom: '0.5rem', fontStyle: 'italic' }}>
            <strong>Q:</strong> {history[0]?.question}
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>{correctAnswerRevealed}</p>
        </div>
      )}

      {!practiceMode && currentQuestion && !isComplete && !reviewMode && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ color: 'var(--dark-navy)', marginBottom: '0.5rem' }}>{currentQuestion.question}</h3>
            <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '3px', background: '#e3f2fd', color: '#1565c0', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Difficulty: {currentQuestion.difficulty}/5
            </span>
          </div>

          <form onSubmit={submitAnswer} style={{ marginTop: '0.75rem' }}>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              rows={4}
              disabled={loading}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={loading || !answer.trim()}>
                {loading ? 'Evaluating...' : 'Submit Answer'}
              </button>
              {currentQuestion.hint && (
                <button type="button" className="btn btn-outline" onClick={() => setShowHint(!showHint)}>
                  {showHint ? 'Hide Hint' : 'Show Hint'}
                </button>
              )}
            </div>
            {showHint && currentQuestion.hint && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#fff8e1', borderRadius: '6px', border: '1px solid #ffe082', fontSize: '0.85rem' }}>
                <strong>Hint:</strong> {currentQuestion.hint}
              </div>
            )}
          </form>
        </div>
      )}

      {!practiceMode && reviewMode && reviewComplete && (
        <div className="card" style={{ marginBottom: '1rem', background: '#e8f5e9', border: '1px solid #4caf50', textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ color: 'var(--accent-yellow)' }}>Review Complete! 🎉</h3>
          <p>You marked {reviewCorrect} of {reviewCorrect + reviewWrong} cards correct ({Math.round((reviewCorrect / Math.max(reviewCorrect + reviewWrong, 1)) * 100)}%).</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
            Ready to test yourself? Switch to Quiz mode to answer questions and get evaluated.
          </p>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => { setReviewMode(false); }}>Switch to Quiz Mode</button>
            <button className="btn btn-outline" onClick={resetSession}>Pick Another Topic</button>
          </div>
        </div>
      )}

      {!practiceMode && reviewMode && !reviewComplete && session.questions[reviewIndex] && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          {!reviewFlipped ? (
            <div
              onClick={() => setReviewFlipped(true)}
              style={{ cursor: 'pointer', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', textAlign: 'center' }}
            >
              <h3 style={{ color: 'var(--dark-navy)', margin: 0 }}>{session.questions[reviewIndex].question}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', marginTop: '1rem' }}>
                Click to reveal answer
              </p>
            </div>
          ) : (
            <div style={{ padding: '2rem' }}>
              <h4 style={{ color: 'var(--purple-secondary)', margin: '0 0 0.75rem 0' }}>Expected Concepts:</h4>
              <ul style={{ textAlign: 'left', margin: 0, fontSize: '0.95rem', lineHeight: '1.6' }}>
                {session.questions[reviewIndex].expected_concepts.map((c: string, i: number) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              {session.questions[reviewIndex].hint && (
                <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--gray-text)' }}>
                  <strong>Hint:</strong> {session.questions[reviewIndex].hint}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-primary" onClick={() => { setReviewCorrect(p => p + 1); const next = reviewIndex + 1; if (next >= session.questions.length) { setReviewComplete(true); } else { setReviewIndex(next); setReviewFlipped(false); } }}>
                  Got it ✓
                </button>
                <button type="button" className="btn btn-outline" onClick={() => { setReviewWrong(p => p + 1); const next = reviewIndex + 1; if (next >= session.questions.length) { setReviewComplete(true); } else { setReviewIndex(next); setReviewFlipped(false); } }} style={{ color: '#c62828', borderColor: '#c62828' }}>
                  Need to Study ✗
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ background: '#f8f9fa', marginTop: '0.5rem' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', margin: 0 }}>
          This tutoring session is for educational purposes only. It should not be relied upon as legal advice.
        </p>
      </div>
    </div>
  );
}
