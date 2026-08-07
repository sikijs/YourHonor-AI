import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('react-markdown', () => {
  const MockMarkdown = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  MockMarkdown.displayName = 'MockMarkdown';
  return MockMarkdown;
});

let resolveStream: (() => void) | null = null;

jest.mock('@/lib/api', () => {
  const mockFn = () => jest.fn();
  return {
    api: {
      chat: {
        greeting: jest.fn(),
        stream: jest.fn(),
        message: mockFn,
      },
    },
  };
});

import ChatView from '@/components/ChatView';

const { api } = jest.requireMock('@/lib/api');

describe('ChatView', () => {
  beforeEach(() => {
    resolveStream = null;
    api.chat.greeting.mockReset();
    api.chat.stream.mockReset();
    api.chat.greeting.mockResolvedValue({ greeting: 'Hello! I am ready.' });
    api.chat.stream.mockImplementation(async function* () {
      yield {
        type: 'meta',
        sources: [],
        source_docs: [],
        retrieval_count: 0,
        suggested_tool: null,
        suggested_name: null,
        suggested_description: null,
        suggested_query: null,
      };
      await new Promise<void>((r) => { resolveStream = r; });
      yield { type: 'chunk', text: 'Here is your answer.' };
      yield { type: 'done' };
    });
  });

  const renderView = () =>
    render(
      <ChatView
        user={{ id: 1, email: 'test@example.com', created_at: '2026-01-01T00:00:00Z' }}
        onError={jest.fn()}
        onNavigate={jest.fn()}
      />
    );

  it('shows the generating status bar while streaming and hides it when done', async () => {
    const user = userEvent.setup();
    renderView();

    const textarea = await screen.findByPlaceholderText('Ask anything...');
    await user.type(textarea, 'What is a tort?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(screen.getByText('Generating response…')).toBeInTheDocument();
    });

    expect(resolveStream).not.toBeNull();
    resolveStream!();

    await waitFor(() => {
      expect(screen.queryByText('Generating response…')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Here is your answer.')).toBeInTheDocument();
  });

  it('pins the view to the top of the response while it is being generated', async () => {
    const user = userEvent.setup();
    renderView();

    const textarea = await screen.findByPlaceholderText('Ask anything...');
    await user.type(textarea, 'What is a tort?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const status = await screen.findByText('Generating response…');
    const container = status.closest('.chat-container')!.querySelector('.messages') as HTMLDivElement;
    const assistants = container.querySelectorAll('.message.assistant');
    const anchor = assistants[assistants.length - 1].parentElement as HTMLDivElement;

    Object.defineProperty(container, 'scrollHeight', { value: 800, configurable: true });
    Object.defineProperty(anchor, 'offsetTop', { value: 120, configurable: true });
    expect(anchor.offsetTop).toBe(120);

    await act(async () => {
      resolveStream!();
    });

    await waitFor(() => {
      expect(container.scrollTop).toBe(112);
    });

    await waitFor(() => {
      expect(screen.queryByText('Generating response…')).not.toBeInTheDocument();
    });
  });

  it('hides the status bar when the user stops mid-generation', async () => {
    const user = userEvent.setup();
    renderView();

    const textarea = await screen.findByPlaceholderText('Ask anything...');
    await user.type(textarea, 'What is a tort?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    const stopButton = await screen.findByRole('button', { name: 'Stop' });
    await user.click(stopButton);

    await waitFor(() => {
      expect(screen.queryByText('Generating response…')).not.toBeInTheDocument();
    });
  });
});
