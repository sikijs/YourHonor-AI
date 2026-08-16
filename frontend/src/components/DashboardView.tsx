'use client';

import { useState, useEffect } from 'react';
import { User, api, UserStats, DashboardToday } from '@/lib/api';
import { friendlyDocType } from '@/lib/docTypes';
import ReviewQueueView from '@/components/ReviewQueueView';
import TodayPracticePanel from '@/components/TodayPracticePanel';
import {
  IconFile,
  IconPencil,
  IconRefresh,
  IconChat,
  IconFilePlus,
  IconCheckCircle,
  IconSearch,
  IconColumns,
} from '@/components/icons';

export default function DashboardView({
  user,
  onError,
  onNavigate,
}: {
  user: User;
  onError: (err: string) => void;
  onNavigate: (view: string, q?: string) => void;
}) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [today, setToday] = useState<DashboardToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTopic, setReviewTopic] = useState<string | null>(null);

  useEffect(() => { loadStats(); }, []);

  async function loadStats() {
    try {
      const [statsData, todayData] = await Promise.all([api.stats.me(), api.dashboard.today()]);
      setStats(statsData);
      setToday(todayData);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function closeReview() {
    setReviewOpen(false);
    setReviewTopic(null);
    loadStats();
  }

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="spinner-container"><span className="spinner" /><p>Loading your study stats...</p></div>
      </div>
    );
  }

  if (!stats) return null;

  if (reviewOpen) {
    const topicName = reviewTopic
      ? stats.tutor_review.weak_topics.find((t) => t.topic_id === reviewTopic)?.topic_name
      : undefined;
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: 'var(--dark-navy)', margin: 0 }}>
            Review Queue{topicName ? ` · ${topicName}` : ''}
          </h2>
        </div>
        <ReviewQueueView
          topicId={reviewTopic ?? undefined}
          topicName={topicName}
          onBack={closeReview}
          onGoToTutor={() => onNavigate('tutor')}
        />
        <div className="card" style={{ background: '#f8f9fa' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', margin: 0 }}>
            Reviewing cards this way is for educational purposes only. It should not be relied upon as legal advice.
          </p>
        </div>
      </div>
    );
  }

  const maxDocs = Math.max(...stats.documents_by_type.map((d) => d.count), 1);
  const review = stats.tutor_review;
  const reviewPct = review.total_reviewed > 0
    ? Math.round((review.mastered / review.total_reviewed) * 100)
    : 0;
  const sessions = stats.tutor_sessions;
  const sessionsPct = Math.round(sessions.accuracy * 100);

  const maxSkill = Math.max(...stats.skills.map((s) => s.count), 1);
  const weakestSkill = stats.skills.length > 0
    ? stats.skills.reduce((a, b) => (b.count < a.count ? b : a))
    : null;

  function relativeDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso + 'Z');
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div>
      <h2 style={{ color: 'var(--dark-navy)', margin: '0 0 1rem 0' }}>Study Dashboard</h2>

      <TodayPracticePanel
        today={today}
        onNavigate={onNavigate}
        onOpenReview={(topicId) => { setReviewTopic(topicId ?? null); setReviewOpen(true); }}
      />

      <div className="dashboard-overview">
        <div className="card stat-card">
          <div className="icon-chip icon-chip--navy icon-chip--center"><IconFile /></div>
          <p className="stat-label">Documents</p>
          <p className="stat-value">{stats.documents_total}</p>
          <p className="stat-sub">saved and uploaded</p>
        </div>
        <div className="card stat-card">
          <div className="icon-chip icon-chip--navy icon-chip--center"><IconPencil /></div>
          <p className="stat-label">Notes</p>
          <p className="stat-value">{stats.notes_total}</p>
          <p className="stat-sub">in your scratch pad</p>
        </div>
        <div className="card stat-card">
          <div className="icon-chip icon-chip--navy icon-chip--center"><IconRefresh /></div>
          <p className="stat-label">Review Queue</p>
          <p className="stat-value">{review.weak}</p>
          <p className="stat-sub">cards to restudy</p>
        </div>
        <div className="card stat-card">
          <div className="icon-chip icon-chip--navy icon-chip--center"><IconChat /></div>
          <p className="stat-label">Tutor Sessions</p>
          <p className="stat-value">{sessions.total_sessions}</p>
          <p className="stat-sub">completed live sessions</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 1rem 0', fontSize: '1.05rem' }}>Documents by Type</h3>
          {stats.documents_by_type.length === 0 ? (
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              No documents yet. <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('documents'); }}>Create or upload one</a> to start.
            </p>
          ) : (
            stats.documents_by_type.map((d) => (
              <div key={d.doc_type} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--dark-navy)' }}>{friendlyDocType(d.doc_type)}</span>
                  <span style={{ color: 'var(--gray-text)' }}>{d.count}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${(d.count / maxDocs) * 100}%` }} />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 1rem 0', fontSize: '1.05rem' }}>Tutor Review Progress</h3>
          {review.total_reviewed === 0 ? (
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              You haven&apos;t marked any review cards yet. Start an <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('tutor'); }}>AI Tutor</a> session and use Review mode to build your queue.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--dark-navy)' }}>
                  {review.mastered} mastered of {review.total_reviewed}
                </span>
                <span style={{ color: 'var(--gray-text)' }}>{reviewPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${reviewPct}%`, background: 'var(--purple-secondary)' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#1b7f3a' }}>✓ {review.mastered} mastered</span>
                <span style={{ color: '#c62828' }}>✗ {review.weak} weak</span>
              </div>
            </>
          )}
          {review.weak_topics.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', margin: '0 0 0.5rem 0' }}>Weakest topics</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--gray-text)', margin: '0 0 0.5rem 0' }}>
                Click a topic to review just its cards.
              </p>
              {review.weak_topics.map((t) => (
                <button
                  key={t.topic_id}
                  type="button"
                  onClick={() => { setReviewTopic(t.topic_id); setReviewOpen(true); }}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0.4rem 0.6rem', borderRadius: '6px', background: '#fff8e1', border: '1px solid #ffe082', marginBottom: '0.35rem', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', textAlign: 'left' }}
                >
                  <span style={{ fontWeight: 600 }}>{t.topic_name}</span>
                  <span style={{ color: '#856404' }}>{t.weak_count} card{t.weak_count === 1 ? '' : 's'} · Review &rarr;</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: review.total_reviewed === 0 ? '1rem' : '1.25rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => { setReviewTopic(null); setReviewOpen(true); }}
              disabled={review.weak === 0}
              style={{ width: '100%' }}
            >
              {review.weak > 0 ? `Review all ${review.weak} card${review.weak === 1 ? '' : 's'} in queue` : 'Review Queue (empty)'}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 1rem 0', fontSize: '1.05rem' }}>Live Tutor Sessions</h3>
          {sessions.total_sessions === 0 ? (
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              No completed live sessions yet. Finish an <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('tutor'); }}>AI Tutor</a> session to see your accuracy here.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--dark-navy)' }}>
                  {sessions.total_sessions} session{sessions.total_sessions === 1 ? '' : 's'} · {sessions.total_answers} answer{sessions.total_answers === 1 ? '' : 's'}
                </span>
                <span style={{ color: 'var(--gray-text)' }}>{sessionsPct}% correct</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${sessionsPct}%`, background: 'var(--accent-yellow)' }} />
              </div>
              <div style={{ marginTop: '1rem' }}>
                {sessions.per_topic.map((t) => {
                  const pct = Math.round(t.accuracy * 100);
                  const total = t.correct + t.wrong;
                  return (
                    <div key={t.topic_id} style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--dark-navy)' }}>{t.topic_name}</span>
                        <span style={{ color: 'var(--gray-text)' }}>{pct}% · {t.correct}/{total}</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%`, background: 'var(--accent-yellow)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 1rem 0', fontSize: '1.05rem' }}>Skills &amp; Competencies</h3>
          {stats.skills.every((s) => s.count === 0) ? (
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              Your skills build as you work. Save a document, finish a tutor session, or format a citation to get started.
            </p>
          ) : (
            <>
              {stats.skills.map((s) => (
                <div key={s.skill_id} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--dark-navy)' }} title={s.description}>{s.name}</span>
                    <span style={{ color: 'var(--gray-text)' }}>{s.count}</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.round((s.count / maxSkill) * 100)}%`, background: 'var(--purple-secondary)' }} />
                  </div>
                </div>
              ))}
              {weakestSkill && weakestSkill.count > 0 && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--gray-text)' }}>
                  Where to focus: <strong style={{ color: 'var(--dark-navy)' }}>{weakestSkill.name}</strong>
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '1.25rem 1.5rem', marginTop: '1rem' }}>
        <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>Your Work Portfolio</h3>
        {stats.portfolio.length === 0 ? (
          <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
            No work product yet. Draft a case brief, generate a memorandum, or format citations to build your portfolio.
          </p>
        ) : (
          <>
            {stats.portfolio.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #eee', gap: '1rem' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--dark-navy)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-text)' }}>
                    {friendlyDocType(item.doc_type)} · {relativeDate(item.updated_at)}
                  </p>
                </div>
                <button className="btn btn-outline" onClick={() => onNavigate('documents')} style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
                  Open
                </button>
              </div>
            ))}
            <button className="btn btn-outline" onClick={() => onNavigate('documents')} style={{ marginTop: '0.75rem' }}>
              View all documents
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ padding: '1rem 1.5rem', marginTop: '1rem', background: '#f8f9fa' }}>
        <h3 style={{ color: 'var(--dark-navy)', margin: '0 0 0.75rem 0', fontSize: '1rem' }}>Quick Actions</h3>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('briefs')}><IconFilePlus size={16} /> New Case Brief</button>
          <button className="btn btn-outline" onClick={() => onNavigate('citations')}><IconCheckCircle size={16} /> Cite-Check Text</button>
          <button className="btn btn-outline" onClick={() => onNavigate('issuespotter')}><IconSearch size={16} /> Issue Spotter</button>
          <button className="btn btn-outline" onClick={() => onNavigate('doctrines')}><IconColumns size={16} /> Compare Cases</button>
          <button className="btn btn-outline" onClick={() => onNavigate('tutor')}><IconChat size={16} /> Tutor Practice</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <button className="btn btn-outline" onClick={() => onNavigate('documents')}>My Documents</button>
        <button className="btn btn-outline" onClick={() => onNavigate('tutor')}>AI Tutor</button>
      </div>
      <p style={{ color: 'var(--gray-text)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Dashboard stats reflect your saved documents, notes, tutor review marks, and completed live tutor sessions. Educational software — not legal advice.
      </p>
    </div>
  );
}