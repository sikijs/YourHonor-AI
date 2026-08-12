const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '';

export type ExportFormat = 'pdf' | 'docx' | 'md';
export type ExportContentType = 'markdown' | 'html';

/**
 * POST the content to /api/export and save the returned file as a download.
 * The backend renders PDF (fpdf2) / DOCX (python-docx) from the content, so
 * the browser only ever receives plain bytes.
 */
export async function downloadExport(
  content: string,
  filename: string,
  format: ExportFormat,
  contentType: ExportContentType = 'markdown',
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/export`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, filename, format, content_type: contentType }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Export failed' }));
    throw new Error(error.detail || 'Export failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(filename)}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[._-]+|[._-]+$/g, '');
  return cleaned || 'document';
}