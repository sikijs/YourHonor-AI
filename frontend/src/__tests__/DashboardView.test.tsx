import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    stats: {
      me: jest.fn(),
    },
    tutor: {
      reviewQueue: jest.fn(),
      markReview: jest.fn(),
    },
  },
}));

import DashboardView from '@/components/DashboardView';

const { api } = jest.requireMock('@/lib/api');
const mockStatsMe = api.stats.me;
const mockReviewQueue = api.tutor.reviewQueue;
const mockMarkReview = api.tutor.markReview;

const USER = { id: 1, email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

const FULL_STATS = {
  account_age_days: 42,
  documents_total: 5,
  documents_by_type: [
    { doc_type: 'case_summary', count: 3 },
    { doc_type: 'citation_map', count: 2 },
  ],
  notes_total: 3,
  tutor_review: {
    total_reviewed: 4,
    mastered: 2,
    weak: 2,
    weak_topics: [
      { topic_id: 'torts', topic_name: 'Torts', weak_count: 2 },
    ],
  },
};

const EMPTY_STATS = {
  account_age_days: 0,
  documents_total: 0,
  documents_by_type: [],
  notes_total: 0,
  tutor_review: {
    total_reviewed: 0,
    mastered: 0,
    weak: 0,
    weak_topics: [],
  },
};

describe('DashboardView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders overview stat cards', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Study Dashboard')).toBeInTheDocument());
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Review Queue')).toBeInTheDocument();
    expect(screen.getByText('Account Age')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders documents-by-type breakdown with friendly labels', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Documents by Type')).toBeInTheDocument());
    expect(screen.getByText('Case Summary')).toBeInTheDocument();
    expect(screen.getByText('Citation Map')).toBeInTheDocument();
  });

  it('renders tutor review stats and weak topics', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Tutor Review Progress')).toBeInTheDocument());
    expect(screen.getByText(/2 mastered of 4/)).toBeInTheDocument();
    expect(screen.getByText('Weakest topics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Torts 2 cards/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review all 2 cards in queue' })).toBeInTheDocument();
  });

  it('shows empty-state guidance for a fresh account', async () => {
    mockStatsMe.mockResolvedValue(EMPTY_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Documents by Type')).toBeInTheDocument());
    expect(screen.getByText(/No documents yet/)).toBeInTheDocument();
    expect(screen.getByText(/haven.t marked any review cards/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Queue (empty)' })).toBeDisabled();
    expect(screen.getByText('account — welcome!')).toBeInTheDocument();
  });

  it('reports fetch errors through onError', async () => {
    mockStatsMe.mockRejectedValue(new Error('boom'));
    const onError = jest.fn();

    render(<DashboardView user={USER} onError={onError} onNavigate={jest.fn()} />);

    await waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
  });

  it('opens the review queue when the button is clicked', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    mockReviewQueue.mockResolvedValue({
      cards: [{
        question: 'What is duty of care?',
        answer: 'A legal obligation to avoid harming others.',
        topic_id: 'torts',
        topic_name: 'Torts',
        difficulty: 2,
        expected_concepts: ['Negligence'],
      }],
      total: 1,
    });
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Review all 2 cards in queue' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Review all 2 cards in queue' }));
    await waitFor(() => expect(screen.getByText('Review Queue')).toBeInTheDocument());
    expect(mockReviewQueue).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('What is duty of care?')).toBeInTheDocument());
  });

  it('opens the queue filtered to a topic when a weak topic is clicked', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    mockReviewQueue.mockResolvedValue({
      cards: [
        {
          question: 'What is duty of care?',
          answer: 'A legal obligation to avoid harming others.',
          topic_id: 'torts',
          topic_name: 'Torts',
          difficulty: 2,
        },
        {
          question: 'What is consideration?',
          answer: 'A bargained-for exchange.',
          topic_id: 'contracts',
          topic_name: 'Contracts',
          difficulty: 2,
        },
      ],
      total: 2,
    });
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /Torts/ })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Torts/ }));
    await waitFor(() => expect(screen.getByText('Review Queue · Torts')).toBeInTheDocument());
    expect(screen.getByText('What is duty of care?')).toBeInTheDocument();
    expect(screen.getByText('Card 1 of 1')).toBeInTheDocument();
    expect(screen.queryByText('What is consideration?')).not.toBeInTheDocument();
  });

  it('reloads stats when returning from the review queue', async () => {
    mockStatsMe
      .mockResolvedValueOnce(FULL_STATS)
      .mockResolvedValueOnce({
        ...FULL_STATS,
        tutor_review: {
          total_reviewed: 4,
          mastered: 3,
          weak: 1,
          weak_topics: [{ topic_id: 'torts', topic_name: 'Torts', weak_count: 1 }],
        },
      });
    mockReviewQueue.mockResolvedValue({
      cards: [{
        question: 'What is duty of care?',
        answer: 'A legal obligation to avoid harming others.',
        topic_id: 'torts',
        topic_name: 'Torts',
        difficulty: 2,
      }],
      total: 1,
    });
    mockMarkReview.mockResolvedValue({});
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Review all 2 cards in queue' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Review all 2 cards in queue' }));
    await waitFor(() => expect(screen.getByText('What is duty of care?')).toBeInTheDocument());
    await user.click(screen.getByText('What is duty of care?'));
    await user.click(screen.getByRole('button', { name: 'Got it ✓' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Back to Dashboard' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));

    await waitFor(() => expect(mockStatsMe).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review all 1 card in queue' })).toBeInTheDocument());
  });
});