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

export function getBadge(sourceType: string): BadgeConfig {
  return BADGE_COLORS[sourceType] || { bg: '#f5f5f5', color: '#757575', label: sourceType };
}
