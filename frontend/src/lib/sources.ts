export interface BadgeConfig {
  bg: string;
  color: string;
  label: string;
}

export const BADGE_COLORS: Record<string, BadgeConfig> = {
  courtlistener: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  courtlistener_ingested: { bg: '#e8f4fd', color: '#1a7db5', label: 'CourtListener' },
  rag: { bg: '#e8f8e8', color: '#2e7d32', label: 'RAG' },
  user_upload: { bg: '#fff3e0', color: '#e65100', label: 'Uploaded' },
  web: { bg: '#f3e5f5', color: '#7b1fa2', label: 'Web' },
  seed: { bg: '#e0f7fa', color: '#00838f', label: 'Seed' },
  none: { bg: '#f5f5f5', color: '#757575', label: 'None' },
};

const SITE_NAMES: Record<string, string> = {
  'en.wikipedia.org': 'Wikipedia',
  'britannica.com': 'Britannica',
  'brennancenter.org': 'Brennan Center',
  'uscourts.gov': 'United States Courts',
  'usconstitution.net': 'US Constitution',
  'law.cornell.edu': 'Cornell Law School',
  'justia.com': 'Justia',
  'findlaw.com': 'FindLaw',
  'nolo.com': 'Nolo',
  'oyez.org': 'Oyez',
  'scotusblog.com': 'SCOTUSblog',
  'supremecourt.gov': 'Supreme Court',
  'congress.gov': 'Congress.gov',
  'govinfo.gov': 'GovInfo',
  'lawfaremedia.org': 'Lawfare',
  'archive.org': 'Internet Archive',
  'duckduckgo.com': 'DuckDuckGo',
};

function siteNameFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return SITE_NAMES[host] || host;
  } catch {
    return null;
  }
}

export function getBadge(sourceType: string, url?: string | null): BadgeConfig {
  if (sourceType === 'web') {
    return { ...BADGE_COLORS.web, label: siteNameFromUrl(url) || 'Web' };
  }
  return BADGE_COLORS[sourceType] || { bg: '#f5f5f5', color: '#757575', label: sourceType };
}