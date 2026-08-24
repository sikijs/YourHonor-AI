import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    dashboard: {
      issuePrompt: jest.fn(),
      todayIssueAnswer: jest.fn(),
    },
  },
}));

import DailyWarmupCard from '@/components/DailyWarmupCard';

const { api } = jest.requireMock('@/lib/api');
const mockPrompt = api.dashboard.issuePrompt;
const mockIssueAnswer = api.dashboard.todayIssueAnswer;

const PROMPT = {
  prompt:
    'In Marbury v. Madison the court answered one legal question. Write it as a single sentence: ' +
    '\u201cDoes [party] [action] violate [right or rule]?\u201d Not sure? Reveal the subject hint, ' +
    "then check your sentence against the court's own issue.",
  case_name: 'Marbury v. Madison',
};

const ISSUE_ANSWER = {
  case_name: 'Marbury v. Madison',
  subject: 'Constitutional Law',
  doctrine_name: 'Judicial Review',
  doctrine_description: 'The power of courts to review laws passed by Congress against the Constitution and declare them invalid.',
  issue: 'Does Marbury have a right to his judicial commission, and can the Supreme Court order delivery?',
  plain_holding: 'Yes, but the part of the Judiciary Act letting him sue directly in the Supreme Court was unconstitutional.',
  holding: 'The Supreme Court has the power to review acts of Congress and declare them unconstitutional.',
};

describe('DailyWarmupCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrompt.mockResolvedValue(PROMPT);
    mockIssueAnswer.mockResolvedValue(ISSUE_ANSWER);
  });

  it('renders today\'s warm-up prompt without fetching the answer upfront', async () => {
    render(<DailyWarmupCard onUseCaseName={jest.fn()} />);

    expect(await screen.findByText(/In Marbury v. Madison the court answered/)).toBeInTheDocument();
    expect(mockIssueAnswer).not.toHaveBeenCalled();
    expect(screen.queryByText(/The court's issue:/)).not.toBeInTheDocument();
  });

  it('hides itself entirely when the prompt cannot load', async () => {
    mockPrompt.mockRejectedValue(new Error('offline'));

    const { container } = render(<DailyWarmupCard onUseCaseName={jest.fn()} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('reveals the subject hint on demand with a single answer fetch', async () => {
    const user = userEvent.setup();
    render(<DailyWarmupCard onUseCaseName={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Show subject hint' }));

    expect(await screen.findByText('Judicial Review')).toBeInTheDocument();
    expect(screen.getByText('Constitutional Law')).toBeInTheDocument();
    expect(mockIssueAnswer).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Hide subject hint' }));
    expect(screen.queryByText('Judicial Review')).not.toBeInTheDocument();
    expect(mockIssueAnswer).toHaveBeenCalledTimes(1);
  });

  it("reveals the court's issue and plain-English holding on demand", async () => {
    const user = userEvent.setup();
    render(<DailyWarmupCard onUseCaseName={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: "Reveal the court's issue" }));

    expect(await screen.findByText(/Does Marbury have a right to his judicial commission/)).toBeInTheDocument();
    expect(screen.getByText(/plain English/)).toBeInTheDocument();
    expect(screen.getByText(/unconstitutional/)).toBeInTheDocument();
    expect(mockIssueAnswer).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: "Hide the court's issue" }));
    expect(screen.queryByText(/Does Marbury have a right to his judicial commission/)).not.toBeInTheDocument();
  });

  it('pastes the case name into the spotter and collapses after use', async () => {
    const user = userEvent.setup();
    const onUseCaseName = jest.fn();
    render(<DailyWarmupCard onUseCaseName={onUseCaseName} />);

    await screen.findByText(/In Marbury v. Madison the court answered/);
    await user.click(screen.getByRole('button', { name: /Spot issues in this case/ }));

    expect(onUseCaseName).toHaveBeenCalledWith('Marbury v. Madison');
    expect(screen.queryByText(/Which of these is/)).not.toBeInTheDocument();
    expect(screen.queryByText(/In Marbury v. Madison the court answered/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByText(/In Marbury v. Madison the court answered/)).toBeInTheDocument();
  });

  it('collapses and expands via the toggle without losing state', async () => {
    const user = userEvent.setup();
    render(<DailyWarmupCard onUseCaseName={jest.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Show subject hint' }));
    await screen.findByText('Judicial Review');

    await user.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText('Judicial Review')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show' }));
    expect(await screen.findByText('Judicial Review')).toBeInTheDocument();
    expect(mockIssueAnswer).toHaveBeenCalledTimes(1);
  });
});
