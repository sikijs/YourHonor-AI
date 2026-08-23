import type { Components } from 'react-markdown';

export const markdownComponents: Components = {
  h1: ({ children }: any) => <h1 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>{children}</h1>,
  h2: ({ children }: any) => <h2 style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>{children}</h2>,
  h3: ({ children }: any) => <h3 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>{children}</h3>,
  p: ({ children }: any) => <p style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>{children}</p>,
  ul: ({ children }: any) => <ul style={{ marginTop: '0.25rem', marginBottom: '0.5rem' }}>{children}</ul>,
  a: ({ href, children, ...props }: any) => {
    // Internal anchors (#section) would trip hash-based routing — render
    // them as plain text instead of navigating away from the current view.
    if (!href || href.startsWith('#')) {
      return <span {...props}>{children}</span>;
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
    );
  },
};
