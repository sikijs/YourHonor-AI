'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { marked } from 'marked';
import type { Components } from 'react-markdown';
import { api, User, Document, CaseBriefResponse, LegalSummaryResponse, ArgumentExtractionResponse, Argument, CitationMapResponse, CitedAuthority, CatalogResponse, CatalogTemplate, TemplateField, GenerateDocumentResponse, MemorandumResponse, LegalIssue, TutorTopic, TutorQuestion, TutorStartResponse, TutorAnswerResponse, DebateResponse, DebateArgument, GlossaryResponse, ChatMessageResponse, SourceInfo } from '@/lib/api';
import { AI_IN_LAW, AiSection } from '@/lib/aiInLawContent';
import { ABOUT_SECTIONS, AboutSection } from '@/lib/aboutContent';
import { fetchLegalTechContent } from '@/lib/legalTechContent';
import { printContent, caseBriefHtml, summaryHtml, argumentsHtml, citationMapHtml, memorandumHtml, debateHtml, glossaryHtml, documentHtml, resultToPlainText } from '@/lib/print';

function GlossaryView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<GlossaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult(null);
    onError('');
    try {
      const entry = await api.legal.glossary(query, selectedDocId);
      setResult(entry);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Legal Glossary</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A legal glossary defines key terms and concepts with etymology, usage examples, and practice tips. Mastering legal terminology is essential for reading cases and understanding the law.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a legal term to get a definition with etymology, usage examples, related terms, and practice tips.
      </p>
      <form onSubmit={handleLookup} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter a legal term (e.g., habeas corpus, mens rea, stare decisis)..."
            style={{ marginBottom: 0 }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
            {loading ? 'Looking up...' : 'Look Up'}
          </button>
        </div>
        {documents.length > 0 && (
          <select
            value={selectedDocId ?? ''}
            onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : undefined)}
            style={{ fontSize: '0.85rem', marginBottom: 0 }}
          >
            <option value="">General (no specific document)</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.title}</option>
            ))}
          </select>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Searching legal sources and generating definition...</p>
        </div>
      )}

      {result && (
        <div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <h3 style={{ marginBottom: 0 }}>{result.term}</h3>
              {result.also_known_as && (
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>
                  also known as: {result.also_known_as}
                </span>
              )}
            </div>
            {result.etymology && (
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', marginBottom: '0.75rem' }}>
                <em>Etymology:</em> {result.etymology}
              </p>
            )}
            <div style={{ background: '#e3f2fd', padding: '1rem', borderRadius: '6px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{result.definition}</p>
            </div>
            {result.jurisdiction && (
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <strong>Jurisdiction:</strong> {result.jurisdiction}
              </p>
            )}
          </div>

          {result.usage_example && (
            <div className="card" style={{ background: '#f9f9f9', borderLeft: '4px solid var(--blue-primary)' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Usage Example</h4>
              <p style={{ fontStyle: 'italic', margin: 0, color: '#555' }}>{result.usage_example}</p>
            </div>
          )}

          {result.related_terms.length > 0 && (
            <div className="card">
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Related Terms</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {result.related_terms.map((term, i) => (
                  <span key={i} style={{
                    background: '#e8eaf6',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    color: '#283593',
                  }}>
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.practice_tips && (
            <div className="card" style={{ background: '#fff8e1', border: '1px solid #ffe082' }}>
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#e65100' }}>Practice Tips</h4>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>{result.practice_tips}</p>
            </div>
          )}

          {result.citations.length > 0 && (
            <div className="card">
              <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Sources</h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                {result.citations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => printContent('Glossary: ' + result.term, glossaryHtml(result))}>
              Save PDF
            </button>
          </div>

          {result.from_seed && (
            <div className="card" style={{ background: '#e8f5e9', border: '1px solid #4caf50', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#2e7d32', margin: 0 }}>
                This entry is from the curated legal glossary. Definitions have been verified from established legal sources.
              </p>
            </div>
          )}

          {!result.from_seed && (
            <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#856404', margin: 0 }}>
                {result.disclaimer}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'auth' | 'documents' | 'chat' | 'briefs' | 'summaries' | 'arguments' | 'citations' | 'memoranda' | 'generator' | 'tutor' | 'debate' | 'glossary' | 'resources' | 'about'>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const userData = await api.auth.me();
      setUser(userData);
      setView('home');
    } catch {
      setUser(null);
      setView('auth');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await api.auth.signout();
      setUser(null);
      setView('auth');
    } catch (err) {
      setError('Failed to sign out');
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/logo.png" alt="YourHonor AI" height="180" />
          <h1>YourHonor AI</h1>
        </div>
        <nav>
          {user ? (
            <>
              <a href="#" onClick={() => setView('home')}>Home</a>
              <a href="#" onClick={() => setView('about')}>About</a>
              <a href="#" onClick={() => setView('briefs')}>Case Briefs</a>
              <a href="#" onClick={() => setView('summaries')}>Summaries</a>
              <a href="#" onClick={() => setView('arguments')}>Arguments</a>
              <a href="#" onClick={() => setView('citations')}>Citations</a>
              <a href="#" onClick={() => setView('memoranda')}>Memoranda</a>
              <a href="#" onClick={() => setView('debate')}>Debate</a>
              <a href="#" onClick={() => setView('tutor')}>AI Tutor</a>
              <a href="#" onClick={() => setView('documents')}>My Documents</a>
              <a href="#" onClick={() => setView('glossary')}>Glossary</a>
              <a href="#" onClick={() => setView('resources')}>Resources</a>
              <a href="#" onClick={() => setView('chat')}>Chat</a>
              <a href="#" onClick={handleSignOut}>Sign Out</a>
            </>
          ) : (
            <>
              <a href="#" onClick={() => setView('home')}>Home</a>
              <a href="#" onClick={() => setView('about')}>About</a>
              <a href="#" onClick={() => setView('resources')}>Resources</a>
              <a href="#" onClick={() => setView('auth')}>Sign In</a>
            </>
          )}
        </nav>
      </header>

      <main className="container">
        {error && <div className="error">{error}</div>}

        {view === 'home' && (
          <HomeView user={user} onNavigate={setView} />
        )}

        {view === 'auth' && (
          <AuthView
            onAuthSuccess={(userData) => {
              setUser(userData);
              setView('home');
            }}
            onError={setError}
          />
        )}

        {view === 'documents' && user && (
          <DocumentsView user={user} onError={setError} />
        )}

        {view === 'briefs' && user && (
          <CaseBriefView user={user} onError={setError} />
        )}

        {view === 'summaries' && user && (
          <SummaryView user={user} onError={setError} />
        )}

        {view === 'arguments' && user && (
          <ArgumentsView user={user} onError={setError} />
        )}

        {view === 'citations' && user && (
          <CitationMapView user={user} onError={setError} />
        )}

        {view === 'memoranda' && user && (
          <MemorandumView user={user} onError={setError} />
        )}

        {view === 'tutor' && user && (
          <TutorView user={user} onError={setError} />
        )}

        {view === 'debate' && user && (
          <DebateView user={user} onError={setError} />
        )}

        {view === 'glossary' && user && (
          <GlossaryView user={user} onError={setError} />
        )}

        {view === 'generator' && user && (
          <GenerateDocumentView user={user} onError={setError} />
        )}

        {view === 'chat' && user && (
          <ChatView user={user} onError={setError} onNavigate={(v) => setView(v as any)} />
        )}

        {view === 'resources' && (
          <ResourcesView />
        )}

        {view === 'about' && (
          <AboutView />
        )}
      </main>
    </>
  );
}

function AboutView() {
  return (
    <div>
      {ABOUT_SECTIONS.map((section) => (
        <div key={section.id} id={section.id} style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--dark-navy)', marginBottom: '1rem', borderBottom: '2px solid var(--accent-yellow)', paddingBottom: '0.5rem' }}>
            {section.title}
          </h2>
          {section.paragraphs.map((p, i) => {
            if (typeof p === 'string') {
              if (p.startsWith('Hey there')) {
                return <p key={i} style={{ fontSize: '1.3rem', color: 'var(--dark-navy)', marginBottom: '0.75rem' }}>{p}</p>;
              }
              if (section.id === 'disclaimer') {
                return (
                  <div key={i} className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.9rem', color: '#856404', margin: 0 }}>{p}</p>
                  </div>
                );
              }
              return <p key={i} style={{ marginBottom: '0.75rem', lineHeight: 1.7, color: '#444' }}>{p}</p>;
            }
            return (
              <div key={i} style={{ marginBottom: '0.75rem' }}>
                {p.heading && (
                  <h4 style={{ color: 'var(--blue-primary)', marginBottom: '0.25rem' }}>{p.heading}</h4>
                )}
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
                  {p.items.map((item, j) => (
                    <li key={j} style={{ marginBottom: '0.3rem', color: '#444' }}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ResourcesView() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetchLegalTechContent().then(setContent);
  }, []);

  return (
    <div>
      <h2 style={{ color: 'var(--dark-navy)', marginBottom: '1.5rem' }}>Legal Tech &amp; AI Tools</h2>
      {content ? (
        <div className="card" style={{ padding: '1.5rem', lineHeight: 1.7 }}>
          <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <p style={{ color: 'var(--gray-text)' }}>Loading...</p>
      )}
    </div>
  );
}

function HomeView({ user, onNavigate }: { user: User | null; onNavigate: (v: 'home' | 'auth' | 'documents' | 'chat' | 'briefs' | 'summaries' | 'arguments' | 'citations' | 'memoranda' | 'debate' | 'generator' | 'tutor' | 'glossary' | 'resources' | 'about') => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['intro']));

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
            background: depth === 0 ? '#546e7a' : depth === 1 ? '#90a4ae' : '#b0bec5',
            color: depth === 0 ? '#fff' : 'var(--dark-navy)',
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
        <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>AI-Powered Legal Education Platform</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--gray-text)', maxWidth: '600px', margin: '0 auto 1.5rem' }}>
          &ldquo;If you graduate without understanding AI, you&rsquo;ll be outdated.<br />If you trust it blindly, you&rsquo;ll be dangerous.&rdquo;
        </p>
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

function AuthView({ onAuthSuccess, onError }: { onAuthSuccess: (user: User) => void; onError: (err: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    onError('');

    try {
      if (isLogin) {
        const result = await api.auth.signin(email, password);
        const userData = await api.auth.me();
        onAuthSuccess(userData);
      } else {
        await api.auth.signup(email, password);
        const result = await api.auth.signin(email, password);
        const userData = await api.auth.me();
        onAuthSuccess(userData);
      }
    } catch (err: any) {
      onError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <div className="card">
        <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', textAlign: 'center' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <a href="#" onClick={() => setIsLogin(!isLogin)} style={{ color: 'var(--blue-primary)' }}>
            {isLogin ? 'Sign Up' : 'Sign In'}
          </a>
        </p>
      </div>
    </div>
  );
}

function DocumentsView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [docType, setDocType] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [subMode, setSubMode] = useState<'list' | 'generate'>('list');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const docs = await api.documents.list();
      setDocuments(docs);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.documents.create(title, content, docType || undefined);
      setShowModal(false);
      setTitle('');
      setContent('');
      setDocType('');
      loadDocuments();
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const title = file.name.replace(/\.pdf$/i, '');
      await api.documents.upload(file, title);
      loadDocuments();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.documents.delete(id);
      loadDocuments();
    } catch (err: any) {
      onError(err.message);
    }
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleUpload(file);
    }
  }

  return (
    <div>
      {subMode === 'generate' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Generate New Document</h2>
            <button className="btn btn-outline" onClick={() => setSubMode('list')}>← Back to My Documents</button>
          </div>
          <p style={{ color: 'var(--gray-text)', marginBottom: '1rem' }}>
            Generate legal documents from templates — NDAs, service agreements, complaints, and more. The AI will guide you through filling in the required fields based on your needs.
          </p>
          <GenerateDocumentView user={user} onError={onError} />
        </div>
      )}

      {subMode === 'list' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>My Documents</h2>
              <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden', marginLeft: '1rem' }}>
                <button
                  className={`btn btn-primary`}
                  onClick={() => setSubMode('generate')}>+ Generate New</button>
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--gray-text)', marginBottom: '1rem' }}>
            Your saved documents — case briefs, summaries, memoranda, and generated forms. This is your workspace for managing everything you create.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              Upload PDF
            </button>
            <button className="btn btn-secondary" onClick={() => setShowModal(true)}>New Document</button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />

          {uploading && (
            <div className="card" style={{ textAlign: 'center', padding: '1rem', marginBottom: '1rem' }}>
              <p>Uploading and extracting text...</p>
            </div>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : documents.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: 'center', padding: '3rem 2rem', border: '2px dashed var(--gray-text)', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <p style={{ color: 'var(--gray-text)', marginBottom: '0.5rem' }}>
                No documents yet.
              </p>
              <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
                Click to upload a PDF, drag and drop, or create a new text document.
              </p>
            </div>
          ) : (
            <div
              className="documents-list"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              {documents.map((doc) => (
                <div key={doc.id} className="card document-item">
                  <div>
                    <h3>{doc.title}</h3>
                    <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
                      {doc.doc_type || 'Document'} - {new Date(doc.updated_at).toLocaleDateString()}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {doc.original_filename && (
                        <span style={{ fontSize: '0.8rem', background: '#f0f0f0', padding: '0.15rem 0.5rem', borderRadius: '3px', color: 'var(--gray-text)' }}>
                          {doc.original_filename}
                        </span>
                      )}
                      {doc.file_size != null && doc.file_size > 0 && (
                        <span style={{ fontSize: '0.8rem', background: '#f0f0f0', padding: '0.15rem 0.5rem', borderRadius: '3px', color: 'var(--gray-text)' }}>
                          {formatSize(doc.file_size)}
                        </span>
                      )}
                      {doc.file_type && (
                        <span style={{ fontSize: '0.8rem', background: '#e3f2fd', padding: '0.15rem 0.5rem', borderRadius: '3px', color: '#1565c0' }}>
                          {doc.file_type.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="document-actions">
                    <button className="btn btn-outline" onClick={() => setViewDoc(doc)}>
                      View
                    </button>
                    {doc.content && (
                      <button className="btn btn-outline" onClick={() => printContent(doc.title, documentHtml(doc.content!))}>
                        Download
                      </button>
                    )}
                    <button className="btn btn-outline" style={{ borderColor: '#d32f2f', color: '#d32f2f' }} onClick={() => handleDelete(doc.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>New Document</h2>
                  <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <form onSubmit={handleCreate}>
                  <div className="form-group">
                    <label>Title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                      <option value="">Select type...</option>
                      <option value="case_brief">Case Brief</option>
                      <option value="memo">Legal Memorandum</option>
                      <option value="agreement">Agreement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>Content</label>
                      <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                        <button type="button" className={`btn btn-sm ${!showPreview ? 'btn-primary' : ''}`} style={{ borderRadius: 0, border: 'none', padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setShowPreview(false)}>Write</button>
                        <button type="button" className={`btn btn-sm ${showPreview ? 'btn-primary' : ''}`} style={{ borderRadius: 0, border: 'none', padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setShowPreview(true)}>Preview</button>
                      </div>
                    </div>
                    {showPreview ? (
                      <div className="card" style={{ padding: '0.75rem', minHeight: '130px', lineHeight: 1.6, fontSize: '0.9rem' }}>
                        {content ? <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown> : <span style={{ color: 'var(--gray-text)' }}>Nothing to preview</span>}
                      </div>
                    ) : (
                      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary">Create Document</button>
                </form>
              </div>
            </div>
          )}

          {viewDoc && (
            <div className="modal-overlay" onClick={() => setViewDoc(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--white)', zIndex: 1 }}>
                  <h2>{viewDoc.title}</h2>
                  <button className="modal-close" onClick={() => setViewDoc(null)}>&times;</button>
                </div>
                <div style={{ padding: '1rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                  {viewDoc.content ? (
                    <ReactMarkdown components={markdownComponents}>{viewDoc.content}</ReactMarkdown>
                  ) : (
                    <p style={{ color: 'var(--gray-text)' }}>No content</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CaseBriefView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [brief, setBrief] = useState<CaseBriefResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    setLoading(true);
    setBrief(null);
    setSaved(false);
    onError('');
    try {
      const result = await api.legal.caseBrief(query, selectedDocId, cancelRef.current.signal);
      setBrief(result);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Case Brief Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A case brief is a structured summary of a court opinion that distills the facts, issues, holding, reasoning, and significance. Law students use briefs to prepare for class, organize complex cases, and study for exams.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a case name or citation to generate a structured legal brief.
      </p>
      <form onSubmit={handleGenerate} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Marbury v. Madison, 5 U.S. 137"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Brief'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.25rem' }}>
              Use an uploaded PDF:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={selectedDocId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedDocId(id);
                  if (id) {
                    const doc = documents.find(d => d.id === id);
                    if (doc) setQuery(doc.title);
                  }
                }}
                disabled={loading}
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
              >
                <option value="">Search all legal sources (default)</option>
                {documents.filter(d => d.file_path).map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title}</option>
                ))}
              </select>
              {selectedDocId && (
                <span style={{ fontSize: '0.8rem', color: 'var(--purple-secondary)', fontWeight: 600 }}>
                  PDF selected
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.25rem' }}>
              {selectedDocId
                ? 'The analysis will be based on your uploaded document. Type a query above and click Generate.'
                : 'Select one of your uploaded PDFs to analyze it directly.'}
            </p>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Retrieving case and generating brief...</p>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {brief && (
        <div className="brief-result">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{brief.case_name}</h2>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              {brief.citation.join(', ')} | {brief.court} | {brief.date_filed}
              <br />Source: {brief.source}
            </p>
          </div>

          {[
            { label: 'Facts', content: brief.facts },
            { label: 'Procedural History', content: brief.procedural_history },
            { label: 'Holding', content: brief.holding },
            { label: 'Reasoning', content: brief.reasoning },
            { label: 'Rule of Law', content: brief.rule_of_law },
            { label: 'Significance', content: brief.significance },
          ].map((section) => (
            <div key={section.label} className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>{section.label}</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{section.content}</p>
            </div>
          ))}

          {brief.issues.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Issues</h3>
              <ul>
                {brief.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {brief.concurrence && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Concurrence</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{brief.concurrence}</p>
            </div>
          )}

          {brief.dissent && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Dissent</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{brief.dissent}</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: '#2e7d32', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(caseBriefHtml(brief))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Case Brief: ' + brief.case_name, caseBriefHtml(brief))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
              {brief.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [summaryType, setSummaryType] = useState('general');
  const [summary, setSummary] = useState<LegalSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    setLoading(true);
    setSummary(null);
    setSaved(false);
    onError('');
    try {
      const result = await api.legal.summary(query, summaryType, selectedDocId, cancelRef.current.signal);
      setSummary(result);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Legal Summary Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A legal summary condenses a case, statute, or doctrine into its essential components — helping you quickly grasp core principles and key findings without reading the full text.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a legal topic, case name, or statute to generate a structured summary.
      </p>
      <form onSubmit={handleGenerate} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Miranda v. Arizona, First Amendment, tort law"
            style={{ flex: 1, minWidth: '200px' }}
            disabled={loading}
          />
          <select value={summaryType} onChange={(e) => setSummaryType(e.target.value)} disabled={loading}
            style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem' }} aria-label="Summary type">
            <option value="general">General</option>
            <option value="case">Case Summary</option>
            <option value="statute">Statute Summary</option>
            <option value="doctrine">Legal Doctrine</option>
          </select>
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-text)', whiteSpace: 'nowrap' }}>
            {summaryType === 'general' ? 'general summary' :
             summaryType === 'case' ? 'case-focused' :
             summaryType === 'statute' ? 'statute-focused' : 'doctrine-focused'}
          </span>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Summary'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.25rem' }}>
              Use an uploaded PDF:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={selectedDocId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedDocId(id);
                  if (id) {
                    const doc = documents.find(d => d.id === id);
                    if (doc) setQuery(doc.title);
                  }
                }}
                disabled={loading}
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
              >
                <option value="">Search all legal sources (default)</option>
                {documents.filter(d => d.file_path).map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title}</option>
                ))}
              </select>
              {selectedDocId && (
                <span style={{ fontSize: '0.8rem', color: 'var(--purple-secondary)', fontWeight: 600 }}>
                  PDF selected
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.25rem' }}>
              {selectedDocId
                ? 'The analysis will be based on your uploaded document. Type a query above and click Generate.'
                : 'Select one of your uploaded PDFs to analyze it directly.'}
            </p>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Retrieving content and generating summary...</p>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {summary && (
        <div className="brief-result">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{summary.title}</h2>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              Type: {summary.summary_type} | Source: {summary.source}
            </p>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Overview</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{summary.overview}</p>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Key Findings</h3>
            <ul>
              {summary.key_findings.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Legal Principles</h3>
            <ul>
              {summary.legal_principles.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Impact</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{summary.impact}</p>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Key Points</h3>
            <ul>
              {summary.key_points.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          {summary.sources_consulted.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Sources Consulted</h3>
              <ul>
                {summary.sources_consulted.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: '#2e7d32', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(summaryHtml(summary))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Legal Summary: ' + summary.title, summaryHtml(summary))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
              {summary.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ArgumentsView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<ArgumentExtractionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    setLoading(true);
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const args = await api.legal.arguments(query, selectedDocId, cancelRef.current.signal);
      setResult(args);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Argument Extraction</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        Legal argument analysis examines the reasoning presented by each party in a case. Understanding how petitioners and respondents construct their arguments is fundamental to thinking — and writing — like a lawyer.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a case name to extract and analyze legal arguments made by each party.
      </p>
      <form onSubmit={handleExtract} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Miranda v. Arizona"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Extracting...' : 'Extract Arguments'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.25rem' }}>
              Use an uploaded PDF:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={selectedDocId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedDocId(id);
                  if (id) {
                    const doc = documents.find(d => d.id === id);
                    if (doc) setQuery(doc.title);
                  }
                }}
                disabled={loading}
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
              >
                <option value="">Search all legal sources (default)</option>
                {documents.filter(d => d.file_path).map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title}</option>
                ))}
              </select>
              {selectedDocId && (
                <span style={{ fontSize: '0.8rem', color: 'var(--purple-secondary)', fontWeight: 600 }}>
                  PDF selected
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.25rem' }}>
              {selectedDocId
                ? 'The analysis will be based on your uploaded document. Type a query above and click Generate.'
                : 'Select one of your uploaded PDFs to analyze it directly.'}
            </p>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Retrieving case and analyzing arguments...</p>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="brief-result">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{result.case_name}</h2>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              {result.petitioner} vs {result.respondent} | Source: {result.source}
            </p>
          </div>

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--purple-secondary)' }}>Parties</h3>
            <p><strong>Petitioner:</strong> {result.petitioner}</p>
            <p><strong>Respondent:</strong> {result.respondent}</p>
          </div>

          {result.petitioner_arguments.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--purple-secondary)' }}>{result.petitioner}&apos;s Arguments</h3>
              {result.petitioner_arguments.map((arg, i) => (
                <div key={i} style={{ marginBottom: i < result.petitioner_arguments.length - 1 ? '1rem' : 0, paddingBottom: i < result.petitioner_arguments.length - 1 ? '1rem' : 0, borderBottom: i < result.petitioner_arguments.length - 1 ? '1px solid #eee' : 'none' }}>
                  <p><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Authorities:</strong> {arg.authorities.join(', ')}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Court Resolution:</strong> {arg.court_resolution}</p>
                </div>
              ))}
            </div>
          )}
          {result.respondent_arguments.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>{result.respondent}&apos;s Arguments</h3>
              {result.respondent_arguments.map((arg, i) => (
                <div key={i} style={{ marginBottom: i < result.respondent_arguments.length - 1 ? '1rem' : 0, paddingBottom: i < result.respondent_arguments.length - 1 ? '1rem' : 0, borderBottom: i < result.respondent_arguments.length - 1 ? '1px solid #eee' : 'none' }}>
                  <p><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Authorities:</strong> {arg.authorities.join(', ')}</p>
                  <p style={{ marginTop: '0.25rem' }}><strong>Court Resolution:</strong> {arg.court_resolution}</p>
                </div>
              ))}
            </div>
          )}

          {result.counterarguments_considered.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Counterarguments Considered</h3>
              <ul>
                {result.counterarguments_considered.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {result.key_doctrines_statutes.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Key Doctrines &amp; Statutes</h3>
              <ul>
                {result.key_doctrines_statutes.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--accent-yellow)' }}>Outcome</h3>
            <p><strong>Winning Party:</strong> {result.winning_party}</p>
            <p style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}><strong>Rationale:</strong> {result.rationale}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: '#2e7d32', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(argumentsHtml(result))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Argument Map: ' + result.case_name, argumentsHtml(result))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
              {result.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CitationMapView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CitationMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    setLoading(true);
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const cit = await api.legal.citations(query, selectedDocId, cancelRef.current.signal);
      setResult(cit);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Citation Map</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A citation map traces how courts have referenced a case over time — whether followed, distinguished, or overruled. This reveals a case&apos;s legal lineage and helps you assess its continuing authority.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a case name to map cited authorities, statutes, and constitutional provisions.
      </p>
      <form onSubmit={handleGenerate} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Miranda v. Arizona"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Map'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.25rem' }}>
              Use an uploaded PDF:
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={selectedDocId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : undefined;
                  setSelectedDocId(id);
                  if (id) {
                    const doc = documents.find(d => d.id === id);
                    if (doc) setQuery(doc.title);
                  }
                }}
                disabled={loading}
                style={{ flex: 1, fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}
              >
                <option value="">Search all legal sources (default)</option>
                {documents.filter(d => d.file_path).map((doc) => (
                  <option key={doc.id} value={doc.id}>{doc.title}</option>
                ))}
              </select>
              {selectedDocId && (
                <span style={{ fontSize: '0.8rem', color: 'var(--purple-secondary)', fontWeight: 600 }}>
                  PDF selected
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.25rem' }}>
              {selectedDocId
                ? 'The analysis will be based on your uploaded document. Type a query above and click Generate.'
                : 'Select one of your uploaded PDFs to analyze it directly.'}
            </p>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Analyzing citations...</p>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="brief-result">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{result.case_name}</h2>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
              Total authorities cited: {result.total_citations} | Source: {result.source}
            </p>
          </div>

          {result.cases_cited.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--blue-primary)' }}>Cases Cited</h3>
              {result.cases_cited.map((item, i) => (
                <div key={i} style={{ marginBottom: i < result.cases_cited.length - 1 ? '0.75rem' : 0, paddingBottom: i < result.cases_cited.length - 1 ? '0.75rem' : 0, borderBottom: i < result.cases_cited.length - 1 ? '1px solid #eee' : 'none' }}>
                  <p style={{ fontWeight: 600 }}>{item.name}{item.citation ? `, ${item.citation}` : ''}</p>
                  <p style={{ fontSize: '0.9rem' }}>{item.context}</p>
                  <span style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem', borderRadius: '3px', background: item.treatment === 'followed' ? '#e8f5e9' : item.treatment === 'overruled' ? '#ffebee' : '#fff3e0', color: item.treatment === 'followed' ? '#2e7d32' : item.treatment === 'overruled' ? '#c62828' : '#e65100' }}>{item.treatment}</span>
                </div>
              ))}
            </div>
          )}
          {result.statutes_cited.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--purple-secondary)' }}>Statutes Cited</h3>
              {result.statutes_cited.map((item, i) => (
                <div key={i} style={{ marginBottom: i < result.statutes_cited.length - 1 ? '0.75rem' : 0, paddingBottom: i < result.statutes_cited.length - 1 ? '0.75rem' : 0, borderBottom: i < result.statutes_cited.length - 1 ? '1px solid #eee' : 'none' }}>
                  <p style={{ fontWeight: 600 }}>{item.name}{item.citation ? `, ${item.citation}` : ''}</p>
                  <p style={{ fontSize: '0.9rem' }}>{item.context}</p>
                  <span style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem', borderRadius: '3px', background: '#e8f5e9', color: '#2e7d32' }}>{item.treatment}</span>
                </div>
              ))}
            </div>
          )}
          {result.constitutional_provisions.length > 0 && (
            <div className="card" style={{ marginBottom: '0.75rem' }}>
              <h3 style={{ color: '#2e7d32' }}>Constitutional Provisions</h3>
              {result.constitutional_provisions.map((item, i) => (
                <div key={i} style={{ marginBottom: i < result.constitutional_provisions.length - 1 ? '0.75rem' : 0, paddingBottom: i < result.constitutional_provisions.length - 1 ? '0.75rem' : 0, borderBottom: i < result.constitutional_provisions.length - 1 ? '1px solid #eee' : 'none' }}>
                  <p style={{ fontWeight: 600 }}>{item.name}{item.citation ? `, ${item.citation}` : ''}</p>
                  <p style={{ fontSize: '0.9rem' }}>{item.context}</p>
                  <span style={{ fontSize: '0.8rem', padding: '0.15rem 0.5rem', borderRadius: '3px', background: '#e8f5e9', color: '#2e7d32' }}>{item.treatment}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card" style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ color: 'var(--accent-yellow)' }}>Key Precedent</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{result.key_precedent}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: '#2e7d32', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(citationMapHtml(result))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Citation Map: ' + result.case_name, citationMapHtml(result))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
              {result.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatView({ user, onError, onNavigate }: { user: User; onError: (err: string) => void; onNavigate: (v: string) => void }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string; sources?: SourceInfo[]; suggested_tool?: string | null; suggested_name?: string | null; suggested_description?: string | null; suggested_query?: string | null }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadGreeting();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function loadGreeting() {
    try {
      const { greeting } = await api.chat.greeting();
      setMessages([{ role: 'assistant', content: greeting }]);
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    cancelRef.current = new AbortController();
    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await api.chat.message(userMessage, cancelRef.current.signal);
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
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  return (
    <div>
      <h2>Legal AI Assistant</h2>
      <p style={{ color: 'var(--gray-text)', marginBottom: '1rem' }}>
        The AI Assistant answers legal questions and guides you to the right tool. It draws from our knowledge base of cases and legal principles — always verify important information against primary sources.
      </p>
      <div className="chat-container">
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i}>
              <div className={`message ${msg.role}`}>
                {msg.role === 'assistant' ? (
                  <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ padding: '0.25rem 1rem 0.5rem', fontSize: '0.75rem', color: 'var(--gray-text)' }}>
                  <strong>Sources:</strong>{' '}
                  {msg.sources.map((s, j) => (
                    <span key={j} style={{ marginRight: '0.75rem' }}>
                      {s.title} <span style={{ opacity: 0.6 }}>(score: {s.relevance_score})</span>
                      {j < msg.sources!.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}
              {msg.suggested_tool && msg.suggested_name && (
                <div
                  className="card"
                  onClick={() => msg.suggested_tool && onNavigate(msg.suggested_tool)}
                  style={{ margin: '0.25rem 1rem 0.75rem', padding: '0.75rem', cursor: 'pointer', border: '1px solid var(--blue-primary)', borderLeft: '4px solid var(--blue-primary)' }}
                >
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--blue-primary)', margin: '0 0 0.25rem' }}>
                    Try the {msg.suggested_name} tool &rarr;
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', margin: 0 }}>
                    {msg.suggested_description}
                  </p>
                  {msg.suggested_query && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--dark-navy)', margin: '0.25rem 0 0', fontStyle: 'italic' }}>
                      Suggested query: &ldquo;{msg.suggested_query}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="message assistant"><em>Thinking...</em><div style={{ marginTop: '0.5rem', textAlign: 'center' }}><button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }} style={{ fontSize: '0.85rem', padding: '0.3rem 0.75rem' }}>Cancel</button></div></div>}
          <div ref={messagesEndRef} />
        </div>
        <form className="chat-input" onSubmit={handleSend}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about legal concepts, cases, templates, or what tool to use..."
            disabled={loading}
            rows={2}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'none' }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem', textAlign: 'center' }}>
          This AI assistant provides educational information only. Not legal advice.
        </p>
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  h1: ({ children }: any) => <h1 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>{children}</h1>,
  h2: ({ children }: any) => <h2 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>{children}</h2>,
  h3: ({ children }: any) => <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>{children}</h3>,
  p: ({ children }: any) => <p style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>{children}</p>,
  ul: ({ children }: any) => <ul style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>{children}</ul>,
  a: ({ href, children, ...props }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
};

function TutorView({ user, onError }: { user: User; onError: (err: string) => void }) {
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

  useEffect(() => {
    api.tutor.listTopics().then(res => setTopics(res.topics)).catch(() => onError('Failed to load topics'));
  }, []);

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
    } catch (err: any) {
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
    try {
      const res = await api.tutor.submitAnswer(answer);
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
      onError(err.message);
    } finally {
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
      onError(err.message);
    } finally {
      setContinueLearningLoading(false);
    }
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
          <p>Starting your session...</p>
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
              className={`btn ${!reviewMode ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setReviewMode(false)}
              style={{ borderRadius: 0, border: 'none', fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            >
              Quiz
            </button>
            <button
              className={`btn ${reviewMode ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => { setReviewMode(true); setReviewIndex(0); setReviewCorrect(0); setReviewWrong(0); setReviewFlipped(false); setReviewComplete(false); }}
              style={{ borderRadius: 0, border: 'none', fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
            >
              Review
            </button>
          </div>
          <button className="btn btn-outline" onClick={resetSession}>Change Topic</button>
        </div>
      </div>

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
              <span style={{ fontSize: '0.85rem', color: '#2e7d32' }}>✓ {reviewCorrect}</span>
              <span style={{ fontSize: '0.85rem', color: '#c62828' }}>✗ {reviewWrong}</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.85rem', color: '#2e7d32' }}>✓ {correctCount}</span>
              <span style={{ fontSize: '0.85rem', color: '#c62828' }}>✗ {wrongCount}</span>
            </>
          )}
        </div>
      </div>

      {isComplete && !reviewMode && (
        <div className="card" style={{ marginBottom: '1rem', background: '#e8f5e9', border: '1px solid #4caf50', textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ color: '#2e7d32' }}>Topic Complete! 🎉</h3>
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

      {history.length > 0 && !isComplete && !reviewMode && (
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

      {correctAnswerRevealed && !reviewMode && (
        <div className="card" style={{ marginBottom: '1rem', background: '#fff3cd', border: '1px solid #ffc107' }}>
          <h4 style={{ color: '#856404', margin: '0 0 0.5rem 0' }}>Correct Answer</h4>
          <p style={{ fontSize: '0.85rem', color: '#856404', marginBottom: '0.5rem', fontStyle: 'italic' }}>
            <strong>Q:</strong> {history[0]?.question}
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#856404' }}>{correctAnswerRevealed}</p>
        </div>
      )}

      {currentQuestion && !isComplete && !reviewMode && (
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

      {reviewMode && reviewComplete && (
        <div className="card" style={{ marginBottom: '1rem', background: '#e8f5e9', border: '1px solid #4caf50', textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ color: '#2e7d32' }}>Review Complete! 🎉</h3>
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

      {reviewMode && !reviewComplete && session.questions[reviewIndex] && (
        <div className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <div
            onClick={() => !reviewFlipped && setReviewFlipped(true)}
            style={{ perspective: '1000px', cursor: reviewFlipped ? 'default' : 'pointer', minHeight: '200px' }}
          >
            <div style={{
              position: 'relative',
              width: '100%',
              minHeight: '200px',
              transition: 'transform 0.5s',
              transformStyle: 'preserve-3d',
              transform: reviewFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              <div style={{
                position: 'absolute',
                width: '100%',
                minHeight: '200px',
                backfaceVisibility: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '2rem',
                boxSizing: 'border-box',
              }}>
                <h3 style={{ color: 'var(--dark-navy)', margin: 0 }}>{session.questions[reviewIndex].question}</h3>
                {!reviewFlipped && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', marginTop: '1rem' }}>
                    Click to reveal answer
                  </p>
                )}
              </div>
              <div style={{
                position: 'absolute',
                width: '100%',
                minHeight: '200px',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '2rem',
                boxSizing: 'border-box',
              }}>
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
              </div>
            </div>
          </div>
          {reviewFlipped && (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => { setReviewCorrect(p => p + 1); const next = reviewIndex + 1; if (next >= totalQuestions) { setReviewComplete(true); } else { setReviewIndex(next); setReviewFlipped(false); } }}>
                Got it ✓
              </button>
              <button className="btn btn-outline" onClick={() => { setReviewWrong(p => p + 1); const next = reviewIndex + 1; if (next >= totalQuestions) { setReviewComplete(true); } else { setReviewIndex(next); setReviewFlipped(false); } }} style={{ color: '#c62828', borderColor: '#c62828' }}>
                Study again ✗
              </button>
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

function MemorandumView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<MemorandumResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    setLoading(true);
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const memo = await api.legal.memorandum(query, selectedDocId, cancelRef.current.signal);
      setResult(memo);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Legal Memorandum Generator</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        A legal memorandum analyzes a legal question using IRAC — Issue, Rule, Application, Conclusion. It is the core document format every law student and practicing lawyer must master.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Describe a legal question or scenario to draft a structured legal memorandum with IRAC analysis.
      </p>
      <form onSubmit={handleGenerate} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Is a clickwrap agreement enforceable under contract law? Analyze the requirements for offer, acceptance, and consideration."
            style={{ flex: 1, minWidth: '300px', minHeight: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: 'inherit', resize: 'vertical' }}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ alignSelf: 'flex-start' }}>
            {loading ? 'Drafting...' : 'Draft Memorandum'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--dark-navy)', display: 'block', marginBottom: '0.25rem' }}>
              Use an uploaded PDF:
            </label>
            <select
              value={selectedDocId ?? ''}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : undefined;
                setSelectedDocId(id);
                if (id) {
                  const doc = documents.find(d => d.id === id);
                  if (doc) setQuery(doc.title);
                }
              }}
              disabled={loading}
              style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem', width: '100%' }}
            >
              <option value="">Use RAG search (default)</option>
              {documents.filter(d => d.file_path).map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Retrieving sources and drafting memorandum...</p>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div>
          <div className="card" style={{ marginBottom: '1rem', background: '#f0f7ff', border: '1px solid #cce5ff' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem' }}>
              <span><strong>TO:</strong> {result.to}</span>
              <span><strong>FROM:</strong> {result.author}</span>
              <span><strong>DATE:</strong> {result.date}</span>
              <span><strong>RE:</strong> {result.re}</span>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Question Presented</h3>
            <p>{result.question_presented}</p>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Brief Answer</h3>
            <p>{result.brief_answer}</p>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Facts</h3>
            <p>{result.facts}</p>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Discussion</h3>
            {result.issues.map((iss, i) => (
              <div key={i} style={{ marginBottom: i < result.issues.length - 1 ? '1.5rem' : 0, paddingBottom: i < result.issues.length - 1 ? '1.5rem' : 0, borderBottom: i < result.issues.length - 1 ? '1px solid #e0e0e0' : 'none' }}>
                <h4 style={{ color: 'var(--purple-secondary)', marginBottom: '0.75rem' }}>{iss.issue}</h4>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--dark-navy)' }}>Rule:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', lineHeight: 1.6 }}>{iss.rule}</p>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong style={{ color: 'var(--dark-navy)' }}>Application:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', lineHeight: 1.6 }}>{iss.application}</p>
                </div>
                <div>
                  <strong style={{ color: 'var(--dark-navy)' }}>Conclusion:</strong>
                  <p style={{ margin: '0.25rem 0 0 0', lineHeight: 1.6 }}>{iss.conclusion}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>Conclusion</h3>
            <p>{result.overall_conclusion}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.5rem' }}>
              Source: {result.source}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: '#2e7d32', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(memorandumHtml(result))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Legal Memorandum: ' + result.re, memorandumHtml(result))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginTop: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#856404', margin: 0 }}>
              {result.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DebateView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DebateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>(undefined);
  const cancelRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.documents.list().then(setDocuments).catch(() => {});
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.abort();
  }, []);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    cancelRef.current = new AbortController();
    setLoading(true);
    setResult(null);
    setSaved(false);
    onError('');
    try {
      const debate = await api.legal.debate(query, selectedDocId, cancelRef.current.signal);
      setResult(debate);
      setSaved(true);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function strengthColor(strength: string): string {
    switch (strength) {
      case 'strong': return '#2e7d32';
      case 'moderate': return '#e65100';
      case 'weak': return '#c62828';
      default: return 'var(--gray-text)';
    }
  }

  function predictedWinnerLabel(winner: string): string {
    switch (winner) {
      case 'supporting': return 'Supporting Arguments (Your Position)';
      case 'opposing': return 'Opposing Arguments';
      case 'balanced': return 'Balanced — Neither Side Clearly Prevails';
      default: return winner;
    }
  }

  return (
    <div>
      <h2>Legal Debate Analysis</h2>
      <p style={{ color: 'var(--blue-primary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
        Legal debate analysis generates structured arguments for and against a legal position. Testing both sides of an issue sharpens your reasoning and prepares you for advocacy and exams.
      </p>
      <p style={{ color: 'var(--gray-text)' }}>
        Enter a legal position or argument to generate structured pro/con analysis with counter-rebuttals.
      </p>
      <form onSubmit={handleAnalyze} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. A non-compete clause should be enforced because it protects trade secrets"
            disabled={loading}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: '0.9rem' }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !query.trim()}>
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {documents.filter(d => d.file_path).length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--gray-text)' }}>Include uploaded document:</label>
            <select
              value={selectedDocId ?? ''}
              onChange={(e) => setSelectedDocId(e.target.value ? Number(e.target.value) : undefined)}
              disabled={loading}
              style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #ccc', fontSize: '0.85rem' }}
            >
              <option value="">Search all legal sources (default)</option>
              {documents.filter(d => d.file_path).map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
          </div>
        )}
      </form>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Retrieving sources and analyzing arguments...</p>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => { cancelRef.current?.abort(); setLoading(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2>{result.topic}</h2>
            <div style={{ background: '#e3f2fd', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.9rem', margin: 0, color: '#1565c0' }}>
                <strong>Your Position:</strong> {result.user_position}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ color: '#2e7d32', marginBottom: '0.75rem' }}>Supporting Arguments</h3>
              {result.supporting_arguments.map((arg, i) => (
                <div key={i} className="card" style={{ marginBottom: '0.75rem', borderLeft: `4px solid ${strengthColor(arg.strength)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--dark-navy)' }}>{arg.title}</h4>
                    <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: '#e8f5e9', color: strengthColor(arg.strength), fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {arg.strength}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: '0.25rem 0' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  {arg.authorities.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--blue-primary)', margin: '0.25rem 0' }}>
                      <strong>Authorities:</strong> {arg.authorities.join(', ')}
                    </p>
                  )}
                  {arg.counter_rebuttal && (
                    <div style={{ marginTop: '0.25rem', padding: '0.4rem', background: '#fff3e0', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid #ffe0b2' }}>
                      <strong style={{ color: '#e65100' }}>Counter-Rebuttal:</strong> {arg.counter_rebuttal}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ color: '#c62828', marginBottom: '0.75rem' }}>Opposing Arguments</h3>
              {result.opposing_arguments.map((arg, i) => (
                <div key={i} className="card" style={{ marginBottom: '0.75rem', borderLeft: `4px solid ${strengthColor(arg.strength)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--dark-navy)' }}>{arg.title}</h4>
                    <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '3px', background: '#ffebee', color: strengthColor(arg.strength), fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {arg.strength}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Argument:</strong> {arg.argument}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: '0.25rem 0' }}><strong>Reasoning:</strong> {arg.reasoning}</p>
                  {arg.authorities.length > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--blue-primary)', margin: '0.25rem 0' }}>
                      <strong>Authorities:</strong> {arg.authorities.join(', ')}
                    </p>
                  )}
                  {arg.counter_rebuttal && (
                    <div style={{ marginTop: '0.25rem', padding: '0.4rem', background: '#e8f5e9', borderRadius: '4px', fontSize: '0.8rem', border: '1px solid #c8e6c9' }}>
                      <strong style={{ color: '#2e7d32' }}>Counter-Rebuttal:</strong> {arg.counter_rebuttal}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--dark-navy)' }}>Analysis</h3>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Predicted Winner: </span>
              <span style={{ fontSize: '0.85rem', padding: '0.15rem 0.5rem', borderRadius: '3px', background: result.predicted_winner === 'supporting' ? '#e8f5e9' : result.predicted_winner === 'opposing' ? '#ffebee' : '#fff3e0', color: result.predicted_winner === 'supporting' ? '#2e7d32' : result.predicted_winner === 'opposing' ? '#c62828' : '#e65100', fontWeight: 600 }}>
                {predictedWinnerLabel(result.predicted_winner)}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', margin: '0.5rem 0' }}><strong>Rationale:</strong> {result.rationale}</p>
            {result.key_doctrines_statutes.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Key Doctrines & Statutes:</p>
                <ul style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.25rem', color: 'var(--gray-text)' }}>
                  {result.key_doctrines_statutes.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {result.practice_tips.length > 0 && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f3e5f5', borderRadius: '6px', border: '1px solid #ce93d8' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#7b1fa2', marginBottom: '0.25rem' }}>Practice Tips</p>
                <ul style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.25rem', color: '#4a148c' }}>
                  {result.practice_tips.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            {saved && <span style={{ color: '#2e7d32', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
            {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
            <button className="btn btn-outline" onClick={() => { navigator.clipboard.writeText(resultToPlainText(debateHtml(result))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
              Copy to Clipboard
            </button>
            <button className="btn btn-outline" onClick={() => printContent('Debate Analysis: ' + result.topic, debateHtml(result))}>
              Save PDF
            </button>
          </div>

          <div className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#856404', margin: 0 }}>
              {result.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function GenerateDocumentView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CatalogTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateDocumentResponse | null>(null);

  useEffect(() => {
    api.templates.list().then(setCatalog).catch(() => onError('Failed to load templates'));
  }, []);

  function selectTemplate(template: CatalogTemplate) {
    const existingNames = new Set(template.fields.map((f) => f.name));
    const uniqueCover = (template.cover_page_fields || []).filter(
      (f) => !existingNames.has(f.name)
    );
    const merged: CatalogTemplate = {
      ...template,
      fields: [...template.fields, ...uniqueCover],
    };
    setSelectedTemplate(merged);
    setFieldValues({});
    setTitle(template.name);
    setResult(null);
  }

  function handleFieldChange(fieldName: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate || loading) return;
    setLoading(true);
    setResult(null);
    onError('');
    try {
      const doc = await api.legal.generateDocument(selectedTemplate.name, fieldValues, title || undefined);
      setResult(doc);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Document Generator</h2>
      <p style={{ color: 'var(--gray-text)' }}>
        Select a legal document template, fill in the fields, and generate a complete document.
      </p>

      {!selectedTemplate && catalog && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Available Templates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            {catalog.templates.map((t) => (
              <div
                key={t.name}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => selectTemplate(t)}
              >
                <h4 style={{ color: 'var(--blue-primary)' }}>{t.name}</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-text)' }}>{t.description}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.25rem' }}>
                  {(t.fields.length + ((t.cover_page_fields || []).filter(cf => !t.fields.some(f => f.name === cf.name)).length))} fields
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTemplate && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>{selectedTemplate.name}</h3>
            <button className="btn btn-outline" onClick={() => { setSelectedTemplate(null); setResult(null); }}>
              Back to Templates
            </button>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray-text)', marginBottom: '1rem' }}>
            {selectedTemplate.description}
          </p>

          <form onSubmit={handleGenerate}>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Document Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. My Mutual NDA for Project Alpha"
                />
              </div>
            </div>

            <div className="card" style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Template Fields</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', marginBottom: '1rem' }}>
                Fill in each field below. The hint text beneath each input explains what to enter.
              </p>
              {selectedTemplate.fields.map((field) => {
                const categoryLabel = field.category === 'coverpage_link' ? 'Cover Page' : field.category === 'cover_page' ? 'Cover Page' : field.category === 'orderform_link' ? 'Order Form' : field.category === 'keyterms_link' ? 'Key Terms' : field.category === 'businessterms_link' ? 'Business Terms' : field.category === 'sow_link' ? 'SOW Details' : 'General';
                const categoryTooltip = field.category === 'coverpage_link' ? 'Appears on the cover page of the agreement' : field.category === 'cover_page' ? 'Appears on the cover page of the agreement' : field.category === 'orderform_link' ? 'Defined in the order form (pricing, limits)' : field.category === 'keyterms_link' ? 'Key legal terms (liability, IP, governing law)' : field.category === 'businessterms_link' ? 'Business-specific terms (obligations, territory)' : field.category === 'sow_link' ? 'Statement of Work details (deliverables, fees)' : 'General field';
                return (
                <div key={field.name} className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {field.name}
                    <span title={categoryTooltip} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 600, cursor: 'help',
                      background: field.category === 'coverpage_link' || field.category === 'cover_page' ? '#e3f2fd' : field.category === 'orderform_link' ? '#fce4ec' : field.category === 'keyterms_link' ? '#f3e5f5' : '#fff3e0',
                      color: field.category === 'coverpage_link' || field.category === 'cover_page' ? '#1565c0' : field.category === 'orderform_link' ? '#c62828' : field.category === 'keyterms_link' ? '#6a1b9a' : '#e65100',
                    }}>{categoryLabel}</span>
                  </label>
                  {field.name === 'Modifications' ? (
                    <textarea
                      value={fieldValues[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder="Type your modifications here..."
                      rows={4}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: 'inherit', resize: 'vertical' }}
                    />
                  ) : (
                  <input
                    type="text"
                    value={fieldValues[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder="Type your value here..."
                  />
                  )}
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-text)', display: 'block', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    {field.hint}
                  </span>
                </div>
                );
              })}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Document'}
            </button>
          </form>

          {result && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Document Generated</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline" onClick={() => {
                    const blob = new Blob([result.content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${result.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    Download
                  </button>
                  <button className="btn btn-outline" onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`<!DOCTYPE html><html><head><title>${result.title}</title>
<style>
  body{font-family:Georgia,serif;line-height:1.8;padding:2rem 3rem;max-width:800px;margin:auto;color:#222}
  h1{font-size:1.5rem;border-bottom:2px solid #000;padding-bottom:0.3rem;margin-top:1.5rem}
  h2{font-size:1.2rem;margin-top:1.25rem}
  h3{font-size:1.1rem;margin-top:1.5rem;margin-bottom:0.3rem}
  p{margin-bottom:0.5rem;text-align:justify}
  table{border-collapse:collapse;width:100%;margin:0.75rem 0}
  td,th{border:1px solid #999;padding:0.4rem 0.6rem;text-align:left}
  @media print{body{padding:0.5in}}
</style></head><body>${marked.parse(result.content)}</body></html>`);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}>
                    Print
                  </button>
                </div>
              </div>
              <p><strong>Title:</strong> {result.title}</p>
              <div style={{ marginTop: '0.5rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', maxHeight: '500px', overflowY: 'auto', fontSize: '0.9rem', lineHeight: 1.6 }}>
                <ReactMarkdown components={markdownComponents}>{result.content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}