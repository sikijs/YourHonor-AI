import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    stats: {
      me: jest.fn(),
    },
    dashboard: {
      today: jest.fn(),
      todayAnswer: jest.fn(),
      todayIssueAnswer: jest.fn(),
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
const mockToday = api.dashboard.today;
const mockTodayAnswer = api.dashboard.todayAnswer;
const mockTodayIssueAnswer = api.dashboard.todayIssueAnswer;
const mockReviewQueue = api.tutor.reviewQueue;
const mockMarkReview = api.tutor.markReview;

const USER = { id: 1, email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' };

const TODAY = {
  case_of_the_day: {
    case_name: 'Marbury v. Madison',
    citation: '5 U.S. 137',
    year: 1803,
    date_filed: '1803-02-24',
    case_summary: 'Marbury never got his judicial commission, so he sued to force the government to hand it over.',
  },
  citation_drill: {
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
  },
  term_of_the_day: {
    term: 'actus reus',
    definition: 'The physical act that constitutes the external element of a crime.',
    related_terms: ['mens rea'],
  },
  question_of_the_day: {
    question: 'What is consideration in contract law?',
    topic_id: 'contracts',
    topic_name: 'Contracts',
    difficulty: 2,
  },
  issue_prompt_of_the_day: {
    prompt: 'Before reading the holding in Marbury v. Madison, write down the legal issues.',
    case_name: 'Marbury v. Madison',
  },
  suggested_focus: null,
};

const FULL_STATS = {
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
      { topic_id: 'contracts', topic_name: 'Contracts', weak_count: 2 },
    ],
  },
  tutor_sessions: {
    total_sessions: 2,
    total_answers: 18,
    accuracy: 0.667,
    per_topic: [
      { topic_id: 'contracts', topic_name: 'Contracts', sessions: 1, correct: 7, wrong: 3, accuracy: 0.7 },
      { topic_id: 'torts', topic_name: 'Torts', sessions: 1, correct: 5, wrong: 3, accuracy: 0.625 },
    ],
  },
  skills: [
    { skill_id: 'research', name: 'Legal Research', description: 'Case summaries, statute analyses, and uploaded materials', count: 3 },
    { skill_id: 'drafting', name: 'Legal Drafting', description: 'Case briefs, memoranda, arguments, and generated documents', count: 5 },
    { skill_id: 'citation', name: 'Citation Skills', description: 'Citation maps and Bluebook formatting', count: 2 },
    { skill_id: 'analysis', name: 'Case Analysis', description: 'Case comparisons and debate analyses', count: 1 },
    { skill_id: 'issue_spotting', name: 'Issue Spotting', description: 'Issue-spotter analyses and tutor practice saves', count: 1 },
    { skill_id: 'doctrine', name: 'Doctrine Knowledge', description: 'Tutor answers and review-mastery marks', count: 11 },
  ],
  portfolio: [
    { id: 3, title: 'Memo: Negligence', doc_type: 'memorandum', updated_at: '2026-08-10 12:00:00' },
    { id: 2, title: 'Bluebook Citations', doc_type: 'bluebook_citations', updated_at: '2026-08-08 09:30:00' },
  ],
};

const EMPTY_STATS = {
  documents_total: 0,
  documents_by_type: [],
  notes_total: 0,
  tutor_review: {
    total_reviewed: 0,
    mastered: 0,
    weak: 0,
    weak_topics: [],
  },
  tutor_sessions: {
    total_sessions: 0,
    total_answers: 0,
    accuracy: 0,
    per_topic: [],
  },
  skills: [
    { skill_id: 'research', name: 'Legal Research', description: '', count: 0 },
    { skill_id: 'drafting', name: 'Legal Drafting', description: '', count: 0 },
    { skill_id: 'citation', name: 'Citation Skills', description: '', count: 0 },
    { skill_id: 'analysis', name: 'Case Analysis', description: '', count: 0 },
    { skill_id: 'issue_spotting', name: 'Issue Spotting', description: '', count: 0 },
    { skill_id: 'doctrine', name: 'Doctrine Knowledge', description: '', count: 0 },
  ],
  portfolio: [],
};

const TODAY_WITH_FOCUS = {
  ...TODAY,
  suggested_focus: { topic_id: 'contracts', topic_name: 'Contracts', weak_count: 2 },
};

describe('DashboardView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToday.mockResolvedValue(TODAY);
    mockTodayAnswer.mockResolvedValue({
      question: 'What is consideration in contract law?',
      topic_id: 'contracts',
      topic_name: 'Contracts',
      difficulty: 2,
      hint: 'Think about bargained-for exchange.',
      answer: 'Consideration is a bargained-for exchange of legal value.',
    });
    mockTodayIssueAnswer.mockResolvedValue({
      case_name: 'Marbury v. Madison',
      subject: 'Constitutional Law',
      doctrine_name: 'Judicial Review',
      doctrine_description: 'The power of courts to review laws passed by Congress against the Constitution and declare them invalid.',
      issue: 'Does Marbury have a right to his judicial commission, and can the Supreme Court order the government to deliver it?',
      plain_holding: 'Yes and no: the Supreme Court can review laws passed by Congress and strike them down if they conflict with the Constitution. But the part of the Judiciary Act that let Marbury sue directly in the Supreme Court was unconstitutional.',
      holding: 'The Supreme Court has the power to review acts of Congress and declare them unconstitutional.',
    });
  });

  it('renders overview stat cards', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Study Dashboard')).toBeInTheDocument());
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Review Queue')).toBeInTheDocument();
    expect(screen.queryByText('42')).not.toBeInTheDocument();
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
    expect(screen.getByText(/No completed live sessions yet/)).toBeInTheDocument();
  });

  it('renders live tutor session stats with per-topic accuracy', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Live Tutor Sessions')).toBeInTheDocument());
    expect(screen.getByText('Tutor Sessions')).toBeInTheDocument();
    expect(screen.getByText('completed live sessions')).toBeInTheDocument();
    expect(screen.getByText(/2 sessions · 18 answers/)).toBeInTheDocument();
    expect(screen.getByText('67% correct')).toBeInTheDocument();
    expect(screen.getByText(/70% · 7\/10/)).toBeInTheDocument();
    expect(screen.getByText(/63% · 5\/8/)).toBeInTheDocument();
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

  it('renders the Today Legal Practice panel with daily picks', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText("Today's Legal Practice")).toBeInTheDocument());
    expect(screen.getByText('Case of the Day')).toBeInTheDocument();
    expect(screen.getByText('Marbury v. Madison')).toBeInTheDocument();
    expect(screen.getByText(/Marbury never got his judicial commission/)).toBeInTheDocument();
    expect(screen.getByText('Citation Drill')).toBeInTheDocument();
    expect(screen.getByText('Term of the Day')).toBeInTheDocument();
    expect(screen.getByText('actus reus')).toBeInTheDocument();
    expect(screen.getByText('Question of the Day')).toBeInTheDocument();
    expect(screen.getByText(/What is consideration in contract law/)).toBeInTheDocument();
    expect(screen.getByText('Issue-Spotting Prompt')).toBeInTheDocument();
  });

  it('scores the citation drill quiz on a correct answer', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Citation Drill')).toBeInTheDocument());
    expect(screen.queryByText(/Correct!/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Marbury v. Madison, 5 U.S. 137 (1803)' }));
    expect(screen.getByText('Correct!')).toBeInTheDocument();
    expect(screen.getByText(/Rule 10.2.1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marbury vs. Madison, 5 U.S. 137 (1803)' })).toBeDisabled();
  });

  it('scores the citation drill quiz on a wrong answer', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Citation Drill')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Marbury vs. Madison, 5 U.S. 137 (1803)' }));
    expect(screen.getByText(/Not quite/)).toBeInTheDocument();
    expect(screen.getByText(/never "vs\."/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marbury v. Madison, 5 U.S. 137 (1803) ✓' })).toBeInTheDocument();
  });

  it('reveals hint and answer for the Question of the Day', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Question of the Day')).toBeInTheDocument());
    expect(mockTodayAnswer).not.toHaveBeenCalled();
    expect(screen.queryByText(/Consideration is a bargained-for exchange/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show hint' }));
    expect(screen.getByText(/Hint: Think about bargained-for exchange/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await waitFor(() => expect(screen.getByText('Consideration is a bargained-for exchange of legal value.')).toBeInTheDocument());
    expect(mockTodayAnswer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Reveal answer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practice in the AI Tutor' })).toBeInTheDocument();
  });

  it('shows an error message when the answer fetch fails', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    mockTodayAnswer.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Question of the Day')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Reveal answer' }));
    await waitFor(() => expect(screen.getByText(/Couldn't load the answer/)).toBeInTheDocument());
  });

  it('reveals subject hint and court issue for the Issue-Spotting Prompt', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Issue-Spotting Prompt')).toBeInTheDocument());
    expect(mockTodayIssueAnswer).not.toHaveBeenCalled();
    expect(screen.queryByText(/The court's issue/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show subject hint' }));
    expect(screen.getByText('Constitutional Law')).toBeInTheDocument();
    expect(screen.getByText('Judicial Review')).toBeInTheDocument();
    expect(screen.getByText(/power of courts to review laws passed by Congress/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "Reveal the court's issue" }));
    await waitFor(() => expect(screen.getByText(/Does Marbury have a right to his judicial commission/)).toBeInTheDocument());
    expect(screen.getByText(/The court's holding \(in plain English\)/)).toBeInTheDocument();
    expect(screen.getByText(/strike them down if they conflict with the Constitution/)).toBeInTheDocument();
    expect(mockTodayIssueAnswer).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: "Reveal the court's issue" })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try the Issue Spotter' })).toBeInTheDocument();
  });

  it('shows an error message when the issue fetch fails', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    mockTodayIssueAnswer.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Issue-Spotting Prompt')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: "Reveal the court's issue" }));
    await waitFor(() => expect(screen.getByText(/Couldn't load the issue/)).toBeInTheDocument());
  });

  it('deep-links the Case of the Day into Legal Drafting', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    const onNavigate = jest.fn();
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Brief this case' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Brief this case' }));
    expect(onNavigate).toHaveBeenCalledWith('briefs', 'Marbury v. Madison');
  });

  it('shows the suggested focus banner and opens the topic review', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    mockToday.mockResolvedValue(TODAY_WITH_FOCUS);
    mockReviewQueue.mockResolvedValue({ cards: [], total: 0 });
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText(/Suggested focus:/)).toBeInTheDocument());
    expect(screen.getByText(/Contracts — 2 cards waiting in your review queue/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Review now' }));
    await waitFor(() => expect(screen.getByText('Review Queue · Contracts')).toBeInTheDocument());
  });

  it('renders the skills panel with descriptions, levels, and an actionable focus', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    const onNavigate = jest.fn();
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByText('Skills & Competencies')).toBeInTheDocument());
    expect(screen.getByText('Legal Drafting')).toBeInTheDocument();
    expect(screen.getByText('Doctrine Knowledge')).toBeInTheDocument();
    expect(screen.getByText('Case briefs, memoranda, arguments, and generated documents')).toBeInTheDocument();
    expect(screen.getByText('Practicing')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === 'Where to focus: Case Analysis')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Compare cases →' }));
    expect(onNavigate).toHaveBeenCalledWith('doctrines');
  });

  it('renders the work portfolio with type badges', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Your Work Portfolio')).toBeInTheDocument());
    expect(screen.getByText('Memo: Negligence')).toBeInTheDocument();
    expect(screen.getByText(/Memorandum/)).toBeInTheDocument();
    expect(screen.getAllByText('Bluebook Citations').length).toBeGreaterThan(0);
  });

  it('renders quick actions that navigate to their views', async () => {
    mockStatsMe.mockResolvedValue(FULL_STATS);
    const onNavigate = jest.fn();
    const user = userEvent.setup();

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={onNavigate} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'New Case Brief' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New Case Brief' }));
    await user.click(screen.getByRole('button', { name: 'Cite-Check Text' }));
    await user.click(screen.getByRole('button', { name: 'Compare Cases' }));
    expect(onNavigate).toHaveBeenCalledWith('briefs');
    expect(onNavigate).toHaveBeenCalledWith('citations');
    expect(onNavigate).toHaveBeenCalledWith('doctrines');
  });

  it('shows empty-state guidance for skills and portfolio on a fresh account', async () => {
    mockStatsMe.mockResolvedValue(EMPTY_STATS);

    render(<DashboardView user={USER} onError={jest.fn()} onNavigate={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('Skills & Competencies')).toBeInTheDocument());
    expect(screen.getByText(/Your skills build as you work/)).toBeInTheDocument();
    expect(screen.getByText(/No work product yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Where to focus:/)).not.toBeInTheDocument();
  });
});