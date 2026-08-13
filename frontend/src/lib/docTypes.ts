// Friendlier display names for stored doc_type values. Anything not listed
// falls back to snake_case → Title Case ("citation_map" → "Citation Map").
export const DOC_TYPE_LABELS: Record<string, string> = {
  general_summary: 'General Summary',
  case_summary: 'Case Summary',
  statute_summary: 'Statute Summary',
  doctrine_summary: 'Legal Doctrine Summary',
  bluebook_citations: 'Bluebook Citations',
  case_comparison: 'Case Comparison',
};

export function friendlyDocType(docType: string | null | undefined): string {
  if (!docType) return 'Document';
  return DOC_TYPE_LABELS[docType] ??
    docType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}