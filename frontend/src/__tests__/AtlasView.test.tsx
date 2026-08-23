import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/lib/landmarkGuideContent', () => ({
  fetchLandmarkGuide: jest.fn(),
}));

jest.mock('@/components/DoctrineExplorerView', () => {
  const MockDoctrineExplorer = () => <div>DOCTRINE MAP PANE</div>;
  MockDoctrineExplorer.displayName = 'MockDoctrineExplorerView';
  return MockDoctrineExplorer;
});

jest.mock('@/components/LandmarkGuideSection', () => {
  const MockGuide = () => <div>LANDMARK GUIDE PANE</div>;
  MockGuide.displayName = 'MockLandmarkGuideSection';
  return MockGuide;
});

import AtlasView from '@/components/AtlasView';

describe('AtlasView', () => {
  it('renders the doctrine map by default with both tabs available', () => {
    render(<AtlasView user={null} onNavigate={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Doctrine Map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Case Guide' })).toBeInTheDocument();
    expect(screen.getByText('DOCTRINE MAP PANE')).toBeInTheDocument();
    expect(screen.queryByText('LANDMARK GUIDE PANE')).not.toBeInTheDocument();
  });

  it('starts on the guide when initialTab is guide', () => {
    render(<AtlasView user={null} onNavigate={jest.fn()} initialTab="guide" />);

    expect(screen.getByText('LANDMARK GUIDE PANE')).toBeInTheDocument();
    expect(screen.queryByText('DOCTRINE MAP PANE')).not.toBeInTheDocument();
  });

  it('switches to the case guide tab and reports the change', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(<AtlasView user={null} onNavigate={jest.fn()} onTabChange={onTabChange} />);

    await user.click(screen.getByRole('button', { name: 'Case Guide' }));

    expect(await screen.findByText('LANDMARK GUIDE PANE')).toBeInTheDocument();
    expect(screen.queryByText('DOCTRINE MAP PANE')).not.toBeInTheDocument();
    expect(onTabChange).toHaveBeenCalledWith('guide');
  });

  it('switches back to the doctrine map tab', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    render(
      <AtlasView user={null} onNavigate={jest.fn()} initialTab="guide" onTabChange={onTabChange} />
    );

    await user.click(screen.getByRole('button', { name: 'Doctrine Map' }));

    expect(await screen.findByText('DOCTRINE MAP PANE')).toBeInTheDocument();
    expect(screen.queryByText('LANDMARK GUIDE PANE')).not.toBeInTheDocument();
    expect(onTabChange).toHaveBeenCalledWith('map');
  });
});
