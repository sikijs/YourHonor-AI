import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    doctrine: {
      compare: jest.fn(),
    },
  },
}));

jest.mock('@/lib/export', () => ({
  downloadExport: jest.fn(),
}));

jest.mock('@/lib/print', () => ({
  compareHtml: (r: any) => `HTML(${r.case_a.name})`,
  resultToPlainText: (s: string) => s,
}));

import CompareView from '@/components/CompareView';

const { api } = jest.requireMock('@/lib/api');
const mockCompare = api.doctrine.compare;

const RESPONSE = {
  case_a: {
    name: 'Roe v. Wade',
    citation: '410 U.S. 113',
    year: 1973,
    court: 'Supreme Court of the United States',
    date_filed: '1973-01-22',
    subjects: ['Privacy'],
    holdings: ['The Constitution protects a woman\'s decision to terminate her pregnancy.'],
  },
  case_b: {
    name: 'Dobbs v. Jackson Women\'s Health',
    citation: '597 U.S. 215',
    year: 2022,
    court: 'Supreme Court of the United States',
    date_filed: '2022-06-24',
    subjects: ['Privacy'],
    holdings: ['The Constitution does not confer a right to abortion.'],
  },
  comparison: {
    similarities: ['Both concern Fourteenth Amendment liberty.'],
    differences: ['Roe recognized the right; Dobbs rejected it.'],
    relationship: 'Dobbs overruled Roe.',
    relationship_type: 'overruled',
    significance: 'Shows how doctrine can shift with Court membership.',
    practice_note: 'Cite Roe for pre-2022 law and Dobbs for current law.',
  },
  sources_consulted: ['Roe v. Wade', 'Dobbs v. Jackson Women\'s Health'],
  disclaimer: 'Educational only. Not legal advice.',
};

describe('CompareView', () => {
  beforeEach(() => {
    mockCompare.mockReset();
  });

  it('renders the comparison title and generates on demand', async () => {
    mockCompare.mockResolvedValue(RESPONSE);
    render(<CompareView caseNames={['Roe v. Wade', 'Dobbs v. Jackson Women\'s Health']} onError={jest.fn()} onBack={jest.fn()} />);

    expect(screen.getByText('Roe v. Wade vs Dobbs v. Jackson Women\'s Health')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Generate AI Comparison' }));
    expect(mockCompare).toHaveBeenCalledWith(['Roe v. Wade', 'Dobbs v. Jackson Women\'s Health']);

    await waitFor(() => expect(screen.getByText('Quick Facts')).toBeInTheDocument());
    expect(screen.getByText('410 U.S. 113')).toBeInTheDocument();
    expect(screen.getByText('597 U.S. 215')).toBeInTheDocument();
    expect(screen.getByText('Both concern Fourteenth Amendment liberty.')).toBeInTheDocument();
    expect(screen.getByText('Roe recognized the right; Dobbs rejected it.')).toBeInTheDocument();
    expect(screen.getByText('Dobbs overruled Roe.')).toBeInTheDocument();
    expect(screen.getByText('overruled')).toBeInTheDocument();
    expect(screen.getByText('Cite Roe for pre-2022 law and Dobbs for current law.')).toBeInTheDocument();
  });

  it('reports API errors through onError', async () => {
    mockCompare.mockRejectedValue(new Error('Comparison failed'));
    const onError = jest.fn();
    render(<CompareView caseNames={['Roe v. Wade', 'Dobbs v. Jackson Women\'s Health']} onError={onError} onBack={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Generate AI Comparison' }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Comparison failed'));
  });

  it('shows the educational disclaimer after generation', async () => {
    mockCompare.mockResolvedValue(RESPONSE);
    render(<CompareView caseNames={['Roe v. Wade', 'Dobbs v. Jackson Women\'s Health']} onError={jest.fn()} onBack={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Generate AI Comparison' }));
    await waitFor(() => expect(screen.getByText(/Educational only\. Not legal advice\./)).toBeInTheDocument());
  });

  it('triggers onBack from the back button', async () => {
    const onBack = jest.fn();
    render(<CompareView caseNames={['Roe v. Wade', 'Dobbs v. Jackson Women\'s Health']} onError={jest.fn()} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /Back to Doctrines/ }));
    expect(onBack).toHaveBeenCalled();
  });
});