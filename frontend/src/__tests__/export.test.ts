import { downloadExport, sanitizeFilename } from '@/lib/export';

describe('sanitizeFilename', () => {
  it('replaces unsafe characters with underscores', () => {
    expect(sanitizeFilename('Case Brief: Marbury v. Madison')).toBe('Case_Brief_Marbury_v._Madison');
  });

  it('strips leading/trailing separators', () => {
    expect(sanitizeFilename('...hidden')).toBe('hidden');
    expect(sanitizeFilename('memo.txt')).toBe('memo.txt');
  });

  it('falls back to a default name when empty', () => {
    expect(sanitizeFilename('///')).toBe('document');
  });
});

describe('downloadExport', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  // jsdom has no navigation; stub the anchor click so nothing is simulated.
  const originalClick = HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();
    HTMLAnchorElement.prototype.click = jest.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    HTMLAnchorElement.prototype.click = originalClick;
    jest.restoreAllMocks();
  });

  it('posts content to /api/export and triggers a download', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['%PDF-']),
    });
    (global as any).fetch = fetchMock;

    await downloadExport('# Title', 'memo', 'pdf');

    expect(fetchMock).toHaveBeenCalledWith('/api/export', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '# Title', filename: 'memo', format: 'pdf', content_type: 'markdown' }),
    }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('throws the backend error message on failure', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Nothing to export' }),
    });

    await expect(downloadExport('', 'x', 'pdf')).rejects.toThrow('Nothing to export');
  });
});