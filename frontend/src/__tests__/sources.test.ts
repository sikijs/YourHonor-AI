import { getBadge } from '@/lib/sources';

describe('getBadge', () => {
  it('labels web sources by site name from the url', () => {
    expect(getBadge('web', 'https://www.britannica.com/topic/habeas-corpus').label).toBe('Britannica');
    expect(getBadge('web', 'https://en.wikipedia.org/wiki/Habeas_corpus').label).toBe('Wikipedia');
    expect(getBadge('web', 'https://www.brennancenter.org/our-work/x').label).toBe('Brennan Center');
    expect(getBadge('web', 'https://www.uscourts.gov/glossary-legal-terms/habeas-corpus').label).toBe('United States Courts');
  });

  it('falls back to the hostname for unknown sites', () => {
    expect(getBadge('web', 'https://example.org/article').label).toBe('example.org');
    expect(getBadge('web', 'https://www.example.org/article').label).toBe('example.org');
  });

  it('falls back to Web without a url', () => {
    expect(getBadge('web').label).toBe('Web');
    expect(getBadge('web', 'not a url').label).toBe('Web');
  });

  it('leaves non-web types unchanged', () => {
    expect(getBadge('courtlistener').label).toBe('CourtListener');
    expect(getBadge('courtlistener', 'https://www.courtlistener.com/opinion/1/x/').label).toBe('CourtListener');
    expect(getBadge('seed').label).toBe('Seed');
    expect(getBadge('rag').label).toBe('RAG');
  });
});