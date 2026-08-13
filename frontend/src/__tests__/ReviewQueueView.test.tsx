import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    tutor: {
      reviewQueue: jest.fn(),
      markReview: jest.fn(),
    },
  },
}));

import ReviewQueueView from '@/components/ReviewQueueView';

const { api } = jest.requireMock('@/lib/api');
const mockReviewQueue = api.tutor.reviewQueue;
const mockMarkReview = api.tutor.markReview;

const CARD_A = {
  question: 'What is consideration?',
  answer: 'A bargained-for exchange of promises.',
  topic_id: 'contracts',
  topic_name: 'Contracts',
  difficulty: 2,
  expected_concepts: ['Consideration'],
};

const CARD_B = {
  question: 'What is a tort?',
  answer: 'A civil wrong other than breach of contract.',
  topic_id: 'torts',
  topic_name: 'Torts',
  difficulty: 3,
  expected_concepts: ['Tort'],
};

describe('ReviewQueueView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the first card with topic and difficulty', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A], total: 1 });

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('What is consideration?')).toBeInTheDocument());
    expect(screen.getByText('Contracts · Difficulty 2')).toBeInTheDocument();
    expect(screen.getByText('Card 1 of 1')).toBeInTheDocument();
  });

  it('flips the card to reveal answer and key concepts', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A], total: 1 });
    const user = userEvent.setup();

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('What is consideration?')).toBeInTheDocument());
    await user.click(screen.getByText('What is consideration?'));
    expect(screen.getByText('A bargained-for exchange of promises.')).toBeInTheDocument();
    expect(screen.getByText('Consideration')).toBeInTheDocument();
  });

  it('marks a card as got it and advances', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A, CARD_B], total: 2 });
    mockMarkReview.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('What is consideration?')).toBeInTheDocument());
    await user.click(screen.getByText('What is consideration?'));
    await user.click(screen.getByRole('button', { name: 'Got it ✓' }));
    expect(mockMarkReview).toHaveBeenCalledWith('What is consideration?', 'contracts', true);
    await waitFor(() => expect(screen.getByText('What is a tort?')).toBeInTheDocument());
    expect(screen.getByText('Card 2 of 2')).toBeInTheDocument();
  });

  it('marks a card as need to study and keeps it in the queue', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A], total: 1 });
    mockMarkReview.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('What is consideration?')).toBeInTheDocument());
    await user.click(screen.getByText('What is consideration?'));
    await user.click(screen.getByRole('button', { name: 'Need to Study ✗' }));
    expect(mockMarkReview).toHaveBeenCalledWith('What is consideration?', 'contracts', false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review Again' })).toBeInTheDocument());
  });

  it('shows a completion summary after the last card', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A], total: 1 });
    mockMarkReview.mockResolvedValue({});
    const user = userEvent.setup();

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('What is consideration?')).toBeInTheDocument());
    await user.click(screen.getByText('What is consideration?'));
    await user.click(screen.getByRole('button', { name: 'Got it ✓' }));
    await waitFor(() => expect(screen.getByText('Review Complete! 🎉')).toBeInTheDocument());
    expect(screen.getByText(/100%./)).toBeInTheDocument();
  });

  it('shows an all-caught-up message when the queue is empty', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [], total: 0 });

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} />);

    await waitFor(() => expect(screen.getByText("You're all caught up! 🎉")).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Start a Tutor Session' })).toBeInTheDocument();
  });

  it('shows an error and stays on the card when marking fails', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A, CARD_B], total: 2 });
    mockMarkReview.mockRejectedValue(new Error('save failed'));
    const user = userEvent.setup();

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('What is consideration?')).toBeInTheDocument());
    await user.click(screen.getByText('What is consideration?'));
    await user.click(screen.getByRole('button', { name: 'Got it ✓' }));
    await waitFor(() => expect(screen.getByText('save failed')).toBeInTheDocument());
    expect(screen.getByText('Card 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('A bargained-for exchange of promises.')).toBeInTheDocument();
  });

  it('filters the queue to a single topic when topicId is provided', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A, CARD_B], total: 2 });

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} topicId="contracts" topicName="Contracts" />);

    await waitFor(() => expect(screen.getByText('What is consideration?')).toBeInTheDocument());
    expect(screen.getByText('Card 1 of 1')).toBeInTheDocument();
    expect(screen.queryByText('What is a tort?')).not.toBeInTheDocument();
  });

  it('shows a topic-specific message when the topic has no weak cards', async () => {
    mockReviewQueue.mockResolvedValue({ cards: [CARD_A], total: 1 });

    render(<ReviewQueueView onBack={jest.fn()} onGoToTutor={jest.fn()} topicId="torts" topicName="Torts" />);

    await waitFor(() => expect(screen.getByText("You're all caught up! 🎉")).toBeInTheDocument());
    expect(screen.getByText('No cards to restudy in Torts right now.')).toBeInTheDocument();
  });
});