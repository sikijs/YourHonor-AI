import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('react-markdown', () => {
  const MockMarkdown = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  MockMarkdown.displayName = 'MockMarkdown';
  return MockMarkdown;
});
jest.mock('remark-gfm', () => () => {});
jest.mock('marked', () => {
  class MockMarked {
    parse(text: string) { return text; }
  }
  return { Marked: MockMarked };
});

jest.mock('@/lib/api', () => {
  const mockFn = () => jest.fn();
  return {
    api: {
      auth: {
        me: jest.fn(),
        signup: mockFn,
        signin: mockFn,
        signout: mockFn,
      },
      documents: {
        list: mockFn,
        get: mockFn,
        create: mockFn,
        update: mockFn,
        delete: mockFn,
        batchDelete: mockFn,
        upload: mockFn,
      },
      chat: {
        greeting: mockFn,
        message: mockFn,
        stream: mockFn,
      },
      legal: {
        caseBrief: mockFn,
        summary: mockFn,
        arguments: mockFn,
        citations: mockFn,
        templateFields: mockFn,
        generateDocument: mockFn,
        memorandum: mockFn,
        debate: mockFn,
        glossary: mockFn,
      },
      tutor: {
        listTopics: mockFn,
        startSession: mockFn,
        submitAnswer: mockFn,
        continueLearning: mockFn,
        startDynamicSession: mockFn,
        generateHypothetical: mockFn,
        evaluateHypothetical: mockFn,
        startMCQuiz: mockFn,
        submitMCAnswer: mockFn,
      },
      templates: { list: mockFn },
      doctrine: { map: jest.fn().mockResolvedValue({ doctrines: [] }) },
      notes: {
        list: mockFn,
        get: mockFn,
        create: mockFn,
        update: mockFn,
        delete: mockFn,
      },
      stats: { me: jest.fn() },
      dashboard: { today: jest.fn() },
      health: mockFn,
    },
  };
});

import Home from '@/app/page';

const { api } = jest.requireMock('@/lib/api');
const mockAuthMe = api.auth.me;

const AUTHD_USER = { id: 1, email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

const MOCK_STATS = {
  documents_total: 2,
  documents_by_type: [{ doc_type: 'case_brief', count: 2 }],
  notes_total: 1,
  tutor_review: { total_reviewed: 0, mastered: 0, weak: 0, weak_topics: [] },
  tutor_sessions: { total_sessions: 0, total_answers: 0, accuracy: 0, per_topic: [] },
  skills: [],
  portfolio: [],
};

const MOCK_TODAY = {
  case_of_the_day: { case_name: 'Marbury v. Madison', citation: '5 U.S. 137', year: 1803, date_filed: null },
  citation_drill: {
    raw: '5 U.S. 137',
    formatted: 'Marbury v. Madison, 5 U.S. 137 (1803)',
    case_name: 'Marbury v. Madison',
    year: 1803,
    options: [
      { text: 'Marbury v. Madison, 5 U.S. 137', is_correct: false, rule_note: 'Wrong — missing year (Rule 10.6).' },
      { text: 'Marbury v. Madison, 5 U.S. 137 (1803)', is_correct: true, rule_note: 'Correct — full Bluebook form.' },
      { text: 'Marbury vs. Madison, 5 U.S. 137 (1803)', is_correct: false, rule_note: 'Wrong — use "v." (Rule 10.2.1).' },
      { text: 'Marbury v. Madison, 5 US 137 (1803)', is_correct: false, rule_note: 'Wrong — reporter periods (Rule 10.3).' },
    ],
  },
  term_of_the_day: { term: 'actus reus', definition: 'The physical act of a crime.', related_terms: [] },
  question_of_the_day: { question: 'What is consideration?', topic_id: 'contracts', topic_name: 'Contracts', difficulty: 2 },
  issue_prompt_of_the_day: { prompt: 'Spot the issues.', case_name: 'Marbury v. Madison' },
  suggested_focus: null,
};

describe('Home page', () => {
  beforeEach(() => {
    mockAuthMe.mockReset();
    window.location.hash = '';
  });

  it('shows sign-in view when unauthenticated', async () => {
    mockAuthMe.mockRejectedValue(new Error('Not authenticated'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    });
  });

  it('shows navigation when authenticated', async () => {
    mockAuthMe.mockResolvedValue(AUTHD_USER);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign Out' })).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Legal Drafting' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Citations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Tutor' })).toBeInTheDocument();
  });

  it('updates the URL hash when navigating via nav links', async () => {
    mockAuthMe.mockResolvedValue(AUTHD_USER);
    api.stats.me.mockResolvedValue(MOCK_STATS);
    api.dashboard.today.mockResolvedValue(MOCK_TODAY);
    const user = userEvent.setup();

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign Out' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('link', { name: 'Dashboard' }));

    await waitFor(() => expect(window.location.hash).toBe('#dashboard'));
    expect(screen.getByRole('heading', { name: 'Study Dashboard' })).toBeInTheDocument();
  });

  it('navigates between views via browser hash changes', async () => {
    mockAuthMe.mockResolvedValue(AUTHD_USER);
    api.stats.me.mockResolvedValue(MOCK_STATS);
    api.dashboard.today.mockResolvedValue(MOCK_TODAY);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign Out' })).toBeInTheDocument();
    });

    window.location.hash = '#dashboard';
    window.dispatchEvent(new Event('hashchange'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Study Dashboard' })).toBeInTheDocument();
    });
  });

  it('honors public view hashes when signed out', async () => {
    mockAuthMe.mockRejectedValue(new Error('Not authenticated'));
    api.doctrine.map.mockResolvedValue({ version: 1, updated: '2026-01-01', doctrines: [] });
    window.location.hash = '#doctrines';

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Case Law Atlas' })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('sends signed-out users on authed hashes to the Sign In view', async () => {
    mockAuthMe.mockRejectedValue(new Error('Not authenticated'));
    window.location.hash = '#tutor';

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
    });
  });
});