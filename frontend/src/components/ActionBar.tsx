'use client';

import { useState } from 'react';
import { downloadExport, ExportContentType, ExportFormat } from '@/lib/export';

export default function ActionBar({
  saved,
  copied,
  onCopy,
  content,
  filename,
  contentType,
  onExportError,
}: {
  saved: boolean;
  copied: boolean;
  onCopy: () => void;
  content?: string;
  filename?: string;
  contentType?: ExportContentType;
  onExportError?: (err: string) => void;
}) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const canExport = Boolean(content && filename);

  async function handleExport(format: ExportFormat) {
    setExporting(format);
    try {
      await downloadExport(content!, filename!, format, contentType || 'markdown');
    } catch (err: any) {
      onExportError?.(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
      {saved && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
      {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
      <button className="btn btn-outline" onClick={onCopy}>
        Copy to Clipboard
      </button>
      {canExport && (
        <>
          {(['pdf', 'docx', 'md'] as ExportFormat[]).map((format) => (
            <button key={format} className="btn btn-outline" onClick={() => handleExport(format)} disabled={exporting !== null}>
              {exporting === format ? 'Exporting...' : `Download ${format.toUpperCase()}`}
            </button>
          ))}
        </>
      )}
    </div>
  );
}