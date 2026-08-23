'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, api } from '@/lib/api';
import { markdownComponents } from '@/components/markdownComponents';
import {
  IconPen,
  IconChartBar,
  IconLink,
  IconScales,
  IconBook,
  IconCap,
  IconLandmark,
  IconFolder,
  IconBookOpen,
  IconTarget,
} from '@/components/icons';

type NavigateFn = (view: string) => void;

export default function HomeView({ user, onNavigate }: { user: User | null; onNavigate: NavigateFn }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; sources?: { title: string; source: string; relevance_score: number }[]; suggested_tool?: string | null; suggested_name?: string | null; suggested_description?: string | null; suggested_query?: string | null }[]>([]);
  const [input, setInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [atlasCounts, setAtlasCounts] = useState<{ doctrines: number; cases: number } | null>(null);
  const cancelRef = useRef<AbortController | null>(null);
  const greetingLoaded = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isNearBottomRef.current) {
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleChatScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  useEffect(() => {
    api.doctrine
      .map()
      .then((map) => {
        const cases = new Set<string>();
        map.doctrines.forEach((d) => d.cases.forEach((c) => cases.add(c.name)));
        setAtlasCounts({ doctrines: map.doctrines.length, cases: cases.size });
      })
      .catch(() => setAtlasCounts(null));
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
            <div ref={messagesContainerRef} onScroll={handleChatScroll} style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

      <div className="features-wrapper">
      <div className="features">
        <div className="card feature-card" onClick={() => onNavigate(user ? 'drafting' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <div className="icon-chip icon-chip--blue icon-chip--center"><IconPen /></div>
          <h3>Legal Drafting</h3>
          <p>Generate case briefs, legal summaries, argument analysis, and IRAC memoranda</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'dashboard' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <div className="icon-chip icon-chip--navy icon-chip--center"><IconChartBar /></div>
          <h3>Study Dashboard</h3>
          <p>Track your documents, notes, and review queue in one overview</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'citations' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <div className="icon-chip icon-chip--blue icon-chip--center"><IconLink /></div>
          <h3>Citation Maps</h3>
          <p>Map cited authorities, statutes, and constitutional provisions — and reformat raw citations to Bluebook style</p>
        </div>
                <div className="card feature-card" onClick={() => onNavigate(user ? 'debate' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
                  <div className="icon-chip icon-chip--blue icon-chip--center"><IconScales /></div>
                  <h3>Debate Analysis</h3>
                  <p>Generate structured pro/con arguments and counter-rebuttals for any legal position</p>
                </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'issuespotter' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <div className="icon-chip icon-chip--blue icon-chip--center"><IconTarget /></div>
          <h3>Issue Spotter</h3>
          <p>Paste a fact pattern to surface every legal issue, governing rule, and application — built for exam practice</p>
        </div>
                <div className="card feature-card" onClick={() => onNavigate(user ? 'glossary' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
                  <div className="icon-chip icon-chip--blue icon-chip--center"><IconBook /></div>
                  <h3>Legal Glossary</h3>
                  <p>Look up legal terms with definitions, etymologies, and usage examples</p>
                </div>
                <div className="card feature-card" onClick={() => onNavigate(user ? 'tutor' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <div className="icon-chip icon-chip--purple icon-chip--center"><IconCap /></div>
          <h3>AI Tutor</h3>
          <p>Learn legal concepts through Socratic dialogue with adaptive AI tutoring</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate('doctrines')} style={{ cursor: 'pointer' }}>
          <div className="icon-chip icon-chip--blue icon-chip--center"><IconLandmark /></div>
          <h3>Case Law Atlas</h3>
          <p>{atlasCounts ? `Browse ${atlasCounts.cases} landmark cases across ${atlasCounts.doctrines} doctrines with an interactive timeline` : 'Browse landmark cases across doctrines with an interactive timeline'}</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'documents' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <div className="icon-chip icon-chip--blue icon-chip--center"><IconFolder /></div>
          <h3>Document Management</h3>
          <p>Create new legal documents from templates and manage your saved documents</p>
        </div>
        <div className="card feature-card" onClick={() => onNavigate(user ? 'resources' : 'auth')} style={{ cursor: user ? 'pointer' : 'default' }}>
          <div className="icon-chip icon-chip--blue icon-chip--center"><IconBookOpen /></div>
          <h3>Resources</h3>
          <p>Explore legal tech tools, AI fundamentals, and curated learning materials</p>
        </div>
      </div>
      </div>

      <div className="card" style={{ marginTop: '2rem', textAlign: 'center', background: '#f8f9fa' }}>
        <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
          This is educational software. Outputs are not legal advice. All AI-generated content should be independently verified.
        </p>
      </div>
    </div>
  );
}
