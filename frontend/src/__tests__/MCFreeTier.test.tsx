import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    tutor: {
      listTopics: jest.fn(),
      startSession: jest.fn(),
      submitAnswer: jest.fn(),
      relatedConcepts: jest.fn(() => Promise.resolve({ cards: [] })),
      markReview: jest.fn(() => Promise.resolve({})),
      reviewQueue: jest.fn(() => Promise.resolve({ cards: [], total: 0 })),
      reviewDueCount: jest.fn(() => Promise.resolve({ due_count: 0 })),
      startMCQuiz: jest.fn(),
      startOfflineMCQuiz: jest.fn(),
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
const mockStartOfflineMC = api.tutor.startOfflineMCQuiz;
const mockStartAI = api.tutor.startMCQuiz;

const USER = { id: 1, email: 'student@example.com', created_at: '2026-01-01' };
const TOPIC = { id: 'contracts', name: 'Contracts', description: 'Offer, acceptance.', question_count: 3 };
const QUESTION = {
  question: 'Which is consideration?',
  options: ['A bargained-for exchange', 'A gift', 'A threat', 'A mistake'],
  correct_index: 0,
  explanation: 'Consideration is a bargained-for exchange.',
  option_explanations: ['Correct.', 'No.', 'No.', 'No.'],
  difficulty: 2,
};

function startResponse() {
  return {
    topic_id: TOPIC.id,
    topic_name: TOPIC.name,
    difficulty: 0,
    total_questions: 10,
    question: QUESTION,
  };
}

describe('TutorView MC Quiz free/AI source toggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTopics.mockResolvedValue({ topics: [TOPIC] });
    mockStartSession.mockResolvedValue({
      topic_id: TOPIC.id,
      topic_name: TOPIC.name,
      topic_description: TOPIC.description,
      total_questions: 1,
      current_question: { question: 'Q?', hint: '', expected_concepts: ['c'], difficulty: 1 },
      current_index: 0,
      questions: [{ question: 'Q?', hint: '', expected_concepts: ['c'], difficulty: 1 }],
    });
    mockStartOfflineMC.mockResolvedValue(startResponse());
    mockStartAI.mockResolvedValue(startResponse());
  });

  async function openMcTab(user: ReturnType<typeof userEvent.setup>) {
    render(<TutorView user={USER} onError={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(TOPIC.name)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'MC Quiz' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'MC Quiz' }));
    await waitFor(() => expect(screen.getByText('Question source')).toBeInTheDocument());
  }

  it('defaults to the free tier and starts without any cost confirmation', async () => {
    const user = userEvent.setup();
    await openMcTab(user);

    const freeButton = screen.getByRole('button', { name: /Free practice/ });
    expect(freeButton).toHaveClass('btn-primary');
    expect(mockStartAI).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Start Free MC Quiz' }));
    await waitFor(() => expect(mockStartOfflineMC).toHaveBeenCalledWith('contracts', undefined));
    expect(mockStartAI).not.toHaveBeenCalled();
  });

  it('hides the difficulty slider on free and shows it for AI with a cost confirm', async () => {
    const user = userEvent.setup();
    await openMcTab(user);

    expect(screen.queryByText(/Difficulty: 3\/5/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /AI-generated/ }));
    expect(screen.getByText(/Difficulty: 3\/5/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start AI MC Quiz' }));
    expect(await screen.findByText(/use AI API calls/)).toBeInTheDocument();
    expect(mockStartAI).not.toHaveBeenCalled();
    expect(mockStartOfflineMC).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Yes, start' }));
    await waitFor(() =>
      expect(mockStartAI).toHaveBeenCalledWith('contracts', 3, undefined)
    );
  });
});
