import { Marked } from 'marked';

const _marked = new Marked();

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineStyle(s: string): string {
  return s.replace(/["']/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

const PRINT_CSS = `
  html,body{margin:0;padding:0}
  body{font-family:Georgia,'Times New Roman',serif;line-height:1.8;padding:0.5in;max-width:800px;margin:auto;color:#222}
  h1{font-size:1.6rem;border-bottom:2px solid #000;padding-bottom:0.3rem;margin-top:1.5rem;margin-bottom:1rem}
  h2{font-size:1.25rem;margin-top:1.5rem;margin-bottom:0.5rem;color:#111}
  h3{font-size:1.1rem;margin-top:1.25rem;margin-bottom:0.3rem;color:#111}
  h4{font-size:1rem;margin-top:1rem;margin-bottom:0.25rem;color:#444}
  p{margin-bottom:0.5rem;text-align:justify}
  ul,ol{margin:0.5rem 0;padding-left:1.5rem}
  li{margin-bottom:0.25rem}
  table{border-collapse:collapse;width:100%;margin:0.75rem 0;page-break-inside:avoid}
  td,th{border:1px solid #999;padding:0.4rem 0.6rem;text-align:left;font-size:0.9rem}
  th{background:#f2f2f2}
  strong{color:#000}
  em{color:#555}
  hr{border:none;border-top:1px solid #ccc;margin:1.5rem 0}
  .header{font-size:0.85rem;color:#666;margin-bottom:0.25rem;border-bottom:1px solid #ddd;padding-bottom:0.3rem}
  .field-label{font-weight:bold;margin-top:0.75rem;margin-bottom:0.25rem;font-size:0.95rem;color:#333}
  .field-value{margin-left:0;margin-bottom:0.75rem}
  .tag{display:inline-block;background:#eee;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.85rem;margin:0.15rem}
  .section{border-left:3px solid #ccc;padding-left:0.75rem;margin:0.75rem 0}
  .badge{display:inline-block;padding:0.1rem 0.5rem;border-radius:3px;font-size:0.8rem;font-weight:bold}
  .badge-win{background:#e8f5e9;color:#2e7d32}
  .badge-strong{background:#c8e6c9;color:#1b5e20}
  .badge-moderate{background:#fff3e0;color:#e65100}
  .badge-weak{background:#ffebee;color:#c62828}
  @media print{body{padding:0.5in}}
`;

export function printContent(title: string, bodyHtml: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body><h1>${esc(title)}</h1>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch {} }, 200);
}

function fmtTags(items: string[]): string {
  if (!items || items.length === 0) return '';
  return items.map(t => `<span class="tag">${esc(t)}</span>`).join('');
}

function fmtList(items: string[]): string {
  if (!items || items.length === 0) return '';
  return '<ul>' + items.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>';
}

function fmtField(label: string, value: string | null | undefined): string {
  if (!value) return '';
  return `<div class="field-label">${esc(label)}</div><div class="field-value"><p>${esc(value)}</p></div>`;
}

export function caseBriefHtml(result: {
  case_name: string; citation: string[]; court: string; date_filed: string;
  facts: string; procedural_history: string; issues: string[];
  holding: string; reasoning: string; rule_of_law: string;
  concurrence?: string | null; dissent?: string | null; significance: string;
  sources?: Array<{ title: string; source_type: string; url?: string | null; citation?: string | null; court?: string | null; date_filed?: string | null }>;
  sources_consulted?: string[];
}): string {
  let sourcesHtml = '';
  const srcList = result.sources;
  if (srcList && srcList.length > 0) {
    sourcesHtml = srcList.map((s, i) => {
      const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575' };
      return `<div style="margin-bottom:0.5rem;padding-bottom:0.3rem;${i < srcList.length - 1 ? 'border-bottom:1px solid #eee' : ''}">
        <strong>${esc(s.title)}</strong>
        <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.75rem;background:${badge.bg};color:${badge.color};margin-left:0.3rem;font-weight:600">${esc(s.source_type)}</span>
        ${s.url ? `<a href="${esc(s.url)}" style="font-size:0.78rem;color:#1a7db5;text-decoration:none;margin-left:0.3rem">View on CourtListener ↗</a>` : ''}
        <div style="font-size:0.78rem;color:#888;margin-top:0.1rem">${[s.citation, s.court, s.date_filed].filter(Boolean).join(' | ')}</div>
      </div>`;
    }).join('');
  }

  return `
    <div class="header">${esc(result.court)} &mdash; ${esc(result.date_filed)}</div>
    <div class="header">${result.citation.map(c => esc(c)).join('; ')}</div>

    ${fmtField('Facts', result.facts)}
    ${fmtField('Procedural History', result.procedural_history)}

    <div class="field-label">Issues</div>
    <div class="field-value">${fmtList(result.issues)}</div>

    ${fmtField('Holding', result.holding)}
    ${fmtField('Reasoning', result.reasoning)}
    ${fmtField('Rule of Law', result.rule_of_law)}
    ${fmtField('Concurrence', result.concurrence || null)}
    ${fmtField('Dissent', result.dissent || null)}
    ${fmtField('Significance', result.significance)}

    ${sourcesHtml ? `<div class="field-label">Sources</div><div class="field-value">${sourcesHtml}</div>` : ''}
    ${result.sources_consulted && result.sources_consulted.length > 0 ? `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>` : ''}
  `;
}

import { BADGE_COLORS } from '@/lib/sources';

export function summaryHtml(result: {
  title: string; summary_type: string; overview: string;
  key_findings: string[]; legal_principles: string[]; impact: string;
  key_points: string[]; sources_consulted: string[];
  sources?: Array<{ title: string; source_type: string; url?: string | null; citation?: string | null; court?: string | null; date_filed?: string | null }>;
}): string {
  let sourcesHtml = '';
  const srcList = result.sources;
  if (srcList && srcList.length > 0) {
    sourcesHtml = srcList.map((s, i) => {
      const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575' };
      return `<div style="margin-bottom:0.5rem;padding-bottom:0.3rem;${i < srcList.length - 1 ? 'border-bottom:1px solid #eee' : ''}">
        <strong>${esc(s.title)}</strong>
        <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.75rem;background:${badge.bg};color:${badge.color};margin-left:0.3rem;font-weight:600">${esc(s.source_type)}</span>
        ${s.url ? `<a href="${esc(s.url)}" style="font-size:0.78rem;color:#1a7db5;text-decoration:none;margin-left:0.3rem">View on CourtListener ↗</a>` : ''}
        <div style="font-size:0.78rem;color:#888;margin-top:0.1rem">${[s.citation, s.court, s.date_filed].filter(Boolean).join(' | ')}</div>
      </div>`;
    }).join('');
  }

  return `
    <div class="header">${esc(result.summary_type)} summary</div>
    ${fmtField('Overview', result.overview)}

    <div class="field-label">Key Findings</div>
    <div class="field-value">${fmtList(result.key_findings)}</div>

    <div class="field-label">Legal Principles</div>
    <div class="field-value">${fmtList(result.legal_principles)}</div>

    ${fmtField('Impact', result.impact)}

    <div class="field-label">Key Points</div>
    <div class="field-value">${fmtList(result.key_points)}</div>

    <div class="field-label">Sources Consulted</div>
    <div class="field-value">${fmtList(result.sources_consulted)}</div>

    ${sourcesHtml ? `<div class="field-label">Retrieved Sources</div><div class="field-value">${sourcesHtml}</div>` : ''}
  `;
}

export function argumentsHtml(result: {
  case_name: string; petitioner: string; respondent: string;
  petitioner_arguments: Array<{ party: string; argument: string; reasoning: string; authorities: string[]; court_resolution: string }>;
  respondent_arguments: Array<{ party: string; argument: string; reasoning: string; authorities: string[]; court_resolution: string }>;
  counterarguments_considered: string[]; key_doctrines_statutes: string[];
  winning_party: string; rationale: string;
  sources?: Array<{ title: string; source_type: string; url?: string | null; citation?: string | null; court?: string | null; date_filed?: string | null }>;
  sources_consulted?: string[];
}): string {
  let sourcesHtml = '';
  const srcList = result.sources;
  if (srcList && srcList.length > 0) {
    sourcesHtml = srcList.map((s, i) => {
      const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575' };
      return `<div style="margin-bottom:0.5rem;padding-bottom:0.3rem;${i < srcList.length - 1 ? 'border-bottom:1px solid #eee' : ''}">
        <strong>${esc(s.title)}</strong>
        <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.75rem;background:${badge.bg};color:${badge.color};margin-left:0.3rem;font-weight:600">${esc(s.source_type)}</span>
        ${s.url ? `<a href="${esc(s.url)}" style="font-size:0.78rem;color:#1a7db5;text-decoration:none;margin-left:0.3rem">View on CourtListener ↗</a>` : ''}
        <div style="font-size:0.78rem;color:#888;margin-top:0.1rem">${[s.citation, s.court, s.date_filed].filter(Boolean).join(' | ')}</div>
      </div>`;
    }).join('');
  }

  let html = `<div class="header">${esc(result.case_name)}</div>`;
  html += `<p><strong>Petitioner:</strong> ${esc(result.petitioner)} &mdash; <strong>Respondent:</strong> ${esc(result.respondent)}</p>`;

  const renderArgs = (args: Array<any>, label: string) => {
    if (!args || args.length === 0) return '';
    let h = `<h2>${esc(label)} Arguments</h2>`;
    args.forEach((a, i) => {
      h += `<div class="section"><h3>Argument ${i+1}</h3>`;
      h += fmtField('Claim', a.argument);
      h += fmtField('Reasoning', a.reasoning);
      if (a.authorities?.length) h += `<div class="field-label">Authorities</div><div class="field-value">${fmtTags(a.authorities)}</div>`;
      if (a.court_resolution) h += fmtField('Court Resolution', a.court_resolution);
      h += `</div>`;
    });
    return h;
  };

  html += renderArgs(result.petitioner_arguments, 'Petitioner');
  html += renderArgs(result.respondent_arguments, 'Respondent');

  if (result.counterarguments_considered?.length) {
    html += `<h2>Counterarguments Considered</h2>${fmtList(result.counterarguments_considered)}`;
  }

  html += `<h2>Key Doctrines &amp; Statutes</h2>${fmtTags(result.key_doctrines_statutes || [])}`;
  html += `<p><strong>Winning Party:</strong> ${esc(result.winning_party)}</p>`;
  html += fmtField('Rationale', result.rationale);

  if (sourcesHtml) html += `<div class="field-label">Sources</div><div class="field-value">${sourcesHtml}</div>`;
  if (result.sources_consulted?.length) html += `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>`;
  return html;
}

export function citationMapHtml(result: {
  case_name: string; cases_cited: Array<{ name: string; citation: string | null; type: string; context: string; treatment: string }>;
  statutes_cited: Array<{ name: string; citation: string | null; type: string; context: string; treatment: string }>;
  constitutional_provisions: Array<{ name: string; citation: string | null; type: string; context: string; treatment: string }>;
  total_citations: number; key_precedent: string;
  sources?: Array<{ title: string; source_type: string; url?: string | null; citation?: string | null; court?: string | null; date_filed?: string | null }>;
  sources_consulted?: string[];
}): string {
  let sourcesHtml = '';
  const srcList = result.sources;
  if (srcList && srcList.length > 0) {
    sourcesHtml = srcList.map((s, i) => {
      const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575' };
      return `<div style="margin-bottom:0.5rem;padding-bottom:0.3rem;${i < srcList.length - 1 ? 'border-bottom:1px solid #eee' : ''}">
        <strong>${esc(s.title)}</strong>
        <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.75rem;background:${badge.bg};color:${badge.color};margin-left:0.3rem;font-weight:600">${esc(s.source_type)}</span>
        ${s.url ? `<a href="${esc(s.url)}" style="font-size:0.78rem;color:#1a7db5;text-decoration:none;margin-left:0.3rem">View on CourtListener ↗</a>` : ''}
        <div style="font-size:0.78rem;color:#888;margin-top:0.1rem">${[s.citation, s.court, s.date_filed].filter(Boolean).join(' | ')}</div>
      </div>`;
    }).join('');
  }

  let html = `<div class="header">${esc(result.case_name)}</div>`;
  html += `<p><strong>Total Citations:</strong> ${result.total_citations}</p>`;

  const renderAuth = (items: Array<any>, label: string) => {
    if (!items || items.length === 0) return '';
    let h = `<h2>${esc(label)}</h2>`;
    items.forEach(a => {
      h += `<div class="section">`;
      h += `<p><strong>${esc(a.name)}</strong>${a.citation ? ' &mdash; ' + esc(a.citation) : ''}</p>`;
      h += fmtField('Context', a.context);
      if (a.treatment) h += `<p><span class="badge badge-moderate">${esc(a.treatment)}</span></p>`;
      h += `</div>`;
    });
    return h;
  };

  html += renderAuth(result.cases_cited, 'Cases Cited');
  html += renderAuth(result.statutes_cited, 'Statutes Cited');
  html += renderAuth(result.constitutional_provisions, 'Constitutional Provisions');
  html += fmtField('Key Precedent', result.key_precedent);

  if (sourcesHtml) html += `<div class="field-label">Sources</div><div class="field-value">${sourcesHtml}</div>`;
  if (result.sources_consulted?.length) html += `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>`;
  return html;
}

export function memorandumHtml(result: {
  to: string; author: string; date: string; re: string;
  question_presented: string; brief_answer: string; facts: string;
  issues: Array<{ issue: string; rule: string; application: string; conclusion: string }>;
  overall_conclusion: string;
  sources?: Array<{ title: string; source_type: string; url?: string | null; citation?: string | null; court?: string | null; date_filed?: string | null }>;
  sources_consulted?: string[];
}): string {
  let sourcesHtml = '';
  const srcList = result.sources;
  if (srcList && srcList.length > 0) {
    sourcesHtml = srcList.map((s, i) => {
      const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575' };
      return `<div style="margin-bottom:0.5rem;padding-bottom:0.3rem;${i < srcList.length - 1 ? 'border-bottom:1px solid #eee' : ''}">
        <strong>${esc(s.title)}</strong>
        <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.75rem;background:${badge.bg};color:${badge.color};margin-left:0.3rem;font-weight:600">${esc(s.source_type)}</span>
        ${s.url ? `<a href="${esc(s.url)}" style="font-size:0.78rem;color:#1a7db5;text-decoration:none;margin-left:0.3rem">View on CourtListener ↗</a>` : ''}
        <div style="font-size:0.78rem;color:#888;margin-top:0.1rem">${[s.citation, s.court, s.date_filed].filter(Boolean).join(' | ')}</div>
      </div>`;
    }).join('');
  }

  let html = `<table>
    <tr><td style="width:100px;font-weight:bold">TO:</td><td>${esc(result.to)}</td></tr>
    <tr><td style="font-weight:bold">FROM:</td><td>${esc(result.author)}</td></tr>
    <tr><td style="font-weight:bold">DATE:</td><td>${esc(result.date)}</td></tr>
    <tr><td style="font-weight:bold">RE:</td><td>${esc(result.re)}</td></tr>
  </table>`;

  html += fmtField('Question Presented', result.question_presented);
  html += fmtField('Brief Answer', result.brief_answer);
  html += fmtField('Facts', result.facts);

  if (result.issues?.length) {
    html += `<h2>Discussion</h2>`;
    result.issues.forEach((i, idx) => {
      html += `<h3>Issue ${idx+1}: ${esc(i.issue)}</h3>`;
      html += fmtField('Rule', i.rule);
      html += fmtField('Application', i.application);
      html += fmtField('Conclusion', i.conclusion);
    });
  }

  html += fmtField('Overall Conclusion', result.overall_conclusion);

  if (sourcesHtml) html += `<div class="field-label">Sources</div><div class="field-value">${sourcesHtml}</div>`;
  if (result.sources_consulted?.length) html += `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>`;
  return html;
}

export function debateHtml(result: {
  topic: string; user_position: string;
  supporting_arguments: Array<{ side: string; title: string; argument: string; reasoning: string; authorities: string[]; strength: string; counter_rebuttal: string | null }>;
  opposing_arguments: Array<{ side: string; title: string; argument: string; reasoning: string; authorities: string[]; strength: string; counter_rebuttal: string | null }>;
  key_doctrines_statutes: string[]; predicted_winner: string; rationale: string; practice_tips: string[];
  sources?: Array<{ title: string; source_type: string; url?: string | null; citation?: string | null; court?: string | null; date_filed?: string | null }>;
  sources_consulted?: string[];
}): string {
  let sourcesHtml = '';
  const srcList = result.sources;
  if (srcList && srcList.length > 0) {
    sourcesHtml = srcList.map((s, i) => {
      const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575' };
      return `<div style="margin-bottom:0.5rem;padding-bottom:0.3rem;${i < srcList.length - 1 ? 'border-bottom:1px solid #eee' : ''}">
        <strong>${esc(s.title)}</strong>
        <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.75rem;background:${badge.bg};color:${badge.color};margin-left:0.3rem;font-weight:600">${esc(s.source_type)}</span>
        ${s.url ? `<a href="${esc(s.url)}" style="font-size:0.78rem;color:#1a7db5;text-decoration:none;margin-left:0.3rem">View on CourtListener ↗</a>` : ''}
        <div style="font-size:0.78rem;color:#888;margin-top:0.1rem">${[s.citation, s.court, s.date_filed].filter(Boolean).join(' | ')}</div>
      </div>`;
    }).join('');
  }

  let html = `<div class="header">${esc(result.topic)}</div>`;
  html += fmtField('Your Position', result.user_position);

  const renderArgs = (args: Array<any>, label: string) => {
    if (!args || args.length === 0) return '';
    let h = `<h2>${esc(label)}</h2>`;
    args.forEach(a => {
      const strengthClass = a.strength === 'strong' ? 'badge-strong' : a.strength === 'weak' ? 'badge-weak' : 'badge-moderate';
      h += `<div class="section"><h3>${esc(a.title)}</h3>`;
      h += `<p><span class="badge ${strengthClass}">${esc(a.strength)}</span></p>`;
      h += fmtField('Argument', a.argument);
      h += fmtField('Reasoning', a.reasoning);
      if (a.authorities?.length) h += `<div class="field-label">Authorities</div><div class="field-value">${fmtTags(a.authorities)}</div>`;
      if (a.counter_rebuttal) h += `<div class="field-label">Counter-Rebuttal</div><div class="field-value"><p style="font-style:italic">${esc(a.counter_rebuttal)}</p></div>`;
      h += `</div>`;
    });
    return h;
  };

  html += renderArgs(result.supporting_arguments, 'Supporting Arguments');
  html += renderArgs(result.opposing_arguments, 'Opposing Arguments');

  if (result.key_doctrines_statutes?.length) {
    html += `<h2>Key Doctrines &amp; Statutes</h2>${fmtTags(result.key_doctrines_statutes)}`;
  }

  const winClass = result.predicted_winner === 'supporting' ? 'badge-win' : result.predicted_winner === 'opposing' ? 'badge-moderate' : '';
  html += `<p><strong>Predicted Winner:</strong> <span class="badge ${winClass}">${esc(result.predicted_winner)}</span></p>`;
  html += fmtField('Rationale', result.rationale);

  if (result.practice_tips?.length) {
    html += `<h2>Practice Tips</h2>${fmtList(result.practice_tips)}`;
  }

  if (sourcesHtml) html += `<div class="field-label">Sources</div><div class="field-value">${sourcesHtml}</div>`;
  if (result.sources_consulted?.length) html += `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>`;
  return html;
}

export function bluebookHtml(result: {
  entries: Array<{
    raw_input: string; formatted: string; case_name?: string | null;
    authority_type: string; rules_applied: string[]; notes: string;
    confidence: string; from_local: boolean;
  }>;
  general_notes: string;
  sources_consulted?: string[];
}): string {
  let html = `<h2>Bluebook Citations</h2>`;
  result.entries.forEach((entry, i) => {
    html += `<div class="section">`;
    html += `<p><strong>Raw:</strong> ${esc(entry.raw_input)}</p>`;
    html += `<p><strong>Formatted:</strong> ${esc(entry.formatted)}</p>`;
    html += `<p><span class="tag" style="background:#e8f4f8;color:#209dd7">${esc(entry.authority_type)}</span>`;
    html += `<span class="tag" style="background:#f3e8f7;color:#753991">${esc(entry.confidence)} confidence</span>`;
    if (entry.from_local) html += `<span class="tag" style="background:#e8f5e9;color:#2e7d32">curated landmark match</span>`;
    html += `</p>`;
    if (entry.rules_applied?.length) {
      html += `<div class="field-label">Bluebook Rules Applied</div><div class="field-value">${fmtTags(entry.rules_applied)}</div>`;
    }
    if (entry.notes) html += fmtField('Notes', entry.notes);
    html += `</div>`;
  });
  if (result.general_notes) html += fmtField('General Notes', result.general_notes);
  if (result.sources_consulted?.length) {
    html += `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>`;
  }
  return html;
}

export function compareHtml(result: {
  case_a: {
    name: string; citation: string; year: number; court: string;
    date_filed: string; subjects: string[]; holdings: string[];
  };
  case_b: {
    name: string; citation: string; year: number; court: string;
    date_filed: string; subjects: string[]; holdings: string[];
  };
  comparison: {
    similarities: string[]; differences: string[];
    relationship: string; relationship_type: string;
    significance: string; practice_note: string;
  } | null;
  sources_consulted?: string[];
}): string {
  const factRows = (c: any) => `
    <tr><td style="width:150px;font-weight:bold">Citation</td><td>${esc(c.citation)}</td></tr>
    <tr><td style="font-weight:bold">Year</td><td>${esc(String(c.year))}</td></tr>
    <tr><td style="font-weight:bold">Court</td><td>${esc(c.court)}</td></tr>
    <tr><td style="font-weight:bold">Decided</td><td>${esc(c.date_filed)}</td></tr>
    <tr><td style="font-weight:bold">Doctrines</td><td>${esc(c.subjects.join(', '))}</td></tr>
    <tr><td style="font-weight:bold">Holding</td><td>${c.holdings.map((h: string) => esc(h)).join('<br/>')}</td></tr>`;

  let html = `<h2>Case Comparison: ${esc(result.case_a.name)} vs ${esc(result.case_b.name)}</h2>`;
  html += `<h3>Quick Facts</h3>`;
  html += `<table><tr><th style="width:50%">${esc(result.case_a.name)}</th><th style="width:50%">${esc(result.case_b.name)}</th></tr>`;
  html += `<tr><td style="vertical-align:top">${factRows(result.case_a)}</td><td style="vertical-align:top">${factRows(result.case_b)}</td></tr></table>`;

  if (result.comparison) {
    const comp = result.comparison;
    if (comp.similarities?.length) {
      html += `<h3>Similarities</h3>${fmtList(comp.similarities)}`;
    }
    if (comp.differences?.length) {
      html += `<h3>Differences</h3>${fmtList(comp.differences)}`;
    }
    html += `<h3>Doctrinal Relationship</h3>`;
    html += `<p><span class="badge badge-moderate">${esc(comp.relationship_type)}</span> &mdash; ${esc(comp.relationship)}</p>`;
    html += fmtField('Significance', comp.significance);
    html += fmtField('Exam Practice Note', comp.practice_note);
  }
  if (result.sources_consulted?.length) {
    html += `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>`;
  }
  return html;
}

export function resultToPlainText(html: string): string {
  let t = html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&mdash;/g, '—');
  t = t
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, __, text) => text.toUpperCase() + '\n')
    .replace(/<div[^>]*class="[^"]*field-label[^"]*"[^>]*>(.*?)<\/div>/gi, (_, text) => text.toUpperCase() + '\n');
  t = t
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '$1')
    .replace(/<\/(div|p|h[1-6]|li|tr|table|section)>/gi, '\n')
    .replace(/<(br|hr)\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

export function notesHtml(_title: string, content: string): string {
  const body = _marked.parse(content || '', { async: false }) as string;
  return `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.8; color: #222;">
    ${body}
  </div>`;
}

export function glossaryHtml(result: {
  term: string; definition: string; etymology?: string | null;
  jurisdiction?: string | null; usage_example: string;
  related_terms: string[]; also_known_as?: string | null;
  practice_tips?: string | null; citations: string[];
  from_seed?: boolean;
}): string {
  let html = `<div class="header">Glossary Entry${result.from_seed ? ' &mdash; Curated from legal sources' : ''}</div>`;
  if (result.etymology) html += `<p><em>Etymology:</em> ${esc(result.etymology)}</p>`;
  if (result.jurisdiction) html += `<p><em>Jurisdiction:</em> ${esc(result.jurisdiction)}</p>`;
  if (result.also_known_as) html += `<p><em>Also known as:</em> ${esc(result.also_known_as)}</p>`;

  html += fmtField('Definition', result.definition);

  if (result.usage_example) {
    html += `<div class="field-label">Usage Example</div><div class="field-value"><p style="font-style:italic;color:#555">${esc(result.usage_example)}</p></div>`;
  }

  if (result.related_terms?.length) {
    html += `<div class="field-label">Related Terms</div><div class="field-value">${fmtTags(result.related_terms)}</div>`;
  }

  if (result.practice_tips) {
    html += `<div class="section">`;
    html += `<div class="field-label">Practice Tips</div><div class="field-value"><p><em>${esc(result.practice_tips)}</em></p></div>`;
    html += `</div>`;
  }

  if (result.citations?.length) {
    html += `<div class="field-label">Sources</div><div class="field-value"><ul>${result.citations.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
  }
  return html;
}

export function issueSpotterHtml(result: {
  overview: string;
  issues: Array<{
    issue: string; rule: string; application: string;
    conclusion: string; missing_information: string;
    relevant_authorities: string[];
  }>;
  issues_by_area: Record<string, string[]>;
  practice_tips: string;
  sources?: Array<{ title: string; source_type: string; url?: string | null; citation?: string | null; court?: string | null; date_filed?: string | null }>;
  sources_consulted?: string[];
}): string {
  let sourcesHtml = '';
  const srcList = result.sources;
  if (srcList && srcList.length > 0) {
    sourcesHtml = srcList.map((s, i) => {
      const badge = BADGE_COLORS[s.source_type] || { bg: '#f5f5f5', color: '#757575' };
      return `<div style="margin-bottom:0.5rem;padding-bottom:0.3rem;${i < srcList.length - 1 ? 'border-bottom:1px solid #eee' : ''}">
        <strong>${esc(s.title)}</strong>
        <span style="display:inline-block;padding:0.1rem 0.4rem;border-radius:3px;font-size:0.75rem;background:${badge.bg};color:${badge.color};margin-left:0.3rem;font-weight:600">${esc(s.source_type)}</span>
        ${s.url ? `<a href="${esc(s.url)}" style="font-size:0.78rem;color:#1a7db5;text-decoration:none;margin-left:0.3rem">View on CourtListener ↗</a>` : ''}
        <div style="font-size:0.78rem;color:#888;margin-top:0.1rem">${[s.citation, s.court, s.date_filed].filter(Boolean).join(' | ')}</div>
      </div>`;
    }).join('');
  }

  let html = `<h2>Issue Spotter Analysis</h2>`;
  html += fmtField('Overview', result.overview);

  if (Object.keys(result.issues_by_area).length > 0) {
    html += `<div class="field-label">Legal Areas</div><div class="field-value">`;
    Object.entries(result.issues_by_area).forEach(([area, texts]) => {
      html += `<span class="tag" style="background:#e8f4f8;color:var(--blue-primary)">${esc(area)} (${texts.length})</span> `;
    });
    html += `</div>`;
  }

  result.issues.forEach((issue, i) => {
    html += `<div class="section" style="margin:1rem 0;border-left:3px solid #ecad0a;padding-left:0.75rem">`;
    html += `<h3>Issue ${i+1}: ${esc(issue.issue)}</h3>`;
    html += fmtField('Rule', issue.rule);
    html += fmtField('Application', issue.application);
    html += `<p><strong>Conclusion:</strong> ${esc(issue.conclusion)}</p>`;
    if (issue.missing_information) {
      html += `<div style="background:#fff8e1;padding:0.5rem;border-radius:3px;font-size:0.9rem;margin:0.5rem 0"><strong>Needs more info:</strong> ${esc(issue.missing_information)}</div>`;
    }
    if (issue.relevant_authorities.length > 0) {
      html += `<div class="field-label">Authorities</div><div class="field-value">${fmtTags(issue.relevant_authorities)}</div>`;
    }
    html += `</div>`;
  });

  if (result.practice_tips) {
    html += fmtField('Exam Tips', result.practice_tips);
  }

  if (sourcesHtml) html += `<div class="field-label">Sources</div><div class="field-value">${sourcesHtml}</div>`;
  if (result.sources_consulted?.length) html += `<div class="field-label">Sources Consulted</div><div class="field-value">${fmtList(result.sources_consulted)}</div>`;
  return html;
}
