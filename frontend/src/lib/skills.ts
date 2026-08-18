// Skill-level bands and practice deep links for the Dashboard's
// "Skills & Competencies" card. Counts are activity volume (saved documents,
// uploads, tutor answers, review marks) — the levels make that volume
// readable, not a calibrated measure of mastery.

export interface SkillLevel {
  label: string;
  color: string;
}

// Progress bars are absolute, not relative to the strongest skill: a full
// bar means SKILL_BAR_MAX (10) activities in that area, which lines up with
// the top "Practicing" level band (>9). No skill pins at 100% just because
// another skill has fewer activities.
export const SKILL_BAR_MAX = 10;

export function skillBarPercent(count: number): number {
  return Math.min(100, Math.round((count / SKILL_BAR_MAX) * 100));
}

export function skillLevel(count: number): SkillLevel {
  if (count <= 0) return { label: 'Not started', color: 'var(--gray-text)' };
  if (count <= 3) return { label: 'Getting started', color: 'var(--blue-primary)' };
  if (count <= 9) return { label: 'Developing', color: '#856404' };
  return { label: 'Practicing', color: '#1b7f3a' };
}

// Where each skill is practiced in the app, so the "Where to focus" line can
// deep-link straight into the matching view (same targets as Quick Actions).
export const SKILL_PRACTICE: Record<string, { view: string; label: string }> = {
  research: { view: 'summaries', label: 'Write a summary' },
  drafting: { view: 'briefs', label: 'Draft a brief' },
  citation: { view: 'citations', label: 'Format citations' },
  analysis: { view: 'doctrines', label: 'Compare cases' },
  issue_spotting: { view: 'issuespotter', label: 'Try the Issue Spotter' },
  doctrine: { view: 'tutor', label: 'Tutor practice' },
};