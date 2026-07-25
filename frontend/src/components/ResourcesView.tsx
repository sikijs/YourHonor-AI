'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchLegalTechContent } from '@/lib/legalTechContent';
import { markdownComponents } from '@/components/markdownComponents';
import { AI_IN_LAW, AiSection } from '@/lib/aiInLawContent';

function renderSectionContent(section: AiSection, depth: number = 0) {
  return (
    <div key={section.id} style={{ marginBottom: depth === 0 ? '1rem' : '0.75rem' }}>
      <h4 style={{
        color: depth === 0 ? 'var(--dark-navy)' : 'var(--blue-primary)',
        fontSize: depth === 0 ? '1.05rem' : '0.95rem',
        marginBottom: '0.5rem',
      }}>
        {section.title}
      </h4>
      {section.paragraphs.map((p, i) => (
        <p key={i} style={{
          marginBottom: i < section.paragraphs.length - 1 ? '0.6rem' : 0,
          lineHeight: 1.7,
        }}>
          {p}
        </p>
      ))}
      {section.subsections && section.subsections.length > 0 && (
        <div style={{ marginTop: '1rem', marginLeft: '1rem', borderLeft: '2px solid var(--accent-yellow)', paddingLeft: '1rem' }}>
          {section.subsections.map((sub) => renderSectionContent(sub, depth + 1))}
        </div>
      )}
    </div>
  );
}

export default function ResourcesView() {
  const [content, setContent] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    fetchLegalTechContent().then(setContent);
  }, []);

  function toggleSection(id: string) {
    setActiveSection((prev) => (prev === id ? null : id));
  }

  const introPart = content ? content.split('## 1. Understanding AI')[0] : '';
  const restPart = content
    ? '## 1. Understanding AI' + content.split('## 1. Understanding AI').slice(1).join('## 1. Understanding AI')
    : '';

  return (
    <div>
      <h2 style={{ color: 'var(--dark-navy)', marginBottom: '1.5rem' }}>Legal Tech &amp; AI Tools</h2>

      {content ? (
        <>
          {/* Intro — everything before "## 1. Understanding AI" */}
          <div className="card" style={{ padding: '1.5rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
              {introPart}
            </ReactMarkdown>
          </div>

          {/* AI-in-Law section */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{
              color: 'var(--dark-navy)',
              fontSize: '1.1rem',
              marginBottom: '1rem',
              borderBottom: '2px solid var(--accent-yellow)',
              paddingBottom: '0.5rem',
            }}>
              Understanding AI in Law
            </h3>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {AI_IN_LAW.map((section) => (
                <button
                  key={section.id}
                  onClick={() => toggleSection(section.id)}
                  style={{
                    padding: '0.3rem 0.6rem',
                    background: activeSection === section.id ? 'var(--blue-primary)' : '#f0f0f0',
                    color: activeSection === section.id ? '#fff' : 'var(--dark-navy)',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {section.title}
                </button>
              ))}
            </div>

            {activeSection && (
              <div className="card" style={{ padding: '1.25rem', lineHeight: 1.7, borderTop: '3px solid var(--blue-primary)' }}>
                {AI_IN_LAW.filter((s) => s.id === activeSection).map((section) => renderSectionContent(section))}
              </div>
            )}
          </div>

          {/* Rest — from "## 1. Understanding AI" onwards */}
          <div className="card" style={{ padding: '1.5rem', lineHeight: 1.7 }}>
            <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
              {restPart}
            </ReactMarkdown>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--gray-text)' }}>Loading...</p>
      )}
    </div>
  );
}
