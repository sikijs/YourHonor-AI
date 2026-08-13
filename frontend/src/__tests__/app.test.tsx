import { render, screen, waitFor } from '@testing-library/react';

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
      notes: {
        list: mockFn,
        get: mockFn,
        create: mockFn,
        update: mockFn,
        delete: mockFn,
      },
      stats: { me: mockFn },
      health: mockFn,
    },
  };
});

import Home from '@/app/page';

const { api } = jest.requireMock('@/lib/api');
const mockAuthMe = api.auth.me;

describe('Home page', () => {
  beforeEach(() => {
    mockAuthMe.mockReset();
  });

  it('shows sign-in view when unauthenticated', async () => {
    mockAuthMe.mockRejectedValue(new Error('Not authenticated'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    });
  });

  it('shows navigation when authenticated', async () => {
    mockAuthMe.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      created_at: '2026-01-01T00:00:00Z',
    });

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
});