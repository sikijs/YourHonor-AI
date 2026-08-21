import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    legal: {
      bluebookFormat: jest.fn(),
    },
  },
}));

jest.mock('@/lib/export', () => ({
  downloadExport: jest.fn(),
}));

jest.mock('@/lib/print', () => ({
  bluebookHtml: (r: any) => `HTML(${r.entries.length})`,
  resultToPlainText: (s: string) => s,
}));

import BluebookView from '@/components/BluebookView';

const { api } = jest.requireMock('@/lib/api');
const mockFormat = api.legal.bluebookFormat;

const USER = { id: 1, email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

const RESPONSE = {
  entries: [
    {
      raw_input: 'Miranda vs Arizona 384 US 436',
      formatted: 'Miranda v. Arizona, 384 U.S. 436 (1966)',
      case_name: 'Miranda v. Arizona',
      authority_type: 'case',
      rules_applied: ['Rule 10 (case citation)'],
      notes: 'Matched to the curated landmark-case library.',
      confidence: 'high',
      from_local: true,
    },
    {
      raw_input: 'Smith v Jones, 123 F3d 456 (2000)',
      formatted: 'Smith v. Jones, 123 F.3d 456 (7th Cir. 2000).',
      case_name: 'Smith v. Jones',
      authority_type: 'case',
      rules_applied: ['Rule 10.2.1(a)', 'Rule 10.6'],
      notes: 'Reporter abbreviation expanded.',
      confidence: 'medium',
      from_local: false,
    },
  ],
  general_notes: 'Verify all citations against the current Bluebook.',
  sources: [],
  sources_consulted: ['The Bluebook: A Uniform System of Citation'],
  disclaimer: 'Educational only. Not legal advice.',
};

describe('BluebookView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form with a textarea and format button', () => {
    render(<BluebookView user={USER} onError={jest.fn()} />);
    expect(screen.getByText('Bluebook Citation Formatter')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Format Citations' })).toBeDisabled();
  });

  it('submits citations and renders formatted entries', async () => {
    mockFormat.mockResolvedValue(RESPONSE);

    render(<BluebookView user={USER} onError={jest.fn()} />);

    await userEvent.type(
      screen.getByPlaceholderText(/e\.g\./),
      'Miranda vs Arizona 384 US 436\nSmith v Jones, 123 F3d 456 (2000)',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));

    await waitFor(() => expect(screen.getByText('Miranda v. Arizona, 384 U.S. 436 (1966)')).toBeInTheDocument());
    expect(mockFormat).toHaveBeenCalledWith(
      'Miranda vs Arizona 384 US 436\nSmith v Jones, 123 F3d 456 (2000)',
    );
    expect(screen.getByText('Smith v. Jones, 123 F.3d 456 (7th Cir. 2000).')).toBeInTheDocument();
    expect(screen.getByText('curated match')).toBeInTheDocument();
    expect(screen.getByText('Rule 10.2.1(a)')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('Verify all citations against the current Bluebook.')).toBeInTheDocument();
  });

  it('reports errors from the API through onError', async () => {
    mockFormat.mockRejectedValue(new Error('Formatting failed'));

    const onError = jest.fn();
    render(<BluebookView user={USER} onError={onError} />);

    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), 'Roe v Wade');
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith('Formatting failed'));
  });

  it('copies a single entry when Copy is clicked', async () => {
    mockFormat.mockResolvedValue(RESPONSE);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<BluebookView user={USER} onError={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), 'Miranda vs Arizona');
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));

    await waitFor(() => expect(screen.getByText('Miranda v. Arizona, 384 U.S. 436 (1966)')).toBeInTheDocument());
    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    await userEvent.click(copyButtons[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Miranda v. Arizona, 384 U.S. 436 (1966)'));
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('copies all formatted citations when Copy All is clicked', async () => {
    mockFormat.mockResolvedValue(RESPONSE);
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<BluebookView user={USER} onError={jest.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), 'Miranda vs Arizona');
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));

    await waitFor(() => expect(screen.getByText('Miranda v. Arizona, 384 U.S. 436 (1966)')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Copy All' }));
    expect(writeText).toHaveBeenCalledWith(
      'Miranda v. Arizona, 384 U.S. 436 (1966)\nSmith v. Jones, 123 F.3d 456 (7th Cir. 2000).',
    );
  });

  it('shows the educational disclaimer', async () => {
    mockFormat.mockResolvedValue(RESPONSE);
    render(<BluebookView user={USER} onError={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), 'Roe v Wade');
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));
    await waitFor(() => expect(screen.getByText(/Educational only\. Not legal advice\./)).toBeInTheDocument());
  });

  it('does not submit when the input is blank', async () => {
    render(<BluebookView user={USER} onError={jest.fn()} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Format Citations' }).closest('form')!);
    expect(mockFormat).not.toHaveBeenCalled();
  });

  it('shows an explanatory tooltip when hovering the curated match badge', async () => {
    mockFormat.mockResolvedValue(RESPONSE);
    render(<BluebookView user={USER} onError={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), 'Miranda vs Arizona');
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));
    await waitFor(() => expect(screen.getByText('curated match')).toBeInTheDocument());

    await userEvent.hover(screen.getByText('curated match'));
    expect(await screen.findByText(/92 landmark cases in the offline library/)).toBeInTheDocument();
  });

  it('shows an explanatory tooltip when hovering the confidence badge', async () => {
    mockFormat.mockResolvedValue(RESPONSE);
    render(<BluebookView user={USER} onError={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), 'Smith v Jones');
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));
    await waitFor(() => expect(screen.getByText('medium')).toBeInTheDocument());

    await userEvent.hover(screen.getByText('medium'));
    expect(await screen.findByText(/How sure the formatter is/)).toBeInTheDocument();
  });

  it('shows an explanatory tooltip when hovering the authority type badge', async () => {
    mockFormat.mockResolvedValue(RESPONSE);
    render(<BluebookView user={USER} onError={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/e\.g\./), 'Miranda vs Arizona');
    await userEvent.click(screen.getByRole('button', { name: 'Format Citations' }));
    const caseBadges = await screen.findAllByText('case');
    expect(caseBadges.length).toBeGreaterThan(0);

    await userEvent.hover(caseBadges[0]);
    expect(await screen.findByText(/different formatting rules for each type/)).toBeInTheDocument();
  });
});