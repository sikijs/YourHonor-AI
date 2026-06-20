'use client';

import { ABOUT_SECTIONS } from '@/lib/aboutContent';

export default function AboutView() {
  return (
    <div>
      {ABOUT_SECTIONS.map((section) => (
        <div key={section.id} id={section.id} style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: 'var(--dark-navy)', marginBottom: '1rem', borderBottom: '2px solid var(--accent-yellow)', paddingBottom: '0.5rem' }}>
            {section.title}
          </h2>
          {section.paragraphs.map((p, i) => {
            if (typeof p === 'string') {
              if (p.startsWith('Hey there')) {
                return <p key={i} style={{ fontSize: '1.3rem', color: 'var(--dark-navy)', marginBottom: '0.75rem' }}>{p}</p>;
              }
              if (section.id === 'disclaimer') {
                return (
                  <div key={i} className="card" style={{ background: '#fff3cd', border: '1px solid #ffc107', marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.9rem', color: '#856404', margin: 0 }}>{p}</p>
                  </div>
                );
              }
              return <p key={i} style={{ marginBottom: '0.75rem', lineHeight: 1.7, color: '#444' }}>{p}</p>;
            }
            return (
              <div key={i} style={{ marginBottom: '0.75rem' }}>
                {p.heading && (
                  <h4 style={{ color: 'var(--blue-primary)', marginBottom: '0.25rem' }}>{p.heading}</h4>
                )}
                <ul style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: 1.7 }}>
                  {p.items.map((item, j) => (
                    <li key={j} style={{ marginBottom: '0.3rem', color: '#444' }}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
