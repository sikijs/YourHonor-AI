'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchLandmarkGuide } from '@/lib/landmarkGuideContent';
import { markdownComponents } from '@/components/markdownComponents';

// "Case Guide" tab content for the Case Law Atlas. The guide is a
// ~1,100-line reference document, so this component only mounts when its
// Atlas tab is active and fetches lazily on mount instead of weighing down
// the initial page render. The tab bar in AtlasView provides the heading.
export default function LandmarkGuideSection() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLandmarkGuide()
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p style={{ color: 'var(--gray-text)' }}>
        Could not load the guide. Please refresh and try again.
      </p>
    );
  }
  if (content === null) {
    return <p style={{ color: 'var(--gray-text)' }}>Loading...</p>;
  }
  return (
    <div className="card" style={{ padding: '1.5rem', lineHeight: 1.7 }}>
      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
