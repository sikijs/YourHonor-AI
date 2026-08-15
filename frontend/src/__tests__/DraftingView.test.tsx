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

  it('renders the tab passed as initialTab', () => {
    render(<DraftingView user={USER} onError={jest.fn()} initialTab="summary" />);
    expect(screen.getByText('Legal Summary Generator')).toBeInTheDocument();
    expect(screen.queryByText('Case Brief Generator')).not.toBeInTheDocument();
  });

  it('fires onTabChange when a tab is selected', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(<DraftingView user={USER} onError={jest.fn()} onTabChange={onTabChange} />);
    await user.click(screen.getByRole('button', { name: 'Arguments' }));
    expect(onTabChange).toHaveBeenCalledWith('arguments');
  });

  it('carries the case name from Case Brief into the Summary tab', async () => {
    const user = userEvent.setup();
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/Marbury v\. Madison/), 'Marbury v. Madison');
    await user.click(screen.getByRole('button', { name: 'Summary' }));
    expect(screen.getByDisplayValue('Marbury v. Madison')).toBeInTheDocument();
  });

  it('carries an edited query back from Summary to Case Brief', async () => {
    const user = userEvent.setup();
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/Marbury v\. Madison/), 'Roe v. Wade');
    await user.click(screen.getByRole('button', { name: 'Summary' }));
    const summaryInput = screen.getByPlaceholderText(/Miranda v\. Arizona/);
    await user.clear(summaryInput);
    await user.type(summaryInput, 'Miranda v. Arizona');
    await user.click(screen.getByRole('button', { name: 'Case Brief' }));
    expect(screen.getByDisplayValue('Miranda v. Arizona')).toBeInTheDocument();
  });

  it('carries the query into the Arguments and Memorandum tabs', async () => {
    const user = userEvent.setup();
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/Marbury v\. Madison/), 'Marbury v. Madison');
    await user.click(screen.getByRole('button', { name: 'Arguments' }));
    expect(screen.getByDisplayValue('Marbury v. Madison')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Memorandum' }));
    expect(screen.getByDisplayValue('Marbury v. Madison')).toBeInTheDocument();
  });

  it('seeds the shared query from a deep link on any tab', async () => {
    render(<DraftingView user={USER} onError={jest.fn()} initialTab="summary" initialQuery="Roe v. Wade" />);
    expect(screen.getByDisplayValue('Roe v. Wade')).toBeInTheDocument();
  });

  it('keeps the generated brief when leaving and returning to the Case Brief tab', async () => {
    const user = userEvent.setup();
    api.legal.caseBrief.mockResolvedValue({
      case_name: 'Miranda v. Arizona',
      complexity: 'standard',
      citation: ['384 U.S. 436'],
      court: 'Supreme Court of the United States',
      date_filed: '1966-06-13',
      facts: 'Miranda facts section.',
      procedural_history: 'Procedural history section.',
      issues: ['Are custodial statements admissible without warnings?'],
      holding: 'The prosecution may not use statements from custodial interrogation without prior warnings.',
      reasoning: 'Reasoning section.',
      rule_of_law: 'Rule of law section.',
      concurrence: null,
      dissent: null,
      significance: 'Significance section.',
      sources: [],
      sources_consulted: [],
      disclaimer: 'Educational only.',
    });
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.type(screen.getByPlaceholderText(/Marbury v\. Madison/), 'Miranda v. Arizona');
    await user.click(screen.getByRole('button', { name: 'Generate Brief' }));
    expect(await screen.findByText('Miranda facts section.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Summary' }));
    expect(screen.queryByText('Miranda facts section.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Case Brief' }));
    expect(screen.getByText('Miranda facts section.')).toBeInTheDocument();
    expect(api.legal.caseBrief).toHaveBeenCalledTimes(1);
  });

  it('keeps the generated summary when leaving and returning to the Summary tab', async () => {
    const user = userEvent.setup();
    api.legal.summary.mockResolvedValue({
      title: 'Miranda v. Arizona Summary',
      summary_type: 'general',
      complexity: 'standard',
      overview: 'Miranda overview section.',
      key_findings: ['Finding one'],
      legal_principles: ['Principle one'],
      impact: 'Impact section.',
      key_points: ['Point one'],
      sources_consulted: [],
      sources: [],
      disclaimer: 'Educational only.',
    });
    render(<DraftingView user={USER} onError={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Summary' }));
    await user.type(screen.getByPlaceholderText(/Miranda v\. Arizona/), 'Miranda v. Arizona');
    await user.click(screen.getByRole('button', { name: 'Generate Summary' }));
    expect(await screen.findByText('Miranda overview section.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Arguments' }));
    await user.click(screen.getByRole('button', { name: 'Summary' }));
    expect(screen.getByText('Miranda overview section.')).toBeInTheDocument();
    expect(api.legal.summary).toHaveBeenCalledTimes(1);
  });
});