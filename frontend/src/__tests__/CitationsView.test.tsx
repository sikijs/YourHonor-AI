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
    dashboard: {
      citationDrill: jest.fn(),
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
    api.dashboard.citationDrill.mockResolvedValue({
      raw: '5 U.S. 137',
      formatted: 'Marbury v. Madison, 5 U.S. 137 (1803)',
      case_name: 'Marbury v. Madison',
      year: 1803,
      options: [
        { text: 'Marbury v. Madison, 5 U.S. 137', is_correct: false, rule_note: 'Wrong — the decision year is required (Rule 10.6).' },
        { text: 'Marbury v. Madison, 5 U.S. 137 (1803)', is_correct: true, rule_note: 'Correct — full case name, "v." (Rule 10.2.1), reporter periods (Rule 10.3), year (Rule 10.6).' },
        { text: 'Marbury vs. Madison, 5 U.S. 137 (1803)', is_correct: false, rule_note: 'Wrong — party names use "v.", never "vs." (Rule 10.2.1).' },
        { text: 'Marbury v. Madison, 5 US 137 (1803)', is_correct: false, rule_note: 'Wrong — reporter abbreviations keep periods (Rule 10.3).' },
      ],
    });
  });

  it('renders the citation map by default with all three tabs available', async () => {
    render(<CitationsView user={USER} onError={jest.fn()} />);
    expect(await screen.findByRole('button', { name: 'Citation Map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bluebook Formatter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Daily Drill' })).toBeInTheDocument();
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

  it('renders the daily drill with today\'s quiz', async () => {
    render(<CitationsView user={USER} onError={jest.fn()} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Daily Drill' }));

    expect(await screen.findByText(/Which of these is the correct Bluebook citation for/)).toBeInTheDocument();
    expect(screen.getByText('5 U.S. 137')).toBeInTheDocument();
    expect(api.dashboard.citationDrill).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Marbury v. Madison, 5 U.S. 137 (1803)' }),
    ).toBeInTheDocument();
  });

  it('scores a drill answer and jumps to the formatter from the drill', async () => {
    const user = userEvent.setup();
    render(<CitationsView user={USER} onError={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Daily Drill' }));
    await user.click(await screen.findByRole('button', { name: 'Marbury vs. Madison, 5 U.S. 137 (1803)' }));

    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marbury v. Madison, 5 U.S. 137 (1803) ✓' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Format your own citations/ }));
    expect(await screen.findByText('Bluebook Citation Formatter')).toBeInTheDocument();
  });
});