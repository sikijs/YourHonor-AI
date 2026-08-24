import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    tutor: {
      listTopics: jest.fn(),
      startSession: jest.fn(),
      submitAnswer: jest.fn(),
      relatedConcepts: jest.fn(),
      markReview: jest.fn(),
      reviewQueue: jest.fn(),
      reviewDueCount: jest.fn(),
      startMCQuiz: jest.fn(),
      submitMCAnswer: jest.fn(),
      getResume: jest.fn(() => Promise.resolve({ session: null })),
      saveResume: jest.fn(() => Promise.resolve({ status: 'ok' })),
      clearResume: jest.fn(() => Promise.resolve({ status: 'ok' })),
    },
  },
}));

import TutorView from '@/components/TutorView';

const { api } = jest.requireMock('@/lib/api');
const mockListTopics = api.tutor.listTopics;
const mockStartSession = api.tutor.startSession;
const mockRelatedConcepts = api.tutor.relatedConcepts;
const mockMarkReview = api.tutor.markReview;
const mockReviewQueue = api.tutor.reviewQueue;
const mockReviewDueCount = api.tutor.reviewDueCount;

type UserEvent = ReturnType<typeof userEvent.setup>;

const USER = { id: 1, email: 'student@example.com', created_at: '2026-01-01' };
const TOPIC = { id: 'contracts', name: 'Contracts', description: 'Offer, acceptance, consideration.', question_count: 3 };

const Q_D1 = { question: 'Q low difficulty?', hint: '', expected_concepts: ['Basics'], difficulty: 1, answer: 'A low answer.' };
const Q_D3_A = { question: 'Q high difficulty one?', hint: '', expected_concepts: ['Advanced'], difficulty: 3, answer: 'A one answer.' };
const Q_D3_B = { question: 'Q high difficulty two?', hint: '', expected_concepts: ['Advanced'], difficulty: 3, answer: 'A two answer.' };

function startSessionResponse(questions: typeof Q_D1[]) {
  return {
    topic_id: TOPIC.id,
    topic_name: TOPIC.name,
    topic_description: TOPIC.description,
    total_questions: questions.length,
    current_question: questions[0],
    current_index: 0,
    questions,
  };
}

async function openReviewTab(user: UserEvent) {
  await user.click(await screen.findByRole('button', { name: 'Start' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: Q_D1.question })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Review' }));
}

async function setDifficulty(user: UserEvent, level: string) {
  await user.selectOptions(screen.getByLabelText('Difficulty:'), level);
}

function progressSpan() {
  return screen.getByText(
    (_, el) => el?.tagName === 'SPAN' && (el.textContent ?? '').startsWith('Progress:'),
  );
}

describe('TutorView Review pass (cumulative to session length)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTopics.mockResolvedValue({ topics: [TOPIC] });
    mockStartSession.mockResolvedValue(startSessionResponse([Q_D1, Q_D3_A, Q_D3_B]));
    mockRelatedConcepts.mockResolvedValue({ cards: [] });
    mockMarkReview.mockResolvedValue({});
    mockReviewQueue.mockResolvedValue({ cards: [], total: 0 });
    mockReviewDueCount.mockResolvedValue({ due_count: 0 });
  });

  it('keeps the progress bar max at the session size when filtering by difficulty', async () => {
    const user = userEvent.setup();
    render(<TutorView user={USER} onError={jest.fn()} />);
    await openReviewTab(user);

    expect(progressSpan()).toHaveTextContent('Progress: 0/3');
    await setDifficulty(user, '1');

    // Max stays /3 even though only one card matches difficulty 1
    expect(progressSpan()).toHaveTextContent('Progress: 0/3');    expect(screen.getByRole('heading', { name: Q_D1.question })).toBeInTheDocument();
  });

  it('shows the pick-next panel with per-level and All chips after clearing a level', async () => {
    const user = userEvent.setup();
    render(<TutorView user={USER} onError={jest.fn()} />);
    await openReviewTab(user);

    await setDifficulty(user, '1');
    await user.click(screen.getByRole('heading', { name: Q_D1.question }));
    await user.click(screen.getByRole('button', { name: 'Got it ✓' }));

    expect(await screen.findByText("You've cleared all 1 card at Difficulty 1.")).toBeInTheDocument();
    expect(screen.getByText('2 cards left to finish this review pass — pick where to continue:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Difficulty 3 · 2 left' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All remaining (2)' })).toBeInTheDocument();
    // No premature completion card
    expect(screen.queryByText('Review Complete! 🎉')).not.toBeInTheDocument();
  });

  it('continues the pass via the All remaining chip and completes only after every card is marked', async () => {
    const user = userEvent.setup();
    render(<TutorView user={USER} onError={jest.fn()} />);
    await openReviewTab(user);

    await setDifficulty(user, '1');
    await user.click(screen.getByRole('heading', { name: Q_D1.question }));
    await user.click(screen.getByRole('button', { name: 'Got it ✓' }));
    await user.click(await screen.findByRole('button', { name: 'All remaining (2)' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: Q_D3_A.question })).toBeInTheDocument());
    expect(progressSpan()).toHaveTextContent('Progress: 1/3');

    await user.click(screen.getByRole('heading', { name: Q_D3_A.question }));
    await user.click(screen.getByRole('button', { name: 'Need to Study ✗' }));
    expect(progressSpan()).toHaveTextContent('Progress: 2/3');

    await waitFor(() => expect(screen.getByRole('heading', { name: Q_D3_B.question })).toBeInTheDocument());
    await user.click(screen.getByRole('heading', { name: Q_D3_B.question }));
    await user.click(screen.getByRole('button', { name: 'Got it ✓' }));

    await waitFor(() => expect(screen.getByText('Review Complete! 🎉')).toBeInTheDocument());
    expect(screen.getByText(/You marked 2 of 3 cards correct \(67%\)\./)).toBeInTheDocument();
    expect(mockMarkReview).toHaveBeenCalledTimes(3);
    expect(mockMarkReview).toHaveBeenNthCalledWith(2, Q_D3_A.question, 'contracts', false);
  });

  it('shows a due-count pill whose tooltip explains spaced repetition', async () => {
    mockReviewDueCount.mockResolvedValue({ due_count: 3 });
    const user = userEvent.setup();
    render(<TutorView user={USER} onError={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(TOPIC.name)).toBeInTheDocument());
    await user.click(await screen.findByRole('button', { name: 'Start' }));

    // Pill renders and the button carries an accessible due count.
    const reviewButton = await screen.findByRole('button', { name: 'Review, 3 cards due today' });
    expect(reviewButton).toHaveTextContent('3');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    // Keyboard focus on the tab reveals the explainer bubble.
    // (Walk focus forward until the Review tab owns it.)
    for (let i = 0; i < 8 && document.activeElement !== reviewButton; i++) {
      await user.tab();
    }
    expect(document.activeElement).toBe(reviewButton);
    expect(screen.getByRole('tooltip')).toHaveTextContent('3 cards you flagged are due again today');

    await user.tab(); // focus moves on, bubble hides
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
