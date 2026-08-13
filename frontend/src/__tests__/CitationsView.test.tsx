import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    documents: {
      list: jest.fn(),
    },
    legal: {
      citations: jest.fn(),
      bluebookFormat: jest.fn(),
    },
  },
}));

jest.mock('@/lib/export', () => ({
  downloadExport: jest.fn(),
}));

jest.mock('@/lib/print', () => ({
  citationMapHtml: (r: any) => `HTML(${r.case_name})`,
  bluebookHtml: (r: any) => `HTML(${r.entries.length})`,
  resultToPlainText: (s: string) => s,
}));

import CitationsView from '@/components/CitationsView';

const { api } = jest.requireMock('@/lib/api');

const USER = { id: 1, email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

describe('CitationsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.documents.list.mockResolvedValue([]);
    api.legal.citations.mockResolvedValue({
      case_name: 'Miranda v. Arizona',
      cases_cited: [],
      statutes_cited: [],
      constitutional_provisions: [],
      total_citations: 0,
      key_precedent: '',
      sources: [],
      sources_consulted: [],
      disclaimer: 'Educational only.',
    });
    api.legal.bluebookFormat.mockResolvedValue({
      entries: [],
      general_notes: '',
      sources: [],
      sources_consulted: [],
      disclaimer: 'Educational only.',
    });
  });

  it('renders the citation map by default with both tabs available', async () => {
    render(<CitationsView user={USER} onError={jest.fn()} />);
    expect(await screen.findByRole('button', { name: 'Citation Map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bluebook Formatter' })).toBeInTheDocument();
    expect(await screen.findByText('Generate Map')).toBeInTheDocument();
  });

  it('switches to the Bluebook formatter tab', async () => {
    const user = userEvent.setup();
    render(<CitationsView user={USER} onError={jest.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Bluebook Formatter' }));
    expect(await screen.findByText('Bluebook Citation Formatter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Format Citations' })).toBeInTheDocument();
    expect(screen.queryByText('Generate Map')).not.toBeInTheDocument();
  });

  it('switches back to the citation map tab', async () => {
    const user = userEvent.setup();
    render(<CitationsView user={USER} onError={jest.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Bluebook Formatter' }));
    await user.click(await screen.findByRole('button', { name: 'Citation Map' }));
    await waitFor(() => expect(screen.getByText('Generate Map')).toBeInTheDocument());
    expect(screen.queryByText('Bluebook Citation Formatter')).not.toBeInTheDocument();
  });
});