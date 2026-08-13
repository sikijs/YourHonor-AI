'use client';

import { useState, useEffect } from 'react';
import { api, CurriculumCard } from '@/lib/api';

export default function ReviewQueueView({
  onBack,
  onGoToTutor,
  topicId,
  topicName,
}: {
  onBack: () => void;
  onGoToTutor: () => void;
  topicId?: string;
  topicName?: string;
}) {
  const [cards, setCards] = useState<CurriculumCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gotCount, setGotCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadQueue(); }, []);

  async function loadQueue() {
    setLoading(true);
    setError('');
    setIndex(0);
    setFlipped(false);
    setGotCount(0);
    setAgainCount(0);
    setComplete(false);
    try {
      const res = await api.tutor.reviewQueue();
      const topicCards = topicId
        ? res.cards.filter((c) => c.topic_id === topicId)
        : res.cards;
      setCards(topicCards);
    } catch (err: any) {
      setError(err.message || 'Failed to load your review queue');
    } finally {
      setLoading(false);
    }
  }

  async function mark(gotIt: boolean) {
    if (!cards || submitting) return;
    const card = cards[index];
    setSubmitting(true);
    setError('');
    try {
      await api.tutor.markReview(card.question, card.topic_id, gotIt);
      if (gotIt) setGotCount((g) => g + 1);
      else setAgainCount((g) => g + 1);
      setFlipped(false);
      if (index + 1 >= cards.length) {
        setComplete(true);
      } else {
        setIndex((i) => i + 1);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save your mark');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: '1rem', textAlign: 'center', padding: '2rem' }}>
        <div className="spinner-container"><span className="spinner" /><p>Loading review queue...</p></div>
      </div>
    );
  }

  if (!cards) {
    return (
      <div className="card" style={{ marginBottom: '1rem', textAlign: 'center', padding: '2rem' }}>
        <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 0.5rem 0' }}>Couldn&apos;t load your review queue</h3>
        <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={onBack}>Back to Dashboard</button>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '1rem', background: '#e8f5e9', border: '1px solid #4caf50', textAlign: 'center', padding: '2rem' }}>
        <h3 style={{ color: 'var(--accent-yellow)', margin: '0 0 0.5rem 0' }}>You&apos;re all caught up! 🎉</h3>
        <p style={{ fontSize: '0.9rem' }}>
          {topicId
            ? `No cards to restudy in ${topicName ?? 'this topic'} right now.`
            : 'No cards in your review queue right now.'}
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
          Cards you mark &ldquo;Need to Study&rdquo; in an AI Tutor review session will show up here.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onGoToTutor}>Start a Tutor Session</button>
          <button className="btn btn-outline" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  if (complete) {
    const total = gotCount + againCount;
    return (
      <div className="card" style={{ marginBottom: '1rem', background: '#e8f5e9', border: '1px solid #4caf50', textAlign: 'center', padding: '2rem' }}>
        <h3 style={{ color: 'var(--accent-yellow)', margin: '0 0 0.5rem 0' }}>Review Complete! 🎉</h3>
        <p>
          You marked <strong>{gotCount}</strong> of {total} cards as understood
          ({Math.round((gotCount / Math.max(total, 1)) * 100)}%).
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
          Cards you marked &ldquo;Need to Study&rdquo; ({againCount}) stay in your queue for another pass.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={loadQueue} disabled={submitting}>Review Again</button>
          <button className="btn btn-outline" onClick={onGoToTutor}>Start a Tutor Session</button>
          <button className="btn btn-outline" onClick={onBack}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const card = cards[index];
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
          Card {index + 1} of {cards.length}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--blue-primary)', fontWeight: 600 }}>
          ✓ {gotCount} &nbsp;·&nbsp; ✗ {againCount}
        </span>
      </div>
      {error && <div className="error" style={{ margin: '0.75rem 1.5rem' }}>{error}</div>}
      {!flipped ? (
        <div
          onClick={() => setFlipped(true)}
          style={{ cursor: 'pointer', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', textAlign: 'center' }}
        >
          <p style={{ fontSize: '0.85rem', color: 'var(--purple-secondary)', margin: '0 0 0.75rem 0', fontWeight: 600 }}>
            {card.topic_name} · Difficulty {card.difficulty}
          </p>
          <h3 style={{ color: 'var(--dark-navy)', margin: 0 }}>{card.question}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', marginTop: '1rem' }}>
            Click to reveal answer
          </p>
        </div>
      ) : (
        <div style={{ padding: '2rem' }}>
          <h4 style={{ color: 'var(--purple-secondary)', margin: '0 0 0.5rem 0' }}>Answer</h4>
          <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
            {card.answer || 'No written answer available for this card.'}
          </p>
          {(card.expected_concepts?.length ?? 0) > 0 && (
            <>
              <h5 style={{ color: 'var(--dark-navy)', margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 600 }}>
                Key concepts
              </h5>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
                {(card.expected_concepts ?? []).map((c, i) => (
                  <span key={i} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '3px', background: '#e3f2fd', color: '#1565c0' }}>{c}</span>
                ))}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => mark(true)} disabled={submitting}>
              Got it ✓
            </button>
            <button type="button" className="btn btn-outline" onClick={() => mark(false)} disabled={submitting} style={{ color: '#c62828', borderColor: '#c62828' }}>
              Need to Study ✗
            </button>
          </div>
        </div>
      )}
      <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-outline" onClick={onBack} style={{ fontSize: '0.8rem' }}>Back to Dashboard</button>
      </div>
    </div>
  );
}