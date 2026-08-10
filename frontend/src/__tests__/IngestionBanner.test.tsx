import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    rag: {
      ingestionStatus: jest.fn(),
    },
  },
}));

import IngestionBanner from '@/components/IngestionBanner';

const { api } = jest.requireMock('@/lib/api');

describe('IngestionBanner', () => {
  beforeEach(() => {
    api.rag.ingestionStatus.mockReset();
  });

  it('shows progress while landmark ingestion is running', async () => {
    api.rag.ingestionStatus.mockResolvedValue({
      running: true,
      total: 70,
      done: 34,
      failed: 0,
      current: 'Mapp v. Ohio',
    });

    render(<IngestionBanner />);

    expect(await screen.findByText(/Loading landmark cases/)).toBeInTheDocument();
    expect(screen.getByText(/34 of 70/)).toBeInTheDocument();
    expect(screen.getByText(/Mapp v. Ohio/)).toBeInTheDocument();
  });

  it('renders nothing once ingestion has finished', async () => {
    api.rag.ingestionStatus.mockResolvedValue({
      running: false,
      total: 70,
      done: 70,
      failed: 0,
      current: '',
    });

    render(<IngestionBanner />);

    await waitFor(() => expect(api.rag.ingestionStatus).toHaveBeenCalled());
    expect(screen.queryByText(/Loading landmark cases/)).not.toBeInTheDocument();
  });

  it('stays hidden when the backend cannot report status', async () => {
    api.rag.ingestionStatus.mockRejectedValue(new Error('unreachable'));

    render(<IngestionBanner />);

    await waitFor(() => expect(api.rag.ingestionStatus).toHaveBeenCalled());
    expect(screen.queryByText(/Loading landmark cases/)).not.toBeInTheDocument();
  });

  it('dismisses when the user clicks the close button', async () => {
    const user = userEvent.setup();
    api.rag.ingestionStatus.mockResolvedValue({
      running: true,
      total: 70,
      done: 10,
      failed: 0,
      current: 'Terry v. Ohio',
    });

    render(<IngestionBanner />);

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Loading landmark cases/)).not.toBeInTheDocument();
  });
});
