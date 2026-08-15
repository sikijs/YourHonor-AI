import { DoctrineCaseNode } from '@/lib/api';

export const SUBJECT_COLORS: Record<string, string> = {
  'Constitutional Law': '#753991',
  'First Amendment': '#209dd7',
  'Criminal Procedure': '#d32f2f',
  'Contracts': '#2e7d32',
  'Torts': '#e65100',
  'Property': '#6d4c41',
  'Civil Procedure': '#0288d1',
  'Administrative Law': '#5c6bc0',
};

export const SUBJECT_FALLBACK = '#888888';

export interface TimelineCase extends DoctrineCaseNode {
  subjects: string[];
}

export interface TimelineEra {
  label: string;
  min: number;
  max: number;
}

export const TIMELINE_ERAS: TimelineEra[] = [
  { label: '1800–1849', min: 1800, max: 1849 },
  { label: '1850–1899', min: 1850, max: 1899 },
  { label: '1900–1949', min: 1900, max: 1949 },
  { label: '1950–1999', min: 1950, max: 1999 },
  { label: '2000–present', min: 2000, max: 9999 },
];

export function subjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] || SUBJECT_FALLBACK;
}

/** Normalize search text so "vs"/"vs."/"versus" match "v." in case names. */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/(^|\s)(vs\.?|versus)(\s|$)/g, ' v ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
