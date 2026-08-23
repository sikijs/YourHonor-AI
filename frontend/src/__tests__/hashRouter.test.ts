import { parseHash, viewToHash, PUBLIC_VIEWS } from '@/lib/hashRouter';

describe('parseHash', () => {
  test('returns null for empty hash', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
  });

  test('returns null for unknown view', () => {
    expect(parseHash('#nonexistent')).toBeNull();
    expect(parseHash('#settings')).toBeNull();
  });

  test('parses a plain view', () => {
    expect(parseHash('#dashboard')).toEqual({ view: 'dashboard' });
    expect(parseHash('#about')).toEqual({ view: 'about' });
  });

  test('parses drafting tab and query params', () => {
    expect(parseHash('#drafting?tab=summary')).toEqual({
      view: 'drafting',
      draftTab: 'summary',
    });
    expect(parseHash('#drafting?tab=brief&q=Marbury%20v.%20Madison')).toEqual({
      view: 'drafting',
      draftTab: 'brief',
      query: 'Marbury v. Madison',
    });
  });

  test('ignores invalid tab values', () => {
    expect(parseHash('#drafting?tab=notes')).toEqual({ view: 'drafting' });
    expect(parseHash('#drafting?tab=')).toEqual({ view: 'drafting' });
  });

  test('ignores tab param on non-drafting views', () => {
    expect(parseHash('#home?tab=summary')).toEqual({ view: 'home' });
  });

  test('parses atlas tab param on the doctrines view', () => {
    expect(parseHash('#doctrines?tab=guide')).toEqual({
      view: 'doctrines',
      atlasTab: 'guide',
    });
    expect(parseHash('#doctrines?tab=map')).toEqual({
      view: 'doctrines',
      atlasTab: 'map',
    });
  });

  test('ignores invalid atlas tab values', () => {
    expect(parseHash('#doctrines?tab=nope')).toEqual({ view: 'doctrines' });
    expect(parseHash('#doctrines?tab=summary')).toEqual({ view: 'doctrines' });
  });

  test('does not treat trailing slash as a view', () => {
    expect(parseHash('#dashboard/')).toBeNull();
  });
});

describe('viewToHash', () => {
  test('builds plain view hashes', () => {
    expect(viewToHash('dashboard')).toBe('#dashboard');
    expect(viewToHash('home')).toBe('#home');
  });

  test('builds drafting hashes with tab and query', () => {
    expect(viewToHash('drafting', { draftTab: 'summary' })).toBe('#drafting?tab=summary');
    expect(viewToHash('drafting', { draftTab: 'brief', query: 'Marbury v. Madison' })).toBe(
      '#drafting?tab=brief&q=Marbury+v.+Madison',
    );
  });

  test('round-trips through parseHash', () => {
    const hash = viewToHash('drafting', { draftTab: 'arguments', query: 'Erie v. Tompkins' });
    expect(parseHash(hash)).toEqual({ view: 'drafting', draftTab: 'arguments', query: 'Erie v. Tompkins' });
  });

  test('drops params on non-drafting views', () => {
    expect(viewToHash('tutor', { draftTab: 'brief', query: 'x' })).toBe('#tutor');
  });

  test('builds atlas hashes with tab', () => {
    expect(viewToHash('doctrines')).toBe('#doctrines');
    expect(viewToHash('doctrines', { atlasTab: 'guide' })).toBe('#doctrines?tab=guide');
    expect(viewToHash('doctrines', { atlasTab: 'map' })).toBe('#doctrines?tab=map');
  });

  test('round-trips the atlas tab through parseHash', () => {
    const hash = viewToHash('doctrines', { atlasTab: 'guide' });
    expect(parseHash(hash)).toEqual({ view: 'doctrines', atlasTab: 'guide' });
  });
});

describe('PUBLIC_VIEWS', () => {
  test('exposes the expected public views', () => {
    expect(PUBLIC_VIEWS).toEqual(['home', 'about', 'doctrines', 'resources', 'auth']);
  });
});