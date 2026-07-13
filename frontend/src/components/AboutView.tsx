'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function AboutView() {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/about')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load about page');
        return res.json();
      })
      .then((data) => setContent(data.content))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <p style={{ color: 'var(--error)' }}>Error: {error}</p>;
  }

  if (!content) {
    return (
      <div className="spinner-container">
        <span className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="about-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 style={{
              fontSize: '2.4rem',
              color: 'var(--dark-navy)',
              marginBottom: '0.25rem',
            }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{
              color: 'var(--dark-navy)',
              marginBottom: '1rem',
              borderBottom: '2px solid var(--accent-yellow)',
              paddingBottom: '0.5rem',
              marginTop: '2rem',
            }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{
              color: 'var(--dark-navy)',
              margin: '1.5rem 0 0.5rem',
            }}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p style={{
              marginBottom: '0.75rem',
              lineHeight: 1.7,
              color: '#444',
            }}>
              {children}
            </p>
          ),
          img: ({ src, alt }) => (
            <img
              src={src}
              alt={alt}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                margin: '1.5rem auto 0.6rem',
              }}
            />
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              background: '#fffdf0',
              borderLeft: '4px solid var(--accent-yellow)',
              padding: '0.75rem 1rem',
              margin: '1rem 0',
              borderRadius: '0 8px 8px 0',
              fontStyle: 'italic',
              color: '#555',
            }}>
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr style={{
              border: 'none',
              borderTop: '1px solid #ddd',
              margin: '2rem 0',
            }} />
          ),
          ul: ({ children }) => (
            <ul style={{
              margin: '0.5rem 0',
              paddingLeft: '1.25rem',
              lineHeight: 1.7,
            }}>
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: '0.3rem', color: '#444' }}>
              {children}
            </li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
