'use client';

import { useState, useEffect } from 'react';
import { api, User } from '@/lib/api';

import HomeView from '@/components/HomeView';
import AuthView from '@/components/AuthView';
import DocumentsView from '@/components/DocumentsView';
import DraftingView from '@/components/DraftingView';
import TutorView from '@/components/TutorView';
import DebateView from '@/components/DebateView';
import GlossaryView from '@/components/GlossaryView';
import IssueSpotterView from '@/components/IssueSpotterView';
import GenerateDocumentView from '@/components/GenerateDocumentView';
import ChatView from '@/components/ChatView';
import ResourcesView from '@/components/ResourcesView';
import AboutView from '@/components/AboutView';
import AppFooter from '@/components/AppFooter';
import ScratchPad from '@/components/ScratchPad';
import IngestionBanner from '@/components/IngestionBanner';
import DoctrineExplorerView from '@/components/DoctrineExplorerView';
import DashboardView from '@/components/DashboardView';
import CitationsView from '@/components/CitationsView';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'auth' | 'documents' | 'chat' | 'citations' | 'generator' | 'tutor' | 'debate' | 'glossary' | 'doctrines' | 'issuespotter' | 'dashboard' | 'resources' | 'about' | 'drafting'>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [briefQuery, setBriefQuery] = useState('');
  const [draftTab, setDraftTab] = useState<'brief' | 'summary' | 'arguments' | 'memorandum'>('brief');

  function navigate(v: string, q?: string) {
    if (v === 'briefs' || v === 'summaries' || v === 'arguments' || v === 'memoranda') {
      if (q) setBriefQuery(q);
      setDraftTab(v === 'briefs' ? 'brief' : v === 'summaries' ? 'summary' : v === 'arguments' ? 'arguments' : 'memorandum');
      setView('drafting');
      return;
    }
    if (q) setBriefQuery(q);
    setView(v as any);
  }

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
        <div className="spinner-container"><span className="spinner" /><p>Loading...</p></div>
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
              <a href="#" onClick={() => setView('home')} style={view === 'home' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Home</a>
              <a href="#" onClick={() => setView('dashboard')} style={view === 'dashboard' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Dashboard</a>
              <a href="#" onClick={() => setView('about')} style={view === 'about' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>About</a>
              <a href="#" onClick={() => setView('drafting')} style={view === 'drafting' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Legal Drafting</a>
              <a href="#" onClick={() => setView('citations')} style={view === 'citations' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Citations</a>
              <a href="#" onClick={() => setView('debate')} style={view === 'debate' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Debate</a>
              <a href="#" onClick={() => setView('issuespotter')} style={view === 'issuespotter' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Issue Spotter</a>
              <a href="#" onClick={() => setView('tutor')} style={view === 'tutor' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>AI Tutor</a>
              <a href="#" onClick={() => setView('documents')} style={view === 'documents' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>My Documents</a>
              <a href="#" onClick={() => setView('glossary')} style={view === 'glossary' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Glossary</a>
              <a href="#" onClick={() => setView('doctrines')} style={view === 'doctrines' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Doctrines</a>
              <a href="#" onClick={() => setView('resources')} style={view === 'resources' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Resources</a>
              <a href="#" onClick={() => setView('chat')} style={view === 'chat' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Chat</a>
              <a href="#" onClick={handleSignOut}>Sign Out</a>
            </>
          ) : (
            <>
              <a href="#" onClick={() => setView('home')} style={view === 'home' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Home</a>
              <a href="#" onClick={() => setView('about')} style={view === 'about' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>About</a>
              <a href="#" onClick={() => setView('doctrines')} style={view === 'doctrines' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Doctrines</a>
              <a href="#" onClick={() => setView('resources')} style={view === 'resources' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Resources</a>
              <a href="#" onClick={() => setView('auth')} style={view === 'auth' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Sign In</a>
            </>
          )}
        </nav>
      </header>

      <IngestionBanner />

      <main className="container">
        {error && <div className="error">{error}</div>}

        {view === 'home' && (
          <HomeView user={user} onNavigate={navigate} />
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

        {view === 'dashboard' && user && (
          <DashboardView user={user} onError={setError} onNavigate={navigate} />
        )}

        {view === 'drafting' && user && (
          <DraftingView user={user} onError={setError} initialQuery={draftTab === 'brief' ? briefQuery : undefined} />
        )}

        {view === 'citations' && user && (
          <CitationsView user={user} onError={setError} />
        )}

        {view === 'tutor' && user && (
          <TutorView user={user} onError={setError} />
        )}

        {view === 'debate' && user && (
          <DebateView user={user} onError={setError} />
        )}

        {view === 'issuespotter' && user && (
          <IssueSpotterView user={user} onError={setError} />
        )}

        {view === 'glossary' && user && (
          <GlossaryView user={user} onError={setError} onNavigate={navigate} />
        )}

        {view === 'doctrines' && (
          <DoctrineExplorerView user={user} onNavigate={navigate} />
        )}

        {view === 'generator' && user && (
          <GenerateDocumentView user={user} onError={setError} />
        )}

        {view === 'chat' && user && (
          <ChatView user={user} onError={setError} onNavigate={navigate} />
        )}

        {view === 'resources' && (
          <ResourcesView />
        )}

        {view === 'about' && (
          <AboutView />
        )}
      </main>
      {user && <ScratchPad />}
      <AppFooter />
    </>
  );
}
