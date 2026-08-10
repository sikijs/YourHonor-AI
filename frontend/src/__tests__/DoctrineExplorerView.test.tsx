import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    doctrine: {
      map: jest.fn(),
    },
  },
}));

import DoctrineExplorerView from '@/components/DoctrineExplorerView';

const { api } = jest.requireMock('@/lib/api');

const MAP = {
  version: 1,
  updated: '2026-08-10',
  doctrines: [
    {
      id: 'judicial-review',
      name: 'Judicial Review',
      subject: 'Constitutional Law',
      description: 'The power of courts to review legislation against the Constitution.',
      cases: [
        {
          name: 'Marbury v. Madison',
          citation: '5 U.S. 137',
          year: 1803,
          holding: 'The Supreme Court has the power to declare acts of Congress unconstitutional.',
        },
      ],
    },
    {
      id: 'contracts-consideration',
      name: 'Consideration',
      subject: 'Contracts',
      description: 'The bargain element that makes a promise enforceable.',
      cases: [
        {
          name: 'Hamer v. Sidway',
          citation: '27 N.E. 256 (N.Y. 1891)',
          year: 1891,
          holding: 'Forbearance of a legal right constitutes valid consideration.',
        },
      ],
    },
  ],
};

const renderView = (user: unknown = null, onNavigate = jest.fn()) =>
  render(<DoctrineExplorerView user={user as never} onNavigate={onNavigate} />);

describe('DoctrineExplorerView', () => {
  beforeEach(() => {
    api.doctrine.map.mockReset();
    api.doctrine.map.mockResolvedValue(MAP);
  });

  it('renders doctrine cards after loading', async () => {
    renderView();
    expect(await screen.findByText('Judicial Review')).toBeInTheDocument();
    expect(screen.getByText('Consideration')).toBeInTheDocument();
    expect(screen.getAllByText('Constitutional Law').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contracts').length).toBeGreaterThan(0);
  });

  it('opens a doctrine detail with case holding on card click', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByText('Judicial Review'));
    expect(await screen.findByText(/power to declare acts of Congress unconstitutional/)).toBeInTheDocument();
    expect(screen.getByText('Marbury v. Madison')).toBeInTheDocument();
    expect(screen.getByText('5 U.S. 137')).toBeInTheDocument();
  });

  it('navigates to case briefs with the case name prefilled when signed in', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();
    renderView({ id: 1, email: 'a@b.c' }, onNavigate);
    await user.click(await screen.findByText('Judicial Review'));
    await user.click(await screen.findByRole('button', { name: /Generate Case Brief/ }));
    expect(onNavigate).toHaveBeenCalledWith('briefs', 'Marbury v. Madison');
  });

  it('routes unsigned-in users to the sign-in view', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();
    renderView(null, onNavigate);
    await user.click(await screen.findByText('Judicial Review'));
    await user.click(await screen.findByRole('button', { name: /Generate Case Brief/ }));
    expect(onNavigate).toHaveBeenCalledWith('auth');
  });

  it('switches to the timeline view with era groups', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Timeline' }));
    expect(await screen.findByText('1800–1849')).toBeInTheDocument();
    expect(screen.getByText(/Marbury v\. Madison/)).toBeInTheDocument();
    expect(screen.getByText(/colored by subject/)).toBeInTheDocument();
  });

  it('filters doctrines by subject', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Contracts' }));
    expect(await screen.findByText('Consideration')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Judicial Review')).not.toBeInTheDocument());
  });

  it('filters doctrines by search text', async () => {
    const user = userEvent.setup();
    renderView();
    await user.type(await screen.findByPlaceholderText(/Search doctrines/), 'Marbury');
    expect(await screen.findByText('Judicial Review')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Consideration')).not.toBeInTheDocument());
  });

  it('shows an error message when the map cannot load', async () => {
    api.doctrine.map.mockRejectedValue(new Error('backend unreachable'));
    renderView();
    expect(await screen.findByText('backend unreachable')).toBeInTheDocument();
  });
});
