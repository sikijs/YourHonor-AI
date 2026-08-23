'use client';

import { useState, useEffect } from 'react';
import { api, User } from '@/lib/api';
import {
  parseHash,
  viewToHash,
  ViewName,
  DraftingTabName,
  AtlasTabName,
  ParsedHash,
  PUBLIC_VIEWS,
  VIEW_NAMES,
} from '@/lib/hashRouter';

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
import AtlasView from '@/components/AtlasView';
import DashboardView from '@/components/DashboardView';
import CitationsView from '@/components/CitationsView';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewName>('home');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftQuery, setBriefQuery] = useState('');
  const [draftTab, setDraftTab] = useState<DraftingTabName>('brief');
  const [atlasTab, setAtlasTab] = useState<AtlasTabName>('map');

  // Apply a parsed hash route to state, gating non-public views on auth.
  function applyRoute(parsed: ParsedHash, isAuthed: boolean) {
    if (!isAuthed && parsed.view !== 'auth' && !PUBLIC_VIEWS.includes(parsed.view)) {
      setView('auth');
      return;
    }
    if (parsed.draftTab) setDraftTab(parsed.draftTab);
    if (parsed.atlasTab) setAtlasTab(parsed.atlasTab);
    if (parsed.query) setBriefQuery(parsed.query);
    setView(parsed.view);
  }

  // Switch views from the nav links; assigning location.hash pushes a
  // history entry so Back/Forward walks through the visited views.
  function goTo(next: ViewName) {
    setView(next);
    window.location.hash = viewToHash(next);
  }

  function handleDraftTabChange(tab: DraftingTabName) {
    setDraftTab(tab);
    // location.replace keeps tab switches out of history (no Back noise).
    window.location.replace(viewToHash('drafting', { draftTab: tab }));
  }

  function handleAtlasTabChange(tab: AtlasTabName) {
    setAtlasTab(tab);
    // location.replace keeps tab switches out of history (no Back noise).
    window.location.replace(viewToHash('doctrines', { atlasTab: tab }));
  }

  function navigate(v: string, q?: string) {
    if (v === 'briefs' || v === 'summaries' || v === 'arguments' || v === 'memoranda') {
      const tab: DraftingTabName = v === 'briefs' ? 'brief' : v === 'summaries' ? 'summary' : v === 'arguments' ? 'arguments' : 'memorandum';
      if (q) setBriefQuery(q);
      setDraftTab(tab);
      setView('drafting');
      window.location.hash = viewToHash('drafting', { draftTab: tab, query: q });
      return;
    }
    if (q) setBriefQuery(q);
    setView(v as ViewName);
    if (VIEW_NAMES.includes(v as ViewName)) {
      window.location.hash = viewToHash(v);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  // Respond to browser Back/Forward and manual hash edits.
  useEffect(() => {
    function onHashChange() {
      const parsed = parseHash(window.location.hash);
      if (!parsed) {
        setView('home');
        return;
      }
      applyRoute(parsed, !!user);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [user]);

  async function checkAuth() {
    const parsed = parseHash(window.location.hash);
    try {
      const userData = await api.auth.me();
      setUser(userData);
      if (parsed && parsed.view !== 'auth') {
        applyRoute(parsed, true);
      } else {
        setView('home');
      }
    } catch {
      setUser(null);
      if (parsed && parsed.view !== 'auth' && PUBLIC_VIEWS.includes(parsed.view)) {
        applyRoute(parsed, false);
      } else {
        setView('auth');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await api.auth.signout();
      setUser(null);
      goTo('auth');
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
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('home'); }} style={view === 'home' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Home</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('dashboard'); }} style={view === 'dashboard' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Dashboard</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('about'); }} style={view === 'about' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>About</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('drafting'); }} style={view === 'drafting' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Legal Drafting</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('citations'); }} style={view === 'citations' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Citations</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('debate'); }} style={view === 'debate' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Debate</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('issuespotter'); }} style={view === 'issuespotter' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Issue Spotter</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('tutor'); }} style={view === 'tutor' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>AI Tutor</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('documents'); }} style={view === 'documents' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>My Documents</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('glossary'); }} style={view === 'glossary' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Glossary</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('doctrines'); }} style={view === 'doctrines' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Case Law Atlas</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('resources'); }} style={view === 'resources' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Resources</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('chat'); }} style={view === 'chat' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Chat</a>
              <a href="#" onClick={(e) => { e.preventDefault(); handleSignOut(); }}>Sign Out</a>
            </>
          ) : (
            <>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('home'); }} style={view === 'home' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Home</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('about'); }} style={view === 'about' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>About</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('doctrines'); }} style={view === 'doctrines' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Case Law Atlas</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('resources'); }} style={view === 'resources' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Resources</a>
              <a href="#" onClick={(e) => { e.preventDefault(); goTo('auth'); }} style={view === 'auth' ? { color: 'var(--accent-yellow)', fontWeight: 600 } : {}}>Sign In</a>
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
              goTo('home');
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
          <DraftingView
            user={user}
            onError={setError}
            initialTab={draftTab}
            initialQuery={draftQuery}
            onTabChange={handleDraftTabChange}
          />
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
          <AtlasView
            user={user}
            onNavigate={navigate}
            initialTab={atlasTab}
            onTabChange={handleAtlasTabChange}
          />
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
