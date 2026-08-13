import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/api', () => ({
  api: {
    doctrine: {
      map: jest.fn(),
      compare: jest.fn(),
    },
  },
}));

jest.mock('@/lib/export', () => ({
  downloadExport: jest.fn(),
}));

jest.mock('@/lib/print', () => ({
  compareHtml: (r: any) => `HTML(${r.case_a.name})`,
  resultToPlainText: (s: string) => s,
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
        {
          name: 'Martin v. Hunter\'s Lessee',
          citation: '14 U.S. 304',
          year: 1816,
          holding: 'The Supreme Court has appellate jurisdiction over state court decisions.',
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
    api.doctrine.compare.mockReset();
    api.doctrine.compare.mockResolvedValue({
      case_a: { name: 'Marbury v. Madison', citation: '5 U.S. 137', year: 1803, court: 'Supreme Court of the United States', date_filed: '1803-02-24', subjects: ['Judicial Review'], holdings: ['Power to declare acts unconstitutional.'] },
      case_b: { name: 'Martin v. Hunter\'s Lessee', citation: '14 U.S. 304', year: 1816, court: 'Supreme Court of the United States', date_filed: '1816-03-20', subjects: ['Judicial Review'], holdings: ['Appellate jurisdiction over state courts.'] },
      comparison: {
        similarities: ['Both define judicial power.'],
        differences: ['Marbury is original jurisdiction; Martin is appellate.'],
        relationship: 'Martin built on Marbury.',
        relationship_type: 'applied',
        significance: 'Shows how judicial review expanded.',
        practice_note: 'Cite both when discussing judicial review scope.',
      },
      sources_consulted: ['Marbury v. Madison', 'Martin v. Hunter\'s Lessee'],
      disclaimer: 'Educational only.',
    });
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
    const briefButtons = await screen.findAllByRole('button', { name: /Generate Case Brief/ });
    await user.click(briefButtons[0]);
    expect(onNavigate).toHaveBeenCalledWith('briefs', 'Marbury v. Madison');
  });

  it('routes unsigned-in users to the sign-in view', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();
    renderView(null, onNavigate);
    await user.click(await screen.findByText('Judicial Review'));
    const briefButtons = await screen.findAllByRole('button', { name: /Generate Case Brief/ });
    await user.click(briefButtons[0]);
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

  it('compares two selected cases inside a doctrine detail', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByText('Judicial Review'));
    await user.click(await screen.findByLabelText('Select Marbury v. Madison for comparison'));
    await user.click(await screen.findByLabelText('Select Martin v. Hunter\'s Lessee for comparison'));
    await user.click(await screen.findByRole('button', { name: 'Compare Selected' }));

    expect(await screen.findByText('Marbury v. Madison vs Martin v. Hunter\'s Lessee')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate AI Comparison' }));
    expect(api.doctrine.compare).toHaveBeenCalledWith(['Marbury v. Madison', 'Martin v. Hunter\'s Lessee']);
    expect(await screen.findByText('Quick Facts')).toBeInTheDocument();
    expect(await screen.findByText('Both define judicial power.')).toBeInTheDocument();
    expect(screen.getByText('applied')).toBeInTheDocument();
  });

  it('keeps Compare Selected disabled until exactly two cases are chosen', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByText('Judicial Review'));
    const compareBtn = await screen.findByRole('button', { name: 'Compare Selected' });
    expect(compareBtn).toBeDisabled();
    await user.click(await screen.findByLabelText('Select Marbury v. Madison for comparison'));
    expect(compareBtn).toBeDisabled();
    await user.click(await screen.findByLabelText('Select Martin v. Hunter\'s Lessee for comparison'));
    expect(compareBtn).toBeEnabled();
  });

  it('compares any two cases via the global picker', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Compare Cases' }));
    expect(await screen.findByText('Compare Any Two Landmark Cases')).toBeInTheDocument();

    await user.click(await screen.findByLabelText(/Marbury v\. Madison/));
    await user.click(await screen.findByLabelText(/Hamer v\. Sidway/));
    await user.click(await screen.findByRole('button', { name: 'Compare (2/2)' }));

    expect(await screen.findByText('Marbury v. Madison vs Hamer v. Sidway')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Generate AI Comparison' }));
    expect(api.doctrine.compare).toHaveBeenCalledWith(['Marbury v. Madison', 'Hamer v. Sidway']);
  });

  it('cancels the global picker without comparing', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: 'Compare Cases' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Judicial Review')).toBeInTheDocument();
    expect(api.doctrine.compare).not.toHaveBeenCalled();
  });
});
