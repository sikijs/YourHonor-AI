import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  COMPLEXITY_OPTIONS: [
    { value: 'intro', label: 'Introductory' },
    { value: 'standard', label: 'Standard' },
    { value: 'advanced', label: 'Advanced' },
  ],
  api: {
    documents: {
      list: jest.fn(),
    },
    legal: {
      caseBrief: jest.fn(),
      summary: jest.fn(),
      arguments: jest.fn(),
      memorandum: jest.fn(),
    },
  },
}));

jest.mock('@/lib/print', () => ({
  caseBriefHtml: (r: any) => `HTML(${r.case_name})`,
  summaryHtml: (r: any) => `HTML(${r.title})`,
  argumentHtml: (r: any) => `HTML(${r.case_name})`,
  memorandumHtml: (r: any) => `HTML(${r.title})`,
  resultToPlainText: (s: string) => s,
}));

jest.mock('@/lib/export', () => ({
  downloadExport: jest.fn(),
}));

import DraftingView from '@/components/DraftingView';

const { api } = jest.requireMock('@/lib/api');

const USER = { id: 1, email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

describe('DraftingView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.documents.list.mockResolvedValue([]);
  });

  it('renders the Case Brief tab by default with all four tabs available', async () => {
    render(<DraftingView user={USER} onError={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Case Brief' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Summary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arguments' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Memorandum' })).toBeInTheDocument();
    expect(screen.getByText('Case Brief Generator')).toBeInTheDocument();
  });

  it('switches to the Summary tab', async () => {
    const user = userEvent.setup();
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Summary' }));
    expect(screen.getByText('Legal Summary Generator')).toBeInTheDocument();
    expect(screen.queryByText('Case Brief Generator')).not.toBeInTheDocument();
  });

  it('switches to the Arguments tab', async () => {
    const user = userEvent.setup();
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Arguments' }));
    expect(screen.getByText('Argument Extraction')).toBeInTheDocument();
  });

  it('switches to the Memorandum tab and back to Case Brief', async () => {
    const user = userEvent.setup();
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Memorandum' }));
    expect(screen.getByText('Legal Memorandum Generator')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Case Brief' }));
    expect(screen.getByText('Case Brief Generator')).toBeInTheDocument();
  });
});