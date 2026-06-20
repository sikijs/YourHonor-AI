'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked';
import { User, CatalogResponse, CatalogTemplate, GenerateDocumentResponse, api } from '@/lib/api';
import { markdownComponents } from '@/components/markdownComponents';

export default function GenerateDocumentView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<CatalogTemplate | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateDocumentResponse | null>(null);

  useEffect(() => {
    api.templates.list().then(setCatalog).catch(() => onError('Failed to load templates'));
  }, []);

  function selectTemplate(template: CatalogTemplate) {
    const existingNames = new Set(template.fields.map((f) => f.name));
    const uniqueCover = (template.cover_page_fields || []).filter(
      (f) => !existingNames.has(f.name)
    );
    const merged: CatalogTemplate = {
      ...template,
      fields: [...template.fields, ...uniqueCover],
    };
    setSelectedTemplate(merged);
    setFieldValues({});
    setTitle(template.name);
    setResult(null);
  }

  function handleFieldChange(fieldName: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldName]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate || loading) return;
    setLoading(true);
    setResult(null);
    onError('');
    try {
      const doc = await api.legal.generateDocument(selectedTemplate.name, fieldValues, title || undefined);
      setResult(doc);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Document Generator</h2>
      <p style={{ color: 'var(--gray-text)' }}>
        Select a legal document template, fill in the fields, and generate a complete document.
      </p>

      {!selectedTemplate && catalog && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Available Templates</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            {catalog.templates.map((t) => (
              <div
                key={t.name}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => selectTemplate(t)}
              >
                <h4 style={{ color: 'var(--blue-primary)' }}>{t.name}</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--gray-text)' }}>{t.description}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-text)', marginTop: '0.25rem' }}>
                  {(t.fields.length + ((t.cover_page_fields || []).filter(cf => !t.fields.some(f => f.name === cf.name)).length))} fields
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTemplate && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--blue-primary)' }}>{selectedTemplate.name}</h3>
            <button className="btn btn-outline" onClick={() => { setSelectedTemplate(null); setResult(null); }}>
              Back to Templates
            </button>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray-text)', marginBottom: '1rem' }}>
            {selectedTemplate.description}
          </p>

          <form onSubmit={handleGenerate}>
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Document Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. My Mutual NDA for Project Alpha"
                />
              </div>
            </div>

            <div className="card" style={{ marginBottom: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem' }}>Template Fields</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-text)', marginBottom: '1rem' }}>
                Fill in each field below. The hint text beneath each input explains what to enter.
              </p>
              {selectedTemplate.fields.map((field) => {
                const categoryLabel = field.category === 'coverpage_link' ? 'Cover Page' : field.category === 'cover_page' ? 'Cover Page' : field.category === 'orderform_link' ? 'Order Form' : field.category === 'keyterms_link' ? 'Key Terms' : field.category === 'businessterms_link' ? 'Business Terms' : field.category === 'sow_link' ? 'SOW Details' : 'General';
                const categoryTooltip = field.category === 'coverpage_link' ? 'Appears on the cover page of the agreement' : field.category === 'cover_page' ? 'Appears on the cover page of the agreement' : field.category === 'orderform_link' ? 'Defined in the order form (pricing, limits)' : field.category === 'keyterms_link' ? 'Key legal terms (liability, IP, governing law)' : field.category === 'businessterms_link' ? 'Business-specific terms (obligations, territory)' : field.category === 'sow_link' ? 'Statement of Work details (deliverables, fees)' : 'General field';
                return (
                <div key={field.name} className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {field.name}
                    <span title={categoryTooltip} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '3px', fontWeight: 600, cursor: 'help',
                      background: field.category === 'coverpage_link' || field.category === 'cover_page' ? '#e3f2fd' : field.category === 'orderform_link' ? '#fce4ec' : field.category === 'keyterms_link' ? '#f3e5f5' : '#fff3e0',
                      color: field.category === 'coverpage_link' || field.category === 'cover_page' ? '#1565c0' : field.category === 'orderform_link' ? '#c62828' : field.category === 'keyterms_link' ? '#6a1b9a' : '#e65100',
                    }}>{categoryLabel}</span>
                  </label>
                  {field.name === 'Modifications' ? (
                    <textarea
                      value={fieldValues[field.name] || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder="Type your modifications here..."
                      rows={4}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #ccc', fontFamily: 'inherit', fontSize: 'inherit', resize: 'vertical' }}
                    />
                  ) : (
                  <input
                    type="text"
                    value={fieldValues[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    placeholder="Type your value here..."
                  />
                  )}
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-text)', display: 'block', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    {field.hint}
                  </span>
                </div>
                );
              })}
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Document'}
            </button>
          </form>

          {result && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Document Generated</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline" onClick={() => {
                    const blob = new Blob([result.content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${result.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    Download
                  </button>
                  <button className="btn btn-outline" onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`<!DOCTYPE html><html><head><title>${result.title}</title>
<style>
  body{font-family:Georgia,serif;line-height:1.8;padding:2rem 3rem;max-width:800px;margin:auto;color:#222}
  h1{font-size:1.5rem;border-bottom:2px solid #000;padding-bottom:0.3rem;margin-top:1.5rem}
  h2{font-size:1.2rem;margin-top:1.25rem}
  h3{font-size:1.1rem;margin-top:1.5rem;margin-bottom:0.3rem}
  p{margin-bottom:0.5rem;text-align:justify}
  table{border-collapse:collapse;width:100%;margin:0.75rem 0}
  td,th{border:1px solid #999;padding:0.4rem 0.6rem;text-align:left}
  @media print{body{padding:0.5in}}
</style></head><body>${marked.parse(result.content)}</body></html>`);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}>
                    Print
                  </button>
                </div>
              </div>
              <p><strong>Title:</strong> {result.title}</p>
              <div style={{ marginTop: '0.5rem', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', maxHeight: '500px', overflowY: 'auto', fontSize: '0.9rem', lineHeight: 1.6 }}>
                <ReactMarkdown components={markdownComponents}>{result.content}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
