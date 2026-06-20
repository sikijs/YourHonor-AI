'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Document, api } from '@/lib/api';
import { markdownComponents } from '@/components/markdownComponents';
import { printContent, documentHtml } from '@/lib/print';
import GenerateDocumentView from '@/components/GenerateDocumentView';

export default function DocumentsView({ user, onError }: { user: User; onError: (err: string) => void }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [docType, setDocType] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [subMode, setSubMode] = useState<'list' | 'generate'>('list');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const docs = await api.documents.list();
      setDocuments(docs);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.documents.create(title, content, docType || undefined);
      setShowModal(false);
      setTitle('');
      setContent('');
      setDocType('');
      loadDocuments();
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const title = file.name.replace(/\.pdf$/i, '');
      await api.documents.upload(file, title);
      loadDocuments();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.documents.delete(id);
      loadDocuments();
    } catch (err: any) {
      onError(err.message);
    }
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleUpload(file);
    }
  }

  return (
    <div>
      {subMode === 'generate' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Generate New Document</h2>
            <button className="btn btn-outline" onClick={() => setSubMode('list')}>← Back to My Documents</button>
          </div>
          <p style={{ color: 'var(--gray-text)', marginBottom: '1rem' }}>
            Generate legal documents from templates — NDAs, service agreements, complaints, and more. The AI will guide you through filling in the required fields based on your needs.
          </p>
          <GenerateDocumentView user={user} onError={onError} />
        </div>
      )}

      {subMode === 'list' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <h2 style={{ margin: 0 }}>My Documents</h2>
              <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid #ccc', borderRadius: '6px', overflow: 'hidden', marginLeft: '1rem' }}>
                <button
                  className={`btn btn-primary`}
                  onClick={() => setSubMode('generate')}>+ Generate New</button>
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--gray-text)', marginBottom: '1rem' }}>
            Your saved documents — case briefs, summaries, memoranda, and generated forms. This is your workspace for managing everything you create.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
              Upload PDF
            </button>
            <button className="btn btn-secondary" onClick={() => setShowModal(true)}>New Document</button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />

          {uploading && (
            <div className="card" style={{ textAlign: 'center', padding: '1rem', marginBottom: '1rem' }}>
              <div className="spinner-container"><span className="spinner" /><p>Uploading and extracting text...</p></div>
            </div>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : documents.length === 0 ? (
            <div
              className="card"
              style={{ textAlign: 'center', padding: '3rem 2rem', border: '2px dashed var(--gray-text)', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <p style={{ color: 'var(--gray-text)', marginBottom: '0.5rem' }}>
                No documents yet.
              </p>
              <p style={{ color: 'var(--gray-text)', fontSize: '0.85rem' }}>
                Click to upload a PDF, drag and drop, or create a new text document.
              </p>
            </div>
          ) : (
            <div
              className="documents-list"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              {documents.map((doc) => (
                <div key={doc.id} className="card document-item">
                  <div>
                    <h3>{doc.title}</h3>
                    <p style={{ color: 'var(--gray-text)', fontSize: '0.9rem' }}>
                      {doc.doc_type || 'Document'} - {new Date(doc.updated_at).toLocaleDateString()}
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {doc.original_filename && (
                        <span style={{ fontSize: '0.8rem', background: '#f0f0f0', padding: '0.15rem 0.5rem', borderRadius: '3px', color: 'var(--gray-text)' }}>
                          {doc.original_filename}
                        </span>
                      )}
                      {doc.file_size != null && doc.file_size > 0 && (
                        <span style={{ fontSize: '0.8rem', background: '#f0f0f0', padding: '0.15rem 0.5rem', borderRadius: '3px', color: 'var(--gray-text)' }}>
                          {formatSize(doc.file_size)}
                        </span>
                      )}
                      {doc.file_type && (
                        <span style={{ fontSize: '0.8rem', background: '#e3f2fd', padding: '0.15rem 0.5rem', borderRadius: '3px', color: '#1565c0' }}>
                          {doc.file_type.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="document-actions">
                    <button className="btn btn-outline" onClick={() => setViewDoc(doc)}>
                      View
                    </button>
                    {doc.content && (
                      <button className="btn btn-outline" onClick={() => printContent(doc.title, documentHtml(doc.content!))}>
                        Download
                      </button>
                    )}
                    <button className="btn btn-outline" style={{ borderColor: '#d32f2f', color: '#d32f2f' }} onClick={() => handleDelete(doc.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>New Document</h2>
                  <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
                </div>
                <form onSubmit={handleCreate}>
                  <div className="form-group">
                    <label>Title</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Type</label>
                    <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                      <option value="">Select type...</option>
                      <option value="case_brief">Case Brief</option>
                      <option value="memo">Legal Memorandum</option>
                      <option value="agreement">Agreement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ margin: 0 }}>Content</label>
                      <div style={{ display: 'flex', gap: '0.25rem', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                        <button type="button" className={`btn btn-sm ${!showPreview ? 'btn-primary' : ''}`} style={{ borderRadius: 0, border: 'none', padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setShowPreview(false)}>Write</button>
                        <button type="button" className={`btn btn-sm ${showPreview ? 'btn-primary' : ''}`} style={{ borderRadius: 0, border: 'none', padding: '0.25rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setShowPreview(true)}>Preview</button>
                      </div>
                    </div>
                    {showPreview ? (
                      <div className="card" style={{ padding: '0.75rem', minHeight: '130px', lineHeight: 1.6, fontSize: '0.9rem' }}>
                        {content ? <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown> : <span style={{ color: 'var(--gray-text)' }}>Nothing to preview</span>}
                      </div>
                    ) : (
                      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} />
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary">Create Document</button>
                </form>
              </div>
            </div>
          )}

          {viewDoc && (
            <div className="modal-overlay" onClick={() => setViewDoc(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto' }}>
                <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'var(--white)', zIndex: 1 }}>
                  <h2>{viewDoc.title}</h2>
                  <button className="modal-close" onClick={() => setViewDoc(null)}>&times;</button>
                </div>
                <div style={{ padding: '1rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                  {viewDoc.content ? (
                    <ReactMarkdown components={markdownComponents}>{viewDoc.content}</ReactMarkdown>
                  ) : (
                    <p style={{ color: 'var(--gray-text)' }}>No content</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
