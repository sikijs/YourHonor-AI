import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HoverTip, { dueCardsTip } from '@/components/HoverTip';

describe('HoverTip', () => {
  it('shows the bubble on hover and keyboard focus, hides on blur', async () => {
    const user = userEvent.setup();
    render(
      <HoverTip tip={dueCardsTip(3)}>
        <button type="button">Trigger</button>
      </HoverTip>
    );
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.hover(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('3 cards you flagged');

    await user.unhover(screen.getByRole('button', { name: 'Trigger' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab(); // keyboard focus reveals it too
    expect(screen.getByRole('tooltip')).toHaveTextContent(/wrong ones come back soon/);

    await user.tab(); // focus leaves -> bubble hides
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('dueCardsTip handles singular and plural', () => {
    expect(dueCardsTip(1)).toMatch(/^1 card you flagged/);
    expect(dueCardsTip(7)).toMatch(/^7 cards you flagged/);
    expect(dueCardsTip(7)).toContain('wrong ones come back soon');
    // The internal spaced-repetition schedule is an implementation detail.
    expect(dueCardsTip(7)).not.toMatch(/days/);
  });

  it('supports a controlled `show` prop for parent-owned wiring', () => {
    function Controlled({ show }: { show: boolean }) {
      return (
        <HoverTip tip="parent says so" show={show}>
          <span>badge</span>
        </HoverTip>
      );
    }
    const { rerender } = render(<Controlled show={false} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    rerender(<Controlled show />);
    // Anchor measurement runs in an effect; flush it.
    rerender(<Controlled show />);
    expect(screen.getByRole('tooltip')).toHaveTextContent('parent says so');

    rerender(<Controlled show={false} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
