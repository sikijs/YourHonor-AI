'use client';

import { useState } from 'react';
import { User } from '@/lib/api';
import { AI_IN_LAW, AiSection } from '@/lib/aiInLawContent';

type NavigateFn = (view: string) => void;

export default function HomeView({ user, onNavigate }: { user: User | null; onNavigate: NavigateFn }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  function toggleSection(id: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function renderSection(section: AiSection, depth: number = 0) {
    const isExpanded = expandedSections.has(section.id);
    return (
      <div key={section.id} id={section.id} style={{ marginBottom: depth === 0 ? '1rem' : depth === 1 ? '0.75rem' : '0.5rem' }}>
        <div
          onClick={() => toggleSection(section.id)}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: depth === 0 ? '0.75rem 1rem' : depth === 1 ? '0.5rem 0.75rem' : '0.35rem 0.6rem',
            background: depth === 0 ? 'var(--dark-navy)' : depth === 1 ? 'var(--blue-primary)' : 'var(--purple-secondary)',
            color: '#fff',
            borderRadius: depth >= 2 ? '6px' : '8px',
            fontSize: depth === 0 ? '1.1rem' : depth === 1 ? '0.95rem' : '0.85rem',
            fontWeight: depth === 0 ? 700 : 600,
            userSelect: 'none',
          }}
        >
          <span>{section.title}</span>
          <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
        </div>
        {isExpanded && (
          <div className="card" style={{ marginTop: '0.25rem', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            {section.paragraphs.map((p, i) => {
              const isLastFinalThought = section.id === 'final-thought' && i === section.paragraphs.length - 1;
              return (
                <p key={i} style={{
                  marginBottom: i < section.paragraphs.length - 1 ? '0.75rem' : 0,
                  lineHeight: 1.7,
                  ...(isLastFinalThought ? { fontSize: '1.2rem', fontWeight: 700 } : {}),
                }}>
                  {p}
                </p>
              );
            })}
            {section.subsections && section.subsections.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                {section.subsections.map((sub) => renderSection(sub, depth + 1))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

  return (
    <div>
      <div className="hero">
        <h1>YourHonor AI</h1>
        <p style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>AI-Powered Legal Education Platform</p>
        {user ? (
          <button className="btn btn-secondary" onClick={() => onNavigate('chat')}>
            Start Chatting
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={() => onNavigate('auth')}>
            Get Started
          </button>
        )}
      </div>

      <div style={{
        marginTop: '2rem',
        padding: '1.5rem 2rem',
        borderRadius: '12px',
        border: '2px solid var(--accent-yellow)',
        background: 'linear-gradient(135deg, #fffdf0 0%, #fff8dc 100%)',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(236,173,10,0.15)',
      }}>
        <p style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          lineHeight: 1.5,
          color: 'var(--dark-navy)',
          margin: 0,
        }}>
          &ldquo;If you graduate without understanding AI, you&rsquo;ll be outdated.<br />If you trust it blindly, you&rsquo;ll be dangerous.&rdquo;
        </p>
      </div>

      <div className="features">
        <div className="card feature-card" onClick={() => onNavigate(user ? 'briefs' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <h3>Case Briefs</h3>
          <p>Generate structured case briefs with facts, holding, reasoning, and analysis</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'summaries' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <h3>Legal Summaries</h3>
          <p>Summarize cases, statutes, and legal doctrines with key findings and principles</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'arguments' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <h3>Argument Analysis</h3>
          <p>Extract and analyze legal arguments made by each party in a case</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'citations' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <h3>Citation Maps</h3>
          <p>Map cited authorities, statutes, and constitutional provisions</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'memoranda' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <h3>Legal Memoranda</h3>
          <p>Draft structured legal memoranda with IRAC analysis for any legal question</p>
        </div>
                <div className="card feature-card" onClick={() => onNavigate(user ? 'debate' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
                  <h3>Debate Analysis</h3>
                  <p>Generate structured pro/con arguments and counter-rebuttals for any legal position</p>
                </div>
                <div className="card feature-card" onClick={() => onNavigate(user ? 'glossary' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
                  <h3>Legal Glossary</h3>
                  <p>Look up legal terms with definitions, etymologies, and usage examples</p>
                </div>
                <div className="card feature-card" onClick={() => onNavigate(user ? 'tutor' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <h3>AI Tutor</h3>
          <p>Learn legal concepts through Socratic dialogue with adaptive AI tutoring</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'documents' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <h3>Document Management</h3>
          <p>Create new legal documents from templates and manage your saved documents</p>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ color: 'var(--dark-navy)', marginBottom: '1.5rem', borderBottom: '2px solid var(--accent-yellow)', paddingBottom: '0.5rem' }}>
          Understanding AI in Law
        </h2>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {AI_IN_LAW.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(e) => { e.preventDefault(); toggleSection(section.id); setTimeout(() => document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' }), 100); }}
              style={{
                padding: '0.3rem 0.6rem',
                background: expandedSections.has(section.id) ? 'var(--blue-primary)' : '#f0f0f0',
                color: expandedSections.has(section.id) ? '#fff' : 'var(--dark-navy)',
                borderRadius: '4px',
                fontSize: '0.8rem',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {section.title}
            </a>
          ))}
        </div>

        {AI_IN_LAW.map((section) => renderSection(section))}
      </div>

      <div className="card" style={{ marginTop: '2rem', textAlign: 'center', background: '#f8f9fa' }}>
        <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
          This is educational software. Outputs are not legal advice. All AI-generated content should be independently verified.
        </p>
      </div>
    </div>
  );
}
