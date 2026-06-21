'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, api } from '@/lib/api';
import { markdownComponents } from '@/components/markdownComponents';
import { AI_IN_LAW, AiSection } from '@/lib/aiInLawContent';

type NavigateFn = (view: string) => void;

export default function HomeView({ user, onNavigate }: { user: User | null; onNavigate: NavigateFn }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; sources?: { title: string; source: string; relevance_score: number }[]; suggested_tool?: string | null; suggested_name?: string | null; suggested_description?: string | null; suggested_query?: string | null }[]>([]);
  const [input, setInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const cancelRef = useRef<AbortController | null>(null);
  const greetingLoaded = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function loadGreeting() {
    try {
      const { greeting } = await api.chat.greeting();
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch {
      // silently fail — greeting is optional
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || chatLoading || !user) return;

    cancelRef.current = new AbortController();
    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content })).slice(-10);
      const res = await api.chat.message(userMessage, history, cancelRef.current.signal);
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: res.response,
        sources: res.sources,
        suggested_tool: res.suggested_tool,
        suggested_name: res.suggested_name,
        suggested_description: res.suggested_description,
        suggested_query: res.suggested_query,
      }]);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
    } finally {
      setChatLoading(false);
    }
  }

  function openChat() {
    setMessages([]);
    greetingLoaded.current = false;
    setChatOpen(true);
    setTimeout(() => {
      greetingLoaded.current = true;
      loadGreeting();
      chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      inputRef.current?.focus();
    }, 100);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

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
          <button className="btn btn-secondary" onClick={openChat}>
            Ask a Question
          </button>
        ) : (
          <button className="btn btn-secondary" onClick={() => onNavigate('auth')}>
            Get Started
          </button>
        )}
      </div>

      {user && chatOpen && (
        <div ref={chatRef} className="card" style={{ marginTop: '2rem', padding: 0, overflow: 'hidden', scrollMarginTop: '1rem' }}>
          <div style={{ padding: '1rem 1.5rem', background: 'var(--dark-navy)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>Ask the AI Assistant</h3>
            <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, padding: '0 0.25rem' }} aria-label="Close chat">&times;</button>
          </div>
          <div style={{ padding: '1rem 1.5rem' }}>
            <div ref={messagesContainerRef} style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {messages.map((msg, i) => (
                <div key={i}>
                  <div style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    background: msg.role === 'user' ? 'var(--blue-primary)' : '#f0f4f8',
                    color: msg.role === 'user' ? '#fff' : '#333',
                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    marginLeft: msg.role === 'user' ? 'auto' : 0,
                    marginRight: msg.role === 'assistant' ? 'auto' : 0,
                  }}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.suggested_tool && msg.suggested_name && (
                    <div
                      onClick={() => msg.suggested_tool && onNavigate(msg.suggested_tool)}
                      style={{ margin: '0.35rem 0 0 0', padding: '0.5rem 0.75rem', cursor: 'pointer', border: '1px solid var(--blue-primary)', borderLeft: '3px solid var(--blue-primary)', borderRadius: '6px', background: '#f8fbff', fontSize: '0.85rem' }}
                    >
                      <p style={{ fontWeight: 600, color: 'var(--blue-primary)', margin: '0 0 0.2rem' }}>
                        Try the {msg.suggested_name} tool &rarr;
                      </p>
                      <p style={{ color: 'var(--gray-text)', margin: 0, fontSize: '0.8rem' }}>{msg.suggested_description}</p>
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div style={{ padding: '0.6rem 0.85rem', borderRadius: '8px', background: '#f0f4f8', fontSize: '0.9rem', alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div className="spinner-container"><span className="spinner" /><em>Thinking...</em></div>
                </div>
              )}
            </div>
            {messages.length === 0 && !chatLoading && (
              <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem', textAlign: 'center', marginBottom: '0.75rem' }}>
                Ask about legal concepts, current events, or anything on your mind.
              </p>
            )}
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.5rem' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={chatLoading}
                rows={1}
                style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'none', margin: 0 }}
              />
              <button type="submit" className="btn btn-primary" disabled={chatLoading || !input.trim()} style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}

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
