'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchLegalTechContent } from '@/lib/legalTechContent';
import { markdownComponents } from '@/components/markdownComponents';

export default function ResourcesView() {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetchLegalTechContent().then(setContent);
  }, []);

  return (
    <div>
      <h2 style={{ color: 'var(--dark-navy)', marginBottom: '1.5rem' }}>Legal Tech &amp; AI Tools</h2>
      {content ? (
        <div className="card" style={{ padding: '1.5rem', lineHeight: 1.7 }}>
          <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <p style={{ color: 'var(--gray-text)' }}>Loading...</p>
      )}
    </div>
  );
}
