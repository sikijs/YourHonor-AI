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
      generateDrill: jest.fn(),
      submitDrill: jest.fn(),
      getResume: jest.fn(),
      saveResume: jest.fn(),
      clearResume: jest.fn(),
    },
    documents: { create: jest.fn() },
  },
}));

import TutorView from '@/components/TutorView';

const { api } = jest.requireMock('@/lib/api');
const mockListTopics = api.tutor.listTopics;
const mockStartSession = api.tutor.startSession;
const mockGetResume = api.tutor.getResume;
const mockSaveResume = api.tutor.saveResume;
const mockClearResume = api.tutor.clearResume;

const USER = { id: 1, email: 'student@example.com', created_at: '2026-01-01' };
const TOPIC = { id: 'contracts', name: 'Contracts', description: 'Offer, acceptance.', question_count: 2 };

function makeQuestion(n: number) {
  return { question: `Question ${n}?`, hint: '', expected_concepts: ['c'], difficulty: 1 };
}

function savedSession(mode: 'quiz' | 'review', currentIndex: number) {
  return {
    topic_id: TOPIC.id,
    mode,
    updated_at: '2026-08-01T00:00:00',
    payload: {
      topic_name: TOPIC.name,
      questions: [makeQuestion(1), makeQuestion(2)],
      current_index: currentIndex,
      history: [],
      correct_count: 0,
      wrong_count: 0,
      marked: [],
      correct: 0,
      wrong: 0,
    },
  };
}

describe('TutorView session resume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTopics.mockResolvedValue({ topics: [TOPIC] });
    mockGetResume.mockResolvedValue({ session: null });
    mockSaveResume.mockResolvedValue({ status: 'ok' });
    mockClearResume.mockResolvedValue({ status: 'ok' });
    mockStartSession.mockResolvedValue({
      topic_id: TOPIC.id,
      topic_name: TOPIC.name,
      topic_description: TOPIC.description,
      total_questions: 2,
      current_question: makeQuestion(1),
      current_index: 0,
      questions: [makeQuestion(1), makeQuestion(2)],
    });
  });

  it('autosaves a quiz snapshot when a session starts', async () => {
    const user = userEvent.setup();
    render(<TutorView user={USER} onError={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(TOPIC.name)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(mockSaveResume).toHaveBeenCalled());
    const [topicId, mode, payload] = mockSaveResume.mock.calls[0];
    expect(topicId).toBe('contracts');
    expect(mode).toBe('quiz');
    expect(payload.current_index).toBe(0);
    expect(payload.questions).toHaveLength(2);
  });

  it('offers to restore a saved quiz and resumes at the saved question', async () => {
    mockGetResume.mockResolvedValue({ session: savedSession('quiz', 1) });
    const user = userEvent.setup();
    render(<TutorView user={USER} onError={jest.fn()} />);

    const banner = await screen.findByText(/Unfinished/i);
    expect(banner).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resume' }));
    // Restored straight into the session view at the saved index.
    expect(await screen.findByText('Question 2?')).toBeInTheDocument();
    expect(mockStartSession).not.toHaveBeenCalled();
    // The restored state is re-snapshotted so the slot stays fresh.
    await waitFor(() => expect(mockSaveResume).toHaveBeenCalled());
    expect(mockSaveResume.mock.calls[0][2].current_index).toBe(1);
  });

  it('discarding the banner clears the stored snapshot', async () => {
    mockGetResume.mockResolvedValue({ session: savedSession('quiz', 0) });
    const user = userEvent.setup();
    render(<TutorView user={USER} onError={jest.fn()} />);

    await screen.findByText(/Unfinished/i);
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(mockClearResume).toHaveBeenCalled());
    expect(screen.queryByText(/Unfinished/i)).not.toBeInTheDocument();
  });

  it('no banner appears when there is no saved session', async () => {
    render(<TutorView user={USER} onError={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(TOPIC.name)).toBeInTheDocument());
    expect(screen.queryByText(/Unfinished/i)).not.toBeInTheDocument();
  });
});
