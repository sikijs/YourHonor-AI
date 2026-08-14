// Hash-based routing for the single-page app.
//
// The app keeps its current view in React state (page.tsx) with no URL
// routing, so the browser Back/Forward buttons could never move between
// views. This module maps the view to a URL hash (`#dashboard`,
// `#drafting?tab=summary&q=...`) so history navigation, refresh, and
// bookmarks all work. No router library is needed: assigning
// `location.hash` pushes a history entry and a `hashchange` listener
// (registered in page.tsx) drives state updates.

export type DraftingTabName = 'brief' | 'summary' | 'arguments' | 'memorandum';

export const VIEW_NAMES = [
  'home',
  'auth',
  'documents',
  'chat',
  'citations',
  'generator',
  'tutor',
  'debate',
  'glossary',
  'doctrines',
  'issuespotter',
  'dashboard',
  'resources',
  'about',
  'drafting',
] as const;

export type ViewName = (typeof VIEW_NAMES)[number];

// Views reachable without signing in. Everything else redirects to the
// Sign In view when no user is present.
export const PUBLIC_VIEWS: ReadonlyArray<ViewName> = [
  'home',
  'about',
  'doctrines',
  'resources',
  'auth',
];

export const DRAFTING_TABS: DraftingTabName[] = ['brief', 'summary', 'arguments', 'memorandum'];

export interface ParsedHash {
  view: ViewName;
  draftTab?: DraftingTabName;
  query?: string;
}

export function parseHash(hash: string): ParsedHash | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const [path, queryStr] = raw.split('?');
  const view = path as ViewName;
  if (!VIEW_NAMES.includes(view)) return null;

  const params = new URLSearchParams(queryStr || '');
  const draftTab = params.get('tab') as DraftingTabName | null;
  const query = params.get('q') || undefined;

  return {
    view,
    draftTab: view === 'drafting' && draftTab && DRAFTING_TABS.includes(draftTab) ? draftTab : undefined,
    query: query || undefined,
  };
}

export function viewToHash(
  view: string,
  opts?: { draftTab?: DraftingTabName; query?: string },
): string {
  let hash = `#${view}`;
  if (view === 'drafting' && (opts?.draftTab || opts?.query)) {
    const params = new URLSearchParams();
    if (opts?.draftTab) params.set('tab', opts.draftTab);
    if (opts?.query) params.set('q', opts.query);
    hash += `?${params.toString()}`;
  }
  return hash;
}