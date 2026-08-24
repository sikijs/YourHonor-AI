import { render, screen, waitFor, act } from '@testing-library/react';
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
      getResume: jest.fn(() => Promise.resolve({ session: null })),
      saveResume: jest.fn(() => Promise.resolve({ status: 'ok' })),
      clearResume: jest.fn(() => Promise.resolve({ status: 'ok' })),
    },
    documents: { create: jest.fn() },
  },
}));

import TutorView from '@/components/TutorView';

const { api } = jest.requireMock('@/lib/api');
const mockListTopics = api.tutor.listTopics;
const mockStartSession = api.tutor.startSession;
const mockGenerateDrill = api.tutor.generateDrill;
const mockSubmitDrill = api.tutor.submitDrill;
const mockCreateDoc = api.documents.create;

const USER = { id: 1, email: 'student@example.com', created_at: '2026-01-01' };
const TOPIC = { id: 'contracts', name: 'Contracts', description: 'Offer, acceptance.', question_count: 3 };

const DRILL = {
  fact_pattern: 'Dana sold Priya a used car, assuring her it had never been wrecked.',
  embedded_issues: [
    { issue: 'Fraudulent misrepresentation', rule: 'False statement of material fact.', fact_trigger: 'Dana knew' },
    { issue: 'Implied warranty of merchantability', rule: 'UCC 2-314.', fact_trigger: 'dealer sale' },
  ],
  key_concepts: ['Misrepresentation'],
  suggested_minutes: 6,
};

const RESULT = {
  matched: ['Fraudulent misrepresentation'],
  missed: [{ issue: 'Implied warranty of merchantability', rule: 'UCC 2-314.', fact_trigger: 'dealer sale' }],
  false_positives: ['A wild antitrust claim'],
  score_pct: 50,
  feedback: 'You skim past warranty facts.',
  disclaimer: 'For educational purposes only.',
};

function startResponse() {
  return {
    topic_id: TOPIC.id,
    topic_name: TOPIC.name,
    topic_description: TOPIC.description,
    total_questions: 1,
    current_question: { question: 'Q?', hint: '', expected_concepts: ['c'], difficulty: 1 },
    current_index: 0,
    questions: [{ question: 'Q?', hint: '', expected_concepts: ['c'], difficulty: 1 }],
  };
}

describe('IssueDrill (TutorView Drill tab)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListTopics.mockResolvedValue({ topics: [TOPIC] });
    mockStartSession.mockResolvedValue(startResponse());
    mockGenerateDrill.mockResolvedValue(DRILL);
    mockSubmitDrill.mockResolvedValue(RESULT);
    mockCreateDoc.mockResolvedValue({ id: 9 });
  });

  async function openDrillTab(user: ReturnType<typeof userEvent.setup>) {
    render(<TutorView user={USER} onError={jest.fn()} />);
    await waitFor(() => expect(screen.getByText(TOPIC.name)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Issue-Spotting Drill' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Issue-Spotting Drill' }));
    // Heading-scoped: the tab button now shares the panel's visible text.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Issue-Spotting Drill' })).toBeInTheDocument());
  }

  it('shows setup with difficulty slider and requires cost confirmation before generating', async () => {
    const user = userEvent.setup();
    await openDrillTab(user);

    expect(screen.getByText(/Difficulty: 3\/5/)).toBeInTheDocument();
    expect(mockGenerateDrill).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Start Drill' }));
    // The cost confirm appears (its Yes button) before any LLM call is made.
    const yesButton = await screen.findByRole('button', { name: 'Yes, start' });
    expect(mockGenerateDrill).not.toHaveBeenCalled();

    await user.click(yesButton);
    await waitFor(() =>
      expect(mockGenerateDrill).toHaveBeenCalledWith('contracts', 3)
    );
    // The running stage shows the pattern and the timer.
    expect(await screen.findByText(/Dana sold Priya/)).toBeInTheDocument();
    expect(screen.getByText(/Spot every issue you can/)).toBeInTheDocument();
  });

  it('submits the typed issues and renders the three-bucket results', async () => {
    const user = userEvent.setup();
    await openDrillTab(user);

    await user.click(screen.getByRole('button', { name: 'Start Drill' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, start' }));

    const box = await screen.findByPlaceholderText(/breach of contract/i);
    await user.type(box, 'Fraudulent misrepresentation\nA wild antitrust claim');

    await user.click(screen.getByRole('button', { name: 'Submit for grading' }));

    await waitFor(() =>
      expect(mockSubmitDrill).toHaveBeenCalledWith(
        expect.objectContaining({
          topic_id: 'contracts',
          student_issues: ['Fraudulent misrepresentation', 'A wild antitrust claim'],
        })
      )
    );

    expect(await screen.findByText('Drill results')).toBeInTheDocument();
    expect(screen.getByText('✓ Spotted (1)')).toBeInTheDocument();
    expect(screen.getByText('✗ Missed (1)')).toBeInTheDocument();
    expect(screen.getByText('⚠ False alarms (1)')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('A wild antitrust claim')).toBeInTheDocument();
  });

  it('saves the graded drill to Documents', async () => {
    const user = userEvent.setup();
    await openDrillTab(user);

    await user.click(screen.getByRole('button', { name: 'Start Drill' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, start' }));
    const box = await screen.findByPlaceholderText(/breach of contract/i);
    await user.type(box, 'Fraudulent misrepresentation');
    await user.click(screen.getByRole('button', { name: 'Submit for grading' }));
    expect(await screen.findByText('Drill results')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save to Documents' }));
    await waitFor(() => expect(mockCreateDoc).toHaveBeenCalledTimes(1));
    const [title, body, docType] = mockCreateDoc.mock.calls[0];
    expect(title).toContain('Contracts');
    expect(body).toContain('Fact pattern');
    expect(body).toContain('Implied warranty of merchantability');
    expect(docType).toBe('other');
    expect(screen.getByText('Saved ✓')).toBeInTheDocument();
  });

  it('auto-submits when the countdown hits zero', async () => {
    jest.useFakeTimers();
    try {
      mockGenerateDrill.mockResolvedValue({ ...DRILL, suggested_minutes: 1 });
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await openDrillTab(user);

      await user.click(screen.getByRole('button', { name: 'Start Drill' }));
      await user.click(await screen.findByRole('button', { name: 'Yes, start' }));

      const box = await screen.findByPlaceholderText(/breach of contract/i);
      await user.type(box, 'Fraudulent misrepresentation');
      expect(mockSubmitDrill).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(60 * 1000);
      });

      await waitFor(() => expect(mockSubmitDrill).toHaveBeenCalled());
      expect(await screen.findByText('Drill results')).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
