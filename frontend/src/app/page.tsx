'use client';

import { useState, useEffect } from 'react';
import { api, User } from '@/lib/api';

import HomeView from '@/components/HomeView';
import AuthView from '@/components/AuthView';
import DocumentsView from '@/components/DocumentsView';
import CaseBriefView from '@/components/CaseBriefView';
import SummaryView from '@/components/SummaryView';
import ArgumentsView from '@/components/ArgumentsView';
import CitationMapView from '@/components/CitationMapView';
import MemorandumView from '@/components/MemorandumView';
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

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'home' | 'auth' | 'documents' | 'chat' | 'briefs' | 'summaries' | 'arguments' | 'citations' | 'memoranda' | 'generator' | 'tutor' | 'debate' | 'glossary' | 'issuespotter' | 'resources' | 'about'>('home');
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
              <a href="#" onClick={() => setView('about')} style={view === 'about' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>About</a>
              <a href="#" onClick={() => setView('briefs')} style={view === 'briefs' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Case Briefs</a>
              <a href="#" onClick={() => setView('summaries')} style={view === 'summaries' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Summaries</a>
              <a href="#" onClick={() => setView('arguments')} style={view === 'arguments' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Arguments</a>
              <a href="#" onClick={() => setView('citations')} style={view === 'citations' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Citations</a>
              <a href="#" onClick={() => setView('memoranda')} style={view === 'memoranda' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Memoranda</a>
              <a href="#" onClick={() => setView('debate')} style={view === 'debate' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Debate</a>
              <a href="#" onClick={() => setView('issuespotter')} style={view === 'issuespotter' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Issue Spotter</a>
              <a href="#" onClick={() => setView('tutor')} style={view === 'tutor' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>AI Tutor</a>
              <a href="#" onClick={() => setView('documents')} style={view === 'documents' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>My Documents</a>
              <a href="#" onClick={() => setView('glossary')} style={view === 'glossary' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Glossary</a>
              <a href="#" onClick={() => setView('resources')} style={view === 'resources' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Resources</a>
              <a href="#" onClick={() => setView('chat')} style={view === 'chat' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Chat</a>
              <a href="#" onClick={handleSignOut}>Sign Out</a>
            </>
          ) : (
            <>
              <a href="#" onClick={() => setView('home')} style={view === 'home' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Home</a>
              <a href="#" onClick={() => setView('about')} style={view === 'about' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>About</a>
              <a href="#" onClick={() => setView('resources')} style={view === 'resources' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Resources</a>
              <a href="#" onClick={() => setView('auth')} style={view === 'auth' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Sign In</a>
            </>
          )}
        </nav>
      </header>

      <main className="container">
        {error && <div className="error">{error}</div>}

        {view === 'home' && (
          <HomeView user={user} onNavigate={(v) => setView(v as any)} />
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

        {view === 'issuespotter' && user && (
          <IssueSpotterView user={user} onError={setError} />
        )}

        {view === 'glossary' && user && (
          <GlossaryView user={user} onError={setError} onNavigate={(v) => setView(v as any)} />
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
      {user && <ScratchPad />}
      <AppFooter />
    </>
  );
}
