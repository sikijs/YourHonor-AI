import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    dashboard: {
      citationDrill: jest.fn(),
    },
  },
}));

import CitationDrillView from '@/components/CitationDrillView';

const { api } = jest.requireMock('@/lib/api');
const mockDrill = api.dashboard.citationDrill;

const DRILL = {
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
};

describe('CitationDrillView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDrill.mockResolvedValue(DRILL);
  });

  it('renders today\'s drill question with all options', async () => {
    render(<CitationDrillView onError={jest.fn()} />);

    expect(await screen.findByText(/Which of these is the correct Bluebook citation for/)).toBeInTheDocument();
    expect(screen.getByText('5 U.S. 137')).toBeInTheDocument();
    for (const option of DRILL.options) {
      expect(screen.getByRole('button', { name: option.text })).toBeInTheDocument();
    }
    expect(mockDrill).toHaveBeenCalledTimes(1);
  });

  it('scores a correct answer with its rule note', async () => {
    const user = userEvent.setup();
    render(<CitationDrillView onError={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: DRILL.formatted }));

    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText(/Rule 10\.2\.1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marbury vs. Madison, 5 U.S. 137 (1803)' })).toBeDisabled();
    expect(screen.queryByText(/Not quite/)).not.toBeInTheDocument();
  });

  it('scores a wrong answer with the violated rule and marks the correct one', async () => {
    const user = userEvent.setup();
    render(<CitationDrillView onError={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Marbury vs. Madison, 5 U.S. 137 (1803)' }));

    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/never "vs\."/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${DRILL.formatted} ✓` })).toBeDisabled();
    expect(screen.queryByText('Correct!')).not.toBeInTheDocument();
  });

  it('reports load failures through onError', async () => {
    mockDrill.mockRejectedValue(new Error('offline'));
    const onError = jest.fn();

    render(<CitationDrillView onError={onError} />);

    await screen.findByText(/No drill is available/);
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith('offline');
  });

  it('offers a jump to the Bluebook formatter via callback', async () => {
    const user = userEvent.setup();
    const onOpenFormatter = jest.fn();

    render(<CitationDrillView onError={jest.fn()} onOpenFormatter={onOpenFormatter} />);

    await user.click(await screen.findByRole('button', { name: /Format your own citations/ }));
    expect(onOpenFormatter).toHaveBeenCalledTimes(1);
  });
});
