'use client';

export default function ActionBar({
  saved,
  copied,
  onCopy,
  onSavePdf,
}: {
  saved: boolean;
  copied: boolean;
  onCopy: () => void;
  onSavePdf: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
      {saved && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>✓ Saved to My Documents</span>}
      {copied && <span style={{ color: 'var(--blue-primary)', fontSize: '0.85rem' }}>Copied!</span>}
      <button className="btn btn-outline" onClick={onCopy}>
        Copy to Clipboard
      </button>
      <button className="btn btn-outline" onClick={onSavePdf}>
        Save PDF
      </button>
    </div>
  );
}
